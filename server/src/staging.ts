import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

// Override env for staging
process.env.DATABASE_URL = process.env.DATABASE_URL_STAGING;
process.env.MOCK_SALESFORCE = 'true';
process.env.FRONTEND_URL = 'http://localhost:5174';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL_STAGING is not set in .env');
  process.exit(1);
}

import app from './app.js';

const port = 3002;
app.listen(port, () => {
  console.log(`Staging server running on http://localhost:${port}`);
  console.log('  MOCK_SALESFORCE: true');
  console.log('  Database: staging branch');
});
