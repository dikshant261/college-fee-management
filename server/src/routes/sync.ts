import express from 'express';
import {
  getSyncStatus,
  getSyncHistory,
  getPendingSummary,
  syncWithGoogleDrive,
  restoreFromGoogleDrive,
} from '../services/syncEngine';
import { authorize, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/sync/status
 * Returns current sync engine status, pending count, last sync time, etc.
 */
router.get('/status', authorize, async (_req, res) => {
  try {
    const status = await getSyncStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve sync status' });
  }
});

/**
 * GET /api/sync/summary
 * Returns count of pending changes grouped by table
 */
router.get('/summary', authorize, async (_req, res) => {
  try {
    const summary = await getPendingSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve pending summary' });
  }
});

/**
 * GET /api/sync/history
 * Returns recent synchronization events and logs (Requirement 11)
 */
router.get('/history', authorize, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const history = await getSyncHistory(limit);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve sync history' });
  }
});

/**
 * POST /api/sync
 * Manually triggers a synchronization cycle ("Sync Now" button)
 */
router.post('/', authorize, async (_req, res) => {
  try {
    const result = await syncWithGoogleDrive('manual');
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Synchronization failed' });
  }
});

/**
 * POST /api/sync/restore
 * Safely restores database from Google Drive backup (Admin only)
 * Creates a pre-restore backup first (Requirement 10)
 */
router.post('/restore', authorize, requireAdmin, async (_req, res) => {
  try {
    const result = await restoreFromGoogleDrive();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Restore failed' });
  }
});

export default router;
