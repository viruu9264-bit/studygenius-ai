# StudyGenius AI — self-hosted version

This package runs the full website (notes, quiz, flashcards, AI tutor)
on your own server, so it works outside claude.ai too.

## 1. Get an Anthropic API key
1. Go to https://console.anthropic.com and sign up / log in.
2. Add billing (pay-as-you-go), then create an API key under "API Keys".

## 2. Run it on your computer (to test)
```
npm install
cp .env.example .env
# open .env and paste your key after ANTHROPIC_API_KEY=
npm start
```
Open http://localhost:3000 in your browser — the site is fully working there.

## 3. Put it online (so others can use it)
Any Node.js host works. Easiest free options:

**Render.com**
1. Push this folder to a GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `npm install`  |  Start command: `npm start`
4. Add an environment variable `ANTHROPIC_API_KEY` with your key.
5. Deploy — Render gives you a URL like `https://studygenius.onrender.com`.

**Railway.app** works the same way (New Project → Deploy from GitHub → add the `ANTHROPIC_API_KEY` variable).

## Folder contents
- `server.js` — the backend; keeps your API key private and forwards requests to Anthropic.
- `public/index.html` — the website (open this file's source if you want to edit the design/copy).
- `.env.example` — copy to `.env` and put your real key there (never commit `.env`).

## Cost note
Each AI request (notes, quiz, flashcards, tutor reply) uses a small amount
of Anthropic API credit — a few uploads and quizzes typically cost only cents.
Monitor usage at https://console.anthropic.com.
