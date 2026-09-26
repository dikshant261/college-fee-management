import { Router } from 'express';
import {
  createFeeStructure,
  deleteFeeStructure,
  getFeeStructureById,
  getFeeStructures,
  updateFeeStructure
} from '../services/feeStructureService';

const router = Router();

router.get('/', async (_req, res) => {
  const structures = await getFeeStructures();
  res.json(structures);
});

router.post('/', async (req, res) => {
  const { course_code, academic_year, duration_unit, tuition_fee, exam_fee, library_fee, other_fee } = req.body;
  if (!course_code || !academic_year || !duration_unit) {
    return res.status(400).json({ error: 'Course, academic year and duration unit are required' });
  }
  const structure = await createFeeStructure({
    course_code,
    academic_year,
    duration_unit: Number(duration_unit),
    tuition_fee: Number(tuition_fee) || 0,
    exam_fee: Number(exam_fee) || 0,
    library_fee: Number(library_fee) || 0,
    other_fee: Number(other_fee) || 0
  });
  res.status(201).json(structure);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const structure = await getFeeStructureById(id);
  if (!structure) return res.status(404).json({ error: 'Fee structure not found' });
  res.json(structure);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const structure = await updateFeeStructure(id, req.body);
  if (!structure) return res.status(404).json({ error: 'Fee structure not found' });
  res.json(structure);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  await deleteFeeStructure(id);
  res.status(204).send();
});

export default router;
