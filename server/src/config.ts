try {
  process.loadEnvFile('.env')
} catch {
  // no .env file: rely on real environment variables (Render, CI)
}

/**
 * Keys pasted into a hosting dashboard often carry invisible extras: spaces, a trailing newline, surrounding quotes,
 * or the "NAME=" prefix copied from a .env line. Strip them so a paste mistake doesn't become a 401.
 */
const cleanKey = (v: string | undefined, name: string) =>
  (v ?? '')
    .trim()
    .replace(new RegExp(`^${name}\\s*=\\s*`), '')
    .replace(/^["']|["']$/g, '')
    .trim()

export const config = {
  port: Number(process.env.PORT ?? 8787),
  nebiusBase: (process.env.NEBIUS_BASE_URL ?? 'https://api.tokenfactory.us-central1.nebius.com/v1/').replace(/\/?$/, '/'),
  nebiusKey: cleanKey(process.env.NEBIUS_API_KEY, 'NEBIUS_API_KEY'),
  tavilyKey: cleanKey(process.env.TAVILY_API_KEY, 'TAVILY_API_KEY'),
  dbPath: process.env.DB_PATH ?? 'data/haltwise.db',
  signingSecret: process.env.NOTICE_SIGNING_SECRET ?? 'demo-signing-secret',
  thinking: (process.env.NEMOTRON_THINKING ?? 'off') === 'on',
  modelOverrides: {
    super: process.env.MODEL_SUPER,
    nano: process.env.MODEL_NANO,
    omni: process.env.MODEL_OMNI,
    ultra: process.env.MODEL_ULTRA,
  },
}

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ar: 'Arabic',
  hi: 'Hindi',
  ur: 'Urdu',
  fr: 'French',
  pt: 'Portuguese',
  sw: 'Swahili',
}

export const langName = (code: string) => LANG_NAMES[code] ?? 'English'
