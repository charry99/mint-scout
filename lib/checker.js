// Mint Scout check engine — the core value.
// For a contract address on a given chain it:
//   1. confirms it is a contract (eth_getCode)
//   2. checks Sourcify verification status (exact_match / match / null)
//   3. reads name / symbol / decimals / totalSupply / owner() on-chain
//   4. scans the ABI for risky or interesting functions
//   5. produces a VERIFIED / NEEDS REVIEW / HIGH RISK verdict + checklist
// Never fabricates data: anything that could not be read is "unknown".
import { AbiCoder, Interface } from 'ethers';
import { getCode, ethCall, CHAIN_NAMES } from './rpc.js';

const abiCoder = AbiCoder.defaultAbiCoder();

// Function selectors for the standard reads.
const SEL = {
  name: '0x06fdde03',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
  totalSupply: '0x18160ddd',
  owner: '0x8da5cb5b',
  paused: '0x5c975abb',
};

function decodeString(hex) {
  try {
    return abiCoder.decode(['string'], hex)[0];
  } catch {
    try {
      // Some tokens return bytes32 instead of a string.
      const raw = abiCoder.decode(['bytes32'], hex)[0];
      return raw.replace(/\0+$/, '');
    } catch {
      return null;
    }
  }
}

function decodeUint(hex) {
  try {
    return abiCoder.decode(['uint256'], hex)[0].toString();
  } catch {
    return null;
  }
}

function decodeAddress(hex) {
  try {
    return abiCoder.decode(['address'], hex)[0];
  } catch {
    return null;
  }
}

function decodeBool(hex) {
  try {
    return abiCoder.decode(['bool'], hex)[0];
  } catch {
    return null;
  }
}

// Sourcify v2: https://sourcify.dev/server/v2/contract/{chainId}/{address}?fields=abi
async function sourcifyCheck(chainId, address) {
  const url = `https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=abi`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 404) return { status: null, abi: null };
    if (!res.ok) return { status: 'unknown', abi: null, note: `Sourcify HTTP ${res.status}` };
    const json = await res.json();
    const runtime = json.runtimeMatch || null;
    const creation = json.creationMatch || null;
    let status = null;
    // v2 values are the literal strings "exact_match" / "partial_match".
    if (runtime === 'exact_match' || creation === 'exact_match' || json.match === 'exact_match') status = 'exact_match';
    else if (runtime === 'partial_match' || creation === 'partial_match' || json.match === 'partial_match') status = 'match';
    else if (json.abi) status = 'match';
    return { status, abi: Array.isArray(json.abi) ? json.abi : null };
  } catch (err) {
    return { status: 'unknown', abi: null, note: `Sourcify unreachable: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

// ABI function-name groups we care about. Each entry: [group, names[]].
const ABI_GROUPS = [
  ['mint', ['mint', 'mintfree', 'freemint', 'claimfree', 'claim', 'publicmint', 'mintwithagentid', 'freemintwithvoucher', 'claimfreewithvoucher']],
  ['pause', ['pause', 'unpause', 'paused', 'setpaused']],
  ['blacklist', ['blacklist', 'isblacklisted', 'setblacklist', 'addtoblacklist', 'removeblacklist']],
  ['uriRoyalty', ['setbaseuri', 'settokenuri', 'seturi', 'setroyalty', 'setdefaultroyalty', 'setroyaltyinfo']],
  ['withdraw', ['withdraw', 'withdraweth', 'withdrawbnb', 'withdrawusdt', 'claimfees', 'withdrawresidue', 'sweep']],
  ['limits', ['maxtxamount', 'maxwalletamount', 'setmaxtx', 'setmaxwallet', 'setmaxsupply', 'maxtx', 'maxwallet']],
  ['tax', ['buytax', 'selltax', 'settaxes', 'setbuytax', 'setselltax', 'taxfee', 'settaxfee']],
  ['launch', ['launched', 'launch', 'tradingenabled', 'enabletrading', 'openpool', 'poolopen']],
  ['refund', ['refund', 'refundbps', 'finalizerefund']],
  ['owner', ['owner', 'transferownership', 'renounceownership']],
];

function scanAbi(abi) {
  const found = {};
  if (!Array.isArray(abi)) return found;
  const names = new Set();
  const payableMints = [];
  for (const item of abi) {
    if (item.type !== 'function' || !item.name) continue;
    const lower = item.name.toLowerCase();
    names.add(lower);
    if (
      ['mint', 'mintfree', 'freemint', 'claimfree', 'claim', 'publicmint', 'mintwithagentid', 'freemintwithvoucher', 'claimfreewithvoucher'].includes(lower) &&
      item.stateMutability === 'payable'
    ) {
      payableMints.push(item.name);
    }
  }
  for (const [group, groupNames] of ABI_GROUPS) {
    found[group] = groupNames.filter((n) => names.has(n));
  }
  found.payableMints = payableMints;
  // Try to read the interface to detect ERC-721 vs ERC-20 shape.
  const has721 = names.has('tokenuri') || names.has('ownerof') || names.has('tokensupply') || names.has('totalminted');
  const has20 = names.has('totalsupply') && names.has('transfer') && names.has('balanceof');
  found.tokenStandard = has721 && !has20 ? 'ERC-721 (NFT)' : has20 && !has721 ? 'ERC-20 (fungible)' : has721 && has20 ? 'mixed / unknown' : 'unknown';
  return found;
}

/**
 * Run the full check. Returns a structured result object (JSON-safe:
 * no BigInts — everything is converted to strings first).
 */
export async function checkContract(address, chainId = 56) {
  const addr = address.trim();
  const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  const checks = [];
  const facts = { address: addr, chainId, chainName };
  const flags = [];

  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return { ok: false, error: 'Invalid address format — expected 0x + 40 hex characters.', address: addr, chainId };
  }

  // 1. Is it a contract at all?
  let code;
  try {
    code = await getCode(chainId, addr);
  } catch (err) {
    return { ok: false, error: `Could not read chain state: ${err.message}`, address: addr, chainId };
  }
  const isContract = code && code !== '0x' && code.length > 2;
  checks.push({
    id: 'isContract',
    label: 'Address holds contract code',
    status: isContract ? 'pass' : 'fail',
    detail: isContract ? `Bytecode present (${code.length - 2} hex chars)` : 'No code at this address — it is a wallet (EOA), not a contract.',
  });
  if (!isContract) {
    return {
      ok: true,
      kind: 'not_contract',
      verdict: null,
      address: addr,
      chainId,
      chainName,
      checks,
      facts,
      flags: ['not-a-contract'],
      summary: 'This address is a wallet, not a contract. There is nothing to mint or verify here.',
    };
  }

  // 2. Sourcify verification + ABI.
  const src = await sourcifyCheck(chainId, addr);
  facts.sourcify = src.status;
  if (src.status === 'exact_match') {
    checks.push({ id: 'sourcify', label: 'Source code verified on Sourcify', status: 'pass', detail: 'Exact match — deployed bytecode matches the published source exactly.' });
  } else if (src.status === 'match') {
    checks.push({ id: 'sourcify', label: 'Source code verified on Sourcify', status: 'pass', detail: 'Partial match — source is verified, metadata differs slightly.' });
  } else if (src.status === null) {
    checks.push({ id: 'sourcify', label: 'Source code verified on Sourcify', status: 'fail', detail: 'Not verified — nobody can read what this contract actually does.' });
    flags.push('unverified');
  } else {
    checks.push({ id: 'sourcify', label: 'Source code verified on Sourcify', status: 'unknown', detail: src.note || 'Verification status could not be read.' });
    flags.push('verification-unknown');
  }

  // 3. On-chain reads (each independent — a failure is "unknown", not zero).
  const reads = {};
  const readJobs = [
    ['name', SEL.name, decodeString],
    ['symbol', SEL.symbol, decodeString],
    ['decimals', SEL.decimals, (h) => { try { return String(abiCoder.decode(['uint8'], h)[0]); } catch { return null; } }],
    ['totalSupply', SEL.totalSupply, decodeUint],
    ['owner', SEL.owner, decodeAddress],
    ['paused', SEL.paused, decodeBool],
  ];
  for (const [key, sel, decode] of readJobs) {
    try {
      const hex = await ethCall(chainId, addr, sel);
      reads[key] = hex === '0x' || !hex ? null : decode(hex);
    } catch {
      reads[key] = null;
    }
  }
  Object.assign(facts, reads);

  checks.push({
    id: 'nameSymbol',
    label: 'Contract exposes name / symbol',
    status: reads.name || reads.symbol ? 'pass' : 'unknown',
    detail: reads.name || reads.symbol
      ? `${reads.name || '?'} (${reads.symbol || '?'})`
      : 'name()/symbol() did not return readable values.',
  });
  if (reads.totalSupply !== null) {
    checks.push({ id: 'totalSupply', label: 'Total supply readable on-chain', status: 'pass', detail: `totalSupply = ${reads.totalSupply} (raw units; divide by 10^decimals for tokens)` });
  } else {
    checks.push({ id: 'totalSupply', label: 'Total supply readable on-chain', status: 'unknown', detail: 'totalSupply() did not return a value — may be an NFT or a non-standard contract.' });
  }
  if (reads.owner) {
    const zero = /^0x0{40}$/i.test(reads.owner);
    checks.push({
      id: 'owner',
      label: 'Contract has a live owner',
      status: zero ? 'pass' : 'fail',
      detail: zero ? 'Ownership renounced (owner is the zero address).' : `Owner: ${reads.owner} — the owner can usually change settings or withdraw funds.`,
    });
    if (!zero) flags.push('live-owner');
  } else {
    checks.push({ id: 'owner', label: 'Contract has a live owner', status: 'unknown', detail: 'No owner() function, or the call failed.' });
  }
  if (reads.paused !== null) {
    checks.push({ id: 'paused', label: 'Contract is not paused', status: reads.paused ? 'fail' : 'pass', detail: reads.paused ? 'paused() = true — minting/interactions are currently frozen.' : 'paused() = false.' });
    if (reads.paused) flags.push('paused');
  }

  // 4. ABI scan (only possible when Sourcify gave us an ABI).
  const abiScan = scanAbi(src.abi);
  facts.tokenStandard = abiScan.tokenStandard || 'unknown';
  if (src.abi) {
    const admin = [...(abiScan.pause || []), ...(abiScan.uriRoyalty || []), ...(abiScan.withdraw || [])];
    checks.push({
      id: 'adminControls',
      label: 'Owner admin controls in ABI',
      status: admin.length === 0 ? 'pass' : 'fail',
      detail: admin.length === 0
        ? 'No pause / URI / royalty / withdraw functions found in the ABI.'
        : `Found: ${admin.join(', ')} — the owner can change behaviour or take funds.`,
    });
    if (admin.length > 0) flags.push('admin-controls');

    checks.push({
      id: 'payableMint',
      label: 'Mint functions and cost',
      status: 'pass',
      detail: (abiScan.mint || []).length === 0
        ? 'No mint/claim function found in the ABI.'
        : (abiScan.payableMints || []).length > 0
          ? `Payable mint function(s): ${abiScan.payableMints.join(', ')} — minting costs value (check the exact price before approving).`
          : `Free-style mint function(s): ${(abiScan.mint || []).join(', ')} — no value required by the function itself (gas still applies).`,
    });
    if ((abiScan.payableMints || []).length > 0) flags.push('payable-mint');

    if ((abiScan.blacklist || []).length > 0) {
      checks.push({ id: 'blacklist', label: 'Blacklist functions', status: 'fail', detail: `Found: ${abiScan.blacklist.join(', ')} — the owner can block addresses.` });
      flags.push('blacklist');
    } else {
      checks.push({ id: 'blacklist', label: 'Blacklist functions', status: 'pass', detail: 'No blacklist functions in the ABI.' });
    }
    if ((abiScan.tax || []).length > 0) {
      checks.push({ id: 'tax', label: 'Buy/sell tax functions', status: 'fail', detail: `Found: ${abiScan.tax.join(', ')} — transfers may be taxed; check the rates.` });
      flags.push('tax');
    } else {
      checks.push({ id: 'tax', label: 'Buy/sell tax functions', status: 'pass', detail: 'No tax functions in the ABI.' });
    }
    if ((abiScan.limits || []).length > 0) {
      checks.push({ id: 'limits', label: 'Transfer / wallet limits', status: 'unknown', detail: `Found: ${abiScan.limits.join(', ')} — limits exist; values need a live read.` });
      flags.push('limits');
    }
    facts.abiFunctions = {
      mint: abiScan.mint || [],
      payableMints: abiScan.payableMints || [],
      pause: abiScan.pause || [],
      withdraw: abiScan.withdraw || [],
      uriRoyalty: abiScan.uriRoyalty || [],
      blacklist: abiScan.blacklist || [],
      tax: abiScan.tax || [],
      launch: abiScan.launch || [],
      refund: abiScan.refund || [],
    };
  } else {
    checks.push({ id: 'abiScan', label: 'ABI available for risk scan', status: 'unknown', detail: 'No ABI — the contract is unverified, so function-level risks cannot be checked.' });
    flags.push('no-abi');
  }

  // 5. Verdict heuristics.
  const unverified = src.status === null;
  const verificationUnknown = src.status === 'unknown';
  const hasAdmin = flags.includes('admin-controls');
  const hasPayable = flags.includes('payable-mint');
  const hasBlacklist = flags.includes('blacklist');
  const hasTax = flags.includes('tax');
  const liveOwner = flags.includes('live-owner');

  let verdict;
  let summary;
  if (unverified && (hasPayable || hasAdmin || liveOwner)) {
    verdict = 'HIGH RISK';
    summary = 'Unverified contract with owner controls and/or a paid mint. Nothing about what it does can be confirmed from source — do not mint or approve anything here.';
  } else if (unverified) {
    verdict = 'NEEDS REVIEW';
    summary = 'Contract is not verified on Sourcify, so its behaviour cannot be confirmed from source. Treat any mint as unproven until the code is published or verified another way.';
  } else if (verificationUnknown) {
    verdict = 'NEEDS REVIEW';
    summary = 'Verification status could not be read, so the verdict is cautious by default. Re-check before minting.';
  } else if (hasBlacklist || hasTax) {
    verdict = 'NEEDS REVIEW';
    summary = 'Source is verified, but the contract has blacklist and/or tax functions. Read the rates and who can change them before minting.';
  } else if (hasAdmin && liveOwner) {
    verdict = 'NEEDS REVIEW';
    summary = 'Source is verified, but a live owner holds admin controls (pause / URI / withdraw). The mechanics check out; the trust question is the owner.';
  } else {
    verdict = 'VERIFIED';
    summary = 'Source verified on Sourcify with no admin red flags found in the ABI. Still check the mint price, supply and limits before approving — verification proves the code, not the project.';
  }

  return {
    ok: true,
    kind: 'contract',
    verdict,
    address: addr,
    chainId,
    chainName,
    checks,
    facts,
    flags,
    summary,
  };
}
