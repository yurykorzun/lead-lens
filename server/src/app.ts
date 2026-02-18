import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import metadataRoutes from './routes/metadata.js';
import activityRoutes from './routes/activity.js';
import loanOfficerRoutes from './routes/loan-officers.js';
import agentRoutes from './routes/agents.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/contacts', activityRoutes);
app.use('/api/loan-officers', loanOfficerRoutes);
app.use('/api/agents', agentRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
