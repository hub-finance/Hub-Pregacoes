# CLAUDE.md

Guidance for Claude Code and other AI assistants working in this repository.

> **⚠️ Status: scaffold, not a description of real code.**
> As of 2026-08-11 this repository is **empty** — no commits, no branches, no
> source files. Nothing below describes actual code, because there is none yet.
> The sections marked **TODO** are questions to be answered by the first session
> that lands real code. Do not treat unanswered TODOs as facts, and do not guess
> at them.

---

## Repository

| | |
|---|---|
| Remote | `https://github.com/hub-finance/Hub-Pregacoes` |
| Organization | `hub-finance` |
| Visibility | Public |
| Default branch | Not yet established (repo has no commits) |
| State | Empty as of 2026-08-11 |

The name suggests a Portuguese-language project ("pregações" = sermons /
preaching). Identifiers, UI copy, and docs may therefore be in Portuguese —
confirm the intended language before establishing a convention, and record the
answer under [Conventions](#conventions).

---

## How to use and maintain this file

This file is the entry point for any AI assistant working here. It is only
useful if it stays true.

1. **Verify before documenting.** Every command, path, and convention recorded
   below must be something you actually ran or read in the repo — not something
   inferred from a framework's usual layout or from this file's own prompts.
2. **Replace TODOs, don't accumulate them.** When you learn the answer to a
   TODO, replace the whole block with the real content and delete the prompt.
3. **Delete the status banner** at the top once the repo has real code and the
   core sections are filled in. Leaving it in place after that is misleading.
4. **Keep it short.** Prefer a few accurate, load-bearing facts over exhaustive
   description. If something is discoverable in one obvious command, link to the
   command rather than transcribing its output.

---

## Project overview

**TODO.** Answer when the code lands:

- What does this project do, in one or two sentences?
- Who uses it — public visitors, an internal team, a congregation, an admin?
- Is it an application, a service, a static site, a content repository, or a
  library?
- Is anything deployed, and where?

---

## Tech stack

**TODO.** Record only what is actually present in the repo:

- Language(s) and version constraints (e.g. `.nvmrc`, `.python-version`,
  `go.mod`, `engines` in `package.json`).
- Framework(s) and the manifest that pins them.
- Package manager — and which lockfile is authoritative (`package-lock.json`,
  `pnpm-lock.yaml`, `yarn.lock`, `uv.lock`, …). Note it explicitly; using the
  wrong one is a common and costly mistake.
- Datastore, if any, and how schema changes are applied (migrations?).
- Third-party services the code talks to.

---

## Repository structure

**TODO.** Once there are directories worth explaining, map the ones a newcomer
would not guess — not every folder. For each, say what belongs in it and what
does not. Example shape:

```
src/            # ...
  <subdir>/     # ...
tests/          # ...
scripts/        # ...
```

Skip entries that are self-explanatory (`node_modules/`, `.git/`).

---

## Commands

**TODO.** Fill in with commands you have actually executed successfully in this
repo. Delete rows that do not apply rather than inventing a plausible command.

| Purpose | Command |
|---|---|
| Install dependencies | _TODO_ |
| Run locally (dev) | _TODO_ |
| Build | _TODO_ |
| Run tests | _TODO_ |
| Run a single test | _TODO_ |
| Lint | _TODO_ |
| Format | _TODO_ |
| Type-check | _TODO_ |

Also record:

- Required environment variables and where to get them. **Never commit secrets
  or real credential values** — document the variable *names* and point to
  `.env.example` or the secret store.
- Any setup step that is not obvious from the manifest (services that must be
  running, seed data, generated files).

---

## Conventions

**TODO.** Record only conventions that are actually established and observable
in the codebase, plus any the maintainer explicitly states:

- Naming and file layout for new modules.
- Language for identifiers, comments, commit messages, and user-facing copy
  (see the note under [Repository](#repository)).
- Formatting and lint rules, and the config file that enforces them — prefer
  pointing at the config over restating its contents.
- Testing expectations: framework, where tests live, whether new code is
  expected to ship with tests.
- Error handling, logging, and any patterns the codebase deliberately avoids.

---

## Git workflow

These apply now, before any code exists.

- **Branching.** Claude Code sessions work on a designated branch, typically
  `claude/<topic>-<session-id>`, created from the default branch. Each session
  is told its branch; develop and push there, and never push to a different
  branch without explicit permission.
- **Never commit directly to the default branch.**
- **Pushing.** Use `git push -u origin <branch-name>`. On network failure,
  retry with exponential backoff (2s, 4s, 8s, 16s).
- **Pull requests.** Only open a PR when the user explicitly asks for one. If a
  PR template is added to the repo (`.github/pull_request_template.md` or
  equivalent), mirror its headings and fill them in from the actual diff.
- **Merged PRs are final.** For follow-up work, restart the branch from the
  latest default branch rather than stacking commits on merged history.
- **Commit messages.** Explain why the change was made, not just what changed.
  Keep the subject line imperative and under ~72 characters.

---

## Working agreements for AI assistants

- **Do not fabricate.** If this file does not answer a question and the repo
  does not either, say so and ask — do not fill the gap with what a typical
  project of this kind would do. This whole file exists because the repo was
  empty; inventing a plausible architecture would have been worse than useless.
- **Read before editing.** Confirm the current contents of a file before
  changing it.
- **Report faithfully.** If tests fail, show the output. If a step was skipped,
  say which and why.
- **Keep this file current.** When you add a build step, change a command, or
  establish a convention, update the relevant section in the same change.
