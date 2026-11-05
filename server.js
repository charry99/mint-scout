// Mint Scout server — stage 1: contract check engine + static UI.
// The Otari AI explanation endpoint lands in a separate commit on
// branch mint-scout-otari (see lib/otari.js).
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContract } from './lib/checker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'mint-scout', ai: false });
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

app.listen(PORT, () => {
  console.log(`Mint Scout listening on http://localhost:${PORT}`);
});
