import { Router } from 'express';
import { createFeePayment, deleteFeePayment, getFeePayments } from '../services/feeService';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req, res) => {
  const payments = await getFeePayments({
    student_id: req.query.student_id ? String(req.query.student_id).trim() : undefined,
    payment_for: typeof req.query.payment_for === 'string' ? req.query.payment_for : undefined
  });
  res.json(payments);
});

router.post('/', async (req: AuthRequest, res) => {
  const { student_id, payment_for, duration_unit, amount, note } = req.body;
  if (!student_id || !payment_for || !duration_unit || !amount) {
    return res.status(400).json({ error: 'Missing required payment fields' });
  }

  const staff_id = req.user?.id;
  try {
    const payment = await createFeePayment({
      student_id: String(student_id).trim(),
      staff_id,
      payment_for,
      duration_unit: Number(duration_unit),
      amount: Number(amount),
      note
    });
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Unable to record payment' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid payment id' });
  await deleteFeePayment(id);
  res.status(204).send();
});

export default router;
