import express from 'express';
import {
  getAuthUrl,
  handleAuthCallback,
  getGoogleStatus,
  disconnectGoogle,
} from '../services/googleAuthService';
import { authorize, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/google/status
 * Returns Google Drive connection and configuration status
 */
router.get('/status', async (_req, res) => {
  try {
    const status = await getGoogleStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to check Google Drive status' });
  }
});

/**
 * GET /api/google/auth
 * Generates Google OAuth consent URL
 */
router.get('/auth', authorize, (_req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate Google auth URL' });
  }
});

/**
 * GET /api/google/callback
 * Handles OAuth 2.0 code exchange callback from Google
 */
router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  const clientOrigin = process.env.FRONTEND_URL?.trim() || process.env.API_ORIGIN?.trim() || 'http://localhost:5173';

  if (error || !code) {
    console.error('[GoogleCallback] OAuth error received:', error);
    return res.redirect(`${clientOrigin}/sync?google=error&message=${encodeURIComponent(error || 'No code provided')}`);
  }

  try {
    const { email, hasDriveScope } = await handleAuthCallback(code);
    console.log(`[GoogleCallback] Authenticated Google account: ${email}, hasDriveScope: ${hasDriveScope}`);
    if (!hasDriveScope) {
      return res.redirect(
        `${clientOrigin}/sync?google=scope_missing&email=${encodeURIComponent(email || '')}&message=${encodeURIComponent(
          'Google Drive file permission was NOT checked on the Google consent screen. Please reconnect and make sure to check the box.'
        )}`
      );
    }
    res.redirect(`${clientOrigin}/sync?google=connected&email=${encodeURIComponent(email || '')}`);
  } catch (err: any) {
    console.error('[GoogleCallback] Token exchange error:', err);
    res.redirect(`${clientOrigin}/sync?google=error&message=${encodeURIComponent(err?.message || 'Authentication failed')}`);
  }
});

/**
 * POST /api/google/disconnect
 * Disconnects Google account and clears local sync tokens (Admin only)
 */
router.post('/disconnect', authorize, requireAdmin, async (_req, res) => {
  try {
    await disconnectGoogle();
    res.json({ success: true, message: 'Google Drive disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to disconnect Google Drive' });
  }
});

export default router;
