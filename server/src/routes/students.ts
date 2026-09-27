import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createStudent,
  getStudents,
  getStudentById,
  getStudentByRollNo,
  updateStudent,
  softDeleteStudent,
  uploadStudentPhoto,
  getCourses,
  getAcademicYears,
  getSystemSettings,
  StudentInput
} from '../services/studentService';

import { getUploadsDir } from '../utils/paths';

const router = Router();
const uploadsDir = getUploadsDir();
const studentsDir = path.join(uploadsDir, 'students');
if (!fs.existsSync(studentsDir)) fs.mkdirSync(studentsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, studentsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image uploads allowed'));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/courses', async (_req, res) => {
  const courses = await getCourses();
  res.json(courses);
});

router.get('/academic-years', async (_req, res) => {
  const years = await getAcademicYears();
  res.json(years);
});

router.get('/settings', async (_req, res) => {
  const settings = await getSystemSettings();
  res.json(settings);
});

router.get('/roll/:roll_no', async (req, res) => {
  const rollNo = req.params.roll_no;
  if (!rollNo) return res.status(400).json({ error: 'Missing roll number' });
  const student = await getStudentByRollNo(rollNo);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

router.get('/', async (req, res) => {
  const { q, course, academic_year, current_duration_unit, fee_status } = req.query;
  const students = await getStudents({
    q: typeof q === 'string' ? q : undefined,
    course: typeof course === 'string' ? course : undefined,
    academic_year: typeof academic_year === 'string' ? academic_year : undefined,
    current_duration_unit: current_duration_unit ? Number(current_duration_unit) : undefined,
    fee_status: typeof fee_status === 'string' ? fee_status : undefined
  });
  res.json(students);
});

router.post('/', async (req, res) => {
  try {
    const body = req.body as Partial<StudentInput>;
    if (!body.name || !body.course_code || !body.academic_year || !body.current_duration_unit) {
      return res.status(400).json({ error: 'Missing required student fields' });
    }

    const student = await createStudent({
      name: body.name,
      course_code: body.course_code,
      academic_year: body.academic_year,
      current_duration_unit: Number(body.current_duration_unit),
      class: body.class,
      section: body.section,
      phone: body.phone,
      address: body.address,
      university_roll_no: body.university_roll_no
    });

    res.status(201).json(student);
  } catch (err: any) {
    console.error('Error creating student:', err);
    res.status(500).json({ error: err?.message || 'Failed to create student' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid student id' });
  const student = await getStudentById(id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid student id' });

  const body = req.body as Partial<StudentInput>;
  const student = await updateStudent(id, {
    name: body.name ?? undefined,
    course_code: body.course_code ?? undefined,
    academic_year: body.academic_year ?? undefined,
    current_duration_unit: body.current_duration_unit ? Number(body.current_duration_unit) : undefined,
    class: body.class,
    section: body.section,
    phone: body.phone,
    address: body.address,
    university_roll_no: body.university_roll_no
  });

  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid student id' });
  await softDeleteStudent(id);
  res.status(204).send();
});

router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid student id' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const photoPath = `/uploads/students/${req.file.filename}`;
  const student = await uploadStudentPhoto(id, photoPath);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

export default router;
