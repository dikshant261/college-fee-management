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
  try {
    const structures = await getFeeStructures();
    res.json(structures);
  } catch (err: any) {
    console.error('Error fetching fee structures:', err);
    res.status(500).json({ error: 'Failed to retrieve fee structures' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { course_code, academic_year, duration_unit, tuition_fee, exam_fee, library_fee, other_fee } = req.body;
    if (!course_code || !academic_year || !duration_unit) {
      return res.status(400).json({ error: 'Course, academic year and year are required' });
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
  } catch (err: any) {
    console.error('Error creating fee structure:', err);
    if (err?.code === 'SQLITE_CONSTRAINT' || err?.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: `A fee structure for ${req.body.course_code} (${req.body.academic_year}, Year ${req.body.duration_unit}) already exists.`
      });
    }
    res.status(500).json({ error: err.message || 'Failed to create fee structure' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const structure = await getFeeStructureById(id);
    if (!structure) return res.status(404).json({ error: 'Fee structure not found' });
    res.json(structure);
  } catch (err: any) {
    console.error('Error fetching fee structure:', err);
    res.status(500).json({ error: 'Failed to retrieve fee structure' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const structure = await updateFeeStructure(id, req.body);
    if (!structure) return res.status(404).json({ error: 'Fee structure not found' });
    res.json(structure);
  } catch (err: any) {
    console.error('Error updating fee structure:', err);
    if (err?.code === 'SQLITE_CONSTRAINT' || err?.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: `A fee structure for this course, academic session, and year already exists.`
      });
    }
    res.status(500).json({ error: err.message || 'Failed to update fee structure' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await deleteFeeStructure(id);
    res.status(204).send();
  } catch (err: any) {
    console.error('Error deleting fee structure:', err);
    res.status(500).json({ error: 'Failed to delete fee structure' });
  }
});

export default router;
