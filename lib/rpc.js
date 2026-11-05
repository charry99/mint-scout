// Raw JSON-RPC helper with endpoint fallback + per-call timeouts.
// No provider SDK assumptions — plain fetch, so a flaky dataseed never
// takes the whole check down. 48.club first on BSC (most reliable in
// our experience); dataseed last (403s/drops often).
const ENDPOINTS = {
  56: [
    'https://rpc-bsc.48.club',
    'https://bsc.publicnode.com',
    'https://bsc-dataseed1.defibit.com',
    'https://bsc-dataseed.binance.org',
  ],
  1: [
    'https://ethereum.publicnode.com',
    'https://cloudflare-eth.com',
    'https://rpc.ankr.com/eth',
  ],
  8453: [
    'https://mainnet.base.org',
    'https://base.publicnode.com',
  ],
  42161: [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.publicnode.com',
  ],
  137: [
    'https://polygon-rpc.com',
    'https://polygon.publicnode.com',
  ],
  10: [
    'https://mainnet.optimism.io',
    'https://optimism.publicnode.com',
  ],
};

export const CHAIN_NAMES = {
  56: 'BNB Chain',
  1: 'Ethereum',
  8453: 'Base',
  42161: 'Arbitrum One',
  137: 'Polygon',
  10: 'Optimism',
};

export function endpointsFor(chainId) {
  return ENDPOINTS[chainId] || [];
}

async function postJson(url, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'RPC error');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call a JSON-RPC method, trying each endpoint for the chain in order.
 * Returns { result, endpoint } on first success, or throws the last error.
 */
export async function rpcCall(chainId, method, params, timeoutMs = 8000) {
  const urls = endpointsFor(chainId);
  if (urls.length === 0) throw new Error(`No RPC endpoints configured for chain ${chainId}`);
  let lastErr;
  for (const url of urls) {
    try {
      const result = await postJson(
        url,
        { jsonrpc: '2.0', id: 1, method, params },
        timeoutMs
      );
      return { result, endpoint: url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('All RPC endpoints failed');
}

/** eth_getCode — returns the hex bytecode (or '0x' for an EOA). */
export async function getCode(chainId, address) {
  const { result } = await rpcCall(chainId, 'eth_getCode', [address, 'latest']);
  return result;
}

/** eth_call with a `to` + `data`, returns raw hex result. */
export async function ethCall(chainId, to, data) {
  const { result } = await rpcCall(chainId, 'eth_call', [{ to, data }, 'latest']);
  return result;
}
