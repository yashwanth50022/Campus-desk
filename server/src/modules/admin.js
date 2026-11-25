import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { authenticate, getActor, requireRole } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));

adminRouter.get('/overview', asyncHandler(async (_req,res) => {
  const [students, staff, departments, courses, sections, unpaid] = await Promise.all([
    prisma.student.count(), prisma.staff.count(), prisma.department.count(), prisma.course.count(), prisma.section.count(),
    prisma.student.findMany({ include: { department: { include: { feeStructures: { where: { year: Number(process.env.ACADEMIC_YEAR_START)||new Date().getFullYear() } } } }, feePayments: { where: { feeStructure: { year: Number(process.env.ACADEMIC_YEAR_START)||new Date().getFullYear() } } } } }),
  ]);
  const due = unpaid.reduce((sum, student) => sum + student.department.feeStructures.filter((f) => f.year === (Number(process.env.ACADEMIC_YEAR_START)||new Date().getFullYear())).reduce((subtotal, f) => subtotal + f.amount, 0) - student.feePayments.reduce((subtotal, p) => subtotal + p.amount, 0), 0);
  res.json({ students, staff, departments, courses, sections, feeDue: Math.max(0, due) });
}));
adminRouter.get('/users', asyncHandler(async (_req,res) => {
  const items = await prisma.user.findMany({ select: { id: true, loginId: true, role: true, email: true, isActive: true, createdAt: true, student: { select: { name: true, usn: true } }, staff: { select: { id:true, name: true, employeeId: true, departmentId:true, designation:true } } }, orderBy: { createdAt: 'desc' }, take: 300 });
  res.json({ items });
}));
adminRouter.post('/users', validateBody(z.object({ loginId: z.string().trim().min(3).max(40), password: z.string().min(12).max(128), role: z.enum(['STUDENT','TEACHER','HOD','ADMIN']), email: z.string().email().optional(), name: z.string().trim().min(2).max(100), usn: z.string().trim().optional(), employeeId: z.string().trim().optional(), departmentId: z.string().optional(), sectionId: z.string().optional(), semester: z.number().int().min(1).max(8).optional(), admissionYear: z.number().int().optional(), designation: z.string().trim().optional() })), asyncHandler(async (req,res) => {
  const actor = await getActor(req); const input = req.body;
  if (input.role === 'STUDENT' && (!input.usn || !input.departmentId || !input.sectionId || !input.semester || !input.admissionYear)) throw new ApiError(400, 'Student USN, department, section, semester, and admission year are required.');
  if (['TEACHER','HOD'].includes(input.role) && (!input.employeeId || !input.departmentId)) throw new ApiError(400, 'Staff employee ID and department are required.');
  const passwordHash = await bcrypt.hash(input.password, 12);
  if (input.role === 'STUDENT') {
    const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
    if (!section || section.departmentId !== input.departmentId || section.semester !== input.semester) throw new ApiError(400, 'Student department, section, and semester must match.');
  }
  if (['TEACHER','HOD'].includes(input.role) && !await prisma.department.findUnique({where:{id:input.departmentId}})) throw new ApiError(400, 'Select an existing department.');
  const user = await prisma.user.create({ data: { loginId: input.loginId, passwordHash, role: input.role, email: input.email, forcePasswordChange: true,
    ...(input.role === 'STUDENT' ? { student: { create: { usn: input.usn, name: input.name, departmentId: input.departmentId, sectionId: input.sectionId, semester: input.semester, admissionYear: input.admissionYear } } } : {}),
    ...(['TEACHER','HOD'].includes(input.role) ? { staff: { create: { employeeId: input.employeeId, name: input.name, designation: input.designation || input.role, departmentId: input.departmentId } } } : {}),
  }, select: { id:true, loginId:true, role:true, email:true, isActive:true, forcePasswordChange:true, student:{select:{id:true,usn:true,name:true,departmentId:true,sectionId:true,semester:true,admissionYear:true}}, staff:{select:{id:true,employeeId:true,name:true,designation:true,departmentId:true}} } });
  if(input.role==='HOD'&&user.staff)await prisma.department.update({where:{id:input.departmentId},data:{hodStaffId:user.staff.id}});
  await audit({ userId: actor.id, action: 'USER_CREATED', tableName: 'users', recordId: user.id, newValue: user });
  res.status(201).json({ user });
}));
adminRouter.patch('/users/:id/status', validateBody(z.object({ isActive: z.boolean() })), asyncHandler(async (req,res) => {
  const actor = await getActor(req);
  if (req.params.id === actor.id && !req.body.isActive) throw new ApiError(400, 'You cannot deactivate your own account.');
  const old = await prisma.user.findUnique({ where: { id: req.params.id }, select: { isActive: true } });
  if (!old) throw new ApiError(404, 'User not found.');
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: req.body.isActive, refreshTokenHash: req.body.isActive ? undefined : null }, select: { id:true, loginId:true, role:true, isActive:true } });
  await audit({ userId: actor.id, action: 'USER_STATUS_CHANGED', tableName: 'users', recordId: user.id, oldValue: old, newValue: { isActive: user.isActive } });
  res.json({ user });
}));
adminRouter.get('/departments', asyncHandler(async (_req,res) => res.json({ items: await prisma.department.findMany({ include: { feeStructures:true, _count: { select: { students:true, staff:true, courses:true } } }, orderBy: { name:'asc' } }) })));
adminRouter.post('/departments', validateBody(z.object({ code:z.string().trim().min(2).max(12).toUpperCase(), name:z.string().trim().min(2).max(100) })), asyncHandler(async (req,res) => {
  const user = await getActor(req); const department = await prisma.department.create({ data:req.body });
  await audit({ userId:user.id, action:'DEPARTMENT_CREATED', tableName:'departments', recordId:department.id, newValue:department });
  res.status(201).json({ department });
}));
adminRouter.get('/courses', asyncHandler(async (_req,res) => res.json({ items: await prisma.course.findMany({ include:{ department:true }, orderBy:{ code:'asc' } }) })));
adminRouter.post('/courses', validateBody(z.object({ code:z.string().trim().min(2).max(20).toUpperCase(), name:z.string().trim().min(2).max(120), credits:z.number().int().min(1).max(10), semester:z.number().int().min(1).max(8), departmentId:z.string() })), asyncHandler(async (req,res) => {
 const actor=await getActor(req);const course=await prisma.course.create({ data:req.body });await audit({userId:actor.id,action:'COURSE_CREATED',tableName:'courses',recordId:course.id,newValue:course});res.status(201).json({ course });
}));
adminRouter.get('/sections', asyncHandler(async (_req,res) => res.json({ items: await prisma.section.findMany({ include:{ department:true, _count:{select:{students:true}} }, orderBy:[{semester:'asc'},{name:'asc'}] }) })));
adminRouter.post('/sections', validateBody(z.object({ name:z.string().trim().min(1).max(20), semester:z.number().int().min(1).max(8), departmentId:z.string() })), asyncHandler(async (req,res) => {
 const actor=await getActor(req);const section=await prisma.section.create({ data:req.body });await audit({userId:actor.id,action:'SECTION_CREATED',tableName:'sections',recordId:section.id,newValue:section});res.status(201).json({ section });
}));
adminRouter.post('/offerings', validateBody(z.object({ courseId:z.string(), sectionId:z.string(), staffId:z.string(), academicYear:z.string().regex(/^\d{4}-\d{4}$/) })), asyncHandler(async (req,res) => {
 const actor=await getActor(req);const [course,section,staff]=await Promise.all([prisma.course.findUnique({where:{id:req.body.courseId}}),prisma.section.findUnique({where:{id:req.body.sectionId}}),prisma.staff.findUnique({where:{id:req.body.staffId}})]);if(!course||!section||!staff||course.departmentId!==section.departmentId||course.departmentId!==staff.departmentId||course.semester!==section.semester)throw new ApiError(400,'Course, section, and faculty must belong to the same department and semester.');const offering=await prisma.courseOffering.create({ data:req.body });await audit({userId:actor.id,action:'COURSE_OFFERING_CREATED',tableName:'course_offerings',recordId:offering.id,newValue:offering});res.status(201).json({ offering });
}));
adminRouter.get('/audit', asyncHandler(async (req,res) => {
 const items=await prisma.auditLog.findMany({ include:{user:{select:{loginId:true,role:true}}}, orderBy:{at:'desc'}, take:200 }); res.json({items});
}));
adminRouter.get('/settings', asyncHandler(async (_req,res)=>{const items=await prisma.academicSetting.findMany({orderBy:{key:'asc'}});res.json({items:Object.fromEntries(items.map(({key,value})=>[key,value]))});}));
adminRouter.put('/settings', validateBody(z.object({ attendanceCutoff:z.number().min(1).max(100), gradingScale:z.string().max(1000), academicYear:z.string().regex(/^\d{4}-\d{4}$/) })), asyncHandler(async (req,res) => {
 const user=await getActor(req); const pairs=Object.entries(req.body);
 await prisma.$transaction(pairs.map(([key,value])=>prisma.academicSetting.upsert({where:{key},update:{value:String(value)},create:{key,value:String(value)}})));
 await audit({userId:user.id,action:'ACADEMIC_SETTINGS_UPDATED',tableName:'academic_settings',newValue:req.body}); res.json({ok:true});
}));
