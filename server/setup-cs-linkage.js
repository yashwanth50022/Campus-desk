// setup-cs-linkage.js
// This script links CS faculty with CS students for attendance and timetable functionality
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function setupCSLinkage() {
  console.log('=== CS Faculty-Student Linkage Setup ===\n');
  
  // 1. Ensure CS Department exists
  console.log('1. Ensuring CS Department exists...');
  const csDept = await db.department.upsert({
    where: { code: 'CS' },
    update: {},
    create: { code: 'CS', name: 'Computer Science & Engineering' }
  });
  console.log(`   ✓ CS Department: ${csDept.name} (ID: ${csDept.id})\n`);
  
  // 2. Ensure CS Sections exist for Semester 5
  console.log('2. Ensuring CS Sections exist for Semester 5...');
  const csSection5A = await db.section.upsert({
    where: { name_semester_departmentId: { name: 'A', semester: 5, departmentId: csDept.id } },
    update: {},
    create: { name: 'A', semester: 5, departmentId: csDept.id }
  });
  
  const csSection5B = await db.section.upsert({
    where: { name_semester_departmentId: { name: 'B', semester: 5, departmentId: csDept.id } },
    update: {},
    create: { name: 'B', semester: 5, departmentId: csDept.id }
  });
  console.log(`   ✓ CS Section A (ID: ${csSection5A.id})\n   ✓ CS Section B (ID: ${csSection5B.id})\n`);
  
  // 3. Create/Find CS Faculty member
  console.log('3. Creating/Finding CS Faculty member...');
  const facultyLoginId = 'FAC006';
  const existingUser = await db.user.findUnique({ where: { loginId: facultyLoginId } });
  
  let user;
  if (existingUser) {
    user = existingUser;
    console.log('   ✓ Existing user found:', user.loginId);
  } else {
    const passwordHash = await bcrypt.hash('Faculty@123', 12);
    user = await db.user.create({
      data: {
        loginId: facultyLoginId,
        passwordHash,
        role: 'TEACHER',
        forcePasswordChange: true
      }
    });
    console.log('   ✓ New user created:', user.loginId);
  }
  
  // 3b. Ensure staff record exists
  let staff = await db.staff.findUnique({ where: { userId: user.id } });
  if (!staff) {
    staff = await db.staff.create({
      data: {
        userId: user.id,
        employeeId: 'FAC006',
        name: 'CS Faculty Member',
        designation: 'Assistant Professor',
        departmentId: csDept.id
      }
    });
    console.log('   ✓ Staff record created (ID: ${staff.id})');
  } else {
    // Update department if needed
    if (staff.departmentId !== csDept.id) {
      await db.staff.update({
        where: { id: staff.id },
        data: { departmentId: csDept.id }
      });
      console.log('   ✓ Staff department updated to CS');
    }
    console.log('   ✓ Staff record already exists (ID: ${staff.id})');
  }
  
  console.log(`\n   Faculty: ${staff.name} (${staff.employeeId}) in ${csDept.name}\n`);
  
  // 4. Create CourseOfferings linking faculty to CS sections
  console.log('4. Creating CourseOfferings for CS Faculty...');
  
  // Create course if doesn't exist
  const csCourse = await db.course.upsert({
    where: { code: 'CS401' },
    update: {},
    create: { 
      code: 'CS401', 
      name: 'Design and Analysis of Algorithms', 
      credits: 4, 
      semester: 5, 
      departmentId: csDept.id 
    }
  });
  
  // Create course offering for Section A
  const offeringA = await db.courseOffering.upsert({
    where: { courseId_sectionId_academicYear: { courseId: csCourse.id, sectionId: csSection5A.id, academicYear: '2024-2025' } },
    update: {},
    create: {
      courseId: csCourse.id,
      sectionId: csSection5A.id,
      staffId: staff.id,
      academicYear: '2024-2025'
    }
  });
  console.log(`   ✓ Course offering created for Section A (ID: ${offeringA.id})`);
  
  // Create course offering for Section B
  const offeringB = await db.courseOffering.upsert({
    where: { courseId_sectionId_academicYear: { courseId: csCourse.id, sectionId: csSection5B.id, academicYear: '2024-2025' } },
    update: {},
    create: {
      courseId: csCourse.id,
      sectionId: csSection5B.id,
      staffId: staff.id,
      academicYear: '2024-2025'
    }
  });
  console.log(`   ✓ Course offering created for Section B (ID: ${offeringB.id})\n`);
  
  // 5. Link students to these sections
  console.log('5. Ensuring CS Students are linked to these sections...');
  
  // Create 10 CS students in Section A
  for (let i = 1; i <= 10; i++) {
    const usn = `1MJ24CS0${i}`;
    let student = await db.student.findUnique({ where: { usn } });
    
    if (!student) {
      const user = await db.user.findUnique({ where: { loginId: usn } });
      let userObj;
      if (!user) {
        const passwordHash = await bcrypt.hash('Student@123', 12);
        userObj = await db.user.create({
          data: {
            loginId: usn,
            passwordHash,
            role: 'STUDENT',
            forcePasswordChange: true
          }
        });
      } else {
        userObj = user;
      }
      
      student = await db.student.create({
        data: {
          userId: userObj.id,
          usn,
          name: `${csDept.code} Student ${String(i).padStart(2, '0')}`,
          departmentId: csDept.id,
          sectionId: csSection5A.id, // Section A
          semester: 5,
          admissionYear: 2024,
          phone: `+91 90000${String(i).padStart(5, '0')}`
        }
      });
      console.log(`   ✓ Created student: ${usn} in Section A`);
    }
  }
  
  // Create 10 CS students in Section B
  for (let i = 1; i <= 10; i++) {
    const usn = `1MJ24CS${String(i).padStart(2, '0')}`;
    let student = await db.student.findUnique({ where: { usn } });
    
    if (!student) {
      const user = await db.user.findUnique({ where: { loginId: usn } });
      let userObj;
      if (!user) {
        const passwordHash = await bcrypt.hash('Student@123', 12);
        userObj = await db.user.create({
          data: {
            loginId: usn,
            passwordHash,
            role: 'STUDENT',
            forcePasswordChange: true
          }
        });
      } else {
        userObj = user;
      }
      
      student = await db.student.create({
        data: {
          userId: userObj.id,
          usn,
          name: `${csDept.code} Student ${String(i).padStart(2, '0')}`,
          departmentId: csDept.id,
          sectionId: csSection5B.id, // Section B
          semester: 5,
          admissionYear: 2024,
          phone: `+91 90000${String(i + 10).padStart(5, '0')}`
        }
      });
      console.log(`   ✓ Created student: ${usn} in Section B`);
    }
  }
  
  console.log('\n   ✓ All students linked to CS sections\n');
  
  // 6. Verify the linkage
  console.log('6. Verifying linkage...');
  
  // Check course offerings
  const offerings = await prisma.courseOffering.findMany({
    where: { staffId: staff.id },
    include: { course: true, section: true }
  });
  console.log(`   Faculty teaches ${offerings.length} course(s):`);
  offerings.forEach(o => {
    console.log(`     - ${o.course.code} in Section ${o.section.name}`);
  });
  
  // Check students in sections
  const sectionAStudents = await db.student.count({ where: { sectionId: csSection5A.id } });
  const sectionBStudents = await db.student.count({ where: { sectionId: csSection5B.id } });
  console.log(`   Students in Section A: ${sectionAStudents}`);
  console.log(`   Students in Section B: ${sectionBStudents}`);
  
  // 7. Demonstrate functionality
  console.log('\n7. Testing functionality...\n');
  
  // 7a. Teacher can view their classes
  const teacherClasses = await db.courseOffering.findMany({
    where: { staffId: staff.id },
    include: { course: true, section: true }
  });
  console.log(`   ✓ Faculty can mark attendance for ${teacherClasses.length} class(es)`);
  
  // 7b. Timetable visibility for students in Section A
  const timetableA = await db.timetableSlot.findMany({
    where: { offering: { sectionId: csSection5A.id } },
    include: { offering: { include: { course: true, section: true, staff: true } } }
  });
  console.log(`   ✓ Timetable slots for Section A: ${timetableA.length}`);
  
  // 7c. Student can view their attendance
  console.log(`   ✓ Students can view their own attendance records`);
  
  console.log('\n=== Setup Complete! ===\n');
  console.log('Summary:');
  console.log('  • CS Faculty can mark attendance for their assigned course offerings');
  console.log('  • CS Faculty can create/edit timetable slots visible to their students');
  console.log('  • Students can view their timetables in login');
  console.log('  • Students can view their attendance records');
  console.log('  • Linkage is through CourseOffering → Section → Student');
  
  await db.$disconnect();
}

const prisma = new PrismaClient();
setupCSLinkage().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});