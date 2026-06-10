# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production (TypeScript errors are ignored per next.config.mjs)
npm run lint     # Run ESLint
npm run start    # Start production server
```

There are no tests in this project.

## Environment

Requires `OPENAI_API_KEY` in `.env.local`. The model defaults to `gpt-4o` but can be overridden with `OPENAI_MODEL` (e.g., `openai/gpt-4o-mini`). The `OPENAI_MODEL` value is used directly by the Vercel AI SDK (`@ai-sdk/openai`) in `/api/aac/predict` and stripped of the `openai/` prefix when passed to the raw OpenAI SDK in `/api/analyze-drawing`.

Licensing & analytics require MongoDB and a cookie secret:
- `MONGODB_URI` — MongoDB connection string (license keys + usage analytics)
- `MONGODB_DB` — database name (default `aac`)
- `LICENSE_COOKIE_SECRET` — HMAC secret used to sign the auth cookie

Authorized users are seeded manually — there is no self-registration. Run `node scripts/seed-licenses.mjs` (edit the `LICENSES` array first) or insert directly into the `licenses` collection.

## Architecture

This is a **Next.js 15 App Router** project — a single-page AAC (Augmentative and Alternative Communication) tool for children with communication challenges.

### License gate (`app/page.tsx`)

`app/page.tsx` is a **server component** that reads the signed `aac_uid` cookie (via `lib/auth.ts`). If absent/invalid it renders `<LicenseGate />` (`components/license-gate.tsx`); if valid it renders `<SmartDrawingEditor />` (`components/smart-editor.tsx`). The parent activates a device by POSTing a license key to `/api/auth/activate`, which validates it against the `licenses` collection and sets the httpOnly, HMAC-signed cookie (1-year). The cookie only carries an opaque `userId`, never the key. All AI routes also reject unauthenticated requests with `401`.

Usage analytics: `lib/usage-logger.ts` buffers interaction events client-side and flushes them via `navigator.sendBeacon` to `/api/usage`, which attributes them to the `userId` from the cookie and writes to the `usage_events` collection. `components/aac-board.tsx` emits `category_select`, `navigation`, and `sentence` events.

### Frontend (`components/smart-editor.tsx`)

`SmartDrawingEditor` is the root app component (rendered once licensed). It hosts two tabs via shadcn/ui `Tabs`:

- **Communicate tab** (default): renders `<AACBoard />` — a hierarchical symbol-based communication board
- **Draw tab** (hidden unless enabled in Settings): a freehand canvas that auto-submits to the drawing analysis API after a configurable pause

User preferences (voice on/off, pause duration, draw tab visibility, text area expanded state) are persisted to `localStorage`.

### AAC Board (`components/aac-board.tsx`)

A 3-level tree navigation (`CATEGORY_TREE`) where each level narrows a sentence:
1. Top-level category (e.g., Food)
2. Sub-category with a `phrase` starter (e.g., "I want to drink")
3. Leaf item that completes the phrase (e.g., "water")

Speech uses the browser Web Speech API (`window.speechSynthesis`). AI-powered suggestions are fetched on demand from `/api/aac/predict` and shown as an overlay grid.

### API Routes

| Route | Purpose | AI integration |
|---|---|---|
| `POST /api/auth/activate` | Validates a license key, sets the signed auth cookie | none (MongoDB lookup) |
| `POST /api/usage` | Logs batched usage events against the cookie's `userId` | none (MongoDB insert) |
| `POST /api/analyze-drawing` | Interprets canvas drawings as text | OpenAI SDK with vision (`image_url`), returns `{ success, text, newContent }` |
| `POST /api/aac/predict` | Returns 4 next-word suggestions | Vercel AI SDK `generateText` with structured output (`Output.object`) |
| `POST /api/aac/speak` | TTS audio (unused by current frontend, which uses Web Speech API) | OpenAI `tts-1`, voice `nova` |

### UI Components

shadcn/ui components live in `components/ui/` (generated, don't edit). Utility: `lib/utils.ts` exports `cn()` (clsx + tailwind-merge). Path alias `@/` maps to the project root.
