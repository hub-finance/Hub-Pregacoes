# CLAUDE.md

Guidance for Claude Code and other AI assistants working in this repository.

---

## Repository

| | |
|---|---|
| Remote | `https://github.com/hub-finance/Hub-Pregacoes` |
| Owner | `hub-finance` |
| Visibility | Public |
| Contents | A single application, **Hub Bible**, under `hub-bible/` |
| Deploy | Vercel (static), configured by `vercel.json` at the repository root |

**Language convention: Portuguese (pt-BR).** UI copy, code comments, commit
messages and documentation are written in Portuguese. Identifiers (variables,
functions, types) are in English, which is the pattern already established
throughout `hub-bible/src`. Keep both sides of that split.

---

## How to use and maintain this file

This file is the entry point for any AI assistant working here. It is only
useful if it stays true.

1. **Verify before documenting.** Every command, path, and convention recorded
   below must be something you actually ran or read in the repo — not something
   inferred from a framework's usual layout.
2. **Keep it short.** Prefer a few accurate, load-bearing facts over exhaustive
   description. If something is discoverable in one obvious command, link to the
   command rather than transcribing its output.

---

## Project overview

**Hub Bible** — a Bible app that doubles as a ministry workspace: reading,
search, highlights, notes, devotionals, studies, sermons, a ministry library,
reading plans and a full-screen preaching mode.

- **Users:** pastors, leaders and members — personal study and sermon prep.
- **Type:** installable PWA (client-side only). No backend, no accounts, no
  telemetry. All user data lives in the browser's IndexedDB on the device.
- **Deployed** as a static site on Vercel; the built output is `hub-bible/dist`.

Read `hub-bible/README.md` first — it is the functional description of the app.
**Picking up work in a new session: start from `hub-bible/docs/PENDENCIAS.md`**,
which records what is left, what was already investigated, and why.

---

## Tech stack

- **React 18 + TypeScript 5.6**, bundled by **Vite 5** (`hub-bible/vite.config.ts`).
- **Dexie 4** over IndexedDB — the only datastore. Schema in
  `hub-bible/src/core/db/db.ts`; bump the Dexie version and add a migration when
  changing it.
- **React Router 6** with `HashRouter` — deliberate, so the build works from a
  subdirectory and inside an Android WebView without server rewrites.
- **vite-plugin-pwa** (Workbox) for the service worker and manifest.
- **No UI framework.** Styling is hand-written CSS with design tokens in
  `hub-bible/src/styles/tokens.css`.
- Package manager: **npm**; `hub-bible/package-lock.json` is authoritative.
  `engines.node >= 18`.

No environment variables are required — the app has no secrets and makes no
authenticated network calls.

---

## Repository structure

```
vercel.json          # build config; points Vercel at hub-bible/
hub-bible/
  public/bible/      # scripture as static JSON, one file per book per translation
  scripts/           # ETL that generates public/bible/ and the PWA icons
  src/
    core/            # business logic; must not import from features/
      bible/         # canon, reference parsing, repository, search
      data/          # CRUD per domain (favorites, notes, documents, plans…)
      db/            # Dexie schema and types
      ai/ sync/      # contracts for future features; no provider registered
    features/        # one folder per screen
    components/      # shared UI primitives
    styles/          # tokens, base, layout, reader
  docs/              # licensing, architecture, deploy
```

The dependency rule is one-way: `features → core`, never the reverse.

`hub-bible/public/bible/` is **generated** — edit `scripts/build-bible-data.mjs`
and re-run it rather than hand-editing the JSON.

---

## Commands

Run from `hub-bible/` (or use `npm --prefix hub-bible <script>` from the root).

| Purpose | Command |
|---|---|
| Install dependencies | `npm ci` |
| Run locally (dev) | `npm run dev` |
| Build | `npm run build` |
| Serve the build | `npm run preview` |
| Type-check | `npx tsc --noEmit` |
| Regenerate scripture data | `npm run bible:build` |
| Regenerate PWA icons | `node scripts/generate-icons.mjs` |

There is **no automated test suite and no linter configured.** Verification so
far has been type-checking plus driving the built app in a headless browser
(Playwright) across mobile, tablet and desktop widths. If you add tests, record
the command here.

`npm run build` runs `tsc -b` before Vite, so a type error fails the build.

---

## Conventions

- **Scripture licensing is a hard rule.** Never add a copyrighted translation to
  `public/bible/`. Only public-domain or explicitly redistributable texts ship
  with the app; protected ones (ARA, NVI, NTLH, KJA, NAA, ACF) exist only as
  locked catalog entries that the user fills from a licensed copy of their own.
  Read `hub-bible/docs/LICENCAS-BIBLIA.md` before touching translations.
- **AI output must never be presented as scripture.** The contract in
  `src/core/ai/provider.ts` requires biblical text to come from the local
  repository and model output to be labelled `ai-comment`.
- New business logic goes in `src/core/`, not in a component. Screens stay thin.
- User-facing strings are Portuguese; keep the reverent, sober tone already used.
- Accessibility is load-bearing: minimum 44px touch targets, visible focus
  states, `aria-label` on icon-only buttons, no horizontal scroll at any width.
- Comments explain *why*, and only where the reason is not obvious from the code.

---

## Git workflow

- **Branching.** Claude Code sessions work on a designated branch, typically
  `claude/<topic>-<session-id>`. Each session is told its branch; develop and
  push there, and never push to a different branch without explicit permission.
- **Never commit directly to the default branch.**
- **Pushing.** Use `git push -u origin <branch-name>`. On network failure, retry
  with exponential backoff (2s, 4s, 8s, 16s).
- **Pull requests.** Only open a PR when the user explicitly asks for one.
- **Merged PRs are final.** For follow-up work, restart the branch from the
  latest default branch rather than stacking commits on merged history.
- **Commit messages.** Explain why the change was made, not just what changed.
  Keep the subject line imperative and under ~72 characters.

---

## Working agreements for AI assistants

- **Do not fabricate.** If this file does not answer a question and the repo does
  not either, say so and ask.
- **Read before editing.** Confirm the current contents of a file before changing it.
- **Report faithfully.** If a check fails, show the output. If a step was
  skipped, say which and why.
- **Keep this file current.** When you add a build step, change a command, or
  establish a convention, update the relevant section in the same change.
