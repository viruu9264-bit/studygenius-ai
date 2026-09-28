// StudyGenius AI — backend proxy (v3): works with FREE Google Gemini key OR Anthropic key
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const GEMINI_KEY = (process.env.GEMINI_API_KEY || '').trim();
const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const PROVIDER = GEMINI_KEY ? 'gemini' : (ANTHROPIC_KEY ? 'anthropic' : 'none');

const indexPath = [path.join(__dirname, 'public', 'index.html'), path.join(__dirname, 'index.html')].find(p => fs.existsSync(p));
app.get('/', (req, res) => indexPath ? res.sendFile(indexPath) : res.status(404).send('index.html not found in repo'));

async function post(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100000);
  try {
    const r = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const raw = await r.text();
    let data = null; try { data = JSON.parse(raw); } catch (e) {}
    return { r, raw, data };
  } finally { clearTimeout(timer); }
}

async function callAI(prompt) {
  if (PROVIDER === 'gemini') {
    const { r, raw, data } = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      { 'x-goog-api-key': GEMINI_KEY },
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8192 } }
    );
    if (!r.ok) return { ok: false, status: r.status, error: (data && data.error && data.error.message) || raw.slice(0, 200) };
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    return { ok: true, text: parts.map(p => p.text || '').join('') };
  }
  const { r, raw, data } = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    { model: CLAUDE_MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }
  );
  if (!r.ok) return { ok: false, status: r.status, error: (data && data.error && data.error.message) || raw.slice(0, 200) };
  return { ok: true, text: (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') };
}

app.get('/api/health', async (req, res) => {
  const info = { server: 'running', provider: PROVIDER, model: PROVIDER === 'gemini' ? GEMINI_MODEL : CLAUDE_MODEL, indexFound: !!indexPath };
  if (PROVIDER === 'none') { info.problem = 'Render > Environment madhe GEMINI_API_KEY (free) kinva ANTHROPIC_API_KEY add kara'; return res.json(info); }
  try {
    const t = await callAI('Reply with the single word: ok');
    info.aiTest = t.ok ? 'SUCCESS' : 'FAILED';
    if (!t.ok) { info.aiStatus = t.status; info.aiError = t.error; }
  } catch (e) { info.aiTest = 'FAILED'; info.aiError = String(e.message || e); }
  res.json(info);
});

app.post('/api/ask', async (req, res) => {
  if (PROVIDER === 'none') return res.status(500).json({ error: 'Server madhe AI key set nahi (Render > Environment > GEMINI_API_KEY)' });
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt (string) is required' });
  try {
    const out = await callAI(prompt);
    if (!out.ok) {
      console.error('AI error', out.status, out.error);
      let msg = out.error;
      if (out.status === 400 && /API key/i.test(out.error)) msg = 'API key chukichi aahe: ' + out.error;
      else if (out.status === 401 || out.status === 403) msg = 'API key chukichi kinva permission nahi (' + out.status + '): ' + out.error;
      else if (out.status === 404) msg = 'Model milala nahi (404): ' + out.error;
      else if (out.status === 429) msg = 'Free limit sampli (429), 1 minute thamba ani punha try kara';
      return res.status(502).json({ error: msg });
    }
    res.json({ text: out.text });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.name === 'AbortError' ? 'AI cha reply khup vel ghetoy (timeout), punha try kara' : 'Server error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyGenius backend running on port ${PORT} (provider: ${PROVIDER})`));
