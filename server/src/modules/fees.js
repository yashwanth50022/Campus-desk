import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, getActor, requireRole } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';
import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';

export const feesRouter=Router(); feesRouter.use(authenticate);
feesRouter.get('/me',requireRole('STUDENT'),asyncHandler(async(req,res)=>{
 const user=await getActor(req); const year=Number(process.env.ACADEMIC_YEAR_START)||new Date().getFullYear(); const structures=await prisma.feeStructure.findMany({where:{departmentId:user.student.departmentId,year},orderBy:{head:'asc'}}); const payments=await prisma.feePayment.findMany({where:{studentId:user.student.id,feeStructure:{year}},include:{feeStructure:true},orderBy:{paidOn:'desc'}}); const due=structures.reduce((sum,s)=>sum+s.amount,0)-payments.reduce((sum,p)=>sum+p.amount,0); res.json({year,structures,payments,totalDue:Math.max(0,due)});
}));
feesRouter.get('/students',requireRole('ADMIN'),asyncHandler(async(_req,res)=>{
 const year=Number(process.env.ACADEMIC_YEAR_START)||new Date().getFullYear(); const students=await prisma.student.findMany({include:{user:{select:{loginId:true}},department:{include:{feeStructures:{where:{year}}}},feePayments:{where:{feeStructure:{year}}}},orderBy:{usn:'asc'}});
 res.json({items:students.map(s=>{const due=s.department.feeStructures.reduce((n,f)=>n+f.amount,0);const paymentsByStructure=new Map();for(const payment of s.feePayments)paymentsByStructure.set(payment.feeStructureId,(paymentsByStructure.get(payment.feeStructureId)||0)+payment.amount);const paid=[...paymentsByStructure.values()].reduce((n,amount)=>n+amount,0);return {id:s.id,usn:s.usn,name:s.name,department:s.department.name,due:Math.max(0,due-paid),paid}})});
}));
feesRouter.post('/structures',requireRole('ADMIN'),validateBody(z.object({departmentId:z.string(),year:z.number().int().min(2020).max(2100),head:z.string().trim().min(2).max(100),amount:z.number().positive().max(10000000)})),asyncHandler(async(req,res)=>{
 const user=await getActor(req); const item=await prisma.feeStructure.upsert({where:{departmentId_year_head:{departmentId:req.body.departmentId,year:req.body.year,head:req.body.head}},update:{amount:req.body.amount},create:req.body}); await audit({userId:user.id,action:'FEE_STRUCTURE_CHANGED',tableName:'fee_structures',recordId:item.id,newValue:item}); res.status(201).json({item});
}));
feesRouter.get('/departments',requireRole('ADMIN'),asyncHandler(async(_req,res)=>{const items=await prisma.department.findMany({include:{feeStructures:true},orderBy:{name:'asc'}});res.json({items});}));
feesRouter.post('/payments',requireRole('ADMIN'),validateBody(z.object({studentId:z.string(),feeStructureId:z.string(),amount:z.number().positive().max(10000000)})),asyncHandler(async(req,res)=>{
 const user=await getActor(req);const receiptNo=`RCP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;const item=await prisma.$transaction(async(tx)=>{const structure=await tx.feeStructure.findUnique({where:{id:req.body.feeStructureId}});const student=await tx.student.findUnique({where:{id:req.body.studentId}});if(!structure||!student||structure.departmentId!==student.departmentId)throw new ApiError(400,'The fee structure does not belong to this student.');const paid=await tx.feePayment.aggregate({where:{studentId:student.id,feeStructureId:structure.id},_sum:{amount:true}});if((paid._sum.amount||0)+req.body.amount>structure.amount)throw new ApiError(400,'Payment exceeds the outstanding fee balance.');return tx.feePayment.create({data:{...req.body,receiptNo}});},{isolationLevel:'Serializable'});await audit({userId:user.id,action:'FEE_PAYMENT_RECORDED',tableName:'fee_payments',recordId:item.id,newValue:item});res.status(201).json({item});
}));
feesRouter.get('/receipt/:id/pdf',requireRole('STUDENT','ADMIN'),asyncHandler(async(req,res)=>{
 const user=await getActor(req);const item=await prisma.feePayment.findUnique({where:{id:req.params.id},include:{feeStructure:true,student:true}});if(!item||(user.role==='STUDENT'&&item.studentId!==user.student.id))throw new ApiError(404,'Receipt not found.');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${item.receiptNo}.pdf"`);const doc=new PDFDocument({margin:52});doc.pipe(res);doc.fontSize(19).text('College ERP — Payment Receipt');doc.moveDown();doc.fontSize(11).text(`Receipt number: ${item.receiptNo}`);doc.text(`Student: ${item.student.name} (${item.student.usn})`);doc.text(`Fee head: ${item.feeStructure.head}`);doc.text(`Academic year: ${item.feeStructure.year}`);doc.text(`Amount received: INR ${item.amount.toLocaleString('en-IN')}`);doc.text(`Date: ${item.paidOn.toLocaleDateString('en-IN')}`);doc.moveDown(2).fontSize(9).fillColor('#666').text('Payment recorded manually by the college office.');doc.end();
}));
feesRouter.get('/receipt/:id',requireRole('STUDENT','ADMIN'),asyncHandler(async(req,res)=>{
 const user=await getActor(req);const item=await prisma.feePayment.findUnique({where:{id:req.params.id},include:{feeStructure:true,student:true}});if(!item||(user.role==='STUDENT'&&item.studentId!==user.student.id))throw new ApiError(404,'Receipt not found.');res.json({item});
}));
