import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// CORS
const apiOrigin = process.env.API_ORIGIN || '*';
app.use(cors({ origin: apiOrigin }));

// Static uploads
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Routes
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import coursesRouter from './routes/courses';
import settingsRouter from './routes/settings';
import feesRouter from './routes/fees';
import feeStructuresRouter from './routes/feeStructures';
import studentsRouter from './routes/students';
import googleRouter from './routes/google';
import syncRouter from './routes/sync';
import { initDB } from './db';
import { authorize } from './middleware/auth';
import { requireAdmin } from './middleware/auth';
import { initSyncScheduler } from './services/syncEngine';

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/students', authorize, studentsRouter);
app.use('/api/fees', authorize, feesRouter);
app.use('/api/fee-structures', authorize, requireAdmin, feeStructuresRouter);
app.use('/api/users', authorize, requireAdmin, usersRouter);
app.use('/api/courses', authorize, requireAdmin, coursesRouter);
app.use('/api/settings', authorize, requireAdmin, settingsRouter);
app.use('/api/google', googleRouter);
app.use('/api/sync', syncRouter);

app.get('/', (_req, res) => res.send({ message: 'College Fee Tracking API', status: 'ok' }));

app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error(err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// Init DB then start server
(async () => {
  try {
    await initDB();
    initSyncScheduler();
    app.listen(PORT, HOST, () => {
      console.log(`Server listening on http://${HOST}:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database', err);
    process.exit(1);
  }
})();

