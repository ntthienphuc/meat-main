# Meat Freshness Assistant

AI assisted meat-quality checker with a knowledge hub, local accounts, and a lightweight serverless proxy for Hugging Face image inference.

---

## Overview

The project delivers a single-page experience (Vietnamese UI) that helps households judge meat freshness. Users can:

- upload or capture a photo for AI analysis (proxied through Vercel to a Hugging Face Space),
- browse curated guidance, FAQs, and blog-style articles,
- save detections, reminders, and favorite content to browser storage,
- log in with a simple local account system (no external auth required).

Everything ships as static assets plus two Vercel serverless functions housed in `api/`.

---

## Key Features

- **AI Prediction** – Uses `api/predict` to relay multipart image uploads to the public FastAPI hosted at `https://thienphuc12339-meat.hf.space/predict`.
- **Knowledge Hub** – Rich, pre-seeded content rendered from `app.js`, including tutorials, FAQs, and meat-selection tips.
- **Local Accounts** – `auth.js` implements registration, login, roles (admin/test users), and toast notifications using `localStorage`.
- **History & Reminders** – Detection history, bookmarks, and storage reminders persist per-browser in `localStorage`.
- **Responsive UI** – Extensive styling (`style.css`, `landing-immersive.css`, `animated-background.css`) with animated backgrounds and mobile layouts.
- **Unicode Safety** – `unicode-polyfill.js` ensures accented Vietnamese text renders correctly on older environments.

---

## Tech Stack

| Layer          | Details                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| Frontend       | Vanilla HTML/CSS/JS served statically                                    |
| State & Data   | Browser `localStorage`; in-memory data defined inside `app.js`           |
| AI Backend     | Hugging Face Space (`thienphuc12339/meat`) exposing FastAPI endpoints     |
| Proxy          | Vercel serverless functions (`api/health`, `api/predict`) using `node:20`|
| Tooling        | `http-server` for local previews (`npm run dev`)                         |

---

## Project Structure

```
.
├─ index.html                # Entry document loading all scripts and styles
├─ app.js                    # Core UI logic, content data, and view binding
├─ auth.js                   # Local account system, history/bookmark persistence
├─ auth-ui.js                # Auth modals, forms, and related UI helpers
├─ api_integration.js        # Prediction workflow + client-side safeguards
├─ unicode-polyfill.js       # Unicode helpers for legacy browsers
├─ style.css                 # Global styles; layout utilities
├─ landing-immersive.css     # Landing page hero & animations
├─ animated-background.css   # Particle/gradient animation definitions
├─ api/
│  ├─ health.js              # GET /api/health → exposes configured FASTAPI_URL
│  └─ predict.js             # POST /api/predict → multipart proxy to Hugging Face
├─ vercel.json               # Vercel deployment config + env binding
└─ package.json              # npm metadata and dev script
```

---

## Data & Persistence

- All user-generated data (accounts, saved detections, reminders, search analytics) is stored in the browser using `localStorage`. Clearing the browser storage resets the app state.
- Admin credentials bundled for demos:
  - `admin / thittuoi2025`
  - `testuser / test123` (or register a new user).
- No external database or Supabase instance is required for this version.

---

## API Surface

| Route             | Method | Description                                                                                                      |
| ----------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `/api/health`     | GET    | Health check that also returns the configured `FASTAPI_URL` (helps verify deployment wiring).                   |
| `/api/predict`    | POST   | Accepts `multipart/form-data` with a `file` field; streams the payload to the Hugging Face `/predict` endpoint. |

> The upstream FastAPI expects an image tensor under `file`. Responses are JSON objects containing meat type, freshness percentage, and confidence.

---

## Configuration

| Variable     | Where to set            | Purpose                                                     |
| ------------ | ---------------------- | ----------------------------------------------------------- |
| `FASTAPI_URL`| Vercel Project Settings | Base URL of the Hugging Face FastAPI (no trailing slash).   |

When using Vercel CLI locally (`vercel dev`), either set the environment variable in `.vercel/env.local` or export it before launching. The default `vercel.json` already points production deployments to `https://thienphuc12339-meat.hf.space`.

---

## Local Development

### Quick UI Preview

```bash
npm install
npm run dev
```

This spins up `http-server` on `http://localhost:3000` for a static preview. Image predictions will not work in this mode because `/api/*` routes are unavailable.

### Full Stack Preview (with AI proxy)

1. Install the Vercel CLI (`npm i -g vercel`) if you have not already.
2. Set `FASTAPI_URL` in the local Vercel environment:
   ```bash
   vercel env add FASTAPI_URL development
   # paste https://thienphuc12339-meat.hf.space when prompted
   ```
3. Run `vercel dev` from the project root. This emulates Vercel functions so `/api/predict` works locally.
4. Visit the served URL (default `http://localhost:3000`) and upload a meat photo.

### Testing Hugging Face Directly

Use the integrated health endpoint to wake the model before testing:

```bash
curl https://thienphuc12339-meat.hf.space/health
```

Then submit a small (<4 MB) JPEG:

```bash
curl -F "file=@your-image.jpg" https://thienphuc12339-meat.hf.space/predict
```

If the Space has idled, the first request may take longer while the container starts.

---

## Deployment

1. Push the repository to GitHub (or your Vercel Git integration).  
2. Create a Vercel project pointing to this directory.  
3. In Vercel Project Settings → Environment Variables, set `FASTAPI_URL` to the desired Hugging Face endpoint.  
4. Trigger a deployment. Vercel will serve static assets from the repository root and treat `api/` as serverless functions. No build step is required (`buildCommand` in `vercel.json` is a no-op).  
5. Verify `https://<your-domain>/api/health` returns `{ "ok": true, ... }`.

The client automatically resizes/compresses oversized uploads before passing them to `/api/predict` to stay within Vercel’s 4 MB function payload limit.

---

## Troubleshooting

- **413 Request Entity Too Large** – Images exceeding ~4 MB are rejected by Vercel. The client attempts to compress them, but advise users to shoot in lower resolution if this persists.
- **500 from `/api/predict`** – Usually indicates the Hugging Face model is still warming up or rejected the payload. Check `/api/health` and the upstream `/health` endpoint.
- **State not persisting** – Ensure the browser allows `localStorage`. Private/incognito modes may clear data between sessions.
- **Unicode garbling** – Always serve files with UTF-8 encoding. The included polyfill covers most edge cases.

---

## License

No explicit license is provided. Treat the source as **all rights reserved** unless granted otherwise by the repository owner.
