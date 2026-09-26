import { Router } from 'express';
import { createCourse, deleteCourse, getCourseByCode, getCourses, updateCourse } from '../services/courseService';

const router = Router();

router.get('/', async (_req, res) => {
  const courses = await getCourses();
  res.json(courses);
});

router.post('/', async (req, res) => {
  const { code, name, duration_type, total_duration } = req.body;
  if (!code || !name || !duration_type || !total_duration) {
    return res.status(400).json({ error: 'All course fields are required' });
  }
  const course = await createCourse({ code, name, duration_type, total_duration: Number(total_duration) });
  res.status(201).json(course);
});

router.get('/:code', async (req, res) => {
  const course = await getCourseByCode(req.params.code);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  res.json(course);
});

router.put('/:code', async (req, res) => {
  try {
    const course = await updateCourse(req.params.code, req.body);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to update course' });
  }
});

router.delete('/:code', async (req, res) => {
  try {
    await deleteCourse(req.params.code);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to delete course' });
  }
});

export default router;
