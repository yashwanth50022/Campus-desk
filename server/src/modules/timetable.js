import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, getActor, requireRole } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';

export const timetableRouter=Router();timetableRouter.use(authenticate);
timetableRouter.get('/me',asyncHandler(async(req,res)=>{
 const user=await getActor(req);const where=user.role==='STUDENT'?{offering:{sectionId:user.student.sectionId,section:{semester:user.student.semester}}}:user.role==='TEACHER'?{offering:{staffId:user.staff.id}}:user.role==='HOD'?{offering:{course:{departmentId:user.staff.departmentId}}}:{};const items=await prisma.timetableSlot.findMany({where,include:{offering:{include:{course:true,section:true,staff:{select:{name:true}}}}},orderBy:[{weekday:'asc'},{period:'asc'}]});res.json({items});
}));
timetableRouter.post('/',requireRole('ADMIN'),validateBody(z.object({offeringId:z.string(),weekday:z.number().int().min(1).max(7),period:z.number().int().min(1).max(12),room:z.string().trim().min(1).max(30)})),asyncHandler(async(req,res)=>{
 const actor=await getActor(req);const {offeringId,weekday,period,room}=req.body;const offering=await prisma.courseOffering.findUnique({where:{id:offeringId}});if(!offering)throw new ApiError(404,'Class not found.');const classClash=await prisma.timetableSlot.findFirst({where:{weekday,period,offering:{sectionId:offering.sectionId}}});const staffClash=await prisma.timetableSlot.findFirst({where:{weekday,period,offering:{staffId:offering.staffId}}});if(classClash||staffClash)throw new ApiError(409,'This period conflicts with an existing class or staff assignment.');const item=await prisma.timetableSlot.create({data:{offeringId,weekday,period,room}});await audit({userId:actor.id,action:'TIMETABLE_SLOT_CREATED',tableName:'timetable_slots',recordId:item.id,newValue:item});res.status(201).json({item});
}));
