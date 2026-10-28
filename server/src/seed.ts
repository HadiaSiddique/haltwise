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
  console.log('[seed] demo data loaded (all simulated)')
}
