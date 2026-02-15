# Lead Lens — Test Steps

Base URL: `https://lead-lens-topaz.vercel.app` (production) or `http://localhost:5173` (local dev)

---

## Prerequisites

- Admin account exists: `leon@leonbelov.com` / `test1234`
- Salesforce connected app is configured and env vars are set
- Database has been seeded (`npx tsx server/src/seed.ts`)

---

## 1. API Health Check

```bash
curl -s https://lead-lens-topaz.vercel.app/api/health
```

Expected: `{"success":true,"data":{"status":"ok","timestamp":"..."}}`

---

## 2. Admin Login Flow

### 2.1 Open Login Page
- Navigate to `/login`
- Verify two tabs appear: **Admin** and **Loan Officer**
- Admin tab should be selected by default

### 2.2 Admin Login
- Email: `leon@leonbelov.com`
- Password: `test1234`
- Click "Sign In"
- **Expected**: Redirected to dashboard

### 2.3 Verify Admin Navigation
- Top bar shows user name ("Leon Belov"), not just email
- Navigation links visible: **Contacts** | **Manage LOs**

### 2.4 Verify Admin Dashboard
- All contact columns visible (Name, Email, Phone, Stage, Status, Temperature, Message, Thank You, Loan Partner, Created Date, Last Modified, etc.)
- All fields are editable (click a cell to edit)
- Contacts are sorted by Last Modified Date (descending)

---

## 3. Admin — Loan Officer Management

### 3.1 Navigate to Admin Panel
- Click **Manage LOs** in the nav
- **Expected**: Admin panel loads at `/admin`
- Table shows existing loan officers (may be empty initially)

### 3.2 Create a Loan Officer
- Click **Add Loan Officer**
- Fill in:
  - Name: `Test Officer`
  - Email: `test@example.com`
- Click **Create**
- **Expected**:
  - Modal appears with an 8-character access code
  - **Copy the access code** (it is shown only once)
  - LO appears in the table with status "active"

### 3.3 Verify LO in Table
- Row shows: Name, Email, Status (active), Created date, Last Login (never)
- Action buttons visible: Edit, Regenerate Code, Disable

### 3.4 Regenerate Access Code
- Click the regenerate (key) icon on the LO row
- **Expected**: New access code displayed in modal
- Old code is invalidated

### 3.5 Edit Loan Officer
- Click the edit (pencil) icon
- Change the name or email
- Click **Save**
- **Expected**: Table updates with new values

### 3.6 Disable Loan Officer
- Click the disable (ban) icon
- **Expected**: Status changes to "disabled"
- Button changes to "Enable"

### 3.7 Re-enable Loan Officer
- Click the enable icon
- **Expected**: Status changes back to "active"

---

## 4. Loan Officer Login Flow

### 4.1 Log Out as Admin
- Click **Logout** in the top bar
- **Expected**: Redirected to login page

### 4.2 Switch to LO Login
- Click the **Loan Officer** tab on the login page
- **Expected**: Form shows "Email" and "Access Code" fields (not password)

### 4.3 Login as Loan Officer
- Email: the email used when creating the LO (e.g. `test@example.com`)
- Access Code: the code copied in step 3.2 (or 3.4 if regenerated)
- Click "Sign In"
- **Expected**: Redirected to dashboard

### 4.4 Verify LO Navigation
- Top bar shows LO name
- **No** "Manage LOs" link — only the dashboard is visible
- Navigating to `/admin` manually should redirect back to `/`

---

## 5. Loan Officer Dashboard

### 5.1 Verify Limited Columns
- Only 7 columns visible:
  1. Name (read-only)
  2. Email (read-only)
  3. Phone (read-only)
  4. Stage (editable dropdown)
  5. Status (editable dropdown)
  6. Temperature (editable dropdown)
  7. Created Date (read-only)

### 5.2 Verify Contact Scoping
- Contacts shown are scoped to `Loan_Partners__c = <LO name>`
- Sorted by Created Date (descending), not Last Modified

### 5.3 Edit Allowed Fields
- Click a **Stage** cell → dropdown appears → select a new value
- Click a **Status** cell → dropdown appears → select a new value
- Click a **Temperature** cell → dropdown appears → select a new value
- **Expected**: Save bar appears at bottom with pending changes count

### 5.4 Save Changes
- Click **Save** in the save bar
- **Expected**: Changes saved successfully, save bar disappears
- Verify in Salesforce that the contact was updated

### 5.5 Verify Read-Only Fields
- Click on Name, Email, Phone, or Created Date cells
- **Expected**: No edit interaction — cells are not editable

---

## 6. Server-Side Enforcement

### 6.1 LO Cannot Edit Restricted Fields (API)
```bash
# Get a valid LO token first by logging in
TOKEN="<lo_jwt_token>"

# Try to update a field LOs shouldn't edit (e.g., message)
curl -s -X PATCH https://lead-lens-topaz.vercel.app/api/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"changes":[{"id":"<contact_id>","field":"message","value":"test"}]}'
```
**Expected**: 403 error — field not in allowed set

### 6.2 LO Cannot Access Admin Routes
```bash
curl -s https://lead-lens-topaz.vercel.app/api/loan-officers \
  -H "Authorization: Bearer $TOKEN"
```
**Expected**: 403 Forbidden

### 6.3 Disabled LO Cannot Login
- Disable the LO from the admin panel (step 3.6)
- Try logging in as the LO
- **Expected**: Login fails with error message

---

## 7. Edge Cases

### 7.1 Invalid Credentials
- Admin: wrong password → error message
- LO: wrong access code → error message
- Non-existent email → error message

### 7.2 Expired Token
- Wait for token to expire (default 8h) or manually test with an old token
- **Expected**: API returns 401, frontend redirects to login

### 7.3 Direct URL Access
- Unauthenticated user visits `/` → redirected to `/login`
- Unauthenticated user visits `/admin` → redirected to `/login`
- LO visits `/admin` → redirected to `/`
- Admin visits `/admin` → admin panel loads

### 7.4 Duplicate Email
- Try creating an LO with an email that already exists
- **Expected**: Server returns error, UI shows error message
