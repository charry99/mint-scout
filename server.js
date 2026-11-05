// Mint Scout server — stage 2: contract check engine + Otari AI explanations.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContract } from './lib/checker.js';
import { explainCheck, otariAvailable } from './lib/otari.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'mint-scout', ai: otariAvailable() });
});

app.post('/api/check', async (req, res) => {
  const { address, chainId } = req.body || {};
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ ok: false, error: 'address is required' });
  }
  const chain = Number(chainId) || 56;
  try {
    const result = await checkContract(address, chain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: `Check failed: ${err.message}` });
  }
});

// Otari-powered plain-language explanation of a check result.
// Body: { checkResult } — the JSON returned by /api/check.
// Without OTARI_AI_TOKEN this returns { available:false, reason } —
// the rest of the app keeps working.
app.post('/api/explain', async (req, res) => {
  const { checkResult } = req.body || {};
  if (!checkResult || typeof checkResult !== 'object') {
    return res.status(400).json({ ok: false, error: 'checkResult is required' });
  }
  const explanation = await explainCheck(checkResult);
  res.json({ ok: true, ...explanation });
});

app.listen(PORT, () => {
  console.log(`Mint Scout listening on http://localhost:${PORT}`);
});
