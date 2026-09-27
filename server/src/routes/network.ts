import { Router } from 'express';
import { getNetworkDetails } from '../utils/network';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const serverPort = Number(process.env.PORT || 5000);
    const clientPort = Number(process.env.CLIENT_PORT || 5173);
    const networkDetails = await getNetworkDetails(serverPort, clientPort);
    res.json(networkDetails);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to determine network details' });
  }
});

export default router;
