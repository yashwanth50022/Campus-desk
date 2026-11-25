# Adding your data & what each role can do

The portal ships empty. Everything it shows comes from one file:

```
data.js
```

You never need to touch `portal.js` or the CSS to change content — only `data.js`.
After editing, save the file and refresh the page.

---

## 1. What lives where

| Section in `data.js` | Holds | Where it appears |
| --- | --- | --- |
| `institution` | College name, academic year, semester, section | Sidebar, header, welcome line, footer |
| `people` | Every login: students, faculty, HODs, administrators | Sign-in, users list, class rosters, reports |
| `courses` | Subject catalogue | Courses screen |
| `timetable` | One entry per class period | Timetable screen, "Classes today" |
| `calendar` | Exams, holidays, deadlines | Timetable screen |
| `notices` | Announcements | Notices screen, dashboard bulletin |

---

## 2. Start from a working example

Here is a complete, copy-pasteable `people` list — one of each role — plus a couple of courses, a timetable entry and a notice. Paste it over the empty `people: []` (and the other lists) in `data.js`.

```js
people: [
  {
    loginId: 'ADM-001',
    password: 'Admin@2026',
    role: 'ADMIN',
    name: 'Registrar Office',
    department: 'Administration',
    designation: 'Registrar',
    email: 'office@yourcollege.edu',
    phone: '+91 98450 00003'
  },
  {
    loginId: 'HOD-CSE',
    password: 'Hod@2026',
    role: 'HOD',
    name: 'Dr. Rhea Nair',
    department: 'Computer Science',
    designation: 'Head of Department',
    email: 'rhea@yourcollege.edu'
  },
  {
    loginId: 'EMP-1001',
    password: 'Faculty@2026',
    role: 'TEACHER',
    name: 'Dr. Meera Iyer',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    email: 'meera@yourcollege.edu'
  },
  {
    loginId: '1MJ24CS001',
    password: 'Student@2026',
    role: 'STUDENT',
    name: 'Aarav Sharma',
    department: 'Computer Science',
    email: 'aarav@yourcollege.edu',
    phone: '+91 98450 00000',
    semester: 4,
    section: 'A',
    mentor: 'Dr. Meera Iyer',
    attendance: { present: 41, total: 48 },
    marks: { IA1: 22, IA2: 21, SEE: 68 },
    subjects: [
      { code: 'CS401', name: 'Design & Analysis of Algorithms', credits: 4, faculty: 'Dr. Meera Iyer', attendance: 88 },
      { code: 'CS402', name: 'Database Management Systems', credits: 4, faculty: 'Prof. Anil Kumar', attendance: 74 }
    ],
    fees: [
      { id: 'F1', particulars: 'Semester 4 tuition', amount: 62000, due: '15 Sep 2026', status: 'PAID' },
      { id: 'F2', particulars: 'Laboratory & library', amount: 8500, due: '15 Oct 2026', status: 'DUE' }
    ]
  },
  {
    loginId: '1MJ24CS002',
    password: 'Student@2026',
    role: 'STUDENT',
    name: 'Diya Kamath',
    department: 'Computer Science',
    semester: 4,
    section: 'A',
    attendance: { present: 33, total: 48 },
    marks: { IA1: 17, IA2: 19, SEE: 0 },
    subjects: [
      { code: 'CS401', name: 'Design & Analysis of Algorithms', credits: 4, faculty: 'Dr. Meera Iyer', attendance: 69 }
    ],
    fees: [
      { id: 'F1', particulars: 'Semester 4 tuition', amount: 62000, due: '15 Sep 2026', status: 'DUE' }
    ]
  }
],

courses: [
  { code: 'CS401', name: 'Design & Analysis of Algorithms', credits: 4, faculty: 'Dr. Meera Iyer', semester: 4, section: 'A' },
  { code: 'CS402', name: 'Database Management Systems', credits: 4, faculty: 'Prof. Anil Kumar', semester: 4, section: 'A' }
],

timetable: [
  { day: 1, period: 1, code: 'CS401', name: 'Algorithms', room: 'CS-204', staff: 'Dr. Meera Iyer' },
  { day: 2, period: 3, code: 'CS402', name: 'DBMS', room: 'CS-108', staff: 'Prof. Anil Kumar' }
],

calendar: [
  { date: '2026-11-12', title: 'Mid-semester examinations begin', kind: 'EXAM' }
],

notices: [
  { id: 'n1', title: 'Examination timetable released', body: 'The Semester 4 timetable is on the notice board.', audience: 'CAMPUS-WIDE', author: 'Registrar Office', date: '28 Oct 2026' }
]
```

`day` is `1` = Monday … `6` = Saturday. `period` is `1`–`12`.
`kind` is `EVENT`, `EXAM`, `HOLIDAY` or `DEADLINE`.
`status` is `PAID`, `DUE` or `UPCOMING`.

---

## 3. Person field reference

| Field | Needed for | Notes |
| --- | --- | --- |
| `loginId` | all | Must be unique. This is what the person types to sign in. |
| `password` | all | Plain text in this static preview. Use demo passwords only. |
| `role` | all | Exactly `STUDENT`, `TEACHER`, `HOD` or `ADMIN`. Decides the screens. |
| `name` | all | Shown in the sidebar, topbar and lists. |
| `department` | all | Shown on profile and reports. |
| `designation` | staff | e.g. "Assistant Professor", "Registrar". |
| `email`, `phone` | all | Shown on the profile screen. |
| `semester`, `section` | students | Grouping shown on the profile and reports. |
| `mentor` | students | Optional line on the profile. |
| `attendance` | students | `{ present, total }` → the percentage badge and shortage alerts. |
| `marks` | students | `{ IA1, IA2, SEE }`. IA1/IA2 out of 25, SEE out of 100. |
| `subjects` | students | Array — one object per subject with `code`, `name`, `credits`, `faculty`, `attendance`. |
| `fees` | students | Array — `id`, `particulars`, `amount`, `due`, `status`. |

Faculty and HOD accounts need no academic fields; they work from the student list.

---

## 4. What each role can open

The sidebar is built from the role, so a screen that is not listed below does not exist for that account.

| Screen | Student | Faculty | HOD | Admin |
| --- | --- | --- | --- | --- |
| Overview | ✔ own day, subjects, dues | ✔ roster + pending marks | ✔ roster + pending marks | ✔ roster + fee totals |
| Attendance | view own subject-wise % | mark the whole class | mark the whole class | mark the whole class |
| Marks | view published marks only | enter IA1 + IA2 | enter IA1 + IA2, **approve & lock** | enter IA1, IA2 and **SEE** |
| Timetable | view | view | view | view |
| Notices | read | post | post | post |
| Fees | own ledger, pay | — | — | college-wide ledger |
| Courses | view | view | view | view + add course |
| Reports | — | — | ✔ department view | ✔ department view |
| Users | — | — | — | ✔ add accounts, see everyone |
| Profile | ✔ | ✔ | ✔ | ✔ |

Two rules worth remembering:

- **SEE marks** are only editable by `ADMIN`. Faculty and HODs see that column disabled, because the semester-end exam is entered by the office.
- **Approve & lock** only appears for `HOD`. It stays disabled until every student has IA1, IA2 and SEE, exactly like the real API.

---

## 5. How sign-in works

`portal.js` looks the entered login ID up in `people` and checks the password on that record. The `role` on that record becomes the session's role.

- There is **no role switcher anywhere** in the UI — a student session cannot reach faculty, HOD or admin screens.
- Signing in with a different person's credentials starts a different session with that person's permissions. That is normal: it is a different account, not an escalation.
- Delete every person and the sign-in screen tells you that no accounts are configured.

---

## 6. What is saved and what is not

Records you create inside the running portal — a new notice, a new account, a new course, a fee payment, a mark you type — live in the browser session only. They disappear on refresh.

To make anything permanent, put it in `data.js`. That is deliberate: `data.js` is the source of truth for this static portal.

---

## 7. Before you publish

This preview has no server, so:

- **Anyone can read `data.js`**, including passwords. Use fake ones (`Student@2026`), and never publish real student records or credentials.
- Passwords are compared as plain text in the browser. That is fine for a demo; it is not authentication.

The full stack in `server/` is where real authentication lives: bcrypt-hashed passwords, JWT cookies, `requireRole` on every route, HOD-department and teacher-ownership checks, and audit entries for sensitive writes. When you switch to real data, add your college through the API and the seeded database, not through `data.js`.

### Publishing with GitHub Pages

The static portal is just three files, so it can go straight on Pages:

1. Commit `index.html`, `data.js`, `portal.js` and `client/src/styles.css` (the stylesheet the page links to).
2. In the repository, go to **Settings → Pages** and set the source to your default branch, root folder.
3. Open the Pages URL — the portal loads with whatever is in `data.js`.

---

## 8. Quick checklist

- [ ] College name and academic year set in `institution`
- [ ] At least one `ADMIN` account so you can manage everything
- [ ] One `HOD` and one `TEACHER` if you want to show the approval flow
- [ ] Students added with `attendance`, `marks`, `subjects` and `fees`
- [ ] Courses, timetable and calendar filled in
- [ ] Passwords replaced with demo-only values
