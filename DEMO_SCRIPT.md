# Mint Scout — demo video script (3–5 min)

For the Mozilla Otari Hackathon (DoraHacks, deadline Nov 11 2026, 11:59 PM).
Record the app running locally (`npm start` → http://localhost:3000).
Everything shown is read-only: no wallet connection, no signing, no minting.

## 0:00–0:30 — The problem (to camera / voiceover)

"Free mints in the Binance Agent ecosystem move fast, and the contract is
where the truth is — but most people can't read one. Mint Scout pastes a
contract in and answers in plain language: VERIFIED, NEEDS REVIEW, or
HIGH RISK, with an AI explanation from Otari, Mozilla's open-source AI
gateway."

## 0:30–1:30 — Check 1: a good contract (SEEDS)

- Paste `0x8d7E03C2dA2b532D4C59b46059443145147996D6`, chain BNB (56), hit check.
- Show: Sourcify `exact_match`, name SEEDS, verdict **VERIFIED**, no admin
  red flags in the ABI.
- Say: "Verified source, and the ABI scan found no pause, URI-change or
  withdraw controls — that's what VERIFIED means here."

## 1:30–2:30 — Check 2: verified is not enough (Cogito)

- Paste Cogito Agents `0x5ae2…045B` (full address from TESTS.md).
- Show: Sourcify `exact_match` — but verdict **NEEDS REVIEW**, because a
  live owner holds `setBaseURI` + `withdraw` and mint is payable.
- Say: "This is the point of the tool: verified source alone doesn't make
  a mint safe. The owner controls are the story."

## 2:30–3:15 — Check 3: unverified + the wallet trap (Derpagent + EOA)

- Paste Derpagent `0x5dA50e3d24dF33F4e3c6727B9fa4A6FC3d94F6eC` → **NEEDS REVIEW**,
  Sourcify null (unverified), so behaviour can't be confirmed from source.
- Paste the wallet `0x2DB8be71CCdAa91f578721378fbA05F6EE198686` → "not a
  contract" (`eth_getCode` returns `0x`).
- Say: "It refuses to judge a wallet as a contract — a small check that
  stops a whole class of confusion."

## 3:15–4:15 — The Otari AI explanation

- After any check, show the "AI explanation (Otari)" card.
- If the Otari token is configured: read the plain-language explanation
  aloud and point to the `via Otari · <model>` line. The call is
  OpenAI-compatible: `POST https://api.otari.ai/v1/chat/completions`.
- If the token is NOT yet configured: show the honest fallback instead —
  "AI explanation unavailable — set OTARI_AI_TOKEN" — and say so on camera:
  "The app works end-to-end without a token; the AI panel lights up once
  the Otari token is set." Do not fake an AI answer.

## 4:15–4:45 — Close

- "Mint Scout: Sourcify verification, on-chain reads, ABI risk scan, one
  verdict, one plain-language explanation. Built for the Mozilla Otari
  Hackathon — repo and submission on DoraHacks."
- End card: repo URL (once pushed) + DoraHacks hackathon link.

## Before recording

- [ ] `npm test` — 5/5 pass (last run 2026-11-06 ~02:45 IST, see TESTS.md)
- [ ] Decide the Otari branch: record with the token set (live AI panel),
      or record the fallback and say so — don't mix the two
- [ ] Push the repo to GitHub first if the end card shows a repo URL
      (no remote is configured yet — `git remote -v` is empty)
- [ ] Keep the demo to real contracts above; don't invent a HIGH RISK
      example on camera unless a check actually returns one
