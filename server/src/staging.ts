import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

// Override env for staging
process.env.DATABASE_URL = process.env.DATABASE_URL_STAGING;
process.env.MOCK_SALESFORCE = 'true';
// The mock knows Realtor_Note__c.Stage__c, so staging shows the realtor stage tracker
process.env.REALTOR_STAGE = 'true';
// Never send real mail from staging - see sendMail
process.env.EMAIL_DISABLED = 'true';
process.env.FRONTEND_URL = 'http://localhost:5174';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL_STAGING is not set in .env');
  process.exit(1);
}

import express from 'express';
import app from './app.js';
import { resetMockNotes } from './services/salesforce/mock.js';

// Mock notes live in this process, so a note or stage written in one e2e run would
// still be there in the next. global-setup.ts calls this route first. It only exists here,
// never in app.ts, so production has no such route.
const staging = express();
staging.post('/api/__staging/reset-mock', (_req, res) => {
  resetMockNotes();
  res.json({ ok: true });
});
staging.use(app);

const port = 3002;
staging.listen(port, () => {
  console.log(`Staging server running on http://localhost:${port}`);
  console.log('  MOCK_SALESFORCE: true');
  console.log('  Database: staging branch');
});
