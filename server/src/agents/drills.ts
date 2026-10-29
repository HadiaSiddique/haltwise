import { chatHedged } from '../llm.ts'
import { langName } from '../config.ts'
import { inLanguage } from '../i18n.ts'
import type { Run } from '../trace.ts'

/**
 * Scam IQ fire drills: safe, fake scam messages a customer practises on. Nemotron writes a fresh, local set in the
 * customer's language each time; a built-in English set covers the case where the model is unavailable.
 * Nothing here is ever sent to the customer as a real message: it only exists inside the drill screen.
 */
export interface Drill {
  channel: 'sms' | 'email' | 'call' | 'whatsapp'
  sender: string
  message: string
  isScam: boolean
  redFlags: string[]
  lesson: string
}

const BUILT_IN: Drill[] = [
  { channel: 'sms', sender: '+44 7700 900123', message: 'Royal Parcels: your parcel is on hold. Pay the £1.45 redelivery fee today: https://parcels-redeliver.top/pay', isScam: true, redFlags: ['Tiny fee to get your card details', 'Strange web address ending .top', 'Deadline pressure'], lesson: 'Delivery firms do not ask for fees by text. Track parcels only in the official app.' },
  { channel: 'call', sender: 'Unknown number', message: '"This is your bank\'s fraud team. Your account is under attack. Move your savings to a safe account now, and don\'t tell anyone at the branch."', isScam: true, redFlags: ['"Safe account"', 'Secrecy', 'Urgency'], lesson: 'Your bank will never ask you to move money to keep it safe. Hang up and call the number on your card.' },
  { channel: 'sms', sender: 'Your bank', message: 'Your new card ending 4821 has been dispatched and should arrive in 3-5 days. We will never ask for your PIN.', isScam: false, redFlags: [], lesson: 'An information-only message with no link, no request and no pressure is usually genuine.' },
  { channel: 'whatsapp', sender: '+1 415 555 0199', message: 'Hi! Part-time job: earn $300 a day liking videos. Small deposit needed to unlock tasks. Reply YES.', isScam: true, redFlags: ['Too-good pay for easy work', 'Pay a deposit to earn', 'Unknown sender'], lesson: 'Real jobs never ask you to pay to start working.' },
  { channel: 'email', sender: 'security@paypa1-support.com', message: 'We detected unusual sign-in activity. Verify your account within 24 hours or it will be suspended: http://paypa1-verify.com', isScam: true, redFlags: ['Look-alike address (paypa1)', 'Threat of suspension', 'Link to log in'], lesson: 'Never sign in from a link. Open the app or type the address yourself.' },
  { channel: 'sms', sender: 'Dentist', message: 'Reminder: your appointment is tomorrow at 10:30. Reply C to confirm or call the clinic to rebook.', isScam: false, redFlags: [], lesson: 'No money, no link, no codes: an ordinary reminder.' },
]

export async function makeDrills(run: Run, lang: string, country: string): Promise<{ drills: Drill[]; source: 'model' | 'built-in'; model: string }> {
  const L = langName(lang)
  const attempt = async (correction: string) => {
    const res = await chatHedged({
      role: 'super',
      backup: 'nano',
      hedgeAfterMs: 6000,
      timeoutMs: 25000,
      maxTokens: 1800,
      temperature: 0.8,
      system: `You write a safe scam-awareness quiz for a bank customer in ${country}. Write 6 short, realistic messages a person
in ${country} might receive: EXACTLY 4 scams of DIFFERENT types (for example delivery fee, bank or government impersonation, "safe account"
call, job or investment, romance, tech support) and EXACTLY 2 GENUINE messages (is_scam false) that look ordinary, such as an appointment
reminder or a delivery notice with no link and no request. Use fictional names, numbers and links (use the .example or .top domains);
never real brands' real URLs or real phone numbers.
Reply JSON only: {"drills": [{"channel": "sms"|"email"|"call"|"whatsapp", "sender": "...", "message": "...", "is_scam": boolean,
"red_flags": ["<2-3 short flags; empty for genuine>"], "lesson": "<one sentence>"}]}.
LANGUAGE: write sender, message, red_flags and lesson in ${L}. Shuffle the order.${correction}`,
      user: `Country: ${country}. Language: ${L}.`,
      json: true,
    })
    const raw = Array.isArray(res.json?.drills) ? res.json.drills : []
    const drills: Drill[] = raw
      .filter((d: any) => d?.message && typeof d.is_scam === 'boolean')
      .slice(0, 6)
      .map((d: any) => ({
        channel: ['sms', 'email', 'call', 'whatsapp'].includes(d.channel) ? d.channel : 'sms',
        sender: String(d.sender ?? '').slice(0, 60),
        message: String(d.message).slice(0, 400),
        isScam: d.is_scam,
        redFlags: (Array.isArray(d.red_flags) ? d.red_flags : []).map(String).slice(0, 3),
        lesson: String(d.lesson ?? ''),
      }))
    // Language is checked on the prose (lessons and red flags), and allows some Latin: drills legitimately mention
    // "SMS", "OTP" or a fake ".example" link, which made a correct Urdu drill fail the stricter explanation check.
    const prose = drills.flatMap(d => [d.lesson, ...d.redFlags]).join(' ')
    const checks = { messages: drills.length, scams: drills.filter(d => d.isScam).length, languageOk: inLanguage(prose, lang, 0.3) }
    const good = res.ok && checks.messages >= 4 && checks.scams >= 1 && checks.scams < checks.messages && checks.languageOk
    return { res, drills, good, checks }
  }

  let a = await attempt('')
  if (!a.good && a.res.ok) {
    // One firm retry: Super once made all six messages scams, which turns the quiz into a guessing game.
    run.log('drills', 'drill did not meet the rules: retrying', { model: a.res.model, ms: a.res.ms, status: 'fallback', detail: a.checks })
    a = await attempt(`\nYour previous answer broke the rules (${JSON.stringify(a.checks)}). Exactly 2 messages must have "is_scam": false, and all text must be in ${L}.`)
  }
  run.log('drills', a.good ? `Scam IQ drill written (${a.drills.length} messages)` : 'built-in drill used', {
    model: a.res.model,
    ms: a.res.ms,
    status: a.good ? 'ok' : 'fallback',
    detail: a.good ? { scams: a.checks.scams } : { error: a.res.error ?? 'model output not usable', ...a.checks },
  })
  return a.good ? { drills: a.drills, source: 'model', model: a.res.model } : { drills: BUILT_IN, source: 'built-in', model: 'built-in' }
}

/** Anonymous, in-memory tally so the bank can see how prepared its customers are. */
const scores: number[] = []
export function recordScore(score: number) {
  if (Number.isFinite(score) && score >= 0 && score <= 100) scores.push(Math.round(score))
  return drillStats()
}
export const drillStats = () => ({ attempts: scores.length, average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null })
