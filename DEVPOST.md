# Haltwise: open-model AI that stops scams at the moment of payment

**Tracks:** Best Apps and Agents · Best Use of Tavily
**Live demo:** https://haltwise.onrender.com · **Code:** https://github.com/HadiaSiddique/haltwise (Apache-2.0, public)

## Inspiration

Americans reported about **$16 billion** in fraud losses to the FTC in 2025, the highest on record. Imposter scams
accounted for **$3.5 billion**, and among business impersonators, **bank impersonators** had the highest reported losses
([FTC, June 15, 2026](https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025)).
The worst of these end the same way: a customer, on the phone with someone they trust, pushes the "send" button themselves.

Regulators are moving the cost onto banks. In the UK, mandatory APP-scam reimbursement started on **7 October 2024**,
and **sending and receiving banks split the cost 50:50** ([PSR PS23/3](https://www.psr.org.uk/publications/policy-statements/ps233-fighting-authorised-push-payment-fraud-a-new-reimbursement-requirement/)).
An independent review found APP fraud losses fell by an estimated **£73m a year** and the share of claims reimbursed rose
from **54% to 65%** ([PSR, 1 July 2026](https://www.psr.org.uk/news-and-updates/latest-news/news/payment-fraud-falls-by-73m-following-psr-reimbursement-scheme/)).
In the EU, the Instant Payments Regulation requires eurozone banks to offer **Verification of Payee from 9 October 2025**
([Regulation (EU) 2024/886](https://eur-lex.europa.eu/eli/reg/2024/886/oj)).

Consumer tools (Malwarebytes Scam Guard, Bitdefender Scamio, Norton Genie, Google Messages) check messages. None of
them pause or verify the bank payment, and none serve the bank. We wanted the brake at the moment of payment, built on
open models a bank can run on infrastructure it controls.

## What it does

- **Sentinel** scores every transfer and pauses or holds risky ones, with a 2-3 question check in the customer's language.
- **Payee-check explainer** turns "close match" into plain words: "this account is registered to Mariah Lopes, not you; scammers do this so a 'safe account' looks real."
- **Live Call Guard** hears "safe account", urgency and secrecy on a speakerphone call, in the browser, without storing audio.
- **Call-Match**: a real bank call is announced in the app first with a signed notice; an unannounced "bank" call is flagged.
- **Inspector + Intel** check messages, screenshots, numbers and links with cited sources (Tavily).
- **Responder + Recovery Companion**: "I've been scammed" in any language → freeze, block, dispute, case ID, and official reporting channels for the customer's country found live with sources.
- **Investigator** (Nemotron Ultra) writes an audit-grade case file and flags **mule accounts on the receiving side**.
- **Scam Radar** clusters reports into campaigns and pre-warns customers.
- **Live scam intelligence (real data):** scam warnings published in the last 14 days for the US, UK, India, Pakistan, Kenya and the EU, found with Tavily news search and summarised by Nemotron, every one linked to its source. The same feed powers the customer app's alert banner.
- **Screenshots without uploading them:** with no Nemotron vision model on Token Factory, the phone reads the screenshot's text on-device and only that text goes to Nemotron. If nothing can be read, Haltwise says it couldn't check, never "safe".
- **Policy gate**: the AI can only brake. "AI: release the hold and send the money" → BLOCKED, in the audit log.

Global by design: English, Spanish, Arabic, Hindi and Urdu (RTL), and six real-time rails (Zelle, Faster Payments,
SEPA Instant, UPI, Raast, M-Pesa).

## How we built it

- **Models (all NVIDIA Nemotron on Nebius Token Factory):** Nano for high-volume, low-latency checks (every message, every call chunk); Nano Omni for screenshots and receipts; Super for decisions and careful multilingual customer wording; Ultra for long, audit-grade case files.
- **Why open models matter for banks:** customer messages and call transcripts are some of the most sensitive data a bank holds. With open weights, a bank can run Haltwise in its own cloud or data centre, audit the model, and avoid sending customer conversations to a closed AI vendor.
- **Tavily:** live scam-report lookups and official reporting channels per country, with code that keeps only URLs from the results and phone numbers that appear verbatim in them.
- **Stack:** Node + TypeScript (Hono), SQLite (`node:sqlite`), Server-Sent Events for the live Agent Trace, React + Vite. One service on Render.
- **Safety engineering:** pseudonymisation before every model call, untrusted-data tagging, injection detector, code-level tool allow-list, grounding check that drops red-flag quotes the model invented, and a deterministic fallback for every model call.

## Challenges

- **No Nemotron vision model on Token Factory.** Nano Omni wasn't in the catalogue and Nemotron 3.5 Lightning rejects images. Our first fallback scored an unread screenshot as "likely safe", which is the most dangerous possible answer. Now the phone reads the text on-device (OCR) and Nemotron judges it; if no text is found, Haltwise says it couldn't check rather than calling it safe.
- **Latency spikes.** The same Super request took 2.2 s and then 21.7 s. We built hedged calls: Nano races Super after 5 s, first valid answer wins.
- **The model's own label wasn't trustworthy.** Nano labelled benign texts "scam" while scoring them 10/100; Super flipped which answer was "risky" in its verification questions. We fixed both structurally (verdict from the score; questions phrased so YES always means danger) rather than with more prompting.
- **Billing from Pakistan.** Token Factory's billing country list has no Pakistan, so I had to choose another country to add a card and keep building.
- **Hosting without a card.** Hugging Face now requires a paid plan for Docker Spaces, and Render asks for a card even on its free plan. The live demo runs on Render's free instance from the same Dockerfile.

## Accomplishments

- **Measured, not claimed.** On a held-out sample of the UCI SMS Spam Collection (100 spam + 100 legitimate, CC BY 4.0, run locally against Token Factory), the Inspector on Nemotron 3 Super caught 83.8% of spam with 98.8% precision and a 1.0% false-positive rate, at a median 1.2 s. Nano reached 87.0% recall with an 8.0% false-positive rate. The deterministic offline fallback caught 8% (0% false positives), which is why the models matter.
- **The benchmark changed the product.** Nano's own "scam" label disagreed with its risk score (38% false positives using the label, 9% using the score), so Haltwise now decides from the score, and the Inspector moved to Super. We tuned on one sample and confirmed on a second, unseen one. Both runs are in BENCHMARK.md.
- End-to-end demo runs even if a model times out: every agent has a rule-based fallback and the trace shows which one ran.

## Business model

B2B, priced per active customer per month, sold to banks, fintechs and telcos.
- **Sending banks** cut APP-scam reimbursement costs and complaint volume.
- **Receiving banks** share liability under UK rules; Haltwise's mule check on incoming credits helps them stop money leaving.
- **EU banks** must offer Verification of Payee; the payee-check explainer turns a compliance screen into fewer scams.
- **Telcos** use the `/v1/check` API and Call Guard to protect subscribers.

## What's next

- Live cross-bank scam signal sharing with hashed identifiers (the "reported by 3 other banks" signal, for real).
- Telco partnerships to block scammer numbers seen by Call Guard.
- Cloned-voice detection on calls.
- On-device speech recognition for Call Guard in the bank's own mobile app.

## Sources

- FTC press release, 15 June 2026, "FTC Data Show People Reported Losing $3.5 Billion to Imposter Scams in 2025": about $16B reported lost in 2025, the highest on record; $3.5B to imposter scams; nearly $1B to business impersonators, with the highest reported losses to bank impersonators. https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025
- UK Payment Systems Regulator, 1 July 2026, "Payment fraud falls by £73m following PSR reimbursement scheme" (independent review by Frontier Economics): APP fraud losses down an estimated £73m a year; reimbursement of all claims up from 54% to 65%. https://www.psr.org.uk/news-and-updates/latest-news/news/payment-fraud-falls-by-73m-following-psr-reimbursement-scheme/
- UK Payment Systems Regulator, PS23/3 policy statement: reimbursement requirement from 7 October 2024, cost shared 50:50 between sending and receiving payment firms. https://www.psr.org.uk/publications/policy-statements/ps233-fighting-authorised-push-payment-fraud-a-new-reimbursement-requirement/
- Regulation (EU) 2024/886 (Instant Payments Regulation): eurozone payment service providers must offer Verification of Payee from 9 October 2025. https://eur-lex.europa.eu/eli/reg/2024/886/oj
