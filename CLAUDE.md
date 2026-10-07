# Lead Lens

A read-only dashboard over the LGC Salesforce org (lgc-ci). Admins manage loan officers and real estate agents; each sees only their own borrowers, and nobody can edit or see notes.

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
- **Production URL**: `https://lead-lens-portal.vercel.app`

## User Roles

| Role | Login Method | Dashboard | Rows |
|------|-------------|-----------|------|
| **Admin** | Email + password | All columns, nav with "Manage LOs" + "Manage Agents" | Every borrower |
| **Loan Officer** | Email + access code | 7 columns, read-only | Rows they own (`sf_user_id`) |
| **Agent** | Email + access code | 8 columns (incl. Lead Source, Referred By), read-only | Rows they referred (`sf_contact_id`) |

All roles are read-only and newest first by the tracker Created date. See Scoping below.

- No self-signup. Admins create loan officers and agents via admin panels
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

- `users` stores admins, loan officers, and agents (role column distinguishes them)
- `sf_field`/`sf_value` are left over from the Jungo org and no longer scope anything
- Access codes for LOs/agents are stored as bcrypt hashes in `password_hash` column
- Role CHECK: `('admin', 'loan_officer', 'agent')`, Status CHECK: `('active', 'disabled')`
- `sf_contact_id` (agents, realtor Contact) and `sf_user_id` (loan officers, User) hold lgc-ci Ids for Id-based scoping. Admins set them in Manage Agents / Manage LOs; `npx tsx server/src/scripts/match-sf-ids.ts` proposes them by name (report only; `--apply` writes unique matches; refuses any org but lgc-ci)
- Migrations live in `server/drizzle/`. The tables predate them (created with `drizzle-kit push`), so `0000_add_sf_ids` only adds columns and is safe to re-run

## Salesforce Integration

- **Org**: lgc-ci, the LGC production org (`flow-enterprise-8486.lightning.force.com`). Lead Lens moved off the old Jungo org in Oct 2026.
- **OAuth**: Client Credentials flow (SF_CONSUMER_KEY + SF_CONSUMER_SECRET) on the `Lead_Lens` External Client App.
- **Run As user**: `lead-lens@lendinggroupco.com.integration`, holding only the `Lead_Lens_Read` permission set - read only, no FLS on any notes field, no Task access. The metadata lives in the lendinggroupco repo.
- **API**: SOQL reads only. There is no write path on purpose: a Lead Status change in lgc-ci fires referral texts and emails to realtors.

### Where the rows come from

`LeadAccount__c`, the lgc-ci Originator Tracker mirror: one row per Lead and per Contact, so open Leads and clients page in one query and the counts match the tracker.

- Borrowers only: `Lead__r.RecordType.DeveloperName = 'Borrower'` or `Contact__r.Account.RecordType.DeveloperName = 'PersonAccount'`. DeveloperNames, never labels.
- `Status__c` is the Lead status on a lead row and the account's newest loan stage on a client row. The API returns `status: 'Client'` plus `stage` for clients.
- `Created_Date__c` is a Date (converted date, else source created date, else CreatedDate) - the same date the tracker filters and shows.
- A client with a second loan has an extra row with `Opportunity__c` set, as on the tracker.

### Scoping

By Id, never by name - two realtors can share a name. The Id is in the JWT as `sfId`, from `sf_contact_id` (agent) or `sf_user_id` (LO). A user with no Id gets 403, not every row.

- **Admins**: every borrower row.
- **Loan officers**: `Lead__r.OwnerId`, `Contact__r.OwnerId` or `Opportunity__r.OwnerId` = their User Id.
- **Agents**: `Lead__r.Referred_By__c`, `Contact__r.Referred_By__c` or `Opportunity__r.Referring_Agent__c` = their Contact Id. A realtor can be a Partner Contact or an Individual_Partner person account; both are a Contact Id.

### Rules

- **No long text fields in the SELECT** - `Rep_Notes__c`, `Message_to_Realtor__c`, `Description`. They are internal notes and never leave the org, and on `LeadAccount__c` they also make Salesforce return short pages.
- **Never filter `LeadAccount__c.Referred_By__c`** - it is a formula holding the 15-character Id, so an 18-character Id matches nothing. Use the `Lead__r` / `Contact__r` lookups.
- No Tasks, no field history, no activity. Task bodies carry notes in lgc-ci.
- SOQL OFFSET stops at 2000, so `totalPages` is capped - narrow with filters.

## API Routes

All routes prefixed with `/api/`. Auth via `Authorization: Bearer <jwt>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login (admin: email+password, LO/agent: email+accessCode) |
| GET | /auth/verify | Validate token, return user |
| POST | /auth/logout | Stateless (client discards token) |
| GET | /contacts | Paginated borrower rows (SOQL on LeadAccount__c, scoped by Id) |
| GET | /metadata/dropdowns | Picklist values (cached 30min) |
| GET | /loan-officers | List all LOs (admin only, paginated+search) |
| POST | /loan-officers | Create LO (admin only, returns access code) |
| PATCH | /loan-officers/:id | Update LO name/email/status (admin only) |
| POST | /loan-officers/:id/regenerate-code | Generate new access code (admin only) |
| DELETE | /loan-officers/:id | Soft delete / disable LO (admin only) |
| GET | /agents | List all agents (admin only, paginated+search) |
| POST | /agents | Create agent (admin only, returns access code) |
| PATCH | /agents/:id | Update agent name/email/status (admin only) |
| POST | /agents/:id/regenerate-code | Generate new access code (admin only) |
| DELETE | /agents/:id | Soft delete / disable agent (admin only) |

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
| `packages/shared/src/types/auth.ts` | User, LO, Agent management types |
| `packages/shared/src/types/contact.ts` | ContactRow (no free-text fields) and CLIENT_STATUS |
| `server/src/app.ts` | Express app (used by dev + Vercel) |
| `server/src/dev.ts` | Dev entry (dotenv + listen) |
| `server/src/db/schema.ts` | Drizzle table definitions |
| `server/src/services/auth.ts` | Password/access code hashing, JWT creation |
| `server/src/services/salesforce/auth.ts` | SF OAuth token acquisition |
| `server/src/services/salesforce/query.ts` | LeadAccount__c query builder, Id scoping, row mapper |
| `server/src/routes/auth.ts` | Login/verify/logout handlers |
| `server/src/routes/contacts.ts` | GET contacts (read-only) |
| `server/src/routes/loan-officers.ts` | LO CRUD (admin only, paginated) |
| `server/src/routes/agents.ts` | Agent CRUD (admin only, paginated) |
| `server/src/routes/metadata.ts` | Picklist dropdown values |
| `server/src/middleware/auth.ts` | JWT verification + requireAdmin middleware |
| `client/src/components/grid/columns.tsx` | Admin, LO, and Agent column definitions |
| `client/src/components/grid/contact-grid.tsx` | Data grid component |
| `client/src/components/contact-detail-panel.tsx` | Read-only detail panel |
| `client/src/components/admin/loan-officer-manager.tsx` | Admin panel LO management |
| `client/src/components/admin/agent-manager.tsx` | Admin panel Agent management |
| `client/src/pages/dashboard.tsx` | Main dashboard (role-aware) |
| `client/src/pages/admin.tsx` | Admin panel page (LO management) |
| `client/src/pages/agents.tsx` | Admin panel page (Agent management) |
| `client/src/providers/auth-provider.tsx` | Auth context + token management |
| `client/src/hooks/use-crud.ts` | Generic CRUD hook factory (list, create, update, delete, regenerate) |
| `client/src/hooks/use-loan-officers.ts` | LO hooks (thin wrappers around use-crud) |
| `client/src/hooks/use-agents.ts` | Agent hooks (thin wrappers around use-crud) |
| `client/src/hooks/use-admins.ts` | Admin hooks (thin wrappers around use-crud + change password) |
| `server/src/services/user-management.ts` | Shared utilities for user CRUD routes (pagination, validation, DB helpers) |
| `server/src/services/salesforce/mock.ts` | Mock SF layer for staging/testing |
| `server/src/staging.ts` | Staging server entry point (port 3002, mock SF, staging DB) |
| `server/src/seed-staging.ts` | Seed staging DB with test users |
| `e2e/staging/fixtures.ts` | Test credentials + login helpers for staging e2e |
| `e2e/staging/global-setup.ts` | Staging DB reset before/after tests |

## Testing

### Unit Tests (Vitest)
- Framework: Vitest in both `server` and `packages/shared` workspaces
- Run all: `npm test` (runs shared then server)
- Run workspace: `npm test --workspace=server` or `npm test --workspace=packages/shared`
- Watch mode: `npm run test:watch --workspace=server`
- Test files: `src/__tests__/*.test.ts` in each workspace
- Coverage: user-management utilities, query builder and scoping, contacts route, SF mock layer

### E2E Tests (Playwright — staging only)

**NEVER run tests against production.** All e2e tests run against the local staging environment (mock SF + staging Neon branch). There are no production test scripts.

- Start staging: `npm run staging` (server :3002 + client :5174)
- Run tests: `npm run test:e2e` (auto-runs DB setup + teardown)
- Config: `playwright.config.ts`, tests in `e2e/staging/`
- Seed data: `npm run seed:staging` (3 test users: admin, LO, agent)
- DB reset: `npm run reset:staging`
- SF mocking: `MOCK_SALESFORCE=true` in staging server activates mock layer
- Mock data: `server/src/services/salesforce/mock.ts` (8 fake contacts, tasks, history, picklists)
- Test fixtures: `e2e/staging/fixtures.ts` (credentials + login helpers)
- BaseURL is hardcoded to `http://localhost:5174` in playwright config — no env var override

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
- Read-only. Do not add a write route or a PATCH - a Status change in lgc-ci texts the realtor.
- Never select notes (`Rep_Notes__c`, `Message_to_Realtor__c`, `Description`) or Tasks. See Rules above.
- Scope by Id only. Every Id goes through `isSfId` before it reaches SOQL - the REST query endpoint has no binds.

### Auth & Roles
- No self-signup. Admins create LOs via `/api/loan-officers` and agents via `/api/agents`.
- Both passwords and access codes are stored as bcrypt hashes in `password_hash`.
- An LO is scoped by `sf_user_id`, an agent by `sf_contact_id`. Without one they get 403 NO_SCOPE.
- `requireAdmin` middleware gates all `/api/loan-officers` and `/api/agents` routes.
- Nobody edits Salesforce data from Lead Lens.

### Frontend
- Tailwind CSS v4 with `@tailwindcss/vite` plugin (CSS-based config, no tailwind.config).
- `@/` path alias resolves to `client/src/`.
- shadcn/ui components in `client/src/components/ui/`.
- Contact detail panel is read-only: status, loan stage, temperature, source, referred by. No tabs.
- Vite proxy: `/api` → `http://localhost:3001` (configured in `client/vite.config.ts`). Configurable via `VITE_API_TARGET` env var.
- Column definitions are split: `adminColumns`, `loanOfficerColumns`, and `agentColumns`.

### Code Patterns & Guidance

**Server route files** — User management routes (admins, loan-officers, agents) share utilities from `server/src/services/user-management.ts`:
- Use `parsePagination`, `validateNameAndEmail`, `buildUserListConditions` for list/create handlers
- Use `findUserByIdAndRole`, `checkEmailUniqueness`, `deleteUserWithAuditCleanup` for CRUD operations
- Use `sendError` / `sendSuccess` for consistent response format
- Use `isUniqueViolation` to handle Drizzle unique constraint errors
- Express `req.params.id` is typed `string | string[]` — always cast with `as string`
- Each route file defines `ROLE` and `SF_FIELD` constants at the top

**Client hooks** — CRUD hooks use factory functions from `client/src/hooks/use-crud.ts`:
- `useList<T>(endpoint, queryKey, params)` for paginated lists
- `useCreate<TReq, TRes>(endpoint, queryKey)` for create mutations
- `useUpdate<TReq>(endpoint, queryKey)` for update mutations
- `useDelete(endpoint, queryKey)` for delete mutations
- `useRegenerate(endpoint)` for access code regeneration
- Each hook file is a thin wrapper that sets endpoint + queryKey

**Shared types** — `packages/shared/src/types/auth.ts`:
- `UserListItem` is the base type for LO/agent list items
- `AdminListItem extends UserListItem` adds `sfField`/`sfValue`
- `PaginatedResponse<T>` in `api.ts` is generic — use it instead of per-role paginated types
- Legacy types (`LoanOfficerListItem`, `AgentListItem`, `PaginatedXResponse`) are kept as deprecated aliases

**When adding a new user role**:
1. Add role to CHECK constraint in `server/src/db/schema.ts` and `UserRole` type in `user-management.ts`
2. Create route file following the pattern: define `ROLE`/`SF_FIELD` constants, import shared utilities
3. Create client hook file: define `ENDPOINT`/`KEY`, wrap factory functions
4. Add types to `packages/shared/src/types/auth.ts` (extend `UserListItem` if needed)
5. Add unit tests in `server/src/__tests__/` for any new business logic
6. Add staging e2e tests in `e2e/staging/` for the new CRUD flows

**Testing guidelines**:
- Pure functions (validation, formatting, field maps) → unit tests with Vitest
- DB-dependent logic → test via staging e2e (mock SF + staging Neon branch)
- New SF mock data → add to `server/src/services/salesforce/mock.ts`
- Run `npm test` before committing to catch regressions
- Run `npm run typecheck` to verify type safety across workspaces
