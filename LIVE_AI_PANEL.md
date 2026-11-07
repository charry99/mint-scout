# Mint Scout — live Otari AI panel (recorded 2026-11-07)

## What was verified

- **Credit:** "Voucher Devs Wilding 2026" +$20.00 landed 2026-11-07 07:10 IST;
  balance $20.00 on otari.ai/dashboard (account prasad.kalyanreddy@gmail.com).
- **Working wiring (proven by live calls):**
  `POST https://otari.ai/api/v1/chat/completions`, header `Otari-Key: <key>`.
- **Dead wirings (do not use):**
  - `https://api.otari.ai/v1/chat/completions` → HTTP 404:
    "Otari serves its API under /api/v1, not /v1."
  - `https://api.otari.ai/api/v1/chat/completions` + `Authorization: Bearer` →
    HTTP 401 "Invalid API key".
- **Default model:** `deepseek/deepseek-v4-flash` (~6s, ~$0.00005 per
  explanation, finish=stop). The reasoning model `alibaba/qwen-3.5-35b-a3b`
  is NOT usable for the panel: its thinking consumes the whole token budget
  (max_tokens 1200 returned empty content twice; once the gateway 504d).
  Any model can still be chosen via `OTARI_MODEL`.
- **App timeout:** 120s (a 30s abort killed one live call).

## Live end-to-end run (real server, real check, real explain)

Command: `python3 ~/workspace/goals/mint-scout-mozilla-otari-hackathon/hidden_files/live_panel_test.py`
(the server runs with `OTARI_AI_TOKEN` set to an authd surrogate; the real
key never touches disk or logs).

- `/api/health` → `{"ok": true, "service": "mint-scout", "ai": true}`
- `/api/check` SEEDS `0x8d7E03C2dA2b532D4C59b46059443145147996D6` → verdict **VERIFIED**
- `/api/explain` → `available: true`, model `deepseek/deepseek-v4-flash`:

> This contract appears to be a verified ERC-721 NFT project called SEEDS on
> BNB Chain. The biggest risk is that the contract has a live owner who can
> change settings or withdraw funds, though no admin control functions were
> found in the ABI. The source code is verified as an exact match, meaning
> the deployed code matches what's published. Before minting, double-check
> the mint price, total supply (currently 1,814), and any limits —
> verification proves the code, not the project's trustworthiness. Since the
> verdict is VERIFIED, proceed with caution and always do your own research.

## Cost so far

Test calls on 2026-11-07 totalled ~$0.001 (a few probe calls at
$0.00005–$0.0004 each). Balance ≈ $19.999. At ~$0.00005 per explanation,
the $20 covers ~400,000 explanations.

## Still open

- Push the fix to GitHub (`charry99/mint-scout`, branch `mint-scout-otari`) —
  needs a fresh GitHub PAT from the user (transient, not stored).
- Edit DoraHacks Build 50956 so the submitted text matches the live panel
  (the submitted feedback still describes the $0 / fallback state).
