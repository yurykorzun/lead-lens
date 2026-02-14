import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });
import app from './app.js';

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
