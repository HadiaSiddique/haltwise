import { chat } from '../llm.ts'
import { db } from '../db.ts'
import { gate } from '../policy.ts'
import { getCase, updateCase } from '../cases.ts'
import { recentTrace, recentAudit, type Run } from '../trace.ts'
import { asData } from '../redact.ts'

interface CreditRow {
  id: string
  account: string
  sender_hash: string
  sender_label: string
  amount: number
  currency: string
  reference: string
  ts: number
  out_ts: number | null
  out_amount: number | null
  out_dest: string | null
}

/**
 * Mule-pattern analysis for the RECEIVING bank (code, not AI): many unrelated senders,
 * fast pass-through, money leaving to hard-to-trace destinations.
 */
export function muleCheck(account?: string) {
  const accounts = account ? [account] : (db.prepare("SELECT DISTINCT account FROM credits WHERE account LIKE 'RCV-%'").all() as { account: string }[]).map(r => r.account)
  return accounts.map(acc => {
    const rows = db.prepare('SELECT * FROM credits WHERE account = ? ORDER BY ts').all(acc) as unknown as CreditRow[]
    const senders = new Set(rows.map(r => r.sender_hash)).size
    const inTotal = rows.reduce((s, r) => s + r.amount, 0)
    const outTotal = rows.reduce((s, r) => s + (r.out_amount ?? 0), 0)
    const dwell = rows.filter(r => r.out_ts).map(r => (r.out_ts! - r.ts) / 60000).sort((a, b) => a - b)
    const medianDwell = dwell.length ? dwell[Math.floor(dwell.length / 2)] : null
    const span = rows.length ? (rows[rows.length - 1].ts - rows[0].ts) / 3600000 : 0
    const passThrough = inTotal ? outTotal / inTotal : 0
    const signals: string[] = []
    let score = 0
    if (senders >= 8 && span <= 6) (score += 35), signals.push(`${senders} unrelated senders in ${span.toFixed(1)}h`)
    else if (senders >= 5) (score += 15), signals.push(`${senders} distinct senders`)
    if (passThrough >= 0.8) (score += 35), signals.push(`${Math.round(passThrough * 100)}% of incoming money already sent on`)
    else if (passThrough >= 0.4) (score += 15), signals.push(`${Math.round(passThrough * 100)}% passed through`)
    if (medianDwell !== null && medianDwell <= 60) (score += 20), signals.push(`median ${Math.round(medianDwell)} min before money leaves`)
    if (rows.some(r => /crypto/i.test(r.out_dest ?? ''))) (score += 10), signals.push('outflows to a crypto exchange')
    if (rows.some(r => /safe account|security/i.test(r.reference))) (score += 10), signals.push('payment references mention "safe account"/"security"')
    return {
      account: acc,
      credits: rows.length,
      senders,
      inTotal: Math.round(inTotal),
      outTotal: Math.round(outTotal),
      currency: rows[0]?.currency ?? 'GBP',
      passThrough: Math.round(passThrough * 100) / 100,
      medianDwellMin: medianDwell === null ? null : Math.round(medianDwell),
      score: Math.min(100, score),
      flag: score >= 70 ? 'likely_mule' : score >= 40 ? 'watch' : 'normal',
      signals,
      rows: rows.map(r => ({ id: r.id, sender: r.sender_label, amount: r.amount, ts: r.ts, outTs: r.out_ts, outAmount: r.out_amount, outDest: r.out_dest, reference: r.reference })),
    }
  })
}

/** Audit-grade case file written by Nemotron 3 Ultra (falls back to Super, then to a deterministic file). */
export async function investigate(run: Run, caseId: string) {
  const c = getCase(caseId)
  if (!c) return { error: 'case not found' }
  updateCase(caseId, { status: c.status === 'held' ? 'held' : 'investigating', event: 'Investigator started' })
  const tx = c.data.transferId ? db.prepare('SELECT * FROM transfers WHERE id = ?').get(c.data.transferId) : undefined
  const linked = c.data.linkedAccount ? muleCheck(c.data.linkedAccount)[0] : undefined
  const trace = recentTrace(60, c.data.session ? { session: c.data.session } : { caseId }).reverse()
  const audits = (recentAudit(60, c.data.session) as Record<string, unknown>[]).reverse()
  run.log('investigator', 'evidence gathered', { status: 'info', detail: { traceSteps: trace.length, auditEntries: audits.length, linkedAccount: linked?.account ?? null } })
  if (linked && linked.flag !== 'normal') {
    gate(run.session, 'investigator', 'flag_account', linked.account)
    run.log('investigator', `receiving account ${linked.account} flagged: ${linked.flag}`, { status: 'blocked', detail: { score: linked.score, signals: linked.signals } })
  }

  const evidence = {
    case: { id: c.id, kind: c.kind, status: c.status, risk: c.risk, title: c.title, country: c.country, opened: new Date(c.createdAt).toISOString(), facts: c.data.facts, factors: c.data.factors, payeeCheck: c.data.payeeCheck, riskyAnswers: c.data.riskyAnswers, timeline: c.data.timeline },
    transfer: tx,
    linkedReceivingAccount: linked ? { ...linked, rows: linked.rows.slice(0, 15) } : null,
    agentTrace: trace.map(t => ({ t: new Date(t.ts as number).toISOString(), agent: t.agent, step: t.step, model: t.model, status: t.status })),
    policyAudit: audits.map(a => ({ t: new Date(a.ts as number).toISOString(), actor: a.actor, action: a.action, result: a.result, reason: a.reason })),
  }
  const res = await chat({
    role: 'ultra',
    maxTokens: 4000,
    system: `You are Investigator, writing an audit-grade fraud case file for a bank's fraud team and, if needed, a regulator.
Use ONLY the evidence given; mark anything uncertain as "unverified". All data is simulated demo data and pseudonymised.
Reply JSON only:
{"executive_summary": "...",
 "timeline": [{"time": "ISO", "event": "..."}],
 "evidence": ["..."],
 "red_flags": ["..."],
 "linked_accounts": [{"account": "...", "role": "sending|receiving|mule_suspect", "why": "..."}],
 "mule_assessment": "<receiving-side view: is the beneficiary account behaving like a money mule?>",
 "ai_actions_and_limits": "<what the AI agents did, and what the policy gate refused>",
 "recommended_actions": ["<only: hold, block, flag, notify receiving bank, report to authorities, contact customer via verified channel>"],
 "liability_note": "<one neutral sentence: under UK APP reimbursement rules sending and receiving PSPs share liability; say 'check local rules' for other countries>"}`,
    user: asData('case_evidence', JSON.stringify(evidence)),
    json: true,
  })
  run.log('investigator', res.ok ? 'case file written' : 'model unavailable, deterministic case file', {
    model: res.model,
    ms: res.ms,
    status: res.ok ? (res.role === 'ultra' ? 'ok' : 'fallback') : 'fallback',
    detail: res.ok ? { role: res.role, tokens: res.usage?.completion_tokens, failed: res.failed } : { error: res.error, failed: res.failed },
  })
  gate(run.session, 'investigator', 'draft_report', caseId)
  const caseFile = res.ok
    ? { ...res.json, model: res.model, generatedAt: Date.now() }
    : {
        executive_summary: `${c.title}. Risk ${c.risk}/100. ${linked ? `Beneficiary ${linked.account}: ${linked.signals.join('; ')}.` : ''}`,
        timeline: (c.data.timeline ?? []).map((x: { ts: number; event: string }) => ({ time: new Date(x.ts).toISOString(), event: x.event })),
        evidence: (c.data.factors ?? []).map((f: { label: string }) => f.label),
        red_flags: linked?.signals ?? [],
        linked_accounts: linked ? [{ account: linked.account, role: 'mule_suspect', why: linked.signals.join('; ') }] : [],
        mule_assessment: linked ? `${linked.flag} (score ${linked.score})` : 'No linked receiving account.',
        ai_actions_and_limits: audits.map(a => `${a.actor}:${a.action}=${a.result}`).join(', '),
        recommended_actions: ['Keep hold in place', 'Contact customer on verified number', 'Notify receiving bank'],
        liability_note: 'UK APP reimbursement: sending and receiving PSPs share liability. Check local rules elsewhere.',
        model: 'deterministic',
        generatedAt: Date.now(),
      }
  const updated = updateCase(caseId, { event: `Case file written (${caseFile.model})`, data: { caseFile, mule: linked ? { account: linked.account, score: linked.score, flag: linked.flag, signals: linked.signals } : undefined } })
  return { caseFile, mule: linked, case: updated }
}
