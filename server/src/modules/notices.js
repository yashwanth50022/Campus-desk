import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, getActor, requireRole } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';

export const noticesRouter=Router(); noticesRouter.use(authenticate);
noticesRouter.get('/',asyncHandler(async(req,res)=>{
 const user=await getActor(req); const audience=user.role==='STUDENT'?'STUDENTS':['TEACHER','HOD'].includes(user.role)?'STAFF':'ADMIN';
 const scoped=user.role==='ADMIN'?undefined:[{audience:'ALL'},{audience},{audience:user.role}];
 if(user.student)scoped.push({audience:`DEPT:${user.student.departmentId}`},{audience:`CLASS:${user.student.sectionId}`});
 if(user.staff){
   scoped.push({audience:`DEPT:${user.staff.departmentId}`});
   const offerings=await prisma.courseOffering.findMany({where:{staffId:user.staff.id},select:{sectionId:true}});
   scoped.push(...offerings.map(o=>({audience:`CLASS:${o.sectionId}`})));
 }
 const items=await prisma.notice.findMany({where:scoped?{OR:scoped}:undefined,include:{postedBy:{select:{loginId:true,role:true}}},orderBy:{createdAt:'desc'},take:100}); res.json({items});
}));
noticesRouter.post('/',requireRole('TEACHER','HOD','ADMIN'),validateBody(z.object({title:z.string().trim().min(3).max(160),body:z.string().trim().min(3).max(5000),audience:z.string().max(100).default('ALL')})),asyncHandler(async(req,res)=>{
 const user=await getActor(req); const {title,body,audience}=req.body;
 if(user.role==='TEACHER'){
   const sections=await prisma.courseOffering.findMany({where:{staffId:user.staff.id},select:{sectionId:true}});
   const allowed=[`DEPT:${user.staff.departmentId}`,...sections.map(o=>`CLASS:${o.sectionId}`)];
   if(!allowed.includes(audience))throw new ApiError(403,'Teachers may only post to an assigned class or their department.');
 }
 if(user.role==='HOD'&&audience!==`DEPT:${user.staff.departmentId}`)throw new ApiError(403,'HODs may only post to their department.');
 const item=await prisma.notice.create({data:{title,body,audience,postedById:user.id}}); await audit({userId:user.id,action:'NOTICE_POSTED',tableName:'notices',recordId:item.id,newValue:{title,audience}}); res.status(201).json({item});
}));
