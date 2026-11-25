import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');
const db=new PrismaClient();
const password=process.env.DEMO_PASSWORD;
if (!password || password.length < 12 || password.startsWith('replace-')) throw new Error('Set DEMO_PASSWORD to a unique password of at least 12 characters before seeding.');
const passwordHash=await bcrypt.hash(password,12);
try {
  const cs=await db.department.upsert({where:{code:'CSE'},update:{name:'Computer Science & Engineering'},create:{code:'CSE',name:'Computer Science & Engineering'}});
  const ece=await db.department.upsert({where:{code:'ECE'},update:{name:'Electronics & Communication'},create:{code:'ECE',name:'Electronics & Communication'}});
  const csA=await db.section.upsert({where:{name_semester_departmentId:{name:'A',semester:4,departmentId:cs.id}},update:{},create:{name:'A',semester:4,departmentId:cs.id}});
  const eceA=await db.section.upsert({where:{name_semester_departmentId:{name:'A',semester:4,departmentId:ece.id}},update:{},create:{name:'A',semester:4,departmentId:ece.id}});
  const faculty=[
    {loginId:'FAC001',employeeId:'FAC001',name:'Ananya Rao',designation:'Assistant Professor',department:cs},
    {loginId:'FAC002',employeeId:'FAC002',name:'Rohan Mehta',designation:'Associate Professor',department:cs},
    {loginId:'FAC003',employeeId:'FAC003',name:'Priya Nair',designation:'Assistant Professor',department:cs},
    {loginId:'FAC004',employeeId:'FAC004',name:'Vikram Das',designation:'Associate Professor',department:ece},
    {loginId:'FAC005',employeeId:'FAC005',name:'Meera Shah',designation:'Assistant Professor',department:ece},
  ];
  const staffRows=[];
  for(const [i,f] of faculty.entries()){
    let user=await db.user.findUnique({where:{loginId:f.loginId}});
    if(!user)user=await db.user.create({data:{loginId:f.loginId,passwordHash,role:i===0||i===3?'HOD':'TEACHER',email:`${f.loginId.toLowerCase()}@demo.college.edu`,forcePasswordChange:true}});
    let staff=await db.staff.findUnique({where:{employeeId:f.employeeId}});
    if(!staff)staff=await db.staff.create({data:{userId:user.id,employeeId:f.employeeId,name:f.name,designation:f.designation,departmentId:f.department.id}});
    staffRows.push(staff);
  }
  await db.department.update({where:{id:cs.id},data:{hodStaffId:staffRows[0].id}});
  await db.department.update({where:{id:ece.id},data:{hodStaffId:staffRows[3].id}});
  if(!(await db.user.findUnique({where:{loginId:'ADMIN001'}})))await db.user.create({data:{loginId:'ADMIN001',passwordHash,role:'ADMIN',email:'admin@demo.college.edu',forcePasswordChange:true}});
  const students=[];
  for(let i=1;i<=20;i++){
    // USN format: campus(1MJ) + batch year(24) + branch(CS/EC) + 3-digit roll, e.g. 1MJ24CS209 = 2024 batch, CS department, roll 209.
    const department=i<=10?cs:ece, section=i<=10?csA:eceA, usn=`1MJ24${i<=10?'CS':'EC'}${String(i<=10?i:i-10).padStart(3,'0')}`;
    let student=await db.student.findUnique({where:{usn}});
    if(!student){const user=await db.user.create({data:{loginId:usn,passwordHash,role:'STUDENT',email:`${usn.toLowerCase()}@demo.college.edu`,forcePasswordChange:true}});student=await db.student.create({data:{userId:user.id,usn,name:`${i<=10?'CSE':'ECE'} Student ${String(i<=10?i:i-10).padStart(2,'0')}`,departmentId:department.id,sectionId:section.id,semester:4,admissionYear:2024,phone:`+91 90000${String(i).padStart(5,'0')}`}});}
    students.push(student);
  }
  const courses=[];
  for(const [department,items] of [[cs,[['CS401','Design and Analysis of Algorithms',4],['CS402','Operating Systems',4],['CS403','Database Systems',3]]],[ece,[['EC401','Digital Signal Processing',4],['EC402','Communication Systems',4]]]]){
    for(const [code,name,credits] of items){const course=await db.course.upsert({where:{code},update:{},create:{code,name,credits,semester:4,departmentId:department.id}});courses.push(course);}
  }
  const academicYear='2026-2027';const offerings=[];
  for(const [index,course] of courses.entries()){
    const section=course.departmentId===cs.id?csA:eceA;
    const teacher=course.departmentId===cs.id?staffRows[1+(index%2)]:staffRows[4];
    const offering=await db.courseOffering.upsert({where:{courseId_sectionId_academicYear:{courseId:course.id,sectionId:section.id,academicYear}},update:{},create:{courseId:course.id,sectionId:section.id,staffId:teacher.id,academicYear}});offerings.push(offering);
    await db.timetableSlot.upsert({where:{offeringId_weekday_period:{offeringId:offering.id,weekday:index%5+1,period:Math.floor(index/5)+2}},update:{},create:{offeringId:offering.id,weekday:index%5+1,period:Math.floor(index/5)+2,room:`${course.departmentId===cs.id?'CSE':'ECE'}-${201+index}`}});
  }
  const now=new Date();now.setUTCHours(0,0,0,0);
  for(let i=0;i<students.length;i++){
    const student=students[i];const suitable=offerings.filter(o=>o.sectionId===student.sectionId);
    for(const offering of suitable){
      for(let day=1;day<=12;day++){
        const date=new Date(now.getTime()-day*86400000);await db.attendance.upsert({where:{offeringId_studentId_date_period:{offeringId:offering.id,studentId:student.id,date,period:2}},update:{},create:{offeringId:offering.id,studentId:student.id,date,period:2,status:(i+day)%9===0?'ABSENT':'PRESENT',markedById:(await db.staff.findFirst({where:{offerings:{some:{id:offering.id}}}}))?.userId??staffRows[0].userId}});
      }
      for(const component of ['IA1','IA2'])await db.mark.upsert({where:{offeringId_studentId_component:{offeringId:offering.id,studentId:student.id,component}},update:{},create:{offeringId:offering.id,studentId:student.id,component,score:15+(i*3)%10,maxScore:25}});
    }
  }
  for(const department of [cs,ece])await db.feeStructure.upsert({where:{departmentId_year_head:{departmentId:department.id,year:2026,head:'Tuition Fee'}},update:{},create:{departmentId:department.id,year:2026,head:'Tuition Fee',amount:65000}});
  const admin=await db.user.findUnique({where:{loginId:'ADMIN001'}});
  await db.notice.upsert({where:{id:'demo-notice-welcome'},update:{},create:{id:'demo-notice-welcome',title:'Welcome to the new semester',body:'Check your timetable and course enrollment. Faculty will publish attendance and marks here.',audience:'ALL',postedById:admin.id}});
  for(const [key,value] of [['attendanceCutoff','75'],['academicYear',academicYear],['gradingScale','S:90-100, A:80-89, B:70-79, C:60-69, D:50-59, F:0-49']])await db.academicSetting.upsert({where:{key},update:{value},create:{key,value}});
  console.info(`Seed complete: ${students.length} students, ${faculty.length} faculty, 2 departments, ${courses.length} courses.`);
  console.info('Demo logins: ADMIN001, FAC001–FAC005; all demo accounts use DEMO_PASSWORD.');
  console.info(`Student USNs: ${students.map((s) => s.usn).join(', ')}`);
} finally {await db.$disconnect();}
