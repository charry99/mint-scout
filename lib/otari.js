// Otari AI client — Mozilla's hosted AI gateway, OpenAI-compatible.
// VERIFIED LIVE 2026-11-07 with the funded $20 voucher key:
//   POST https://otari.ai/api/v1/chat/completions, header `Otari-Key: <key>`,
//   model alibaba/qwen-3.5-35b-a3b. Auth passes and calls are billed (~$0.0004
//   per short call). The other wiring does NOT work: api.otari.ai/v1 404s
//   ("Otari serves its API under /api/v1, not /v1"), and Bearer auth on
//   api.otari.ai/api/v1 401s ("Invalid API key").
// Auth: Otari-Key header from env OTARI_AI_TOKEN (tokens start with `otk_`).
// No token is hardcoded anywhere; without one the app still works and
// /api/explain returns a graceful fallback.
// NOTE: the default model is deepseek-v4-flash, NOT the reasoning model
// qwen-3.5-35b-a3b: qwen's thinking consumes the whole token budget before
// any visible content (max_tokens 1200 returned empty twice, and once the
// gateway 504d). Flash answers the same prompt in ~6s for ~$0.00005 with
// finish=stop. Any model can still be chosen via OTARI_MODEL.
const OTARI_BASE = process.env.OTARI_BASE_URL || 'https://otari.ai/api/v1';
const DEFAULT_MODEL = process.env.OTARI_MODEL || 'deepseek/deepseek-v4-flash';

export function otariAvailable() {
  return Boolean(process.env.OTARI_AI_TOKEN);
}

function buildPrompt(check) {
  const checks = (check.checks || [])
    .map((c) => `- [${c.status}] ${c.label}: ${c.detail || ''}`)
    .join('\n');
  const facts = check.facts || {};
  return [
    'You are Mint Scout, a plain-language explainer for crypto users who are about to mint or buy from a smart contract.',
    'Explain the contract check result below in 3-6 short sentences, in plain English, no jargon.',
    'Cover: what the contract appears to be, the biggest risk or reassurance, and what to double-check before minting.',
    'Use ONLY the facts given. Never invent prices, supplies, audits, or team details. If something is unknown, say so.',
    'Do not give financial advice. If the verdict is not VERIFIED, end with one sentence of caution.',
    '',
    `Verdict: ${check.verdict || 'N/A'} (${check.kind || 'unknown'})`,
    `Chain: ${check.chainName || check.chainId} — Address: ${check.address}`,
    `Summary: ${check.summary || ''}`,
    `Facts: name=${facts.name || '?'}, symbol=${facts.symbol || '?'}, standard=${facts.tokenStandard || '?'}, sourcify=${facts.sourcify || '?'}, owner=${facts.owner || '?'}, totalSupply=${facts.totalSupply || '?'}`,
    `Flags: ${(check.flags || []).join(', ') || 'none'}`,
    'Checks:',
    checks,
  ].join('\n');
}

/**
 * Ask Otari to explain a check result.
 * Returns { available, model?, text?, reason? }.
 * Without a token this returns available:false — never an error.
 */
export async function explainCheck(check) {
  const token = process.env.OTARI_AI_TOKEN;
  if (!token) {
    return {
      available: false,
      reason: 'AI explanation unavailable — set OTARI_AI_TOKEN to enable the Otari-powered explanation.',
    };
  }
  const ctrl = new AbortController();
  // 120s: qwen-3.5 is a reasoning model and a 1200-token explanation can
  // take well over 30s to generate. (30s aborted a live call, 2026-11-07.)
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(`${OTARI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'otari-key': token,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'You explain smart-contract safety checks in plain language.' },
          { role: 'user', content: buildPrompt(check) },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { available: false, reason: `Otari API returned HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}` };
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) return { available: false, reason: 'Otari returned an empty explanation.' };
    return { available: true, model: json.model || DEFAULT_MODEL, text };
  } catch (err) {
    return { available: false, reason: `Could not reach Otari: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}
