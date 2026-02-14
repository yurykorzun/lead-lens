# Lead Lens

A dashboard for external loan partners to view and edit Salesforce contacts. Built for a mortgage company using Jungo CRM on Salesforce.

## Architecture

Monorepo with npm workspaces:

```
packages/shared/   → @lead-lens/shared — types, constants, field mappings
server/            → @lead-lens/server — Express + TypeScript API
client/            → @lead-lens/client — React + Vite SPA
api/[...path].ts   → Vercel serverless entry point
```

- **Backend**: Express, Drizzle ORM, Neon Postgres (serverless), JWT auth
- **Frontend**: React 19, Vite, TanStack Table + Query, shadcn/ui, Tailwind CSS v4
- **Deployment**: Vercel (static frontend + serverless API functions)

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
```

**Tables**: `users`, `loan_officer_directory`, `audit_log`, `sf_metadata_cache`

- Users sign up only if their email exists in `loan_officer_directory` (allowlist)
- Each user has `sf_field`/`sf_value` that determines their Salesforce data scope
- Seed data: `npx tsx server/src/seed.ts`

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
- **Managers** (Leon, Marat): `Owner.Name = 'Leon Belov'` — sees all contacts they own
- **Loan officers**: `Leon_Loan_Partner__c = 'Yury Korzun'` — sees contacts assigned to them

### Inaccessible Fields

`Jungo_LOS__` namespace fields (LOS Loan Officer, LOS Milestone) are NOT accessible via API. Do not add them to queries.

## API Routes

All routes prefixed with `/api/`. Auth via `Authorization: Bearer <jwt>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/signup | Register (must be in directory) |
| POST | /auth/login | Login, returns JWT |
| GET | /auth/verify | Validate token, return user |
| POST | /auth/logout | Stateless (client discards token) |
| GET | /contacts | Paginated contacts (SOQL, scoped) |
| PATCH | /contacts | Bulk update contacts |
| GET | /contacts/:id/activity | SF Tasks + audit log timeline |
| GET | /metadata/dropdowns | Picklist values (cached 30min) |

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
| `packages/shared/src/types/contact.ts` | ContactRow type definition |
| `server/src/app.ts` | Express app (used by dev + Vercel) |
| `server/src/dev.ts` | Dev entry (dotenv + listen) |
| `server/src/db/schema.ts` | Drizzle table definitions |
| `server/src/services/salesforce/auth.ts` | SF OAuth token acquisition |
| `server/src/services/salesforce/query.ts` | SOQL query builder + executor |
| `server/src/services/salesforce/update.ts` | sObject Collections bulk update |
| `server/src/routes/contacts.ts` | GET/PATCH contacts handlers |
| `server/src/routes/metadata.ts` | Picklist dropdown values |
| `server/src/middleware/auth.ts` | JWT verification middleware |
| `client/src/components/grid/columns.tsx` | TanStack Table column defs with editable cells |
| `client/src/components/grid/contact-grid.tsx` | Data grid component |
| `client/src/pages/dashboard.tsx` | Main dashboard page |
| `client/src/providers/auth-provider.tsx` | Auth context + token management |

## TypeScript Notes

- `@lead-lens/shared` is consumed as raw `.ts` (no build step). Don't add `composite: true`.
- jsonwebtoken v9: `expiresIn` needs `as SignOptions['expiresIn']` cast
- `response.json()` returns `unknown` in strict mode — cast with `as Type`
- Export interfaces used in re-exported hooks to avoid TS4058 errors

## Frontend Patterns

- Tailwind CSS v4 with `@tailwindcss/vite` plugin (CSS-based config, no tailwind.config)
- `@/` path alias resolves to `client/src/`
- shadcn/ui components in `client/src/components/ui/`
- Editable cells use TanStack Table `meta` to pass `onDirty` + `dropdowns` callbacks
- Dirty tracking via `useDirtyTracker` hook, save bar appears when changes exist
- Vite proxy: `/api` → `http://localhost:3001` (configured in `client/vite.config.ts`)
