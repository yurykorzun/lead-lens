# Lead Lens — How to Test

Open the app at **https://lead-lens-portal.vercel.app** (or http://localhost:5173 if running locally).

## 1. Log In as Admin

- On the login screen, select the **Admin** tab
- Email: `leon@leon-belov.com`
- Password: `test1234`
- Click **Sign in**
- You should see the contacts table with your name in the top right

## 2. Browse Contacts

- The table shows all your contacts with colored badges for Status, Temperature, and Stage
- Scroll down to see more rows, or use **Previous** / **Next** at the bottom if there are multiple pages
- Use the filters above the table to search by name, or filter by Status, Temperature, Stage, or date

## 3. Open a Contact

- Click any row in the table
- A detail panel opens on the right side — the table stays visible on the left
- The selected row is highlighted in the table

## 4. Edit and Save

- In the detail panel, change any field (Status, Temperature, Stage, checkboxes, Message, etc.)
- The **Save** button becomes active when you have changes
- Click **Save** to update the contact in Salesforce
- Click **Cancel** or the **X** to close without saving

## 5. Manage Loan Officers (Admin only)

- Click **Manage LOs** in the top navigation bar
- Click **Add Loan Officer** to create a new LO — you'll get an access code to share with them
- You can edit, disable/enable, or regenerate access codes for any LO

## 6. Log In as a Loan Officer

- Log out (click the icon in the top right)
- On the login screen, select the **Loan Officer** tab
- Enter the LO's email and access code, then click **Sign in**
- LOs see a simpler table (fewer columns) and can only edit Status, Temperature, and Stage

## 7. Log Out

- Click the logout icon in the top right corner to sign out
