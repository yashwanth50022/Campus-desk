// cleanup-option2.js
// This script removes timetable, course offerings, attendance, and marks
// while keeping departments, faculty, and students with their section assignments
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function cleanupOption2() {
  console.log('=== Option 2: Cleanup - Remove Timetable/Attendance/Marks ===\n');
  console.log('This will:');
  console.log('  ✅ Keep: Departments, faculty, students with section assignments');
  console.log('  ❌ Remove: Course offerings, timetable slots, attendance, marks\n');
  
  try {
    // Step 1: Remove all attendance records first (depends on offering+student+date+period)
    console.log('1. Removing all attendance records...');
    const attendanceCount = await prisma.attendance.count({});
    console.log(`   Found ${attendanceCount} attendance records to remove`);
    await prisma.attendance.deleteMany({});
    console.log(`   ✅ Removed ${attendanceCount} attendance records\n`);
    
    // Step 2: Remove all marks/grades
    console.log('2. Removing all marks/grades...');
    const marksCount = await prisma.mark.count({});
    console.log(`   Found ${marksCount} marks records to remove`);
    await prisma.mark.deleteMany({});
    console.log(`   ✅ Removed ${marksCount} marks records\n`);
    
    // Step 3: Remove all timetable slots
    console.log('3. Removing all timetable slots...');
    const timetableCount = await prisma.timetableSlot.count({});
    console.log(`   Found ${timetableCount} timetable slots to remove`);
    await prisma.timetableSlot.deleteMany({});
    console.log(`   ✅ Removed ${timetableCount} timetable slots\n`);
    
    // Step 4: Remove all course offerings (this is the key step)
    // Course offerings link faculty to sections. Students reference sections, 
    // but course offerings will be removed. Students remain in their sections.
    console.log('4. Removing all course offerings...');
    const offeringsCount = await prisma.courseOffering.count({});
    console.log(`   Found ${offeringsCount} course offerings to remove`);
    await prisma.courseOffering.deleteMany({});
    console.log(`   ✅ Removed ${offeringsCount} course offerings\n`);
    
    // Step 5: Verify what remains
    console.log('5. Verifying remaining data...\n');
    
    // Departments
    const departments = await prisma.department.findMany({});
    console.log(`   ✅ Departments remaining: ${departments.length}`);
    departments.forEach(d => console.log(`     - ${d.code}: ${d.name}`));
    
    // Faculty/Staff
    const staff = await prisma.staff.findMany({ include: { user: true } });
    console.log(`   ✅ Faculty remaining: ${staff.length}`);
    staff.forEach(s => console.log(`     - ${s.user.loginId} (${s.designation}) in ${s.departmentId}`));
    
    // Students with their section assignments
    const students = await prisma.student.findMany({ include: { section: true } });
    console.log(`   ✅ Students remaining: ${students.length}`);
    students.forEach(s => {
      console.log(`     - ${s.usn} (${s.name}) in Section ${s.section.name}, Semester ${s.section.semester}`);
    });
    
    console.log('\n=== Cleanup Complete! ===\n');
    console.log('What remains:');
    console.log('  • Departments (CS, ECE)');
    console.log('  • Faculty records with their departments');
    console.log('  • All 20 students with their section assignments');
    console.log('  • Student-section relationships intact');
    console.log('\nWhat was removed:');
    console.log('  • All course offerings (old subjects/courses)');
    console.log('  • All timetable slots');
    console.log('  • All attendance records');
    console.log('  • All marks/grades');
    console.log('\nNow you can recreate course offerings and timetable from scratch.\n');
    
    await db.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await db.$disconnect();
    process.exit(1);
  }
}

const prisma = new PrismaClient();
cleanupOption2();