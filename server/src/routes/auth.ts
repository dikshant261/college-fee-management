import { Router } from 'express';
import { loginUser, resetPassword } from '../services/authService';
import { authorize, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = await loginUser(email, password);
  if (!result) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.json(result);
});

router.post('/reset-password', authorize, async (req: AuthRequest, res) => {
  const { new_password } = req.body;
  if (!new_password) {
    return res.status(400).json({ error: 'New password is required' });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const updated = await resetPassword(user.id, new_password);
  if (!updated) {
    return res.status(500).json({ error: 'Unable to update password' });
  }

  return res.json({ message: 'Password reset successfully' });
});

router.get('/me', authorize, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(req.user);
});

export default router;
