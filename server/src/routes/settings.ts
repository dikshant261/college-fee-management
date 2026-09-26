import { Router } from 'express';
import { getSystemSettings, updateSystemSettings } from '../services/settingsService';

const router = Router();

router.get('/', async (_req, res) => {
  const settings = await getSystemSettings();
  res.json(settings);
});

router.put('/', async (req, res) => {
  const settings = await updateSystemSettings(req.body);
  res.json(settings);
});

export default router;
