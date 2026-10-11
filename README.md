# FindTrack

**A community lost-and-found web app for the Philippines.** FindTrack helps people recover lost belongings through trusted community reporting and verified recovery workflows, built on the spirit of *bayanihan*.

Report something you lost or found, get matched with likely candidates, prove ownership with a security question, and arrange a safe hand-off, all in one place.

---

## Features

**Reporting and discovery**
- Report **lost** or **found** items with a title, category, description, color, date, location and photo.
- **AI photo analysis**: upload a picture and Gemini suggests a title, category, description and likely location.
- Search by keyword, status (lost / found / claimed), location and date, or browse by category.
- **Smart match suggestions** appear as you search, and an **AI Matchmaker** compares an item against reports of the opposite type, returning a confidence score and a short reason (matches under 35% are dropped).

**Verified recovery**
- Finders can attach a **security question and secret answer** to a found item.
- Owners submit an **ownership claim**; the answer is checked server-side with Gemini, and the finder approves or rejects the claim.
- Contact details unlock only after a claim is approved.
- Per-item **direct chat** between the two parties.

**Community and engagement**
- **Points and levels**: 15 points per report and 50 per reunited item, with five levels and a roadmap page.
- **Analytics**: reported vs. resolved items over the last six months, category breakdown and top locations.
- Pinned items, claim alerts with notification toggles, onboarding walkthrough, recovery and packaging tips.

**Accounts and access**
- Email/password sign-up with **email verification** (auto-detected while the verify screen is open).
- **Guest browsing** with prompts to sign in for actions like reporting or pinning.
- Profile with bio, contact details and generated avatars.
- Interface available in **English, Spanish, French, Filipino and Chinese**.
- Static pages: About, Safety Guidelines, Help Center, Contact, Privacy Policy and Terms of Service.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4, Motion (Framer Motion), Lucide icons, Material Symbols |
| Auth and database | Firebase Authentication and Cloud Firestore |
| Image hosting | Cloudinary (client-side uploads) |
| AI | Google Gemini via `@google/genai` (`gemini-2.0-flash`) |
| Server | Express 4 with `express-rate-limit`, Firebase Admin SDK |
| i18n | i18next, react-i18next, browser language detector |
| Hosting | Vercel (SPA + serverless functions); also runs as a plain Node server |

The project was originally scaffolded in Google AI Studio.

**Design system:** primary green `#01725a`, amber tertiary `#fab83f`, warm cream surfaces; Inter, Poppins and DM Sans. UI conventions for contributors and AI coding tools live in [`AGENTS.md`](AGENTS.md).

---

## How it works

- **Single-page app, no router library.** `src/App.tsx` switches between views (landing, login, signup, verify-email, dashboard, legal/help pages) with state and `history.pushState`. The dashboard has tabs: Home, Report, Search, Alerts, Profile, My Items, Pinned, Categories, Analytics, Recovery Tips, Packaging Tips, Settings and About/Help.
- **Real-time data.** The client subscribes to Firestore and renders items live.
- **Server-side AI.** Gemini calls run on the server so the API key never reaches the browser. Every AI endpoint requires a Firebase ID token (`Authorization: Bearer <token>`).
- **Firestore collections** used by the app: `items`, `itemSecrets` (private secret answers), `claims`, `chats` and `users`.

### API endpoints

| Method | Path | Purpose | Defined in |
|---|---|---|---|
| GET | `/api/health` | Health check | `server.ts` |
| POST | `/api/analyze-image` | Extract title, category, description and location from a photo | `server.ts`, `api/` |
| POST | `/api/ai-matchmaker` | Rank candidate matches for an item | `server.ts`, `api/` |
| POST | `/api/verify-claim` | Check a claimant's answer against the owner's secret answer | `server.ts` |

`server.ts` applies a rate limit of 20 requests per 15 minutes per IP to the AI routes. Request bodies are capped at 12 MB to allow base64 photos.

---

## Project structure

```
.
├── api/                      # Vercel serverless functions
│   ├── ai-matchmaker.ts
│   └── analyze-image.ts
├── src/
│   ├── main.tsx              # App entry point
│   ├── App.tsx               # Views, auth flow, dashboard shell
│   ├── firebase.ts           # Firebase client setup and error helper
│   ├── types.ts              # Item, Claim, Match, Category types
│   ├── components/           # ItemCard, ItemDetail, Matchmaker, ChatInterface,
│   │   ├── claims/           #   AuthModal, Header, SubmissionForm ...
│   │   └── report/           # Multi-step report form
│   ├── pages/                # Home, Settings, LevelRoadmap
│   ├── lib/                  # claims.ts (claim hooks), cloudinary.ts (uploads)
│   └── i18n/                 # config.ts and locales/{en,es,fr,fil,zh}.json
├── server.ts                 # Express server: Vite middleware in dev, static files in prod
├── vite.config.ts
├── vercel.json               # Security headers and SPA rewrites
├── firestore.rules           # Firestore security rules
├── security_spec.md          # Security notes
├── AGENTS.md                 # UI/UX guidelines for AI coding tools
├── .env.example              # Environment variable template
└── package.json
```

The root-level `*.cjs` files are one-off helper scripts from development and are not part of the app.

---

## Getting started

**Prerequisites:** Node.js 20 or later, a Firebase project (Authentication and Firestore enabled), a Cloudinary account with an unsigned upload preset, and a Gemini API key.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file and fill in the values (see the table below):
   ```bash
   cp .env.example .env
   ```
   Make sure `.env` is listed in `.gitignore` and never committed.
3. Give the Firebase Admin SDK credentials for local use. The server calls `initializeApp()` with no arguments, so it relies on Application Default Credentials, for example by setting `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key file.
4. Start the dev server:
   ```bash
   npm run dev
   ```
   The app runs at <http://localhost:3000>.

### Environment variables

| Variable | Used by | Description |
|---|---|---|
| `GEMINI_API_KEY` | Server | Gemini API key for the AI endpoints |
| `APP_URL` | Server | URL where the app is hosted |
| `VITE_FIREBASE_API_KEY` | Client | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Client | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Client | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Client | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Client | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Client | Firebase app ID |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Client | Firestore database ID |
| `VITE_CLOUDINARY_CLOUD_NAME` | Client | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Client | Cloudinary unsigned upload preset |

Variables prefixed with `VITE_` are bundled into the browser build, so never put secrets in them.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Express server with Vite middleware (hot reload) |
| `npm run build` | Build the client with Vite and bundle `server.ts` to `dist/server.cjs` |
| `npm start` | Run the production server from `dist/server.cjs` |
| `npm run preview` | Preview the Vite build |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run clean` | Remove build output |

---

## Deployment

- **Vercel:** `vercel.json` sets the security headers, rewrites all routes to `index.html` and passes `/api/*` through to the `api/` functions. Add the environment variables above in the Vercel project settings.
- **Any Node host:** run `npm run build`, then `npm start`. The server serves `dist/` and the API routes on port 3000.

## Security

- Content-Security-Policy, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Resource-Policy` headers are set in `vercel.json`.
- Email verification is required before accessing the dashboard.
- AI endpoints verify Firebase ID tokens and are rate limited.
- Secret answers for ownership checks live in a separate `itemSecrets` collection.
- Firestore access is governed by `firestore.rules`; see `security_spec.md` for the design notes.

Found a vulnerability? Please report it privately to the maintainer instead of opening a public issue.
