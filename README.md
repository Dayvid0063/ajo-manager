<!-- README.md -->
# Ajo Manager

Record-keeping and coordination for rotating contribution groups (Ajo / Esusu / Adashe).
Ajo Manager **never holds or moves money**: members pay each other directly, and the app
records who should pay whom, what was reported and what was confirmed.

**Stack:** Nuxt 4 (Vue 3 + Nitro), Tailwind CSS v4, MongoDB + Mongoose, Zod, PWA.

## Local setup

Requirements: Node 24+, npm 11+, Docker.

```bash
npm install                 # also runs `nuxt prepare`
cp .env.example .env        # then fill in values (see below)
npm run db:up               # MongoDB 8 as a single-node replica set (rs0)
npm run dev                 # http://localhost:3000
```

Check that it's working: <http://localhost:3000/api/health> should return `{"status":"ok","db":"ok"}`.

### Environment variables

All app settings use the `NUXT_` prefix so they can be changed at runtime (e.g. on Railway)
without rebuilding. See `.env.example` for the full list. The essentials:

| Variable | Purpose |
|---|---|
| `NUXT_MONGODB_URI` | MongoDB connection string (must be a replica set — local Docker or Atlas) |
| `NUXT_SESSION_PASSWORD` | Secret for signing session cookies, at least 32 random characters |
| `NUXT_PUBLIC_APP_URL` | Public URL, used in invite links |
| `NUXT_MANAGEMENT_FEE_KOBO` | Platform fee in kobo (default `370000` = ₦3,700) |
| `NUXT_PLATFORM_BANK_*` | Platform bank details shown when paying the fee |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run preview` | Production build / run it locally |
| `npm run lint` / `npm run lint:fix` | ESLint (includes Vue conventions: template → script → style, no TS in `.vue`) |
| `npm run typecheck` | Type-check with `vue-tsc` |
| `npm test` | Vitest: unit tests + database tests on an in-memory MongoDB replica set |
| `npm run db:up` / `npm run db:down` | Start / stop local MongoDB |
| `npm run seed` | **Dev only.** Creates test users (refuses to run in production or against Atlas) |
| `npm run admin:promote -- <email>` | Make an existing user a platform admin (`--revoke` to undo) |

The first `npm test` may take a minute while `mongodb-memory-server` downloads its MongoDB binary.

## Accounts & sessions

- Email + password. Passwords are hashed with argon2id.
- Sessions are a sealed, httpOnly cookie (`ajo-session`, 7 days). Every protected API call re-checks
  the user in the database, so disabling a user, changing a password or issuing a temporary
  password logs out their other devices immediately.
- **Password reset (v1):** there is no email provider yet. A platform admin opens
  **Platform admin → Users**, confirms the person's identity, and issues a temporary password
  (shown once). The user must choose a new password at their next login. Every issue is recorded
  in the audit log.
- **First platform admin:** register normally in the app, then run `npm run admin:promote -- you@example.com`.

### Dev seed users

`npm run seed` creates these users, all with the password `Password123!`:

| Email | Role |
|---|---|
| `admin@ajo.test` | Platform admin |
| `ada@ajo.test`, `bola@ajo.test`, `chidi@ajo.test`, `musa@ajo.test` | Members |

## Known limitations

- Login/register rate limits are kept in memory: they apply per server instance and reset on restart.
  That's fine for a single Railway instance; move them to a shared store before running several instances.
- No self-service password reset or email verification until an email provider is added (post-MVP).

## Design system

Every color is defined once in `app/assets/css/tokens.css` (light values in `:root`, dark
values in `.dark`). Components only use token classes such as `bg-surface`, `text-primary`
or `text-status-submitted`; Tailwind's default palette is switched off. To rebrand, edit
`tokens.css` only. In development, open `/design` to see every token and component in the
current theme.

## Project layout

```
app/        Vue app — pages, layouts, components (plain JS in .vue files)
server/     Nitro API — the only trust boundary (TypeScript)
shared/     Constants, Zod schemas and helpers used by both
tests/      Vitest tests
```

## Conventions

- Money is always **integer kobo**: format with `formatKobo`, convert input with `nairaToKobo`.
- Times are stored in UTC and shown in Africa/Lagos.
- Every file starts with a comment giving its path.
- Every privileged route validates its input with Zod and checks permissions on the server.
