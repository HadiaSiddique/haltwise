/**
 * ALL BANK DATA HERE IS SIMULATED DEMO DATA. No real customers, accounts or banks.
 * Account numbers are fictional; the UI only ever shows the last 4 digits.
 */
import { createHmac } from 'node:crypto'
import { db } from './db.ts'
import { config } from './config.ts'

export const CUSTOMER = {
  code: 'CUST_1',
  name: 'Maria Lopez',
  accountMasked: '****4821',
  phoneMasked: '+1 ***-***-0142',
  memberSince: 2014,
}

export type RailId = 'zelle' | 'fps' | 'sepa' | 'upi' | 'raast' | 'mpesa'

export const RAILS: Record<RailId, { label: string; country: string; currency: string; payeeField: string; check: string; typical: number; balance: number }> = {
  zelle: { label: 'Zelle', country: 'US', currency: 'USD', payeeField: 'Email or US mobile', check: 'Zelle registered name', typical: 250, balance: 12480.55 },
  fps: { label: 'Faster Payments', country: 'GB', currency: 'GBP', payeeField: 'Sort code + account number', check: 'Confirmation of Payee', typical: 220, balance: 9870.2 },
  sepa: { label: 'SEPA Instant', country: 'EU', currency: 'EUR', payeeField: 'IBAN', check: 'Verification of Payee', typical: 260, balance: 11240.0 },
  upi: { label: 'UPI', country: 'IN', currency: 'INR', payeeField: 'UPI ID', check: 'UPI registered name', typical: 6000, balance: 845300 },
  raast: { label: 'Raast', country: 'PK', currency: 'PKR', payeeField: 'IBAN or Raast ID (mobile)', check: 'Raast account title', typical: 35000, balance: 2450000 },
  mpesa: { label: 'M-Pesa', country: 'KE', currency: 'KES', payeeField: 'M-Pesa number', check: 'M-Pesa registered name', typical: 4000, balance: 640000 },
}

export interface DirectoryEntry {
  code: string
  rail: RailId
  account: string
  registeredName: string
  crossBankReports: number
  saved?: boolean
}

/** Simulated payee-name directory used for Verification/Confirmation of Payee. */
export const PAYEE_DIRECTORY: DirectoryEntry[] = [
  // The "safe account": opened by a mule with a name one letter away from the victim's.
  { code: 'PAYEE_M1', rail: 'zelle', account: 'safe.mlopes.7781@mailbox.example', registeredName: 'Mariah Lopes', crossBankReports: 3 },
  { code: 'PAYEE_M1', rail: 'fps', account: '20-45-77 31927781', registeredName: 'Mariah Lopes', crossBankReports: 3 },
  { code: 'PAYEE_M1', rail: 'sepa', account: 'ES12 0049 1500 0512 3456 7781', registeredName: 'Mariah Lopes', crossBankReports: 3 },
  { code: 'PAYEE_M1', rail: 'upi', account: 'mlopes7781@okdemo', registeredName: 'Mariah Lopes', crossBankReports: 3 },
  { code: 'PAYEE_M1', rail: 'raast', account: 'PK36 DEMO 0000 0012 3456 7781', registeredName: 'Mariah Lopes', crossBankReports: 3 },
  { code: 'PAYEE_M1', rail: 'mpesa', account: '+254 700 457 781', registeredName: 'Mariah Lopes', crossBankReports: 3 },
  // A genuine, saved payee (rent).
  { code: 'PAYEE_A', rail: 'zelle', account: 'ana.garcia@mailbox.example', registeredName: 'Ana Garcia', crossBankReports: 0, saved: true },
  { code: 'PAYEE_A', rail: 'fps', account: '40-11-22 55501332', registeredName: 'Ana Garcia', crossBankReports: 0, saved: true },
  { code: 'PAYEE_A', rail: 'sepa', account: 'ES91 2100 0418 4502 0005 1332', registeredName: 'Ana Garcia', crossBankReports: 0, saved: true },
  { code: 'PAYEE_A', rail: 'upi', account: 'anagarcia@okdemo', registeredName: 'Ana Garcia', crossBankReports: 0, saved: true },
  { code: 'PAYEE_A', rail: 'raast', account: 'PK70 DEMO 0000 0098 7650 1332', registeredName: 'Ana Garcia', crossBankReports: 0, saved: true },
  { code: 'PAYEE_A', rail: 'mpesa', account: '+254 711 501 332', registeredName: 'Ana Garcia', crossBankReports: 0, saved: true },
  // A new but legitimate payee (a plumber), to show a new payee alone is not a hold.
  { code: 'PAYEE_B', rail: 'zelle', account: 'quickfix.plumbing@mailbox.example', registeredName: 'QuickFix Plumbing LLC', crossBankReports: 0 },
  { code: 'PAYEE_B', rail: 'fps', account: '30-90-12 77120456', registeredName: 'QuickFix Plumbing Ltd', crossBankReports: 0 },
  { code: 'PAYEE_B', rail: 'sepa', account: 'DE44 5001 0517 5407 3249 0456', registeredName: 'QuickFix Sanitär GmbH', crossBankReports: 0 },
  { code: 'PAYEE_B', rail: 'upi', account: 'quickfix@okdemo', registeredName: 'QuickFix Plumbing', crossBankReports: 0 },
  { code: 'PAYEE_B', rail: 'raast', account: 'PK11 DEMO 0000 0044 5566 0456', registeredName: 'QuickFix Plumbing', crossBankReports: 0 },
  { code: 'PAYEE_B', rail: 'mpesa', account: '+254 722 120 456', registeredName: 'QuickFix Plumbing', crossBankReports: 0 },
]

export const DEMO_SCENARIOS = {
  safeAccount: { payeeName: 'Maria Lopez', payeeCode: 'PAYEE_M1', amountFactor: 19, reference: 'Move savings to safe account - urgent' },
  rent: { payeeName: 'Ana Garcia', payeeCode: 'PAYEE_A', amountFactor: 3.6, reference: 'Rent November' },
  plumber: { payeeName: 'QuickFix Plumbing', payeeCode: 'PAYEE_B', amountFactor: 1.2, reference: 'Invoice 4471' },
}

export const signNotice = (id: string, text: string, from: number, to: number) =>
  createHmac('sha256', config.signingSecret).update(`${id}|${CUSTOMER.code}|${text}|${from}|${to}`).digest('hex').slice(0, 32)

const MIN = 60_000
const HOUR = 60 * MIN

function rand(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

export function seed(force = false) {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM reports').get() as { n: number }).n
  if (count > 0 && !force) return
  for (const t of ['cases', 'transfers', 'trace', 'audit', 'reports', 'notices', 'credits']) db.exec(`DELETE FROM ${t}`)
  const now = Date.now()
  const r = rand(42)
  const insReport = db.prepare('INSERT INTO reports (channel, category, text, country, indicator, ts) VALUES (?,?,?,?,?,?)')

  // Campaign 1: fake toll-fee texts, 37 reports in ~2 hours (US).
  const states = ['E-ZPass', 'SunPass', 'FasTrak', 'TxTag', 'Toll Services']
  for (let i = 0; i < 37; i++) {
    const cents = 10 + Math.floor(r() * 89)
    const host = `${['ezpass', 'sunpass', 'tollpay', 'txtag'][i % 4]}-${['pay', 'due', 'svc'][i % 3]}${Math.floor(r() * 90 + 10)}.top`
    insReport.run('sms', 'delivery_toll', `${states[i % 5]}: You have an unpaid toll of $4.${cents}. Pay within 24 hours to avoid a $50 late fee: https://${host}/pay`, 'US', host, now - Math.floor(r() * 2 * HOUR))
  }
  // Campaign 2: parcel redelivery fee texts (UK), 14 in ~3 hours.
  for (let i = 0; i < 14; i++) {
    const host = `parcel-redeliver${Math.floor(r() * 900 + 100)}.icu`
    insReport.run('sms', 'delivery_toll', `Your parcel is on hold due to an unpaid customs fee of £1.${45 + i}. Rebook delivery: https://${host}`, 'GB', host, now - Math.floor(r() * 3 * HOUR))
  }
  // Campaign 3: "bank fraud team" safe-account calls, 11 in ~5 hours.
  const callTexts = [
    'Caller said they were from my bank fraud team and told me to move my savings to a safe account today',
    'Man claiming to be bank security said my account was compromised and to transfer everything to a new secure account',
    'They knew my name and last card digits, said police were involved and not to tell branch staff why I was moving money',
    'Llamada del supuesto departamento de fraude del banco pidiendo mover el dinero a una cuenta segura',
  ]
  for (let i = 0; i < 11; i++) insReport.run('call', 'safe_account', callTexts[i % 4], i % 4 === 3 ? 'ES' : i % 2 ? 'GB' : 'US', 'unknown-caller', now - Math.floor(r() * 5 * HOUR))
  // Campaign 4: task-based job scam (India), 8 in ~6 hours.
  for (let i = 0; i < 8; i++)
    insReport.run('whatsapp', 'job', `Part time job: earn ₹${3000 + i * 250} per day by rating products. Small deposit needed to unlock tasks. Contact on WhatsApp`, 'IN', 'whatsapp-recruiter', now - Math.floor(r() * 6 * HOUR))
  // Campaign 5: fake "KYC update" texts (India / Pakistan), 7.
  for (let i = 0; i < 7; i++)
    insReport.run('sms', 'bank_impersonation', `Dear customer your account will be blocked today. Update KYC immediately: http://kyc-update${i}.xyz`, i % 2 ? 'PK' : 'IN', `kyc-update${i}.xyz`, now - Math.floor(r() * 4 * HOUR))
  // Background noise: unrelated single reports.
  const noise = [
    ['email', 'prize_lottery', 'Congratulations! You have won a $1,000 gift card. Claim your prize now'],
    ['sms', 'investment_crypto', 'Guaranteed 40% return in 7 days with our AI crypto trading platform'],
    ['call', 'tech_support', 'Pop-up said my computer was infected and to call Microsoft support, then asked me to install AnyDesk'],
    ['social', 'romance', 'Met online, says he is stuck at the airport abroad and needs money for customs fees'],
    ['sms', 'government_impersonation', 'Tax office: you are owed a refund, confirm your card details to receive it'],
  ]
  for (let i = 0; i < 9; i++) {
    const [ch, cat, text] = noise[i % noise.length]
    insReport.run(ch, cat, text, ['US', 'GB', 'IN', 'KE', 'PK'][i % 5], 'n/a', now - Math.floor(r() * 24 * HOUR))
  }

  // Incoming credits at accounts where we are the RECEIVING bank (mule check).
  const insCredit = db.prepare('INSERT INTO credits (id, account, sender_hash, sender_label, amount, currency, reference, ts, out_ts, out_amount, out_dest) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  // RCV-7781: opened 9 days ago; 14 unrelated senders in 3 hours; ~92% forwarded to a crypto exchange within minutes.
  for (let i = 0; i < 14; i++) {
    const ts = now - Math.floor(r() * 3 * HOUR)
    const amt = Math.round(400 + r() * 4500)
    const fwd = r() < 0.93
    insCredit.run(`CR-M${i}`, 'RCV-7781', `snd_${Math.floor(r() * 1e8).toString(16)}`, `Sender ${String.fromCharCode(65 + i)} (other bank)`, amt, 'GBP', ['safe account', 'savings move', 'transfer', 'security'][i % 4], ts, fwd ? ts + Math.floor((4 + r() * 20) * MIN) : null, fwd ? Math.round(amt * (0.95 + r() * 0.04)) : null, fwd ? 'Crypto exchange (offshore)' : null)
  }
  // RCV-2210: a bakery. Many senders but repeat customers, money stays.
  for (let i = 0; i < 20; i++) {
    const ts = now - Math.floor(r() * 24 * HOUR)
    insCredit.run(`CR-B${i}`, 'RCV-2210', `snd_bakery_${i % 6}`, `Customer ${(i % 6) + 1}`, Math.round(8 + r() * 60), 'GBP', 'Order', ts, null, null, null)
  }
  // RCV-5530: ambiguous. A few senders, half moved on to a personal account a day later.
  for (let i = 0; i < 5; i++) {
    const ts = now - Math.floor(r() * 20 * HOUR)
    const fwd = i % 2 === 0
    insCredit.run(`CR-A${i}`, 'RCV-5530', `snd_amb_${i}`, `Sender ${i + 1}`, Math.round(150 + r() * 600), 'GBP', 'rent share', ts, fwd ? ts + 22 * HOUR : null, fwd ? 300 : null, fwd ? 'Own account, other bank' : null)
  }
  // The demo customer's own incoming credits (payment-receipt check).
  insCredit.run('CR-C1', CUSTOMER.code, 'snd_jsmith', 'J. Smith', 250, 'USD', 'INV-2291', now - 26 * HOUR, null, null, null)
  insCredit.run('CR-C2', CUSTOMER.code, 'snd_employer', 'Employer payroll', 3200, 'USD', 'PAYROLL OCT', now - 3 * 24 * HOUR, null, null, null)
  insCredit.run('CR-C3', CUSTOMER.code, 'snd_ana', 'Ana Garcia', 45.5, 'USD', 'Dinner split', now - 5 * HOUR, null, null, null)

  // Genuine bank notices (Call-Match): only a call scheduled for TOMORROW exists, so any "bank call" right now is unmatched.
  const from = now + 22 * HOUR
  const to = from + 2 * HOUR
  const text = 'We will call you about your card renewal. We will never ask you to move money.'
  db.prepare('INSERT INTO notices (id, customer, kind, text, sig, valid_from, valid_to) VALUES (?,?,?,?,?,?,?)').run('NT-1', CUSTOMER.code, 'call', text, signNotice('NT-1', text, from, to), from, to)
  seedSampleCases(now)
  console.log('[seed] demo data loaded (all simulated)')
}

/**
 * A realistic morning in the bank console, so the queue is never empty: each case has its transfer, timeline,
 * agent-trace steps and policy-gate audit rows, exactly as the live agents would have written them.
 * The investigator case file is left for the officer to generate live.
 */
function seedSampleCases(now: number) {
  const insCase = db.prepare('INSERT INTO cases (id, kind, status, risk, title, customer, lang, country, data, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  const insTx = db.prepare('INSERT INTO transfers (id, case_id, session, status, rail, amount, currency, payee_code, payee_masked, risk, decision, data, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const insTrace = db.prepare('INSERT INTO trace (session, case_id, agent, step, model, ms, status, detail, ts) VALUES (?,?,?,?,?,?,?,?,?)')
  const insAudit = db.prepare('INSERT INTO audit (session, actor, action, target, result, reason, ts) VALUES (?,?,?,?,?,?,?)')
  const SUPER = 'nvidia/nemotron-3-super-120b-a12b'
  const NANO = 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B'
  const ago = (m: number) => now - m * MIN
  // Collected first and inserted oldest-first: the console lists trace and audit newest-first by row id.
  const traceRows: [number, string, string | null, string, string, string | null, number | null, string, unknown][] = []
  const auditRows: [number, string, string, string, string, string, string][] = []
  const steps = (session: string, caseId: string | null, rows: [number, string, string, string | null, number | null, string, unknown][]) =>
    rows.forEach(([m, ...rest]) => traceRows.push([ago(m), session, caseId, ...rest]))
  const gateRows = (session: string, rows: [number, string, string, string, string, string][]) => rows.forEach(([m, ...rest]) => auditRows.push([ago(m), session, ...rest]))

  // 1. Held: the classic "bank fraud team" safe-account call (UK, Faster Payments).
  {
    const s = 'sample-safe-account'
    const factors = [
      { id: 'new_payee', label: 'New payee', points: 15 },
      { id: 'amount', label: "Amount is 19x this customer's usual GBP payment", points: 25 },
      { id: 'on_call', label: 'Customer is on a phone call right now', points: 20 },
      { id: 'unmatched_call', label: 'Caller claims to be the bank but no signed bank notice exists (Call-Match)', points: 15 },
      { id: 'call_safe_account', label: 'Live Call Guard heard "safe account" language', points: 25 },
      { id: 'reported_payee', label: 'Payee account reported by 3 other banks (hashed signal)', points: 30 },
      { id: 'vop_close', label: 'Confirmation of Payee: close match', points: 15 },
      { id: 'instant_rail', label: 'Faster Payments is instant and hard to reverse', points: 5 },
    ]
    const payeeCheck = { result: 'close_match', registeredName: 'Mariah Lopes', scheme: 'Confirmation of Payee', similarity: 0.83 }
    insCase.run('HW-SAMPLE-01', 'transfer_hold', 'held', 100, 'Held: 4,180 GBP via Faster Payments to ****7781', CUSTOMER.code, 'en', 'GB',
      JSON.stringify({ transferId: 'TX-SAMPLE-01', factors, payeeCheck, payeeCode: 'PAYEE_M1', linkedAccount: 'RCV-7781', session: s, riskyAnswers: ['Did someone on the phone tell you to move your savings to a "safe account"?'],
        timeline: [{ ts: ago(42), event: 'Case opened' }, { ts: ago(42), event: 'Transfer held by Sentinel (risk 100)' }, { ts: ago(40), event: 'Customer answered "yes" to a risky verification question' }, { ts: ago(39), event: 'Verified callback offered to customer' }] }), ago(42), ago(39))
    insTx.run('TX-SAMPLE-01', 'HW-SAMPLE-01', s, 'held', 'fps', 4180, 'GBP', 'PAYEE_M1', '****7781', 100, 'hold', JSON.stringify({ factors, payeeCheck, reference: 'Move savings - safe account', lang: 'en', verified: false, questions: [] }), ago(42))
    steps(s, 'HW-SAMPLE-01', [
      [45, 'call-match', 'caller claims bank: NO signed notice, likely scam', null, null, 'blocked', { notice: null }],
      [44, 'callguard', 'chunk 2 scored', NANO, 712, 'ok', { level: 3, tactics: ['impersonation', 'urgency', 'safe_account'] }],
      [43, 'callguard', 'chunk 4 scored', NANO, 690, 'ok', { level: 3, tactics: ['impersonation', 'urgency', 'safe_account', 'secrecy'] }],
      [42, 'sentinel', 'transfer scored', null, null, 'info', { risk: 100, decision: 'hold', payeeCheck: 'close_match', payee: '****7781' }],
      [42, 'sentinel', 'pause-and-verify questions written', SUPER, 2104, 'ok', { questions: 3 }],
      [40, 'sentinel', 'risky answers: escalated to hold', null, null, 'blocked', { risky: 1 }],
    ])
    gateRows(s, [
      [44, 'callguard', 'warn_customer', 'CALL-SAMPLE-01', 'ALLOWED', 'on allow-list'],
      [42, 'sentinel', 'hold_transfer', 'TX-SAMPLE-01', 'ALLOWED', 'on allow-list'],
      [42, 'sentinel', 'flag_payee', 'PAYEE_M1', 'ALLOWED', 'on allow-list'],
      [39, 'sentinel', 'offer_verified_callback', 'TX-SAMPLE-01', 'ALLOWED', 'on allow-list'],
    ])
  }

  // 2. Scam already happened: courier "customs fee" text, card details stolen (Spain, reported in Spanish).
  {
    const s = 'sample-courier'
    insCase.run('HW-SAMPLE-02', 'scam_report', 'investigating', 90, 'Scam reported: delivery toll', CUSTOMER.code, 'es', 'ES',
      JSON.stringify({ session: s, report: 'Recibí un SMS de paquetería pidiendo 1,99 € de aduanas. Puse los datos de mi tarjeta y luego vi un cargo de 349 €.',
        facts: { category: 'delivery_toll', money_sent: true, amount: '349 EUR', paid_by: 'card', shared_codes_or_passwords: false, remote_access_installed: false, summary: 'La clienta pagó una tasa de aduanas falsa por SMS y después sufrió un cargo no autorizado de 349 € en su tarjeta.' },
        actions: [{ tool: 'create_case', allowed: true, label: 'Case HW-SAMPLE-02 created' }, { tool: 'freeze_card', allowed: true, label: 'Card frozen (simulated)' }, { tool: 'block_channels', allowed: true, label: 'New payees and outgoing instant payments blocked for 24h (simulated)' }, { tool: 'open_dispute', allowed: true, label: 'Dispute / reimbursement claim opened (simulated)' }],
        channels: [{ name: 'INCIBE - Cómo denunciar si has sido víctima de un fraude', url: 'https://www.incibe.es/ciudadania/ayuda/denuncia' }],
        timeline: [{ ts: ago(118), event: 'Case opened' }, { ts: ago(118), event: 'Card frozen (simulated)' }, { ts: ago(118), event: 'New payees and outgoing instant payments blocked for 24h (simulated)' }, { ts: ago(117), event: 'Dispute / reimbursement claim opened (simulated)' }, { ts: ago(116), event: 'Recovery plan sent to customer' }] }), ago(118), ago(116))
    steps(s, 'HW-SAMPLE-02', [
      [118, 'responder', 'report understood', SUPER, 1310, 'ok', { category: 'delivery_toll', paid_by: 'card', money_sent: true }],
      [118, 'policy-gate', 'unfreeze is officer-only', null, null, 'blocked', { reason: 'unfreeze_card is never available to AI agents (brake-only policy).' }],
      [117, 'intel', 'Tavily: official reporting channels (ES)', 'tavily', 1820, 'ok', { results: 6 }],
      [116, 'responder', 'recovery plan written', SUPER, 1540, 'ok', null],
    ])
    gateRows(s, [
      [118, 'responder', 'freeze_card', 'HW-SAMPLE-02', 'ALLOWED', 'on allow-list'],
      [118, 'responder', 'block_channels', 'HW-SAMPLE-02', 'ALLOWED', 'on allow-list'],
      [118, 'responder', 'unfreeze_card', 'HW-SAMPLE-02', 'BLOCKED', 'unfreeze_card is never available to AI agents (brake-only policy).'],
      [117, 'responder', 'open_dispute', 'HW-SAMPLE-02', 'ALLOWED', 'on allow-list'],
    ])
  }

  // 3. Guardian Mode: an older customer's large first payment waits for a family member (US, Zelle).
  {
    const s = 'sample-guardian'
    const factors = [
      { id: 'new_payee', label: 'New payee', points: 15 },
      { id: 'amount', label: "Amount is 8.0x this customer's usual USD payment", points: 15 },
      { id: 'instant_rail', label: 'Zelle is instant and hard to reverse', points: 5 },
    ]
    const payeeCheck = { result: 'match', registeredName: 'QuickFix Plumbing LLC', scheme: 'Zelle registered name', similarity: 1 }
    insCase.run('HW-SAMPLE-03', 'transfer_hold', 'open', 35, 'Guardian approval: 2,000 USD via Zelle to ****0456', CUSTOMER.code, 'en', 'US',
      JSON.stringify({ transferId: 'TX-SAMPLE-03', factors, payeeCheck, payeeCode: 'PAYEE_B', session: s, timeline: [{ ts: ago(25), event: 'Case opened' }, { ts: ago(25), event: 'Sent to Guardian for approval' }] }), ago(25), ago(25))
    insTx.run('TX-SAMPLE-03', 'HW-SAMPLE-03', s, 'guardian', 'zelle', 2000, 'USD', 'PAYEE_B', '****0456', 35, 'guardian', JSON.stringify({ factors, payeeCheck, reference: 'Water heater replacement', lang: 'en', verified: false, questions: [] }), ago(25))
    steps(s, 'HW-SAMPLE-03', [[25, 'sentinel', 'transfer scored', null, null, 'info', { risk: 35, decision: 'guardian', payeeCheck: 'match' }]])
  }

  // 4. Mule alert on the receiving side: the account the safe-account money was heading to.
  {
    insCase.run('HW-SAMPLE-04', 'message_alert', 'investigating', 92, 'Receiving account RCV-7781: likely money mule', CUSTOMER.code, 'en', 'GB',
      JSON.stringify({ session: 'sample-mule', linkedAccount: 'RCV-7781', mule: { account: 'RCV-7781', score: 100, flag: 'likely_mule', signals: ['14 unrelated senders in 2.8h', 'most incoming money already sent on', 'outflows to a crypto exchange'] },
        timeline: [{ ts: ago(30), event: 'Case opened' }, { ts: ago(30), event: 'Mule pattern detected on incoming credits' }, { ts: ago(29), event: 'Account flagged for review (no funds moved by AI)' }] }), ago(30), ago(29))
    steps('sample-mule', 'HW-SAMPLE-04', [[30, 'investigator', 'receiving account RCV-7781 flagged: likely_mule', null, null, 'blocked', { score: 100 }]])
    gateRows('sample-mule', [[29, 'investigator', 'flag_account', 'RCV-7781', 'ALLOWED', 'on allow-list']])
  }

  // 5. Resolved: a genuine payment paused, verified by the customer, and released.
  {
    const s = 'sample-released'
    insCase.run('HW-SAMPLE-05', 'transfer_hold', 'released', 30, 'Released after verification: 900 USD via Zelle to ****0456', CUSTOMER.code, 'en', 'US',
      JSON.stringify({ transferId: 'TX-SAMPLE-05', session: s, timeline: [{ ts: ago(190), event: 'Case opened' }, { ts: ago(189), event: 'Customer answered the verification questions' }, { ts: ago(188), event: 'Customer confirmed: transfer released' }] }), ago(190), ago(188))
    insTx.run('TX-SAMPLE-05', 'HW-SAMPLE-05', s, 'released', 'zelle', 900, 'USD', 'PAYEE_B', '****0456', 30, 'verify', JSON.stringify({ reference: 'Invoice 4471', lang: 'en', verified: true, questions: [] }), ago(190))
    gateRows(s, [[188, 'customer', 'release_transfer', 'TX-SAMPLE-05', 'ALLOWED', 'on allow-list']])
  }

  // 6. A prompt-injection attempt on a held payment, refused by the policy gate.
  {
    const s = 'sample-injection'
    steps(s, null, [
      [15, 'inspector', 'message analysed', SUPER, 1420, 'ok', { risk: 95, verdict: 'scam', category: 'bank_impersonation' }],
      [15, 'policy-gate', 'injected instructions refused', null, null, 'blocked', [{ tool: 'release_hold' }, { tool: 'transfer_money' }]],
    ])
    gateRows(s, [
      [15, 'sentinel', 'release_hold', 'TX-SAMPLE-01', 'BLOCKED', 'Prompt injection: message text tried to make sentinel call release_hold. AI agents can only brake; release_hold needs a human.'],
      [15, 'sentinel', 'transfer_money', 'TX-SAMPLE-01', 'BLOCKED', 'Prompt injection: message text tried to make sentinel call transfer_money. AI agents can only brake; transfer_money needs a human.'],
    ])
  }

  for (const [ts, session, caseId, agent, step, model, ms, status, detail] of traceRows.sort((a, b) => a[0] - b[0]))
    insTrace.run(session, caseId, agent, step, model, ms, status, JSON.stringify(detail ?? null), ts)
  for (const [ts, session, actor, action, target, result, reason] of auditRows.sort((a, b) => a[0] - b[0])) insAudit.run(session, actor, action, target, result, reason, ts)
}
