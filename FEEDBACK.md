# Feedback: Nebius Token Factory, NVIDIA Nemotron and Tavily

Written while building Haltwise for the Nebius x NVIDIA Global AI Hackathon (Oct 28-30, 2026), from Pakistan.
Every entry below is something we actually hit, with what we did about it. Latencies are wall-clock from a home
connection in Pakistan to `api.tokenfactory.us-central1.nebius.com`.

## Token Factory

### What worked
- **Drop-in OpenAI compatibility.** Plain `fetch` to `/v1/models` and `/v1/chat/completions` worked first time. No SDK needed.
- **`GET /models` as the source of truth.** We resolve our four agent roles from the live catalogue at startup instead of hard-coding IDs, which is how we found out which Nemotron models this account actually has.
- **`response_format: {type: "json_object"}` and `chat_template_kwargs: {enable_thinking: false}` were both accepted** by Nemotron 3 Nano, Super and Ultra (HTTP 200). With thinking off, `usage.completion_tokens_details.reasoning_tokens` reported 0. With the flag omitted, Ultra reasoned (171 reasoning tokens) and returned the reasoning separately from `content`. Exactly what an app needs.
- **Clear, actionable errors.** Sending an image to a text-only model returned `400 "This model does not support image input"`. Sending `input_audio` returned a 422 that lists the accepted content types (`text`, `image_url`, `video_url`). We learned more from those two errors than from the docs.
- **Fast first tokens for small calls:** Nano 0.7-2.4 s, Super 0.7-2.2 s, Ultra 0.45-1.9 s for short JSON replies.

### Friction / bugs
1. **Billing country list has no Pakistan.** The Billing details form jumps from Oman to Poland. For a *global* hackathon this blocks participants in a country of ~240M people. To keep building, I had to pick another country (Japan) as my billing country and then add my card, even though my billing address is in Lahore, Pakistan. That leaves my account with a billing country that doesn't match where I live, which I would rather not have had to do. Suggestion: include all countries in the billing form (or at least every country where hackathon participants are), and let hackathon participants start with credits before any billing form.
2. **Inconsistent model ID casing in the catalogue:** `nvidia/Nemotron-3-Ultra-550b-a55b`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. Three conventions for one model family made auto-matching by pattern fiddly (we need case-insensitive regexes). Suggestion: one lowercase convention, or a `family`/`tier` field in `/models`.
3. **No Nemotron vision/omni model available.** Nemotron 3 Nano Omni is not in this account's catalogue, and `nvidia/Nemotron-3_5-Lightning` is text-only. The only image-capable models listed are non-NVIDIA. For a hackathon that requires Nemotron, this removes screenshot and receipt analysis. Suggestion: list Nano Omni (or a Nemotron VL model), or say in the hackathon brief which modalities are available.
4. **`/models` has no capability metadata.** We had to send a test image and a test WAV to find out what each model accepts. Suggestion: add `modalities`, `context_length`, `supports_json`, `supports_reasoning_toggle` to `/models`.
5. **Latency spikes on Super.** The same Sentinel request (≈900 max tokens, JSON) took 2.2 s on one run and 21.7 s on the next. We now hedge: if Super hasn't answered in 5 s (or errors), Nano starts in parallel and the first valid answer wins; templates cover the case where both fail. Suggestion: publish p50/p95 latency per model, or offer a priority tier for interactive apps.
6. **Nemotron 3.5 Lightning without the thinking flag** put its reasoning ("Here's a thinking process: ...") directly in `content` and hit `finish_reason=length` on a 60-token test, while Nano/Super/Ultra returned clean JSON. Consistent reasoning handling across the family (always in `reasoning_content`) would help.

7. **HTTP 529 "worker overloaded" on Super** during our benchmark (2 of 200 calls at concurrency 4). In the app, our fallback chain moves to Nano automatically. Suggestion: a `Retry-After` header on 529 so clients can back off precisely.
8. **JSON mode doesn't guarantee valid JSON when output is cut off.** One Super answer hit `finish_reason=length` mid-object and came back as broken JSON (`"verdict: suspicious category: ..."`). Expected, but a clear error, or structured-output mode that reserves room to close the object, would help.

### Suggestions
- A "hackathon quickstart" page listing the exact Nemotron IDs available, their modalities, and a cURL for JSON mode with thinking off.
- Per-key usage view broken down by model, so we can show judges cost per agent.

## Nemotron 3 Super (`nvidia/nemotron-3-super-120b-a12b`)
- Used for: Sentinel (pause-and-verify questions, payee-check explanation), Responder (understanding the report, recovery plan).
- **Strong multilingual output.** Spanish verification questions and Arabic recovery plans read naturally and stayed on task.
- **Follows "brake-only" framing well.** It never proposed moving money.
- **Best Inspector in our benchmark:** 83.8% recall, 98.8% precision, 1.0% false-positive rate on a held-out SMS sample, median 1.2 s. Its misses were mostly ordinary marketing, not fraud.
- Friction: it repeatedly labelled `risky_answer` backwards on questions like "Is this payment for something you were expecting?" (risky = "yes"), even with a few-shot example. We stopped asking for the label: the prompt now requires every question to be phrased so that YES means danger, which Super followed in every run since.
- Friction: it echoed our pseudonymisation codes (`PAYEE_B`) into customer-facing text. That's on us, but a note in model docs about placeholder handling would help. We now tell it not to and swap codes back in code.
- Latency: see the spike above (2.2 s vs 21.7 s for the same request).

## Nemotron 3 Nano (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`)
- Used for: Inspector (every message), Live Call Guard (every transcript chunk), Intel summaries, Radar naming.
- **Fast enough for live calls:** 0.7-1.0 s per transcript chunk, so warnings appear while the scammer is still talking.
- Correctly picked up "safe account", urgency and secrecy in Spanish call transcripts.
- Friction: it flagged an ordinary Spanish bank-scam SMS as a *prompt injection* (`injection_attempt: true`) because the message asked the reader to move money. We tightened the definition in the prompt and now require corroboration from a rule-based detector.
- Friction: asked to write a note in Arabic for Pakistan's reporting channel, it wrote Urdu. Reasonable guess for Pakistan, but not what was asked.
- **Label vs. score mismatch (biggest finding).** On 200 SMS messages, Nano's `verdict` label often contradicted its own `risk_score`: "scam" at risk 10 on "sry can't talk on phone, with parents". Using its label gave a 37-38% false-positive rate; using its score gave 8-9% at nearly the same recall (confirmed on a held-out sample). Super did not show this. We now derive the verdict from the score for every model.
- **Slower than Super on this task:** median 2.3 s vs Super's 1.2 s for the same prompt and messages. That was a surprise for a 3B-active model, so we moved the Inspector to Super (Nano stays as its fallback and runs Call Guard, where its inputs are short).
- Quotes: it quotes the redacted text it saw (e.g. `+****0000`), which is correct behaviour. Our grounding check now accepts both forms.

## Nemotron 3 Ultra (`nvidia/Nemotron-3-Ultra-550b-a55b`)
- Used for: Investigator audit-grade case files.
- **Best output of the family for this task.** It tied the sending-side signals (unmatched bank call, "safe account" language, payee check close match) to the receiving-side mule pattern (14 senders in 2.8 h, 72% pass-through, 15-minute dwell, crypto exit) in one coherent narrative, using only the evidence provided.
- ~13 s for a ~1.6k-token case file: fine for an investigator workflow.
- Friction: our first in-app Ultra call (max_tokens 2200, large evidence JSON) failed and fell back to Super. We did not capture the error at the time; after adding error logging and raising max_tokens to 4000, it has not recurred.

## Nemotron 3 Nano Omni
- Not available in this account's Token Factory catalogue (see friction #3). Audio input is not accepted by any listed model (422 on `input_audio`).
- Workaround we shipped: OCR on the customer's phone (Tesseract/WebAssembly), then Nemotron Super judges the text. It works for clean screenshots, but it loses what a vision model would catch: logos, layout, fake bank-app styling and edited-receipt artefacts. A Nemotron vision model on Token Factory would make this much stronger.

## Tavily
- Used for: (1) "is this URL/number reported as a scam?" and (2) official fraud-reporting channels per country, with `include_domains` set to government/regulator domains.
- **Great relevance for scam lookups:** a fake E-ZPass toll URL returned an NYPD advisory PDF, a toll-road operator's press release and a security vendor's guide in about 2-4 s.
- **Pakistan worked:** with `include_domains` (fia.gov.pk, nccia.gov.pk, sbp.org.pk, pta.gov.pk) it returned the NCCIA cybercrime reporting app.
- Friction: the first `include_domains` call for Pakistan timed out at our 12 s limit; the same query later returned in 1.7 s. We raised the timeout to 20 s, retry without the domain filter, cache real results for 12 h, and pre-warm the main countries at startup.
- Suggestion: a `country` parameter, or an "official sources only" flag, would make "find the government reporting channel" a one-liner.

## Nebius Serverless
Not used in this build (single Node service on Render; benchmark run locally).
