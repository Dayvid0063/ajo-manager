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

## Groups & the platform fee

1. A user creates a group (wizard: details → contributions → payout order → rules → review). It starts as a **draft**.
2. The owner sees the platform's bank details, the fee and a payment reference (`AJO-<code>`), pays **by bank
   transfer outside the app**, and reports the payment.
3. A platform admin opens **Platform admin → Fee verification**, checks the bank, and confirms or rejects with a reason.
4. Confirming moves the group to **awaiting members** and enables invites. This happens once, in one transaction;
   confirming again changes nothing. The owner gets an in-app alert.

The fee amount and bank details come from `NUXT_MANAGEMENT_FEE_KOBO` and `NUXT_PLATFORM_BANK_*`. If the bank
details are empty, the fee page tells owners to contact support instead of showing payment details.

## Members, positions & starting a group

1. Once the fee is confirmed, owners and admins share the **invite code, link or QR** (Group → Invite).
2. People open `/join/<code>`, see a limited summary, register or log in, and **ask to join**.
3. The owner or an admin approves requests, up to the planned number of members.
4. Payout positions follow the group's method: **admins assign**, **members pick** an open slot, or the owner runs a
   **random draw** once everyone has joined.
5. Every member accepts the **latest rules version** and their **position**.
6. The owner starts the group. The schedule engine creates every round (one per member, recipient = position N)
   and every obligation in one transaction. Starting twice is impossible.

## Payments (contribution tracking)

- Each member adds a **payout account** per group (Group → Overview). It is shown only to the people paying
  them and to group admins, and never in notifications.
- Members pay **outside the app**, then tap **Mark as paid** (date, method, reference, optional screenshot/PDF).
  That is a *claim* (dashed border, "Awaiting confirmation") until the round's recipient (if the group allows it)
  or an owner/admin confirms it. Nobody can confirm their own claim. A rejected claim keeps its reason, and the
  member submits a new one; confirmed records are never edited.
- Due / overdue are worked out from dates whenever a payment is shown (due = within 3 days, overdue = after the
  due date, Lagos time).
- **Reminders** run hourly as a Nitro scheduled task (`reminders:send`): due soon, due today, overdue, payout
  approaching, and "it's your payout round". Each is sent once. In development, trigger it manually by opening
  `/_nitro/tasks/reminders:send`.

### Cloudflare R2 setup (proof uploads)

Set `NUXT_R2_ACCOUNT_ID`, `NUXT_R2_ACCESS_KEY_ID`, `NUXT_R2_SECRET_ACCESS_KEY`, `NUXT_R2_BUCKET` and
`NUXT_R2_ENDPOINT`. Keep the bucket **private**. The browser uploads directly with a 5-minute signed URL, so the
bucket needs a CORS rule (R2 → bucket → Settings → CORS policy):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Files are viewed through 60-second signed links, issued only to the payer, the recipient and group admins
(fee screenshots: the group's owner/admins and platform admins). If R2 isn't configured, uploads show as
unavailable and members can still report payments with a bank reference.

## Known limitations

- Reminders use check-then-insert de-duplication, which is fine for one server instance. If the app is scaled out,
  add a unique index on the reminder key.
- Partial payments are not supported: "Mark as paid" requires the full amount.

- Fee evidence uploads (screenshots) arrive with Cloudflare R2 in Phase 5. Until then, owners report the sender
  name, date and bank reference.

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
