# Campus Desk — College ERP Portal

A modular, responsive college ERP starter built to the supplied v1 plan: React/Vite client, Express REST API, PostgreSQL with Prisma, and server-side role/ownership checks.

## Included v1 areas

- One admin-provisioned sign-in for student, teacher, HOD, and admin accounts
- Student profiles, own attendance, semester marks/results, enrollment, timetable, notices, and fee balance/receipt records
- Faculty class lists, one-request whole-class attendance marking, internal marks entry, timetables, class reports, and scoped notices
- HOD department-scoped reports, marks approval/locking, and notices
- Admin user provisioning/deactivation, departments, courses, sections, class offerings, fee tracking, academic events/timetable management, academic settings, audit viewer, and CSV attendance export
- Student semester marksheets and payment receipts generated as PDFs
- Responsive portal layout and demo seed with two departments, twenty students, five faculty, five courses, and sample academic activity

Online payments, mobile apps, exams/proctoring, payroll, transport, hostel, placement, and live SMS are intentionally out of v1 scope. Email OTP delivery requires SMTP configuration.

## Local setup

Requirements: Node.js 20+, npm, and a running PostgreSQL database.

1. Copy `server/.env.example` to `server/.env`; set `DATABASE_URL` and distinct random `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` values of at least 32 characters. Set `DEMO_PASSWORD` to a strong password of at least 12 characters. The server exits if the signing secrets are missing or weak.
2. Install packages: `npm install`.
3. Generate Prisma client and migrate: `npm run db:generate && npm run db:migrate`.
4. Create demo records: `npm run db:seed`.
5. Start both apps: `npm run dev` (client at http://localhost:5173; API at http://localhost:4000).
6. Sign in with `ADMIN001`, `FAC001`–`FAC005`, or one of the generated student USNs printed in the seed log (for example `1MJ24CS001`); all demo accounts use `DEMO_PASSWORD`.

### USN convention

Student USNs follow `CAMPUS + BATCH + BRANCH + ROLL`, for example `1MJ24CS209`: campus prefix `1MJ`, batch `24` (2024 admission), branch `CS`, roll number `209`. The branch segment must match the student's department (seeded branches: `CS` for CSE, `EC` for ECE); derive batch and department from the USN only in this format.

The seed does not run in production. It uses a configured password and hashes it with bcrypt; no real credentials are committed. Every new and demo account must change its temporary password at first sign-in. The API blocks other portal routes until that change is complete. Password reset uses a six-digit, short-lived email OTP with bounded attempts; configure SMTP to deliver it.

### Opening the portal

There are two ways to run this project.

**1. The static portal — no install, no database**

Open `index.html` at the repository root in a browser, or serve the folder with any static file server (GitHub Pages included). It is a self-contained portal that runs entirely in the browser and reads every record from `data.js`: your college details, people, courses, timetable, calendar and notices. Each person's `role` decides which screens that login can open. See `GUIDE.md` for the field list, a copy-paste example and the full permission table.

This is the version to publish as a demo or portfolio piece. Its passwords are visible to anyone who opens the page — that is fine for a demo, never for real student data.

**2. The full stack — React + Express + PostgreSQL**

Use `npm run dev` and open http://localhost:5173. Use this for real data: authentication, roles, ownership checks and audit logging are enforced by the API, not by the browser. For a single-port run, `npm run build` then `npm start`, and open http://localhost:4000. The API only serves the client after `client/dist` exists.

## Security model

Passwords are bcrypt-hashed (cost 12), not encrypted or stored in plaintext. Access/refresh JWTs are HttpOnly, SameSite=Strict cookies; production cookies are Secure. Access tokens expire after 15 minutes and refresh tokens are rotated and persisted as bcrypt hashes. Authentication requests are rate-limited; repeated failed logins temporarily lock the account. Zod schemas validate write payloads, route roles are enforced on the API, and teacher/HOD/student ownership is checked against their assigned class/department/enrollment. Sensitive writes create audit entries. Helmet and credentialed, origin-restricted CORS are enabled.

Run the API behind HTTPS in production, use unique high-entropy environment secrets, protect/back up PostgreSQL, configure an SMTP provider for password-reset emails, and replace demo fixtures before real college use. This starter is not a substitute for a deployment security review, college-rule confirmation, or production operations runbook. A role marker in the UI is never the security boundary; the API is.

## API outline

REST routes live below `/api/v1`: `/auth`, `/attendance`, `/marks`, `/timetable`, `/notices`, `/fees`, `/admin`, `/enrolment`, and `/reports`. Student views use `/me` endpoints wherever available. Health check: `/api/health`.
