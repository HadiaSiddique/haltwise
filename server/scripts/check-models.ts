/**
 * npm run models
 * Lists the Nemotron models on Nebius Token Factory, resolves Haltwise's four roles,
 * sends a tiny JSON test to each, and probes whether the Omni model accepts images and audio.
 * Writes data/models.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'
import { config } from '../src/config.ts'
import { resolveModels, models, available, catalog, type Role } from '../src/llm.ts'

if (!config.nebiusKey) {
  console.error('Set NEBIUS_API_KEY first (in .env or the environment).')
  process.exit(1)
}

await resolveModels()
console.log('\nAll models on this account:')
for (const id of catalog) console.log('  ', /nemotron/i.test(id) ? '*' : ' ', id)

async function raw(model: string, content: unknown, maxTokens = 60) {
  const t0 = Date.now()
  const res = await fetch(config.nebiusBase + 'chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.nebiusKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(60000),
  })
  const body = await res.text()
  return { status: res.status, ms: Date.now() - t0, body: body.slice(0, 400) }
}

/** 96x32 PNG with a white bar on navy, built by hand so no image library is needed. */
function testPng() {
  const w = 96
  const h = 32
  const rows: number[] = []
  for (let y = 0; y < h; y++) {
    rows.push(0)
    for (let x = 0; x < w; x++) {
      const bar = y > 10 && y < 22 && x > 8 && x < 88
      rows.push(...(bar ? [255, 255, 255] : [11, 20, 38]))
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from(rows))), chunk('IEND', Buffer.alloc(0))])
  return `data:image/png;base64,${png.toString('base64')}`
}

/** 1 second, 16 kHz mono PCM16 sine tone. */
function testWav() {
  const sr = 16000
  const n = sr
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 8000), 44 + i * 2)
  return buf.toString('base64')
}

const report: Record<string, unknown> = { checkedAt: new Date().toISOString(), base: config.nebiusBase, nemotron: catalog.filter(id => /nemotron/i.test(id)), roles: {} }
console.log('\nRole tests:')
for (const role of ['nano', 'super', 'omni', 'ultra'] as Role[]) {
  const id = models[role]
  if (!available[role]) {
    console.log(`  ${role.padEnd(6)} ${id}  -> NOT ON ACCOUNT (Haltwise will fall back)`)
    ;(report.roles as any)[role] = { id, available: false }
    continue
  }
  const r = await raw(id, 'Reply with JSON only: {"ok": true}')
  console.log(`  ${role.padEnd(6)} ${id}  -> HTTP ${r.status} in ${r.ms} ms`)
  ;(report.roles as any)[role] = { id, available: true, text: r }
}

if (available.omni) {
  const img = await raw(models.omni, [
    { type: 'text', text: 'Describe this image in five words.' },
    { type: 'image_url', image_url: { url: testPng() } },
  ])
  const aud = await raw(models.omni, [
    { type: 'text', text: 'What do you hear? Five words.' },
    { type: 'input_audio', input_audio: { data: testWav(), format: 'wav' } },
  ])
  console.log(`\nOmni image input: HTTP ${img.status} (${img.ms} ms) ${img.body.slice(0, 160)}`)
  console.log(`Omni audio input: HTTP ${aud.status} (${aud.ms} ms) ${aud.body.slice(0, 160)}`)
  report.omniImage = img
  report.omniAudio = aud
}

mkdirSync('data', { recursive: true })
writeFileSync('data/models.json', JSON.stringify(report, null, 2))
console.log('\nSaved data/models.json. Pin IDs in .env (MODEL_SUPER, MODEL_NANO, MODEL_OMNI, MODEL_ULTRA) if the auto-match picked the wrong one.')
