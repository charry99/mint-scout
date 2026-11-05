# Mint Scout — test results

Live integration tests (`npm test`, file `tests/check.test.mjs`) hit real
Sourcify + BSC RPC endpoints. Last full run: **2026-11-06 ~02:45 IST — 5/5 pass.**

## Contract checks (BNB Chain, chainId 56)

| Contract | Sourcify | Name / symbol | Verdict | Notes |
|---|---|---|---|---|
| SEEDS NFT `0x8d7E…96D6` | exact_match | SEEDS / SEEDS | **VERIFIED** | No admin red flags in ABI. Owner `0xF8fA…84D2F` is live, but no pause/URI/withdraw functions found. |
| Derpagent `0x5dA5…F6eC` | null (unverified) | Derpagent / DERP | **NEEDS REVIEW** | Not verified, so no ABI to scan. Owner is the zero address (renounced), which is good — but behaviour is still unconfirmable from source. |
| Cogito Agents `0x5ae2…045B` | exact_match | Cogito Agents / COG-A | **NEEDS REVIEW** | Verified source, but a live owner (`0xF381…D132`) holds `setBaseURI` + `withdraw` in the ABI, and `mint` is payable. The engine correctly refuses to call this VERIFIED. |
| User wallet `0x2DB8…8686` (EOA) | n/a | n/a | **not a contract** | `eth_getCode` returns `0x` — correctly identified as a wallet, not a contract. |

## Otari explain

- Without `OTARI_AI_TOKEN`: `/api/explain` returns
  `{ available: false, reason: "AI explanation unavailable — set OTARI_AI_TOKEN …" }`
  and everything else still works. Covered by the test
  "Otari explain — graceful fallback without a token".
- With a token set: live Otari call is attempted (not tested in CI runs —
  no token is available in this environment).

## Bugs found and fixed during testing

1. **Sourcify v2 match strings** — the v2 API returns the literal strings
   `"exact_match"` / `"partial_match"` for `creationMatch`/`runtimeMatch`,
   not `"exact"` / `"partial"`. The checker compared against the wrong
   strings, so verified contracts were reported as `match` (partial).
   Fixed in `lib/checker.js`; SEEDS and Cogito now correctly report
   `exact_match`.
2. **Test expectation for Cogito** — initially expected VERIFIED; the engine
   correctly returns NEEDS REVIEW because of live-owner admin controls.
   The test was corrected, not the engine.
3. **`node --test tests/`** — Node 24 resolves the bare directory as a
   module path; the npm script now points at `tests/check.test.mjs`
   directly.
