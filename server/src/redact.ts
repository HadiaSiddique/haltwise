import { createHash } from 'node:crypto'
import { CUSTOMER, PAYEE_DIRECTORY } from './seed.ts'

/** Mask an account/IBAN/phone to its last 4 digits. */
export function mask(account: string) {
  const digits = account.replace(/\D/g, '')
  return digits.length >= 4 ? `****${digits.slice(-4)}` : '****'
}

export const hashId = (s: string) => createHash('sha256').update(s.replace(/\s/g, '').toLowerCase()).digest('hex').slice(0, 16)

/**
 * Applied to every string before it reaches a model:
 * known customer/payee names → codes, long digit runs and IBANs → last 4, emails → masked.
 */
export function redact(text: string) {
  let out = text
  const names: [string, string][] = [
    [CUSTOMER.name, CUSTOMER.code],
    [CUSTOMER.name.split(' ')[0], CUSTOMER.code],
    ...PAYEE_DIRECTORY.map(p => [p.registeredName, p.code] as [string, string]),
  ]
  for (const [name, code] of names) {
    if (name.length > 2) out = out.replace(new RegExp(`\\b${escape(name)}\\b`, 'gi'), code)
  }
  out = out.replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}\b/g, m => mask(m)) // IBAN
  out = out.replace(/\b\d[\d -]{7,}\d\b/g, m => (m.replace(/\D/g, '').length >= 8 ? mask(m) : m))
  out = out.replace(/\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, '$1***@$2')
  return out
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Wrap untrusted text so prompts treat it as data, never as instructions. */
export function asData(label: string, text: string) {
  const safe = text.replace(/<\/?untrusted[^>]*>/gi, '')
  return `<untrusted_${label}>\n${safe}\n</untrusted_${label}>`
}
