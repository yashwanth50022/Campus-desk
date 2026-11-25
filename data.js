/* ==================================================================
   CAMPUS DESK · YOUR DATA
   ------------------------------------------------------------------
   This is the ONLY file you need to edit to make the portal yours.
   Every list below starts empty on purpose — add your own records.

   HOW TO USE
   1. Uncomment an example block (remove the leading // on each line).
   2. Replace the values with your real data.
   3. Save the file and refresh the page.

   ⚠ IMPORTANT — READ BEFORE PUBLISHING
   This file is served to the browser, so anyone can read it, including
   the passwords. That is fine for a public demo, but never put real
   college credentials here. Real authentication (bcrypt hashes, JWT
   sessions, per-route role checks) lives in server/ — see GUIDE.md.
================================================================== */

window.CAMPUS_DATA = {
  /* ------------------------------------------------------------------
     1. COLLEGE DETAILS
     Shown in the sidebar, the header and the welcome line.
  ------------------------------------------------------------------ */
  institution: {
    name: 'MVJCE College ERP',
    academicYear: '2026–27',
    semester: '5',
    section: 'C'
  },

  /* ------------------------------------------------------------------
     2. PEOPLE — one entry per login.
     role must be exactly one of: 'STUDENT' | 'TEACHER' | 'HOD' | 'ADMIN'
     That value decides which screens the person can open (see GUIDE.md).
  ------------------------------------------------------------------ */
  people: [
    /* -------------------- STUDENT ------------------- */
    {
      loginId: '1MJ24CS209@mvjce.edu.in',
      password: 'Yash333502-12-2005',
      role: 'STUDENT',
      name: 'Yashwant Sai T',
      department: 'Computer Science',
      email: 'yashwant@mvjce.edu.in',
      phone: '+91 9000000000',
      semester: 5,
      section: 'C',
      mentor: 'Dr. Faculty Name',

      // Overall class attendance (drives the % badge and shortage alerts)
      attendance: { present: 0, total: 0 },

      // Marks of the class shown on the Marks screen
      // IA1 and IA2 are out of 25, SEE is out of 100
      marks: { IA1: 0, IA2: 0, SEE: 0 },

      // Subject-wise attendance on the Attendance screen
      // Using course codes from timetable, mapped to subject names from subject allocation table
      subjects: [
        { code: 'MVJ22CS51', name: 'Software Engineering & Project Management', credits: 4, faculty: 'Prof. Maivizhi C', attendance: 0 },
        { code: 'MVJ22CS52', name: 'Computer Networks', credits: 4, faculty: 'Prof. Helan Mariam Aipe / Ms.Logashree', attendance: 0 },
        { code: 'MVJ22CS53', name: 'Theory Of Computation', credits: 3, faculty: 'Prof. Poshitha M', attendance: 0 },
        { code: 'MVJ22CS552', name: 'Artificial Intelligence', credits: 3, faculty: 'Prof.Navya KS', attendance: 0 },
        { code: 'MVJ22RMI57', name: 'Research Methodology', credits: 3, faculty: 'Prof.Anannya Dutta', attendance: 0 },
        { code: 'MVJ22ENV58', name: 'Environmental Studies', credits: 2, faculty: 'Dr. Chirdeep', attendance: 0 },
        // NSS removed as requested
        { code: 'MVJ22CSP56', name: 'Mini-project', credits: 2, faculty: 'Prof. Helen Mariam Aipe', attendance: 0 },
        { code: 'MVJ22CSL54L', name: 'DataVisualization Lab', credits: 1, faculty: 'Prof. Mukundavani', attendance: 0 },
      ],

      // Fee ledger on the Fees screen (status: PAID | DUE | UPCOMING)
      fees: [
        { id: 'F1', particulars: 'Semester 5 tuition', amount: 65000, due: '15 Dec 2026', status: 'DUE' },
      ]
    },

    /* -------------------- FACULTY ------------------- */
    {
      loginId: 'yashwant50022@gmail.com',
      password: 'yashwanth50022',
      role: 'TEACHER',
      name: 'Yashwant',
      department: 'Computer Science',
      designation: 'Assistant Professor',
      email: 'yashwant@mvjce.edu.in',
      phone: '+91 98450 00006'
    },

    /* -------------------- ADMINISTRATOR --------------- */
    {
      loginId: 'colerobyn@gmail.com',
      password: 'yashwanth50022',
      role: 'ADMIN',
      name: 'Yashwanth',
      department: 'Administration',
      designation: 'Registrar',
      email: 'office@mvjce.edu.in',
      phone: '+91 98450 00003'
    }
  ],

  /* ------------------------------------------------------------------
     3. COURSES — the academic catalogue.
  ------------------------------------------------------------------ */
  courses: [
    { code: 'MVJ22CS51', name: 'Software Engineering & Project Management', credits: 4, faculty: 'Prof. Maivizhi C'},
        { code: 'MVJ22CS52', name: 'Computer Networks', credits: 4, faculty: 'Prof. Helan Mariam Aipe / Ms.Logashree'},
        { code: 'MVJ22CS53', name: 'Theory Of Computation', credits: 3, faculty: 'Prof. Poshitha M'},
        { code: 'MVJ22CS552', name: 'Artificial Intelligence', credits: 3, faculty: 'Prof.Navya KS'},
        { code: 'MVJ22RMI57', name: 'Research Methodology', credits: 3, faculty: 'Prof.Anannya Dutta'},
        { code: 'MVJ22ENV58', name: 'Environmental Studies', credits: 2, faculty: 'Dr. Chirdeep'},
        { code: 'MVJ22CSP56', name: 'Mini-project', credits: 2, faculty: 'Prof. Helen Mariam Aipe'},
        { code: 'MVJ22CSL54L', name: 'DataVisualization Lab', credits: 1, faculty: 'Prof. Mukundavani' },
  ],

  /* ------------------------------------------------------------------
     4. TIMETABLE — 7 periods (1–7), 6 days (Monday–Saturday).
     Period times match Image 11 exactly:
       P1: 8:00-9:00, P2: 9:00-10:00, Break: 10:00-10:30,
       P3: 10:30-11:30, P4: 11:30-12:30, Lunch: 12:30-1:30,
       P5: 1:30-2:30, P6: 2:30-3:30, P7: 3:30-4:30
     No Sunday classes. (B1)/(B2) markers removed as requested.
     NSS removed from subjects but kept in timetable per Image 11.
  ------------------------------------------------------------------ */
  timetable: [
    /* ------------ MONDAY ------------ */
    { day: 1, period: 1, code: 'MVJ22CS52' },
    { day: 1, period: 2, code: 'MVJ22CS53' },
    { day: 1, period: 3, code: 'MVJ22CS51' },
    { day: 1, period: 4, code: 'MVJ22CS552' },
    { day: 1, period: 5, code: 'MVJ22NS59' },
    { day: 1, period: 6, code: 'MVJ22NS59' },
    { day: 1, period: 7, code: '' },

    /* ------------ TUESDAY ------------ */
    { day: 2, period: 1, code: 'MVJ22CS53' },
    { day: 2, period: 2, code: 'MVJ22RMI57' },
    { day: 2, period: 3, code: 'MVJ22CS52' },
    { day: 2, period: 4, code: 'MVJ22CS54L' },
    { day: 2, period: 5, code: 'MVJ22CS51' },
    { day: 2, period: 6, code: 'MVJ22CSP56' },
    { day: 2, period: 7, code: '' },

    /* ------------ WEDNESDAY ------------ */
    { day: 3, period: 1, code: 'MVJ22RMI57' },
    { day: 3, period: 2, code: 'MVJ22CS552' },
    { day: 3, period: 3, code: 'MVJ22CS52' },
    { day: 3, period: 4, code: 'MVJ22ENV58' },
    { day: 3, period: 5, code: '' },
    { day: 3, period: 6, code: '' },
    { day: 3, period: 7, code: '' },

    /* ------------ THURSDAY ------------ */
    { day: 4, period: 1, code: 'MVJ22CS51' },
    { day: 4, period: 2, code: 'MVJ22CSP56' },
    { day: 4, period: 3, code: 'MVJ22CS552' },
    { day: 4, period: 4, code: 'MVJ22CS53' },
    { day: 4, period: 5, code: 'MVJ22CSP56' },
    { day: 4, period: 6, code: 'MVJ22CSP56' },
    { day: 4, period: 7, code: '' },

    /* ------------ FRIDAY ------------ */
    { day: 5, period: 1, code: 'MVJ22ENV58' },
    { day: 5, period: 2, code: 'MVJ22CS53' },
    { day: 5, period: 3, code: 'MVJ22CS52' },
    { day: 5, period: 4, code: 'MVJ22RMI57' },
    { day: 5, period: 5, code: 'MVJ22CS52' },
    { day: 5, period: 6, code: 'MVJ22CS54L' },
    { day: 5, period: 7, code: '' },

    /* ------------ SATURDAY ------------ */
    { day: 6, period: 1, code: 'MVJ22CS52' },
    { day: 6, period: 2, code: 'MVJ22CS53' },
    { day: 6, period: 3, code: 'MVJ22CS52' },
    { day: 6, period: 4, code: 'MVJ22CS51' },
    { day: 6, period: 5, code: '' },
    { day: 6, period: 6, code: '' },
    { day: 6, period: 7, code: '' }
  ],

  /* ------------------------------------------------------------------
     5. ACADEMIC CALENDAR — kind: EVENT | EXAM | HOLIDAY | DEADLINE
  ------------------------------------------------------------------ */
  calendar: [],

  /* ------------------------------------------------------------------
     6. NOTICES — audience is free text shown on the card.
  ------------------------------------------------------------------ */
  notices: []
};