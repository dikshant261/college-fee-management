import { Router } from 'express';
import { createUser, deleteUser, getUserById, getUsers, updateUser } from '../services/userService';

const router = Router();

router.get('/', async (_req, res) => {
  const users = await getUsers();
  res.json(users);
});

router.post('/', async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email and role are required' });
  }
  try {
    const user = await createUser({ name, email, role });
    res.status(201).json(user);
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A user with this email address already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const user = await updateUser(id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A user with this email address already exists' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  try {
    await deleteUser(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
