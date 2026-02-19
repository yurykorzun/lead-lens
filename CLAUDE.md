# Lead Lens

A dashboard for managing Salesforce contacts. Built for a mortgage company using Jungo CRM on Salesforce. Admins manage loan officers and real estate agents, each seeing their own scoped contacts with limited edit permissions.

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
| **Admin** | Email + password | All columns, full edit, nav with "Manage LOs" + "Manage Agents" | All fields | Scoped by `sf_field`/`sf_value` (e.g. `Owner.Name = 'Leon Belov'`) |
| **Loan Officer** | Email + access code | 7 columns, limited edit | Stage, Status, Temperature only | `Loan_Partners__c OR Leon_Loan_Partner__c OR Marat__c = <name>` sorted by `CreatedDate DESC` |
| **Agent** | Email + access code | 8 columns (incl. Lead Source, Referred By), limited edit | Stage, Status, Temperature only | `MtgPlanner_CRM__Referred_By_Text__c = <name>` sorted by `CreatedDate DESC` |

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
- Each user has `sf_field`/`sf_value` that determines their Salesforce data scope
- Access codes for LOs/agents are stored as bcrypt hashes in `password_hash` column
- Role CHECK: `('admin', 'loan_officer', 'agent')`, Status CHECK: `('active', 'disabled')`

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
- `referredByText` → `MtgPlanner_CRM__Referred_By_Text__c` (Jungo managed, text field for name matching)

### Salesforce Contact Custom Fields

| Label | API Name | Type | Package |
|-------|----------|------|---------|
| BDR | `BDR__c` | Picklist | Custom |
| Hot Lead | `Hot_Lead__c` | Checkbox | Custom |
| In Process | `In_Process__c` | Checkbox | Custom |
| Is Client | `Is_Client__c` | Checkbox | Custom |
| Leon Loan Partner | `Leon_Loan_Partner__c` | Text(255) | Custom |
| Loan Partners | `Loan_Partners__c` | Text(255) | Custom |
| Marat | `Marat__c` | Text(255) | Custom |
| Message Quick Update | `Message_QuickUpdate__c` | Text Area(Long) | Custom |
| No of Calls | `No_of_Calls__c` | Picklist | Custom |
| PAAL | `PAAL__c` | Checkbox | Custom |
| Status | `Status__c` | Picklist | Custom |
| Temperature | `Temparture__c` | Picklist | Custom (typo in org!) |
| Referred By | `MtgPlanner_CRM__Referred_By__c` | Lookup(Contact) | Jungo |
| Referred By Text | `MtgPlanner_CRM__Referred_By_Text__c` | Text(255) | Jungo |
| Referred By First Name | `MtgPlanner_CRM__Referred_By_First_Name__c` | Formula(Text) | Jungo |
| Stage | `MtgPlanner_CRM__Stage__c` | Picklist | Jungo |
| Thank You to Referral Source | `MtgPlanner_CRM__Thank_you_to_Referral_Source__c` | Checkbox | Jungo |

**Standard fields used:** `Name`, `FirstName`, `LastName`, `Email`, `Phone`, `MobilePhone`, `OwnerId`, `Owner.Name`, `LeadSource`, `Description`, `CreatedDate`

### Scoping

Contacts are scoped per user via their `sf_field`/`sf_value` (stored in JWT). Multi-field OR logic is in `buildScopeCondition()` in `query.ts`:

- **Admins** (Leon, Marat): `Owner.Name = 'Leon Belov'` — sees all contacts they own
- **Loan officers**: `(Loan_Partners__c = 'X' OR Leon_Loan_Partner__c = 'X' OR Marat__c = 'X')` — OR across all three partner fields
- **Agents**: `MtgPlanner_CRM__Referred_By_Text__c = 'X'` — matched by referred-by text field

### Inaccessible Fields

`Jungo_LOS__` namespace fields (LOS Loan Officer, LOS Milestone) are NOT accessible via API. Do not add them to queries.

## API Routes

All routes prefixed with `/api/`. Auth via `Authorization: Bearer <jwt>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login (admin: email+password, LO/agent: email+accessCode) |
| GET | /auth/verify | Validate token, return user |
| POST | /auth/logout | Stateless (client discards token) |
| GET | /contacts | Paginated contacts (SOQL, scoped by role) |
| PATCH | /contacts | Bulk update contacts (LOs/agents restricted to stage/status/temperature) |
| GET | /contacts/:id/activity | SF Tasks + audit log timeline |
| GET | /contacts/:id/history | SF ContactHistory field changes |
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
| `packages/shared/src/constants/field-map.ts` | camelCase ↔ SF field name mapping |
| `packages/shared/src/types/auth.ts` | User, LO, Agent management types |
| `packages/shared/src/types/contact.ts` | ContactRow type definition |
| `server/src/app.ts` | Express app (used by dev + Vercel) |
| `server/src/dev.ts` | Dev entry (dotenv + listen) |
| `server/src/db/schema.ts` | Drizzle table definitions |
| `server/src/services/auth.ts` | Password/access code hashing, JWT creation |
| `server/src/services/salesforce/auth.ts` | SF OAuth token acquisition |
| `server/src/services/salesforce/query.ts` | SOQL query builder + executor (multi-field scoping) |
| `server/src/services/salesforce/update.ts` | sObject Collections bulk update |
| `server/src/routes/auth.ts` | Login/verify/logout handlers |
| `server/src/routes/contacts.ts` | GET/PATCH contacts handlers |
| `server/src/routes/loan-officers.ts` | LO CRUD (admin only, paginated) |
| `server/src/routes/agents.ts` | Agent CRUD (admin only, paginated) |
| `server/src/routes/activity.ts` | Activity + ContactHistory endpoints |
| `server/src/routes/metadata.ts` | Picklist dropdown values |
| `server/src/middleware/auth.ts` | JWT verification + requireAdmin middleware |
| `client/src/components/grid/columns.tsx` | Admin, LO, and Agent column definitions |
| `client/src/components/grid/contact-grid.tsx` | Data grid component |
| `client/src/components/contact-detail-panel.tsx` | Detail panel with tabs (Details/Activity/History) |
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
- Coverage: user-management utilities, field-map constants, SF mock layer

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
- Never add `Jungo_LOS__` prefixed fields to SOQL queries — they are inaccessible.
- `Temparture__c` is a typo in the SF org. Do NOT rename it.
- `Stage` is `MtgPlanner_CRM__Stage__c` (Jungo managed), not `Stage__c`.
- `MtgPlanner_CRM__Referred_By__c` is a Lookup(Contact) — stores ID. Use `MtgPlanner_CRM__Referred_By_Text__c` for name matching.
- sObject Collections limit: 200 records per call.
- Field mapping changes go in `packages/shared/src/constants/field-map.ts`.

### Auth & Roles
- No self-signup. Admins create LOs via `/api/loan-officers` and agents via `/api/agents`.
- Both passwords and access codes are stored as bcrypt hashes in `password_hash`.
- LO `sf_field` is always `Loan_Partners__c`, `sf_value` is the LO's name. Scoping uses OR across 3 partner fields.
- Agent `sf_field` is always `MtgPlanner_CRM__Referred_By_Text__c`, `sf_value` is the agent's name.
- `requireAdmin` middleware gates all `/api/loan-officers` and `/api/agents` routes.
- LOs and agents can only edit fields in `RESTRICTED_EDITABLE_FIELDS` set (stage, status, temperature).

### Frontend
- Tailwind CSS v4 with `@tailwindcss/vite` plugin (CSS-based config, no tailwind.config).
- `@/` path alias resolves to `client/src/`.
- shadcn/ui components in `client/src/components/ui/`.
- Contact detail panel uses tabs: Details (editable fields), Activity (SF Tasks + audit), History (ContactHistory).
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
