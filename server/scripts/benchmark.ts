/**
 * npm run benchmark -- [--n 100] [--models nano,super] [--concurrency 4]
 *
 * Runs the Inspector prompt on openly licensed public datasets and reports recall, precision,
 * false-positive rate, F1 and latency per model, plus a rules-only baseline.
 * Writes data/benchmark.json (shown in the Command Center) and BENCHMARK.md.
 * Numbers come only from this run. Nothing is estimated.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolveModels, chat, models, type Role } from '../src/llm.ts'
import { SYSTEM } from '../src/agents/inspector.ts'
import { ruleScore } from '../src/rules.ts'
import { asData } from '../src/redact.ts'

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const N = Number(arg('n', '100')) // per class
const ROLES = arg('models', 'nano,super').split(',').filter(r => r && r !== 'none') as Role[]
const CONC = Number(arg('concurrency', '4'))

interface Item {
  text: string
  label: 0 | 1
}
interface Dataset {
  name: string
  url: string
  license: string
  language: string
  load: () => Promise<Item[]>
}

/** Hugging Face datasets-server: paged JSON rows, no download tooling needed. */
async function hfRows(dataset: string, config: string, split: string, total: number, map: (r: any) => Item | undefined) {
  const out: Item[] = []
  for (let offset = 0; offset < total; offset += 100) {
    const u = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=${config}&split=${split}&offset=${offset}&length=100`
    const res = await fetch(u, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`${dataset}: HTTP ${res.status}`)
    const body = (await res.json()) as { rows: { row: any }[] }
    for (const r of body.rows) {
      const it = map(r.row)
      if (it) out.push(it)
    }
    if (body.rows.length < 100) break
  }
  return out
}

const DATASETS: Dataset[] = [
  {
    name: 'UCI SMS Spam Collection',
    url: 'https://huggingface.co/datasets/ucirvine/sms_spam',
    license: 'CC BY 4.0',
    language: 'en',
    load: () => hfRows('ucirvine/sms_spam', 'plain_text', 'train', 5574, r => ({ text: String(r.sms), label: r.label === 1 ? 1 : 0 })),
  },
]
// Optional second (non-English) dataset: set BENCH_DATASET2="owner/name|config|split|textField|labelField|positiveValue|license|lang"
if (process.env.BENCH_DATASET2) {
  const [ds, cfg, split, tf, lf, pos, license, language] = process.env.BENCH_DATASET2.split('|')
  DATASETS.push({
    name: ds,
    url: `https://huggingface.co/datasets/${ds}`,
    license,
    language,
    load: () => hfRows(ds, cfg, split, 20000, r => ({ text: String(r[tf]), label: String(r[lf]) === pos ? 1 : 0 })),
  })
}

/** Deterministic stratified sample (same messages for every model). */
function sample(items: Item[], n: number) {
  let s = 1234567
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const pick = (arr: Item[]) =>
    arr
      .map(x => ({ x, k: rnd() }))
      .sort((a, b) => a.k - b.k)
      .slice(0, n)
      .map(o => o.x)
  return [...pick(items.filter(i => i.label === 1)), ...pick(items.filter(i => i.label === 0))]
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

function metrics(pred: (0 | 1 | null)[], gold: (0 | 1)[], lat: number[]) {
  let tp = 0, fp = 0, tn = 0, fn = 0, errors = 0
  pred.forEach((p, i) => {
    if (p === null) return errors++
    if (p === 1 && gold[i] === 1) tp++
    else if (p === 1) fp++
    else if (gold[i] === 1) fn++
    else tn++
  })
  const precision = tp + fp ? tp / (tp + fp) : null
  const recall = tp + fn ? tp / (tp + fn) : null
  const fpr = fp + tn ? fp / (fp + tn) : null
  const f1 = precision != null && recall != null && precision + recall ? (2 * precision * recall) / (precision + recall) : null
  const sorted = lat.filter(x => x > 0).sort((a, b) => a - b)
  const q = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null)
  return { tp, fp, tn, fn, errors, precision, recall, fpr, f1, p50ms: q(0.5), p95ms: q(0.95) }
}

await resolveModels()
const results: any[] = []
const dsMeta: any[] = []
for (const ds of DATASETS) {
  console.log(`\nLoading ${ds.name}…`)
  const all = await ds.load()
  const items = sample(all, N)
  const gold = items.map(i => i.label)
  dsMeta.push({ name: ds.name, url: ds.url, license: ds.license, language: ds.language, total: all.length, sampled: items.length, positives: gold.filter(g => g === 1).length, negatives: gold.filter(g => g === 0).length })

  const rulePred = items.map(i => (ruleScore(i.text).score >= 30 ? 1 : 0) as 0 | 1)
  results.push({ dataset: ds.name, model: 'rules', ...metrics(rulePred, gold, []) })
  console.log('  rules baseline done')

  for (const role of ROLES) {
    const lat: number[] = []
    let done = 0
    const pred = await pool(items, CONC, async it => {
      const r = await chat({ role, system: SYSTEM('en'), user: asData('message', it.text) + '\nRespond with JSON only.', json: true, maxTokens: 700, noFallback: true })
      if (++done % 20 === 0) process.stdout.write(`  ${role}: ${done}/${items.length}\r`)
      if (!r.ok) return null
      lat.push(r.ms)
      const v = r.json?.verdict
      return (v === 'scam' || v === 'suspicious' ? 1 : 0) as 0 | 1
    })
    const m = metrics(pred, gold, lat)
    results.push({ dataset: ds.name, model: models[role], role, ...m })
    console.log(`  ${models[role]}: recall ${fmt(m.recall)} precision ${fmt(m.precision)} FPR ${fmt(m.fpr)} p50 ${m.p50ms} ms errors ${m.errors}`)
  }
}

const out = { ranAt: new Date().toISOString(), where: 'local machine (Node script calling Nebius Token Factory)', perClass: N, positiveRule: 'verdict is "scam" or "suspicious"', datasets: dsMeta, results }
mkdirSync('data', { recursive: true })
writeFileSync('data/benchmark.json', JSON.stringify(out, null, 2))
writeFileSync('BENCHMARK.md', toMarkdown(out))
console.log('\nWrote data/benchmark.json and BENCHMARK.md')

function fmt(x: number | null) {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`
}

function toMarkdown(o: typeof out) {
  const rows = o.results.map(r => `| ${r.dataset} | \`${r.model}\` | ${fmt(r.recall)} | ${fmt(r.precision)} | ${fmt(r.fpr)} | ${fmt(r.f1)} | ${r.p50ms ?? '—'} | ${r.p95ms ?? '—'} | ${r.tp}/${r.fp}/${r.tn}/${r.fn} | ${r.errors} |`)
  return `# Haltwise Inspector benchmark

Generated by \`npm run benchmark\` on ${o.ranAt}. Ran on: ${o.where}.

## Datasets

${o.datasets.map(d => `- **${d.name}** (${d.language}), licence ${d.license}, ${d.url}. ${d.total} messages available; stratified sample of ${d.sampled} (${d.positives} spam/scam, ${d.negatives} legitimate), fixed seed.`).join('\n')}

## Method

- Same Inspector system prompt as production (\`server/src/agents/inspector.ts\`), message wrapped as untrusted data.
- A prediction is positive when the model's verdict is "scam" or "suspicious". Model fallback disabled, so each row is exactly one model.
- Latency is wall-clock time per Token Factory call from the benchmark machine.
- "rules" is Haltwise's deterministic multilingual rule set (score ≥ 30), used as the offline fallback.
- Caveat: SMS spam includes marketing that is not fraud, so "recall" here means catching unwanted/scam texts, and some "false negatives" are benign promotions.

## Results

| Dataset | Model | Recall | Precision | False-positive rate | F1 | p50 ms | p95 ms | TP/FP/TN/FN | Errors |
|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`
}
