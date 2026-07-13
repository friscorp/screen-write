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

Authorized users are seeded manually — there is no self-registration. Run `node scripts/seed-licenses.mjs` (edit the `LICENSES` array first) or insert directly into the `licenses` collection. The seed script loads env via `@next/env` (same as the app), so run it plain — do **not** pass `--env-file`.

Note: `@next/env` runs dotenv variable-expansion, so any literal `$` in env values (e.g. a MongoDB password) must be escaped as `\$` in `.env`, otherwise it's silently mangled and auth fails.

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

Speech uses the browser Web Speech API (`window.speechSynthesis`). The board is intentionally "hardcoded" from whatever was last saved via Settings: it never fetches or reorders items live based on AI or usage data — the tree only changes when a parent adds, edits, or regenerates a category in `components/parent-config.tsx`. In **simple mode** (`simpleMode` prop, default on), tapping a top-level category flattens every sub-category's leaves into one grid (`simpleModeLeaves()` in `aac-board.tsx`), deduped by word and capped at 20 items (`MAX_SIMPLE_MODE_ITEMS`) so the board stays scannable regardless of how many leaves the category actually has.

Level-1 categories are managed in `components/parent-config.tsx`: the built-in and custom categories can all be added, **edited** (name, emoji, preference hints), regenerated, or removed. The category `description` field holds the preference hints used by `/api/aac/generate-tree`, which targets 10–20 unique Level-3 items per category (not a fixed count) and dedupes/caps server-side as a safety net.

### API Routes

| Route | Purpose | AI integration |
|---|---|---|
| `POST /api/auth/activate` | Validates a license key, sets the signed auth cookie | none (MongoDB lookup) |
| `POST /api/usage` | Logs batched usage events against the cookie's `userId` | none (MongoDB insert) |
| `POST /api/analyze-drawing` | Interprets canvas drawings as text | OpenAI SDK with vision (`image_url`), returns `{ success, text, newContent }` |
| `POST /api/aac/generate-tree` | Generates (or regenerates) a category's full sub-category/item tree from its name, emoji, and preference hints; targets 10–20 unique Level-3 items, deduped and capped server-side | Vercel AI SDK `generateObject` |
| `POST /api/aac/predict` | Returns 4 next-word suggestions (unused by current frontend) | Vercel AI SDK `generateText` with structured output (`Output.object`) |
| `POST /api/aac/speak` | TTS audio (unused by current frontend, which uses Web Speech API) | OpenAI `tts-1`, voice `nova` |

### UI Components

shadcn/ui components live in `components/ui/` (generated, don't edit). Utility: `lib/utils.ts` exports `cn()` (clsx + tailwind-merge). Path alias `@/` maps to the project root.
