# Lead Lens

A dashboard for managing Salesforce contacts. Built for a mortgage company using Jungo CRM on Salesforce. Admins manage loan officers and see all contacts; loan officers see only their assigned contacts with limited edit permissions.

## Architecture

Monorepo with npm workspaces:

```
packages/shared/   → @lead-lens/shared — types, constants, field mappings
server/            → @lead-lens/server — Express + TypeScript API
client/            → @lead-lens/client — React + Vite SPA
api/[...path].ts   → Vercel serverless entry point
```

- **Backend**: Express, Drizzle ORM, Neon Postgres (serverless), JWT auth, bcryptjs
- **Frontend**: React 19, Vite, TanStack Table + Query, shadcn/ui, Tailwind CSS v4
- **Deployment**: Vercel (static frontend + serverless API functions)
- **Production URL**: `https://lead-lens-topaz.vercel.app`

## User Roles

| Role | Login Method | Dashboard | Editable Fields | Contacts Scope |
|------|-------------|-----------|----------------|---------------|
| **Admin** | Email + password | All columns, full edit, nav with "Manage LOs" | All fields | Scoped by `sf_field`/`sf_value` (e.g. `Owner.Name = 'Leon Belov'`) |
| **Loan Officer** | Email + access code | 7 columns, limited edit | Stage, Status, Temperature only | `Loan_Partners__c = <name>` sorted by `CreatedDate DESC` |

- No self-signup. Admins create loan officers via the admin panel
- Access codes are generated server-side, shown once, stored as bcrypt hash
- Current admins: Leon Belov, Marat Belov

## Quick Start

```bash
npm install
cp .env.example .env   # fill in credentials
npm run dev             # starts both server (:3001) and client (:5173)
```

Individual workspaces:
```bash
npm run dev --workspace=server    # Express on :3001
npm run dev --workspace=client    # Vite on :5173
npm run typecheck                 # typecheck all workspaces
```

## Database

Neon Postgres via Drizzle ORM. Schema in `server/src/db/schema.ts`.

```bash
npm run db:generate --workspace=server   # generate migrations
npm run db:migrate --workspace=server    # apply migrations
npm run db:studio --workspace=server     # open Drizzle Studio
npx drizzle-kit push --force             # push schema directly (dev only)
npx tsx server/src/seed.ts               # seed/migrate admin users
```

**Tables**: `users`, `audit_log`, `sf_metadata_cache`

- `users` stores both admins and loan officers (role column distinguishes them)
- Each user has `sf_field`/`sf_value` that determines their Salesforce data scope
- Access codes for LOs are stored as bcrypt hashes in `password_hash` column
- Role CHECK: `('admin', 'loan_officer')`, Status CHECK: `('active', 'disabled')`

## Salesforce Integration

- **OAuth**: Client Credentials flow (SF_CONSUMER_KEY + SF_CONSUMER_SECRET)
- **Run As user**: `leon@leon-belov.com` (needs Jungo license for managed package fields)
- **API**: SOQL queries for reads, sObject Collections for bulk updates (max 200/call)
- **Org**: Uses Jungo mortgage CRM (managed package namespace: `MtgPlanner_CRM__`)

### Field Mapping

`packages/shared/src/constants/field-map.ts` maps camelCase frontend names to Salesforce API names. Key quirks:

- `temperature` → `Temparture__c` (typo in SF org, do NOT fix)
- `stage` → `MtgPlanner_CRM__Stage__c` (Jungo managed)
- `thankYouToReferralSource` → `MtgPlanner_CRM__Thank_you_to_Referral_Source__c` (Jungo managed)
- `message` → `Message_QuickUpdate__c` (not Message_to_Realtor)
- `loanPartner` → `Loan_Partners__c` (plural)

### Scoping

Contacts are scoped per user via their `sf_field`/`sf_value` (stored in JWT):
- **Admins** (Leon, Marat): `Owner.Name = 'Leon Belov'` — sees all contacts they own
- **Loan officers**: `Loan_Partners__c = 'Yury Korzun'` — sees contacts assigned to them

### Inaccessible Fields

`Jungo_LOS__` namespace fields (LOS Loan Officer, LOS Milestone) are NOT accessible via API. Do not add them to queries.

## API Routes

All routes prefixed with `/api/`. Auth via `Authorization: Bearer <jwt>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login (admin: email+password, LO: email+accessCode) |
| GET | /auth/verify | Validate token, return user |
| POST | /auth/logout | Stateless (client discards token) |
| GET | /contacts | Paginated contacts (SOQL, scoped by role) |
| PATCH | /contacts | Bulk update contacts (LOs restricted to stage/status/temperature) |
| GET | /contacts/:id/activity | SF Tasks + audit log timeline |
| GET | /metadata/dropdowns | Picklist values (cached 30min) |
| GET | /loan-officers | List all LOs (admin only) |
| POST | /loan-officers | Create LO (admin only, returns access code) |
| PATCH | /loan-officers/:id | Update LO name/email/status (admin only) |
| POST | /loan-officers/:id/regenerate-code | Generate new access code (admin only) |
| DELETE | /loan-officers/:id | Soft delete / disable LO (admin only) |

## Environment Variables

```
SF_LOGIN_URL            # e.g., https://leonbelov.my.salesforce.com
SF_CONSUMER_KEY         # Connected App consumer key
SF_CONSUMER_SECRET      # Connected App consumer secret
SF_API_VERSION          # e.g., v62.0
DATABASE_URL            # Neon Postgres connection string
APP_JWT_SECRET          # random 64-byte hex string
APP_JWT_EXPIRES_IN      # e.g., 8h
FRONTEND_URL            # CORS origin, e.g., http://localhost:5173
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/constants/field-map.ts` | camelCase ↔ SF field name mapping |
| `packages/shared/src/types/auth.ts` | User, LO management types |
| `packages/shared/src/types/contact.ts` | ContactRow type definition |
| `server/src/app.ts` | Express app (used by dev + Vercel) |
| `server/src/dev.ts` | Dev entry (dotenv + listen) |
| `server/src/db/schema.ts` | Drizzle table definitions |
| `server/src/services/auth.ts` | Password/access code hashing, JWT creation |
| `server/src/services/salesforce/auth.ts` | SF OAuth token acquisition |
| `server/src/services/salesforce/query.ts` | SOQL query builder + executor |
| `server/src/services/salesforce/update.ts` | sObject Collections bulk update |
| `server/src/routes/auth.ts` | Login/verify/logout handlers |
| `server/src/routes/contacts.ts` | GET/PATCH contacts handlers |
| `server/src/routes/loan-officers.ts` | LO CRUD (admin only) |
| `server/src/routes/metadata.ts` | Picklist dropdown values |
| `server/src/middleware/auth.ts` | JWT verification + requireAdmin middleware |
| `client/src/components/grid/columns.tsx` | Admin + LO column definitions |
| `client/src/components/grid/contact-grid.tsx` | Data grid component |
| `client/src/components/admin/loan-officer-manager.tsx` | Admin panel LO management |
| `client/src/pages/dashboard.tsx` | Main dashboard (role-aware) |
| `client/src/pages/admin.tsx` | Admin panel page |
| `client/src/providers/auth-provider.tsx` | Auth context + token management |
| `client/src/hooks/use-loan-officers.ts` | TanStack Query hooks for LO CRUD |

## Testing

- **E2e tests must NEVER mutate production data.** Tests should verify UI behavior (fields appear, buttons enable/disable, navigation works) without clicking Save or calling write APIs. Use Cancel to close edit flows.
- Run against production: `BASE_URL=https://lead-lens-topaz.vercel.app npm run test:e2e`
- Run locally: `npm run dev` then `npm run test:e2e`
- Playwright config: `playwright.config.ts`, tests in `e2e/`

## Rules for Updating This Project

### TypeScript
- `@lead-lens/shared` exports raw `.ts` for dev (types field) and compiled `.js` for Vercel runtime (import field). Do NOT add `composite: true` to shared tsconfig.
- After modifying shared types, run `npm run build -w @lead-lens/shared` before deploying.
- Root `tsconfig.json` must keep `"strict": true` — Drizzle ORM type inference breaks without `strictNullChecks`.
- jsonwebtoken v9: `expiresIn` needs `as SignOptions['expiresIn']` cast.
- `response.json()` returns `unknown` in strict mode — cast with `as Type`.
- Export interfaces used in re-exported hooks to avoid TS4058 errors.

### Vercel Deployment
- `vercel.json` uses `routes` (not `rewrites`) for API routing. The order matters: API route first, then filesystem, then SPA fallback.
- Shared package must be built before client: `npm run build -w @lead-lens/shared && npm run build -w @lead-lens/client`.
- Client build uses `vite build` only (no `tsc -b`). Vite handles transpilation.
- Use `bcryptjs` (not `bcrypt`) — native modules don't work in Vercel serverless.
- When setting env vars via CLI, use `printf` not `echo` to avoid trailing newlines.
- Pin TypeScript to exact version (no caret) to avoid Vercel resolving a different version.

### Salesforce
- Never add `Jungo_LOS__` prefixed fields to SOQL queries — they are inaccessible.
- `Temparture__c` is a typo in the SF org. Do NOT rename it.
- `Stage` is `MtgPlanner_CRM__Stage__c` (Jungo managed), not `Stage__c`.
- sObject Collections limit: 200 records per call.
- Field mapping changes go in `packages/shared/src/constants/field-map.ts`.

### Auth & Roles
- No self-signup. Admins create LOs via `/api/loan-officers` endpoint.
- Both passwords and access codes are stored as bcrypt hashes in `password_hash`.
- LO `sf_field` is always `Loan_Partners__c`, `sf_value` is the LO's name.
- `requireAdmin` middleware gates all `/api/loan-officers` routes.
- LOs can only edit fields in `LO_EDITABLE_FIELDS` set (stage, status, temperature).

### Frontend
- Tailwind CSS v4 with `@tailwindcss/vite` plugin (CSS-based config, no tailwind.config).
- `@/` path alias resolves to `client/src/`.
- shadcn/ui components in `client/src/components/ui/`.
- Editable cells use TanStack Table `meta` to pass `onDirty` + `dropdowns` callbacks.
- Dirty tracking via `useDirtyTracker` hook, save bar appears when changes exist.
- Vite proxy: `/api` → `http://localhost:3001` (configured in `client/vite.config.ts`).
- Column definitions are split: `adminColumns` (all fields) and `loanOfficerColumns` (7 fields).
