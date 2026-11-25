import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, assertOfferingAccess, getActor, requireRole } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);
const markSchema = z.object({ offeringId: z.string().min(1), date: z.string().datetime(), period: z.number().int().min(1).max(12), records: z.array(z.object({ studentId: z.string().min(1), status: z.enum(['PRESENT','ABSENT','LATE']) })).min(1).max(200) });

attendanceRouter.get('/me', requireRole('STUDENT'), asyncHandler(async (req, res) => {
  const user = await getActor(req);
  const entries = await prisma.attendance.findMany({ where: { studentId: user.student.id }, include: { offering: { include: { course: true } } }, orderBy: { date: 'desc' }, take: 250 });
  const attendanceSetting = await prisma.academicSetting.findUnique({ where: { key: 'attendanceCutoff' } });
  const cutoff = Math.min(100, Math.max(1, Number(attendanceSetting?.value) || 75));
  const groups = new Map();
  for (const row of entries) {
    const key = row.offeringId;
    const value = groups.get(key) ?? { offeringId: key, course: row.offering.course.name, code: row.offering.course.code, present: 0, total: 0 };
    value.total += 1; if (row.status !== 'ABSENT') value.present += 1; groups.set(key, value);
  }
  const items = [...groups.values()].map((r) => { const percentage = r.total ? Math.round(r.present / r.total * 100) : 0; return { ...r, percentage, belowCutoff: percentage < cutoff }; }).sort((a,b) => a.code.localeCompare(b.code));
  res.json({ items, history: entries, cutoff });
}));

attendanceRouter.get('/class/:offeringId', requireRole('TEACHER','HOD','ADMIN'), asyncHandler(async (req, res) => {
  const user = await getActor(req); const offering = await assertOfferingAccess(user, req.params.offeringId);
  const students = await prisma.student.findMany({ where: { sectionId: offering.sectionId }, include: { attendance: { where: { offeringId: offering.id } } }, orderBy: { usn: 'asc' } });
  const setting=await prisma.academicSetting.findUnique({where:{key:'attendanceCutoff'}});const cutoff=Math.min(100,Math.max(1,Number(setting?.value)||75));
  res.json({ cutoff, items: students.map((s) => ({ id: s.id, usn: s.usn, name: s.name, present: s.attendance.filter((a) => a.status !== 'ABSENT').length, total: s.attendance.length, percentage: s.attendance.length ? Math.round(s.attendance.filter((a) => a.status !== 'ABSENT').length / s.attendance.length * 100) : 0 })) });
}));

attendanceRouter.post('/', requireRole('TEACHER','HOD','ADMIN'), validateBody(markSchema), asyncHandler(async (req, res) => {
  const user = await getActor(req); const offering = await assertOfferingAccess(user, req.body.offeringId);
  const students = await prisma.student.findMany({ where: { id: { in: req.body.records.map((r) => r.studentId) }, sectionId: offering.sectionId }, select: { id: true } });
  if (students.length !== req.body.records.length || new Set(req.body.records.map((r) => r.studentId)).size !== students.length) throw new ApiError(400, 'Attendance includes duplicate or unassigned students.');
  const date = new Date(req.body.date);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid attendance date.');
  // The column is a SQL DATE, so the timestamp must be normalised to UTC midnight.
  // Sending the raw clock time makes the upsert lookup miss and violates the unique index on re-save.
  date.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.attendance.findMany({ where: { offeringId: offering.id, studentId: { in: req.body.records.map((record) => record.studentId) }, date, period: req.body.period } });
  const result = await prisma.$transaction(req.body.records.map((record) => prisma.attendance.upsert({ where: { offeringId_studentId_date_period: { offeringId: offering.id, studentId: record.studentId, date, period: req.body.period } }, update: { status: record.status, markedById: user.id }, create: { offeringId: offering.id, studentId: record.studentId, date, period: req.body.period, status: record.status, markedById: user.id } })));
  await audit({ userId: user.id, action: 'ATTENDANCE_MARKED', tableName: 'attendance', oldValue: existing.map(({studentId,status})=>({studentId,status})), newValue: { offeringId: offering.id, date, period: req.body.period, records: req.body.records } });
  res.json({ ok: true, count: result.length });
}));

attendanceRouter.get('/classes', requireRole('TEACHER','HOD','ADMIN'), asyncHandler(async (req, res) => {
  const user = await getActor(req);
  const where = user.role === 'TEACHER' ? { staffId: user.staff.id } : user.role === 'HOD' ? { course: { departmentId: user.staff.departmentId } } : {};
  const items = await prisma.courseOffering.findMany({ where, include: { course: true, section: true, staff: { select: { name: true } } }, orderBy: [{ section: { semester: 'asc' } }, { course: { code: 'asc' } }] });
  res.json({ items });
}));
