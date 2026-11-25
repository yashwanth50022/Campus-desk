import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth.js';
import { attendanceRouter } from './modules/attendance.js';
import { marksRouter } from './modules/marks.js';
import { timetableRouter } from './modules/timetable.js';
import { noticesRouter } from './modules/notices.js';
import { feesRouter } from './modules/fees.js';
import { adminRouter } from './modules/admin.js';
import { academicRouter } from './modules/academic.js';
import { reportsRouter } from './modules/reports.js';
import { errorHandler } from './middleware/errors.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use((req,res,next)=>{
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') && req.get('origin') !== clientOrigin) return res.status(403).json({error:{message:'Request origin is not allowed.'}});
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.get('/api/health', (_req,res)=>res.json({ok:true}));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/marks', marksRouter);
app.use('/api/v1/timetable', timetableRouter);
app.use('/api/v1/notices', noticesRouter);
app.use('/api/v1/fees', feesRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1', academicRouter);
app.use('/api/v1/reports', reportsRouter);

// Serve the built React client from the same process so a single URL opens the portal.
// Run `npm run build` first; in development use the Vite dev server instead.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // No client build yet: say so instead of returning a bare JSON 404 on the root URL.
  app.get('/', (_req, res) => res.type('html').send(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Campus Desk API</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f7f3;' +
    'font-family:"DM Sans",system-ui,sans-serif;color:#3c4f47;padding:24px}main{max-width:520px;background:#fff;border:1px solid #e2e8e1;' +
    'border-radius:16px;padding:28px}h1{font-size:22px;letter-spacing:-.6px;color:#0d211b;margin:0 0 10px}p{font-size:13px;line-height:1.6;margin:0 0 10px}' +
    'code{background:#f3f7f2;border:1px solid #e2e8e1;border-radius:6px;padding:2px 6px;font-size:12px}</style></head><body><main>' +
    '<h1>The API is running.</h1><p>The React portal is not built into this server yet. In development it runs separately at ' +
    '<a href="http://localhost:5173">http://localhost:5173</a>.</p><p>To serve everything from this port, run <code>npm run build</code> and restart the server.</p>' +
    '<p>Health check: <a href="/api/health">/api/health</a></p></main></body></html>'
  ));
}

app.use((_req,_res,next)=>{const error=new Error('Route not found.');error.status=404;next(error);});
app.use(errorHandler);
