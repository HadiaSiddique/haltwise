/**
 * Deterministic, multilingual scam signals. Used three ways:
 *  1. instant first pass (Live Call Guard shows a warning before the model answers),
 *  2. fallback when a model call times out, so the demo never breaks,
 *  3. a rules-only baseline in the benchmark.
 */

export type Tactic =
  | 'urgency'
  | 'safe_account'
  | 'secrecy'
  | 'remote_access'
  | 'gift_card_crypto'
  | 'ignore_bank_warnings'
  | 'credentials'
  | 'impersonation'
  | 'fee_or_toll'
  | 'prize'
  | 'investment'
  | 'job'
  | 'romance'
  | 'link'

const P: Record<Tactic, RegExp[]> = {
  urgency: [
    /\burgent(ly)?\b/i, /\bimmediately\b/i, /\bright now\b/i, /\bwithin (24|48) ?h(ou)?rs?\b/i, /\bact now\b/i, /\bfinal (notice|warning)\b/i, /\btoday only\b/i, /\bexpires? (today|soon)\b/i, /\bsuspended\b/i,
    /urgente/i, /inmediatamente/i, /ahora mismo/i, /de inmediato/i,
    /عاجل/, /فورا|فوراً/, /حالا/,
    /तुरंत/, /जल्दी/, /अभी/,
    /فوری/, /ابھی/, /جلدی/,
  ],
  safe_account: [
    /\bsafe account\b/i, /\bsecure account\b/i, /\bprotect your (money|funds|savings)\b/i, /\bmove (your|the) (money|funds|savings)\b/i, /\bholding account\b/i,
    /cuenta segura/i, /proteger su dinero/i, /mover (su|el) dinero/i,
    /حساب آمن/, /حساب امن/, /نقل (أموالك|الأموال)/,
    /सुरक्षित खात/, /पैसे (ट्रांसफर|सुरक्षित)/,
    /محفوظ اکاؤنٹ/, /محفوظ کھات/,
  ],
  secrecy: [
    /\bdon'?t tell\b/i, /\bdo not tell\b/i, /\bkeep (this|it) (secret|confidential|between us)\b/i, /\bdon'?t (speak|talk) to (anyone|the bank|staff)\b/i,
    /no (le )?(diga|cuente)/i, /confidencial/i,
    /لا تخبر/, /سري/,
    /किसी को (मत|न) बताएं/, /गोपनीय/,
    /کسی کو (نہ|مت) بتائیں/, /خفیہ/,
  ],
  remote_access: [/anydesk/i, /teamviewer/i, /quick ?support/i, /remote (access|desktop)/i, /screen ?shar/i, /rustdesk/i, /install (this|the) app/i],
  gift_card_crypto: [
    /gift ?cards?/i, /itunes/i, /google play card/i, /steam card/i, /\bbitcoin\b/i, /\bcrypto/i, /\busdt\b/i, /bitcoin atm/i, /wallet address/i,
    /tarjetas? de regalo/i, /بطاقات? هدايا/, /गिफ्ट कार्ड/, /گفٹ کارڈ/,
  ],
  ignore_bank_warnings: [
    /if the bank asks/i, /ignore (the|any) (warning|message)/i, /tell (them|the bank) it'?s for/i, /say (it'?s|it is) (for|a) /i, /the bank (is|may be) (in on it|compromised)/i, /bank staff (are|is) involved/i,
    /si el banco (le )?pregunta/i, /ignore (la|el) (advertencia|mensaje)/i,
    /إذا سألك البنك/, /अगर बैंक पूछे/, /اگر بینک پوچھے/,
  ],
  credentials: [
    /\botp\b/i, /one[- ]time (code|password|passcode)/i, /verification code/i, /\bpin\b/i, /\bpassword\b/i, /\bcvv\b/i, /card number/i, /\blog ?in details\b/i,
    /código de verificación/i, /contraseña/i, /رمز التحقق/, /कोड बताएं/, /او ٹی پی|کوڈ بتائیں/,
  ],
  impersonation: [
    /fraud (department|team)/i, /security (department|team)/i, /from your bank/i, /\bpolice\b/i, /\birs\b/i, /\bhmrc\b/i, /\bcustoms\b/i, /\bfbi\b/i, /social security/i, /\bfca\b/i, /\bfia\b/i, /\bamazon\b/i, /\bmicrosoft\b/i, /\bapple support\b/i,
    /departamento de fraude/i, /su banco/i, /policía/i,
    /قسم الاحتيال/, /البنك/, /الشرطة/,
    /बैंक से/, /पुलिस/, /सीबीआई/,
    /بینک سے/, /پولیس/,
  ],
  fee_or_toll: [/\btolls?\b/i, /unpaid/i, /outstanding (balance|fee|toll)/i, /redeliver/i, /delivery fee/i, /parcel/i, /package (is )?(on hold|held)/i, /customs fee/i, /peaje/i, /paquete/i, /رسوم/, /पार्सल/, /پارسل/],
  prize: [/you(?:'ve| have)? won/i, /\bwinner\b/i, /\bprize\b/i, /lottery/i, /claim your/i, /\bfree\b.*\b(gift|iphone|reward)/i, /ha ganado/i, /premio/i, /جائزة/, /इनाम/, /انعام/],
  investment: [/guaranteed (return|profit)/i, /double your/i, /\b\d{2,3}% (return|profit)/i, /trading (platform|signals)/i, /investment opportunity/i, /forex/i, /inversión garantizada/i, /أرباح مضمونة/, /गारंटीड रिटर्न/],
  job: [/work from home/i, /earn \$?\d+ (a|per) (day|hour)/i, /\b(like|rate) (videos|products)\b/i, /task-based/i, /part[- ]time job/i, /recruiter/i, /trabajo desde casa/i, /وظيفة/, /घर से काम/, /گھر بیٹھے/],
  romance: [/my love/i, /\bdarling\b/i, /\bsweetheart\b/i, /stuck (abroad|at the airport)/i, /oil rig/i, /\bmi amor\b/i, /حبيبي/, /मेरी जान/, /میری جان/],
  link: [/https?:\/\//i, /\bbit\.ly\b/i, /\btinyurl\b/i, /\bwww\./i, /\.(top|xyz|icu|live|click|shop|info)\b/i],
}

const WEIGHT: Record<Tactic, number> = {
  safe_account: 40, ignore_bank_warnings: 35, remote_access: 30, gift_card_crypto: 25, secrecy: 25, credentials: 25,
  impersonation: 15, urgency: 15, fee_or_toll: 20, prize: 20, investment: 20, job: 15, romance: 15, link: 10,
}

export interface RuleHit {
  tactic: Tactic
  quote: string
}

export function scanTactics(text: string): RuleHit[] {
  const hits: RuleHit[] = []
  for (const [tactic, pats] of Object.entries(P) as [Tactic, RegExp[]][]) {
    for (const p of pats) {
      const m = text.match(p)
      if (m) {
        hits.push({ tactic, quote: m[0] })
        break
      }
    }
  }
  return hits
}

export function ruleScore(text: string) {
  const hits = scanTactics(text)
  const raw = hits.reduce((s, h) => s + WEIGHT[h.tactic], 0)
  const score = Math.min(100, raw)
  return { score, hits, category: categoryFromTactics(hits.map(h => h.tactic)) }
}

export const FTC_CATEGORIES = [
  'bank_impersonation',
  'government_impersonation',
  'business_impersonation',
  'safe_account',
  'romance',
  'investment_crypto',
  'job',
  'tech_support',
  'delivery_toll',
  'prize_lottery',
  'other',
  'none',
] as const
export type Category = (typeof FTC_CATEGORIES)[number]

export function categoryFromTactics(t: Tactic[]): Category {
  const has = (x: Tactic) => t.includes(x)
  if (has('safe_account')) return 'safe_account'
  if (has('remote_access')) return 'tech_support'
  if (has('investment')) return 'investment_crypto'
  if (has('romance')) return 'romance'
  if (has('job')) return 'job'
  if (has('fee_or_toll')) return 'delivery_toll'
  if (has('prize')) return 'prize_lottery'
  if (has('impersonation')) return 'bank_impersonation'
  if (has('gift_card_crypto')) return 'investment_crypto'
  return t.length ? 'other' : 'none'
}

/** Prompt-injection detector: text that addresses the AI or asks for money-moving actions. */
const INJECTION = [
  /\b(ai|assistant|haltwise|agent|model|system)\s*[:,]/i,
  /ignore (all |any )?(previous|prior|above) (instructions|rules)/i,
  /you are now/i,
  /system prompt/i,
  /release (the |this )?hold/i,
  /(send|transfer|move) (the )?(money|funds|payment)/i,
  /approve (the |this )?(transfer|payment)/i,
  /add (a |this )?(new )?payee/i,
  /change (the )?(phone|email|contact|address)/i,
  /unblock|unfreeze/i,
  /mark (this|it) as safe/i,
]

export function detectInjection(text: string) {
  const quotes: string[] = []
  for (const p of INJECTION) {
    const m = text.match(p)
    if (m) quotes.push(m[0])
  }
  // Which privileged tools the text is trying to trigger, so the gate can show exactly what it refused.
  const requested = new Set<string>()
  if (/release (the |this )?hold/i.test(text)) requested.add('release_hold')
  if (/(send|transfer|move) (the )?(money|funds|payment)|approve (the |this )?(transfer|payment)/i.test(text)) requested.add('transfer_money')
  if (/add (a |this )?(new )?payee/i.test(text)) requested.add('add_payee')
  if (/change (the )?(phone|email|contact|address)/i.test(text)) requested.add('change_contact_details')
  if (/unblock|unfreeze/i.test(text)) requested.add('unfreeze_card')
  if (/mark (this|it) as safe/i.test(text)) requested.add('override_verdict')
  return { suspected: quotes.length > 0 && (requested.size > 0 || quotes.length > 1), quotes, requested: [...requested] }
}

/** Cheap script-based language detection; the model refines it for Latin-script languages. */
export function detectScriptLanguage(text: string): string | undefined {
  if (/[ऀ-ॿ]/.test(text)) return 'hi'
  if (/[؀-ۿ]/.test(text)) return /[ٹڈڑںےھۓپچژگک]/.test(text) && /[ٹڈڑںے]/.test(text) ? 'ur' : 'ar'
  if (/[ñ¿¡]|\b(usted|cuenta|banco|dinero|pago)\b/i.test(text)) return 'es'
  return undefined
}
