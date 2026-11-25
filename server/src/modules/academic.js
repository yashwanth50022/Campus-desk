import { Router } from 'express';
import { z } from 'zod';
import { authenticate, getActor, requireRole } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';
import { prisma } from '../db.js';

export const academicRouter = Router();
academicRouter.use(authenticate);
academicRouter.get('/enrolment/me', requireRole('STUDENT'), asyncHandler(async (req,res) => {
 const user=await getActor(req); const items=await prisma.courseOffering.findMany({where:{sectionId:user.student.sectionId,section:{semester:user.student.semester}},include:{course:true,staff:{select:{name:true,designation:true}},section:true},orderBy:{course:{code:'asc'}}}); res.json({items});
}));
academicRouter.get('/timetable/me', requireRole('STUDENT'), asyncHandler(async (req,res) => {
 const user=await getActor(req); const items=await prisma.timetableSlot.findMany({where:{offering:{sectionId:user.student.sectionId,section:{semester:user.student.semester}}},include:{offering:{include:{course:true,section:true,staff:{select:{name:true}}}}},orderBy:[{weekday:'asc'},{period:'asc'}]}); res.json({items});
}));
academicRouter.get('/timetable/teaching', requireRole('TEACHER','HOD','ADMIN'), asyncHandler(async (req,res) => {
 const user=await getActor(req); const where=user.role==='TEACHER'?{offering:{staffId:user.staff.id}}:user.role==='HOD'?{offering:{course:{departmentId:user.staff.departmentId}}}:{}; const items=await prisma.timetableSlot.findMany({where,include:{offering:{include:{course:true,section:true,staff:{select:{name:true}}}}},orderBy:[{weekday:'asc'},{period:'asc'}]}); res.json({items});
}));
academicRouter.get('/calendar', asyncHandler(async (_req,res) => { const items=await prisma.academicEvent.findMany({orderBy:{date:'asc'}}); res.json({items}); }));
academicRouter.post('/calendar', requireRole('ADMIN'), validateBody(z.object({title:z.string().trim().min(2).max(160),description:z.string().max(1000).optional(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),kind:z.enum(['EXAM','HOLIDAY','EVENT','DEADLINE']).default('EVENT')})), asyncHandler(async(req,res)=>{const actor=await getActor(req);const date=new Date(`${req.body.date}T00:00:00.000Z`);if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==req.body.date)throw new ApiError(400,'Invalid event date.');const item=await prisma.academicEvent.create({data:{...req.body,date}});await audit({userId:actor.id,action:'ACADEMIC_EVENT_CREATED',tableName:'academic_events',recordId:item.id,newValue:item});res.status(201).json({item});}));
