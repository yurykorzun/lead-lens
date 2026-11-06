# Lead Lens

A read-only dashboard over the LGC Salesforce org (lgc-ci). Admins manage loan officers and real estate agents; each sees only their own borrowers. Nobody edits borrower data or sees the team's internal notes; realtors and their loan officers share a realtor notes thread (`Realtor_Note__c`).

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
| **Agent** | Email + access code | 7 columns (incl. Lead Source, no Referred By since it is always her), read-only | Rows they referred (`sf_contact_id`) |

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
- **Run As user**: `lead-lens@lendinggroupco.com.integration`, holding `Lead_Lens_Read` (read only, no FLS on any internal notes field), `Lead_Lens_Task_Writer` (the realtor task set) and `Lead_Lens_Note_Writer` (Create and Read on `Realtor_Note__c`, no edit or delete). The metadata lives in the lendinggroupco repo.
- **API**: SOQL reads, plus exactly two writes: completing a realtor task and inserting a `Realtor_Note__c` (see Salesforce rules below). Nothing else is written on purpose: in lgc-ci a lead getting a new Referred By (`Referral_Notify_At__c`), or a Task completed with `Update_Referred_By_via_SMS__c` / `_via_Email__c` ticked, sends texts and emails to realtors. A Lead Status change alone sends nothing (checked 2026-10-14).

### Where the rows come from

`LeadAccount__c`, the lgc-ci Originator Tracker mirror: one row per Lead and per Contact, so open Leads and clients page in one query and the counts match the tracker.

- Borrowers only: `Lead__r.RecordType.DeveloperName = 'Borrower'` or `Contact__r.Account.RecordType.DeveloperName = 'PersonAccount'`. DeveloperNames, never labels.
- `Status__c` is the Lead status on a lead row and the account's newest loan stage on a client row. The API returns `status: 'Client'` plus `stage` for clients.
- `Created_Date__c` is a Date (converted date, else source created date, else CreatedDate) - the same date the tracker filters and shows.
- A client with a second loan has an extra row with `Opportunity__c` set, as on the tracker.
- `Account__c` is empty on every client row (6931 of 6931, 2026-11-05). The person account is `Contact__r.AccountId` (person accounts only), and a first loan is reached through it (`Parent_Opportunity__r.AccountId`).

### Scoping

By Id, never by name - two realtors can share a name. The Id is in the JWT as `sfId`, from `sf_contact_id` (agent) or `sf_user_id` (LO). A user with no Id gets 403, not every row.

- **Admins**: every borrower row.
- **Loan officers**: `Lead__r.OwnerId`, `Contact__r.OwnerId` or `Opportunity__r.OwnerId` = their User Id.
- **Agents**: `Lead__r.Referred_By__c`, `Contact__r.Referred_By__c` or `Opportunity__r.Referring_Agent__c` = their Contact Id. A realtor can be a Partner Contact or an Individual_Partner person account; both are a Contact Id.

### Rules

- **No long text fields in the SELECT** - `Rep_Notes__c`, `Message_to_Realtor__c`, `Description`. They are internal notes and never leave the org, and on `LeadAccount__c` they also make Salesforce return short pages.
- **Never filter `LeadAccount__c.Referred_By__c`** - it is a formula holding the 15-character Id, so an 18-character Id matches nothing. Use the `Lead__r` / `Contact__r` lookups.
- No field history, no activity, and no Task except the realtor set: Tasks stamped with `Realtor_Contact__c` (lendinggroupco-uhnx.11). Every other Task is the LP's and its body carries notes in lgc-ci. Select only `TASK_FIELDS` in `services/salesforce/tasks.ts`, never `Description`.
- SOQL OFFSET stops at 2000, so `totalPages` is capped - narrow with filters.

## API Routes

All routes prefixed with `/api/`. Auth via `Authorization: Bearer <jwt>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login (admin: email+password, LO/agent: email+accessCode) |
| GET | /auth/verify | Validate token, return user |
| POST | /auth/logout | Stateless (client discards token) |
| GET | /contacts | Paginated borrower rows (SOQL on LeadAccount__c, scoped by Id) |
| GET | /contacts/:id/notes | Realtor notes on one borrower, newest first: `Realtor_Note__c` on the row's Lead/Contact, its person account and loans (anyone whose dashboard shows the borrower; a realtor gets the account and loan notes only for her own referral) |
| POST | /contacts/:id/notes | Add a note, max 2000 characters - one `Realtor_Note__c` insert, Source = Lead Lens |
| GET | /contacts/tasks/open | The realtor's open realtor tasks on all her in-scope borrowers (agent only) |
| GET | /contacts/:id/tasks | Realtor tasks on one borrower: hers for an agent, all realtors' read-only for LO/admin |
| POST | /contacts/:id/tasks/:taskId/complete | Mark one of her tasks Completed in Salesforce (agent only, no body) - the only Salesforce update |
| GET | /metadata/dropdowns | Picklist values (cached 30min) |
| GET | /loan-officers | List all LOs (admin only, paginated+search) |
| POST | /loan-officers | Create LO (admin only, returns access code) |
| PATCH | /loan-officers/:id | Update LO name/email/status (admin only) |
| POST | /loan-officers/:id/regenerate-code | Generate new access code (admin only) |
| DELETE | /loan-officers/:id | Soft delete / disable LO (admin only) |
| GET | /agents | List all agents (admin only, paginated+search) |
| GET | /agents/realtors?q= | Search Salesforce Contacts by name or email to link an agent (admin only) |
| GET | /agents/realtors/:contactId | The Contact behind an Id, with its borrower count (admin only) |
| POST | /agents | Create agent (admin only, returns access code). `sfContactId` required and must exist |
| PATCH | /agents/:id | Update agent name/email/status/link (admin only). The link can move, never clear |
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
| `server/src/services/salesforce/tasks.ts` | Realtor task queries and the one Salesforce update (Status = Completed) |
| `server/src/services/salesforce/realtor-notes.ts` | Realtor_Note__c read query and the allowlisted note insert |
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
- Mock data: `server/src/services/salesforce/mock.ts` (8 fake contacts, tasks, realtor notes, picklists). Mock notes and tasks live in the staging server's memory. `npm run test:e2e` resets them through `POST /api/__staging/reset-mock`, a route that exists only in `staging.ts`, so the staging server must be running first. `reset:staging` does not reset them
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
- Read-only, with TWO writes. Do not add a third.
  1. The realtor marks her own realtor Task Completed (`completeTask` in `services/salesforce/tasks.ts`). Its body is the constant `{ Status: 'Completed' }`, and the route re-reads the task (Id + borrower + `Realtor_Contact__c`) before writing. Never pass request data into that body - a new Referred By, or a Task completed with `Update_Referred_By_via_SMS__c` / `_via_Email__c` / `Update_Last_Touch__c` ticked, texts or emails the realtor. `tasks.test.ts` and `tasks-route.test.ts` fail if the body changes.
  2. A new realtor note is one `Realtor_Note__c` insert (`createRealtorNote` in `services/salesforce/realtor-notes.ts`). The body is built field by field from `NOTE_INSERT_FIELDS`: `Body__c`, one `Parent_Lead__c` / `Parent_Contact__c` (from the row's Id), `Author_Name__c`, `Author_Role__c`, `Source__c = 'Lead Lens'`. Never spread the request into it. The object is append-only in lgc-ci (a validation rule refuses updates), so there is no edit or delete. `notes-route.test.ts` fails if the body changes.
- Notes reads select only `NOTE_FIELDS` from `Realtor_Note__c`, parented to any Id on the borrower's `LeadAccount__c` row (`rowIdsInScope`), so a converted lead keeps its notes. Every notes call re-checks the borrower against the caller's Salesforce scope (`isRowInScope`), so a realtor loses access when a referral moves. A client's second loan can come from another realtor (5 loans, 2026-11-05), so a realtor reads the person account only when she is the client's Referred By, and a loan only when its `Referring_Agent__c` is her or empty (`idsFromRows`). The Contact thread stays shared. A new note's `Parent_Account__c` comes from `personAccountId`, never from what the realtor may read.
- The old Lead Lens `notes` table is no longer read. Its 2 notes were copied to `Realtor_Note__c` on 2026-11-06 (lendinggroupco-uhnx.12.4, `server/src/scripts/move-notes-to-salesforce.ts`), and the table stays as a backup. It holds borrower details, so treat the Neon database as borrower data.
- Read `First_name__c` with a lowercase n. SOQL ignores case, but the JSON keys use the org's casing.
- Never select the team's notes (`Rep_Notes__c`, `Message_to_Realtor__c`, `Description`, `Rep_Note_History__c`) or any Task without `Realtor_Contact__c`. `Realtor_Note__c` is the only notes object Lead Lens reads. See Rules above.
- Scope by Id only. Every Id goes through `isSfId` before it reaches SOQL - the REST query endpoint has no binds.

### Auth & Roles
- No self-signup. Admins create LOs via `/api/loan-officers` and agents via `/api/agents`.
- Both passwords and access codes are stored as bcrypt hashes in `password_hash`.
- An LO is scoped by `sf_user_id`, an agent by `sf_contact_id`. Without one they get 403 NO_SCOPE.
- An agent cannot be created or saved without `sf_contact_id`, and the server checks the Contact exists. Admins pick it by name or email in Manage Agents rather than typing an Id: three agents were created unlinked on 2026-10-14 and saw an empty dashboard. A realtor's email in Salesforce often differs from the one they sign in with, so search by name too.
- `requireAdmin` middleware gates all `/api/loan-officers` and `/api/agents` routes.
- Nobody edits Salesforce data from Lead Lens, except the realtor marking her own realtor task done. Adding a realtor note inserts a new `Realtor_Note__c` and changes no existing record.

### Frontend
- Tailwind CSS v4 with `@tailwindcss/vite` plugin (CSS-based config, no tailwind.config).
- `@/` path alias resolves to `client/src/`.
- shadcn/ui components in `client/src/components/ui/`.
- Contact detail panel is read-only for Salesforce fields: status, loan stage, temperature, source, referred by. No tabs. Below them, the realtor steps (`contact-tasks.tsx`), then realtor notes (`contact-notes.tsx`, each showing its author and whether it was written in Lead Lens or Salesforce). A realtor's own dashboard also shows her open steps above the grid (`open-tasks.tsx`).
- Vite proxy: `/api` → `http://localhost:3001` (configured in `client/vite.config.ts`). Configurable via `VITE_API_TARGET` env var.
- Column definitions are split: `adminColumns`, `loanOfficerColumns`, and `agentColumns`.
- **Light and dark themes.** Colors are role tokens in `client/src/index.css` (`bg-background`, `text-muted-foreground`, `bg-row-selected`, `bg-notice`...), with the dark values under `.dark`. Use a token, not a raw palette class like `text-slate-500`; where a hue is the point (status badges in `columns.tsx`) write the `dark:` pair next to it. `next-themes` sets the class (`providers/theme-provider.tsx`, key `lead-lens-theme`).
- Tailwind v4 draws a bare `border` in `currentColor`; the base layer sets `border-color` to the token, so don't remove that rule.
- Below 1024px the contact panel covers the screen and the admin nav moves into the Menu. Tests find the panel by `data-testid="contact-panel"`.
- Only a 401/403 from `/auth/verify` signs a user out (`ApiRequestError.status`); a dropped connection must not delete the saved login.
- Phones: inputs and selects are 16px (`text-base md:text-sm`) so iOS Safari doesn't zoom.

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
