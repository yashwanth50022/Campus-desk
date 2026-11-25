import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, assertOfferingAccess, getActor, requireRole } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';

export const marksRouter = Router();
marksRouter.use(authenticate);
const updateSchema = z.object({ offeringId: z.string(), studentId: z.string(), component: z.enum(['IA1','IA2','SEE']), score: z.number().min(0).max(100), maxScore: z.number().positive().max(100).default(25), overrideReason: z.string().trim().min(8).max(500).optional() });

marksRouter.get('/me', requireRole('STUDENT'), asyncHandler(async (req, res) => {
  const user = await getActor(req);
  const items = await prisma.mark.findMany({ where: { studentId: user.student.id, isLocked: true }, include: { offering: { include: { course: true } } }, orderBy: { offering: { course: { code: 'asc' } } } });
  res.json({ items });
}));
marksRouter.get('/class/:offeringId', requireRole('TEACHER','HOD','ADMIN'), asyncHandler(async (req, res) => {
  const user = await getActor(req); const offering = await assertOfferingAccess(user, req.params.offeringId);
  const students = await prisma.student.findMany({ where: { sectionId: offering.sectionId }, include: { marks: { where: { offeringId: offering.id } } }, orderBy: { usn: 'asc' } });
  const items = students.map(({ marks, ...student }) => ({ student: { id: student.id, usn: student.usn, name: student.name }, marks, isLocked: marks.length > 0 && marks.every((mark) => mark.isLocked) }));
  res.json({ items });
}));
marksRouter.put('/', requireRole('TEACHER','HOD','ADMIN'), validateBody(updateSchema), asyncHandler(async (req, res) => {
  const user = await getActor(req); const offering = await assertOfferingAccess(user, req.body.offeringId);
  if (user.role === 'TEACHER' && req.body.component === 'SEE') throw new ApiError(403, 'Only administrators may enter SEE marks.');
  if (user.role === 'HOD' && offering.staffId !== user.staff.id) throw new ApiError(403, 'Marks may only be entered for your assigned classes; HODs may approve within their department.');
  const student = await prisma.student.findFirst({ where: { id: req.body.studentId, sectionId: offering.sectionId } });
  if (!student) throw new ApiError(404, 'Student is not enrolled in this class.');
  const existing = await prisma.mark.findUnique({ where: { offeringId_studentId_component: { offeringId: offering.id, studentId: student.id, component: req.body.component } } });
  if (existing?.isLocked && !(user.role === 'ADMIN' && req.body.overrideReason)) throw new ApiError(423, 'Approved marks are locked; an administrator must provide an override reason.');
  if (existing?.isLocked && user.role === 'ADMIN' && !req.body.overrideReason) throw new ApiError(400, 'An administrator override requires a reason.');
  if (req.body.component === 'SEE' && req.body.maxScore !== 100) throw new ApiError(400, 'SEE marks must be recorded out of 100.');
  if (req.body.component !== 'SEE' && req.body.maxScore !== 25) throw new ApiError(400, 'Internal assessment marks must be recorded out of 25.');
  if (req.body.score > req.body.maxScore) throw new ApiError(400, 'Score cannot exceed the maximum score.');
  const item = await prisma.mark.upsert({ where: { offeringId_studentId_component: { offeringId: offering.id, studentId: student.id, component: req.body.component } }, update: { score: req.body.score, maxScore: req.body.maxScore, isLocked: false, approvedAt: null }, create: { offeringId: offering.id, studentId: student.id, component: req.body.component, score: req.body.score, maxScore: req.body.maxScore } });
  await audit({ userId: user.id, action: existing?.isLocked ? `MARK_ADMIN_OVERRIDE: ${req.body.overrideReason}` : 'MARK_UPDATED', tableName: 'marks', recordId: item.id, oldValue: existing ? { score: existing.score, isLocked: existing.isLocked } : null, newValue: { score: item.score, component: item.component } });
  res.json({ item });
}));
marksRouter.post('/approve/:offeringId', requireRole('HOD'), asyncHandler(async (req, res) => {
  const user = await getActor(req); const offering = await assertOfferingAccess(user, req.params.offeringId);
  const enrolled = await prisma.student.count({ where: { sectionId: offering.sectionId } });
  const draft = await prisma.mark.count({ where: { offeringId: offering.id, isLocked: false } });
  const expected = enrolled * 3;
  const recorded = await prisma.mark.count({ where: { offeringId: offering.id } });
  if (recorded !== expected || draft !== expected) throw new ApiError(409, 'Enter all IA1, IA2, and SEE marks for every enrolled student before approval.');
  const result = await prisma.mark.updateMany({ where: { offeringId: offering.id }, data: { isLocked: true, approvedAt: new Date() } });
  await audit({ userId: user.id, action: 'MARKS_APPROVED_AND_LOCKED', tableName: 'marks', recordId: offering.id, newValue: { count: result.count } });
  res.json({ ok: true, count: result.count });
}));
