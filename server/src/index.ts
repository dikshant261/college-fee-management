import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import morgan from 'morgan';

dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '127.0.0.1';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// CORS: allow any origin dynamically on local network if not explicitly locked down
const apiOrigin = process.env.API_ORIGIN?.trim();
app.use(
  cors({
    origin: apiOrigin && apiOrigin !== '*' ? apiOrigin : true,
    credentials: true
  })
);

import { ensureStorageDirs } from './utils/paths';

// Static uploads (supports custom Windows path from process.env.UPLOADS_DIR)
const { uploadsDir } = ensureStorageDirs();
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
import networkRouter from './routes/network';
import { initDB } from './db';
import { authorize } from './middleware/auth';
import { requireAdmin } from './middleware/auth';
import { initSyncScheduler } from './services/syncEngine';
import { getPrimaryNetworkIp, getAllNetworkIps } from './utils/network';
import { syncAllStudentsFees } from './services/studentService';

app.use('/health', healthRouter);
app.use('/api/network-info', networkRouter);
app.use('/api/auth', authRouter);
app.use('/api/students', authorize, studentsRouter);
app.use('/api/fees', authorize, feesRouter);
app.use('/api/fee-structures', authorize, requireAdmin, feeStructuresRouter);
app.use('/api/users', authorize, requireAdmin, usersRouter);
app.use('/api/courses', authorize, requireAdmin, coursesRouter);
app.use('/api/settings', authorize, settingsRouter);
app.use('/api/google', googleRouter);
app.use('/api/sync', syncRouter);

// Serve static React client build if dist folder exists (single-port Wi-Fi & production mode)
const clientDistCandidates = [
  process.env.CLIENT_DIST_DIR,
  path.join(process.cwd(), 'client/dist'),
  path.join(process.cwd(), '../client/dist'),
  path.join(__dirname, '../../client/dist'),
  path.join(__dirname, '../client/dist')
].filter(Boolean) as string[];

let clientDistFound = false;
for (const distPath of clientDistCandidates) {
  if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
    clientDistFound = true;
    break;
  }
}

if (!clientDistFound) {
  app.get('/', (_req, res) => res.send({ message: 'College Fee Tracking API', status: 'ok' }));
}

app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  console.error(err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// Init DB then start server
(async () => {
  try {
    await initDB();
    await syncAllStudentsFees();
    initSyncScheduler();
    const primaryIp = getPrimaryNetworkIp();
    const clientPort = process.env.CLIENT_PORT || 5173;

    app.listen(PORT, HOST, () => {
      console.log('\n======================================================');
      console.log('  College Fee Management Server is LIVE');
      console.log(`  > Local Machine:  http://localhost:${PORT}`);
      if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
        console.log(`  > Local Wi-Fi:    http://${primaryIp}:${PORT}`);
        console.log(`  > Client Web App: http://${primaryIp}:${clientPort}`);
      } else {
        console.log('  > Network:        Bound strictly to localhost (Wi-Fi access disabled)');
      }
      console.log('======================================================\n');
    });
  } catch (err) {
    console.error('Failed to initialize database', err);
    process.exit(1);
  }
})();

