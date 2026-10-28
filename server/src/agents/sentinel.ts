import { chat } from '../llm.ts'
import { langName } from '../config.ts'
import { db, newId } from '../db.ts'
import { PAYEE_DIRECTORY, RAILS, CUSTOMER, type RailId } from '../seed.ts'
import { mask, redact, asData } from '../redact.ts'
import { ruleScore } from '../rules.ts'
import { t } from '../i18n.ts'
import { gate } from '../policy.ts'
import { createCase, updateCase } from '../cases.ts'
import { calls } from './callguard.ts'
import type { Run } from '../trace.ts'

export interface TransferInput {
  rail: RailId
  payeeName: string
  account: string
  amount: number
  reference?: string
  lang: string
  callId?: string
  guardianMode?: boolean
}

export type PayeeCheck = { result: 'match' | 'close_match' | 'no_match' | 'unavailable'; registeredName?: string; scheme: string; similarity?: number }

const LEGAL = /\b(llc|ltd|limited|inc|gmbh|plc|sa|sl|pvt|co)\b\.?/gi
const normName = (s: string) => s.toLowerCase().replace(LEGAL, '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim()

function similarity(a: string, b: string) {
  const x = normName(a)
  const y = normName(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)])
  for (let j = 1; j <= y.length; j++) d[0][j] = j
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length)
}

const normAcct = (s: string) => s.replace(/\s/g, '').toLowerCase()

/** Simulated Verification of Payee / Confirmation of Payee against the demo directory. */
export function payeeCheck(rail: RailId, account: string, name: string): PayeeCheck & { entry?: (typeof PAYEE_DIRECTORY)[number] } {
  const entry = PAYEE_DIRECTORY.find(p => p.rail === rail && normAcct(p.account) === normAcct(account))
  const scheme = RAILS[rail].check
  if (!entry) return { result: 'unavailable', scheme }
  const sim = similarity(name, entry.registeredName)
  const result = sim >= 0.95 ? 'match' : sim >= 0.7 ? 'close_match' : 'no_match'
  return { result, registeredName: result === 'match' ? entry.registeredName : entry.registeredName, scheme, similarity: Math.round(sim * 100) / 100, entry }
}

export interface Assessment {
  transferId: string
  caseId?: string
  decision: 'release' | 'verify' | 'hold' | 'guardian'
  risk: number
  factors: { id: string; label: string; points: number }[]
  payeeCheck: PayeeCheck
  questions: { id: string; text: string; riskyAnswer: 'yes' | 'no' }[]
  payeeExplanation: string
  scamPattern: string
  message: string
  model: string
}

export async function assessTransfer(run: Run, input: TransferInput): Promise<Assessment> {
  const rail = RAILS[input.rail]
  const vop = payeeCheck(input.rail, input.account, input.payeeName)
  const call = input.callId ? calls.get(input.callId) : undefined
  const ratio = input.amount / rail.typical
  const refRules = ruleScore(input.reference ?? '')
  const factors: Assessment['factors'] = []
  const add = (id: string, label: string, points: number) => factors.push({ id, label, points })

  if (!vop.entry?.saved) add('new_payee', 'New payee', 15)
  if (ratio >= 10) add('amount', `Amount is ${ratio.toFixed(0)}x this customer's usual ${rail.currency} payment`, 25)
  else if (ratio >= 3) add('amount', `Amount is ${ratio.toFixed(1)}x usual`, 15)
  if (call) {
    add('on_call', 'Customer is on a phone call right now', 20)
    if (call.claimsBank && !call.matched) add('unmatched_call', 'Caller claims to be the bank but no signed bank notice exists (Call-Match)', 15)
    if (call.tactics.has('safe_account')) add('call_safe_account', 'Live Call Guard heard "safe account" language', 25)
    else if (call.tactics.size) add('call_tactics', `Live Call Guard heard: ${[...call.tactics.keys()].join(', ')}`, 10)
  }
  if (vop.entry?.crossBankReports) add('reported_payee', `Payee account reported by ${vop.entry.crossBankReports} other banks (hashed signal)`, 30)
  if (vop.result === 'close_match') add('vop_close', `${vop.scheme}: close match`, 15)
  if (vop.result === 'no_match') add('vop_no', `${vop.scheme}: no match`, 25)
  if (vop.result === 'unavailable') add('vop_unavailable', `${vop.scheme} unavailable for this account`, 10)
  if (refRules.hits.some(h => ['urgency', 'safe_account', 'secrecy'].includes(h.tactic))) add('reference_language', `Reference uses pressure words: "${refRules.hits.map(h => h.quote).join('", "')}"`, 10)
  add('instant_rail', `${rail.label} is instant and hard to reverse`, 5)

  const risk = Math.min(100, factors.reduce((s, f) => s + f.points, 0))
  let decision: Assessment['decision'] = risk >= 65 ? 'hold' : risk >= 30 ? 'verify' : 'release'
  if (input.guardianMode && decision !== 'hold' && (ratio >= 3 || risk >= 30)) decision = 'guardian'

  run.log('sentinel', 'transfer scored', {
    status: 'info',
    detail: { risk, decision, factors: factors.map(f => `${f.id}+${f.points}`), payeeCheck: vop.result, payee: mask(input.account) },
  })

  let questions: Assessment['questions'] = []
  let payeeExplanation = ''
  let scamPattern = ''
  let message = ''
  let model = 'rules'
  if (decision !== 'release') {
    const res = await chat({
      role: 'super',
      maxTokens: 900,
      system: `You are Sentinel, the payment-protection agent of a bank. You can only PAUSE or HOLD payments; you can never send money.
Write for the customer in ${langName(input.lang)}, warm and plain, no jargon, no blame.
Reply JSON only:
{"message": "<1-2 sentences: why we paused, reassure that no money has left>",
 "questions": [{"id": "q1", "text": "<yes/no question>", "risky_answer": "yes"|"no"}, ...2 or 3 items, tailored to the risk factors],
 "payee_explanation": "<if payee check is close_match or no_match: 2 sentences on what it means and why it matters; else empty>",
 "scam_pattern": "<1-2 sentences: what this kind of scam usually looks like>"}`,
      user: asData(
        'transfer_context',
        JSON.stringify({
          rail: rail.label,
          country: rail.country,
          amount: `${input.amount} ${rail.currency}`,
          usual_amount: `${rail.typical} ${rail.currency}`,
          payee: vop.entry?.code ?? 'UNKNOWN_PAYEE',
          payee_name_typed_by_customer: redact(input.payeeName),
          payee_check: { scheme: vop.scheme, result: vop.result, registered_name: vop.result === 'match' ? 'same' : vop.registeredName ? 'different person/company' : 'n/a' },
          reference: redact(input.reference ?? ''),
          risk_factors: factors.map(f => f.label),
          decision,
        }),
      ),
      json: true,
    })
    if (res.ok && Array.isArray(res.json?.questions) && res.json.questions.length) {
      model = res.model
      questions = res.json.questions.slice(0, 3).map((q: any, i: number) => ({ id: `q${i + 1}`, text: String(q.text), riskyAnswer: q.risky_answer === 'no' ? 'no' : 'yes' }))
      payeeExplanation = String(res.json.payee_explanation ?? '')
      scamPattern = String(res.json.scam_pattern ?? '')
      message = String(res.json.message ?? '')
    }
    run.log('sentinel', res.ok ? 'pause-and-verify questions written' : 'model unavailable, template questions', {
      model: res.model,
      ms: res.ms,
      status: res.ok ? 'ok' : 'fallback',
      detail: res.ok ? { questions: questions.length } : { error: res.error },
    })
  }
  if (decision !== 'release' && !questions.length) {
    questions = [
      { id: 'q1', text: t('q1', input.lang), riskyAnswer: 'yes' },
      { id: 'q2', text: t('q2', input.lang), riskyAnswer: 'yes' },
      { id: 'q3', text: t('q3', input.lang), riskyAnswer: 'no' },
    ]
    message = t('hold', input.lang)
  }
  if (!payeeExplanation && vop.result === 'close_match') payeeExplanation = t('vopClose', input.lang, { registered: vop.registeredName ?? '' })
  if (!payeeExplanation && vop.result === 'no_match') payeeExplanation = t('vopNo', input.lang)

  const transferId = newId('TX')
  const status = decision === 'release' ? 'released' : decision === 'verify' ? 'verify' : decision === 'guardian' ? 'guardian' : 'held'
  if (decision === 'hold') gate(run.session, 'sentinel', 'hold_transfer', transferId)
  if (decision === 'verify') gate(run.session, 'sentinel', 'request_verification', transferId)
  if (decision === 'hold') gate(run.session, 'sentinel', 'offer_verified_callback', transferId)
  if (vop.entry?.crossBankReports) gate(run.session, 'sentinel', 'flag_payee', vop.entry.code)

  let caseId: string | undefined
  if (decision === 'hold' || decision === 'guardian') {
    caseId = createCase({
      kind: 'transfer_hold',
      status: decision === 'hold' ? 'held' : 'open',
      risk,
      title: `${decision === 'hold' ? 'Held' : 'Guardian approval'}: ${input.amount.toLocaleString()} ${rail.currency} via ${rail.label} to ${mask(input.account)}`,
      lang: input.lang,
      country: rail.country,
      data: { transferId, factors, payeeCheck: { ...vop, entry: undefined }, payeeCode: vop.entry?.code, linkedAccount: vop.entry?.code === 'PAYEE_M1' ? 'RCV-7781' : undefined, session: run.session },
    }).id
    run.caseId = caseId
  }
  db.prepare('INSERT INTO transfers (id, case_id, session, status, rail, amount, currency, payee_code, payee_masked, risk, decision, data, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    transferId, caseId ?? null, run.session, status, input.rail, input.amount, rail.currency, vop.entry?.code ?? 'UNKNOWN', mask(input.account), risk, decision,
    JSON.stringify({ factors, questions, payeeCheck: { ...vop, entry: undefined }, reference: input.reference ?? '', lang: input.lang, verified: false }),
    Date.now(),
  )
  if (decision === 'release') run.log('sentinel', 'low risk: released (simulated payment sent)', { status: 'ok', detail: { transferId } })

  return {
    transferId,
    caseId,
    decision,
    risk,
    factors,
    payeeCheck: { result: vop.result, registeredName: vop.registeredName, scheme: vop.scheme, similarity: vop.similarity },
    questions: decision === 'release' ? [] : questions,
    payeeExplanation,
    scamPattern,
    message,
    model,
  }
}

export function getTransfer(id: string): Record<string, any> | undefined {
  const r = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id) as Record<string, any> | undefined
  return r ? { ...r, data: JSON.parse(r.data ?? '{}') } : undefined
}

export function setTransfer(id: string, status: string, dataPatch: Record<string, unknown> = {}) {
  const tx = getTransfer(id)
  if (!tx) return
  db.prepare('UPDATE transfers SET status = ?, data = ? WHERE id = ?').run(status, JSON.stringify({ ...tx.data, ...dataPatch }), id)
}

/** Customer answers the pause-and-verify questions. Any risky answer escalates to a hold. */
export function answerVerification(run: Run, id: string, answers: Record<string, 'yes' | 'no'>, lang: string) {
  const tx = getTransfer(id)
  if (!tx) return { error: 'not found' }
  const risky = (tx.data.questions as Assessment['questions']).filter(q => answers[q.id] === q.riskyAnswer)
  if (risky.length) {
    gate(run.session, 'sentinel', 'hold_transfer', id)
    gate(run.session, 'sentinel', 'offer_verified_callback', id)
    setTransfer(id, 'held', { answers, verified: false })
    const c = createCase({
      kind: 'transfer_hold',
      status: 'held',
      risk: Math.min(100, tx.risk + 25),
      title: `Held after verification: ${tx.amount.toLocaleString()} ${tx.currency} to ${tx.payee_masked}`,
      lang,
      country: RAILS[tx.rail as RailId].country,
      data: { transferId: id, factors: tx.data.factors, payeeCheck: tx.data.payeeCheck, riskyAnswers: risky.map(q => q.text), session: run.session, payeeCode: tx.payee_code, linkedAccount: tx.payee_code === 'PAYEE_M1' ? 'RCV-7781' : undefined },
    })
    db.prepare('UPDATE transfers SET case_id = ? WHERE id = ?').run(c.id, id)
    run.log('sentinel', 'risky answers: escalated to hold', { status: 'blocked', caseId: c.id, detail: { risky: risky.length } })
    return { status: 'held', caseId: c.id, message: t('hold', lang) }
  }
  setTransfer(id, 'verify', { answers, verified: true })
  run.log('sentinel', 'answers clean: customer may confirm', { status: 'ok' })
  return { status: 'verified' }
}

/** Only the customer (after clean verification) can release a paused transfer. The AI cannot. */
export function customerConfirm(run: Run, id: string) {
  const tx = getTransfer(id)
  if (!tx) return { error: 'not found' }
  const g = gate(run.session, 'customer', 'release_transfer', id, { status: tx.data.verified ? tx.status : 'unverified' })
  if (!g.allowed) return { status: tx.status, blocked: g.reason }
  setTransfer(id, 'released', { releasedBy: 'customer' })
  run.log('sentinel', 'customer confirmed: released (simulated)', { status: 'ok' })
  return { status: 'released' }
}

export function officerDecision(run: Run, id: string, action: 'release' | 'reject') {
  const tx = getTransfer(id)
  if (!tx) return { error: 'not found' }
  const actor = tx.status === 'guardian' ? 'guardian' : 'officer'
  const tool = action === 'release' ? (actor === 'guardian' ? 'guardian_approve' : 'release_hold') : 'reject_transfer'
  const g = gate(run.session, actor, tool, id, { status: tx.status })
  if (!g.allowed) return { status: tx.status, blocked: g.reason }
  setTransfer(id, action === 'release' ? 'released' : 'rejected', { decidedBy: actor })
  if (tx.case_id) updateCase(tx.case_id, { status: action === 'release' ? 'released' : 'rejected', event: `${actor === 'guardian' ? 'Guardian' : 'Bank officer'} ${action === 'release' ? 'released' : 'rejected'} the transfer` })
  return { status: action === 'release' ? 'released' : 'rejected' }
}

export const customerSummary = () => ({ ...CUSTOMER })
