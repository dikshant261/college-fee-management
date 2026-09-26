import { Router } from 'express';
import { getSystemSettings, updateSystemSettings } from '../services/settingsService';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  const settings = await getSystemSettings();
  res.json(settings);
});

router.put('/', requireAdmin, async (req, res) => {
  const settings = await updateSystemSettings(req.body);
  res.json(settings);
});

export default router;
