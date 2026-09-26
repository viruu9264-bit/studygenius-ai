// StudyGenius AI — backend proxy
// Keeps the Anthropic API key on the server; the website calls this instead of calling Anthropic directly.
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public')); // put studygenius.html in a "public" folder next to this file

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

app.post('/api/ask', async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt (string) is required' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Anthropic API error' });

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error calling Anthropic API' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyGenius backend running on port ${PORT}`));
