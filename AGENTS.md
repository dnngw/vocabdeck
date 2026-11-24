<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository conventions

- Keep all PRD documents local and out of Git, including renamed revisions.
- Never commit active environment files, credentials, database dumps, or generated clients.
- Make small commits focused on one feature, fix, or formatting change. Use the repository owner's configured Git identity and clear commit messages.
- Private application data is accessed only through server services with a verified active user context and explicit ownership checks. Do not introduce a demo auth bypass.
- Read `docs/ARCHITECTURE.md` before changing authorization, review transactions, or AI quotas.
- Run relevant checks from `docs/TESTING.md`. Database and browser tests require a disposable database ending in `_test`; never run them on a user database.
