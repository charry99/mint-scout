# Mint Scout 🔍

Paste a contract address, get a verdict — **VERIFIED / NEEDS REVIEW / HIGH RISK** —
from Sourcify verification, on-chain reads and an ABI risk scan, plus a
plain-language AI explanation powered by **Otari** (Mozilla's open-source AI
gateway).

Built for the [Mozilla Otari Hackathon — Devs Wilding Online](https://dorahacks.io/hackathon/mozilla-devs-wilding/detail)
(DoraHacks, deadline Nov 11 2026 11:59 PM).

## What it checks

For any contract on BNB Chain (default), Ethereum, Base, Arbitrum, Polygon
or Optimism:

1. **Is it a contract?** — `eth_getCode` (an EOA wallet is reported as "not a contract").
2. **Sourcify verification** — exact match / partial match / unverified, with the ABI fetched when available.
3. **On-chain reads** — `name()`, `symbol()`, `decimals()`, `totalSupply()`, `owner()`, `paused()`, each independent (a failed read is "unknown", never zero).
4. **ABI risk scan** — mint cost (payable vs free), pause controls, blacklist, buy/sell tax, transfer/wallet limits, withdraw / URI / royalty admin functions, launch and refund functions.
5. **Verdict heuristics** — unverified + owner controls/paid mint → HIGH RISK or NEEDS REVIEW; verified + no admin red flags → VERIFIED (with caveats); verified + live-owner admin controls → NEEDS REVIEW.

Everything is read-only. No wallet connection, no signing, no minting, no transactions.

## How to run

```bash
npm install
npm start
# → http://localhost:3000
```

Endpoints:

- `GET /api/health` — `{ ok, service, ai }` (`ai` is true only when an Otari token is configured)
- `POST /api/check` — `{ "address": "0x…", "chainId": 56 }` → full check result
- `POST /api/explain` — `{ "checkResult": { … } }` → Otari plain-language explanation

## Wiring Otari (AI explanations)

1. Sign up at [otari.ai](https://otari.ai) and copy your API token (starts with `otk_`).
2. Copy `.env.example` to `.env` and set `OTARI_AI_TOKEN=otk_…`.
3. Restart the server. The AI panel appears after every check.

Without a token the app works end-to-end — `/api/explain` returns a clear
graceful fallback (`AI explanation unavailable — set OTARI_AI_TOKEN`) and
nothing else breaks. Never commit `.env` or any token (see `.gitignore`).

The Otari client (`lib/otari.js`) is OpenAI-compatible:
`POST https://api.otari.ai/v1/chat/completions`, default model
`deepseek/deepseek-v4-pro-0813` (override with `OTARI_MODEL`).

## Tests

```bash
npm test
```

Live integration tests against real Sourcify + BSC RPC endpoints. See
[TESTS.md](TESTS.md) for recorded results (5/5 pass as of 2026-11-06).

## Git history

- `71ee5fc` (main) — check engine + UI, no AI
- `2d695a7` (branch `mint-scout-otari`) — **first commit where Otari came in**: Otari client + `/api/explain` + UI wiring

## Hackathon submission checklist

- [x] Working app using Otari.ai (hosted gateway, chat completions)
- [ ] Public GitHub repo + `mint-scout-otari` branch (first Otari commit linked) — branch exists locally, no remote configured yet; see "Push repo to GitHub" below
- [ ] Push repo to GitHub (needs the user's GitHub account)
- [ ] 3–5 min demo video
- [ ] Otari feedback (screen recording or written)
- [ ] DoraHacks registration (name + email + one-line project description)
- [ ] Submit on DoraHacks before Nov 11 11:59 PM (aim for Nov 11 night; countdown says Nov 12 04:29 IST)
