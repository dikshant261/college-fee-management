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
  const user = await createUser({ name, email, role });
  res.status(201).json(user);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  const user = await getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  const user = await updateUser(id, req.body);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  await deleteUser(id);
  res.status(204).send();
});

export default router;
