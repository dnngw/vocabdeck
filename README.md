# Vocabdeck

An context-based English vocabulary app with. 

## Technology
Stack: Next.js App Router, React, TypeScript, Tailwind/shadcn, Supabase Auth + PostgreSQL, Prisma, and ts-fsrs.

## Available Features

- Personal decks, vocabulary search, up to 5 meanings per word and 3 examples per meaning.
- Context-to-meaning cards with FSRS, a daily new-card limit, atomic review history, and idempotent retries.
- CSV import through preview/selection, with validation and deduplication.
- DeepSeek adapter: results can be edited/selected, with atomic quotas, timeouts, a kill switch, and usage logging.
- Personal statistics, timezone and review settings, plus admin suspend/reactivate.
- Login, invitation acceptance, password reset, and data isolation between users.

The local implementation is ready. Launching still requires a Supabase project, SMTP configuration, credentials, and validation of the real integrations in staging. No deployment or Git remote is created automatically.

## Local Development

```sh
nvm use
npm ci
cp .env.example .env.local
npm run db:generate
npm run dev
```

Open http://localhost:3000. Public pages can be opened without credentials. Private features require Supabase and a database; follow the [setup guide](docs/SETUP.md). Do not use production data for testing.

## Checks

```sh
npm run check
npm run build
```

