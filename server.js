// StudyGenius AI — backend proxy (v2, with diagnostics)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Serve only the website file (not server.js / package.json)
const indexPath = [path.join(__dirname, 'public', 'index.html'), path.join(__dirname, 'index.html')].find(p => fs.existsSync(p));
app.get('/', (req, res) => indexPath ? res.sendFile(indexPath) : res.status(404).send('index.html not found in repo'));

async function callClaude(prompt, maxTokens) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    });
    const raw = await r.text();
    let data = null; try { data = JSON.parse(raw); } catch (e) {}
    if (!r.ok) return { ok: false, status: r.status, error: (data && data.error && data.error.message) || raw.slice(0, 200) };
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return { ok: true, text };
  } finally { clearTimeout(timer); }
}

// Open  /api/health  in the browser to see exactly what is wrong
app.get('/api/health', async (req, res) => {
  const info = {
    server: 'running',
    keySet: !!API_KEY,
    keyLooksValid: API_KEY.startsWith('sk-ant-'),
    keyLength: API_KEY.length,
    model: MODEL,
    indexFound: !!indexPath,
  };
  if (!API_KEY) { info.problem = 'ANTHROPIC_API_KEY is missing in Render > Environment'; return res.json(info); }
  if (!info.keyLooksValid) info.warning = 'Key should start with sk-ant- (wrong key pasted?)';
  try {
    const t = await callClaude('Reply with the single word: ok', 20);
    info.anthropicTest = t.ok ? 'SUCCESS' : 'FAILED';
    if (!t.ok) info.anthropicError = t.error, info.anthropicStatus = t.status;
  } catch (e) { info.anthropicTest = 'FAILED'; info.anthropicError = String(e.message || e); }
  res.json(info);
});

app.post('/api/ask', async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server me ANTHROPIC_API_KEY set nahi aahe (Render > Environment)' });
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt (string) is required' });
  try {
    const out = await callClaude(prompt, 4000);
    if (!out.ok) {
      console.error('Anthropic error', out.status, out.error);
      let msg = out.error;
      if (out.status === 401) msg = 'API key chukichi aahe (401): ' + out.error;
      else if (out.status === 400 && /credit|billing/i.test(out.error)) msg = 'Anthropic account madhe credits/billing nahi: ' + out.error;
      else if (out.status === 404) msg = 'Model milala nahi (404): ' + out.error;
      else if (out.status === 429) msg = 'Khup requests / limit (429), thodya velane try kara';
      return res.status(502).json({ error: msg });
    }
    res.json({ text: out.text });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.name === 'AbortError' ? 'AI cha reply khup vel ghetoy (timeout), punha try kara' : 'Server error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyGenius backend running on port ${PORT}`));
