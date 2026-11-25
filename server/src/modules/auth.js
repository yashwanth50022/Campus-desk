import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { authenticate, getActor } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { audit } from '../lib/audit.js';

export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { message: 'Too many authentication requests. Try again later.' } } });
const signInSchema = z.object({ loginId: z.string().trim().min(2).max(40), password: z.string().min(1).max(128) });
const cookieOptions = (maxAge) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge });
function issueCookies(res, user) {
  const claims = { sub: user.id, role: user.role };
  const access = jwt.sign(claims, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m', issuer: 'college-erp' });
  const refresh = jwt.sign(claims, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d', issuer: 'college-erp' });
  res.cookie('accessToken', access, cookieOptions(15 * 60 * 1000));
  res.cookie('refreshToken', refresh, cookieOptions(7 * 24 * 60 * 60 * 1000));
  return bcrypt.hash(refresh, 12).then((refreshTokenHash) => prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash } }));
}
function safeUser(user) {
  return { id: user.id, loginId: user.loginId, role: user.role, email: user.email, forcePasswordChange: user.forcePasswordChange,
    profile: user.student ?? user.staff ?? null };
}

authRouter.post('/login', authLimiter, validateBody(signInSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { loginId: req.body.loginId }, include: { student: { include: { department: true } }, staff: true } });
  const generic = new ApiError(401, 'Login ID or password is incorrect.');
  if (!user || !user.isActive || (user.lockedUntil && user.lockedUntil > new Date())) throw generic;
  const matches = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!matches) {
    const failedLoginCount = user.failedLoginCount + 1;
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount, ...(failedLoginCount >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}) } });
    throw generic;
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await issueCookies(res, user);
  res.json({ user: safeUser(user) });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  try {
    const claims = jwt.verify(req.cookies?.refreshToken ?? '', process.env.JWT_REFRESH_SECRET, { issuer: 'college-erp' });
    const user = await prisma.user.findUnique({ where: { id: claims.sub }, include: { student: { include: { department: true } }, staff: true } });
    if (!user?.isActive || !user.refreshTokenHash || !(await bcrypt.compare(req.cookies.refreshToken, user.refreshTokenHash))) throw new Error('Invalid refresh token');
    await issueCookies(res, user);
    res.json({ user: safeUser(user) });
  } catch { throw new ApiError(401, 'Session expired. Please sign in again.'); }
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  try {
    const claims = jwt.verify(req.cookies?.refreshToken ?? '', process.env.JWT_REFRESH_SECRET);
    await prisma.user.updateMany({ where: { id: claims.sub }, data: { refreshTokenHash: null } });
  } catch { /* Idempotent logout also clears invalid cookies. */ }
  res.clearCookie('accessToken', cookieOptions(0));
  res.clearCookie('refreshToken', cookieOptions(0));
  res.json({ ok: true });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await getActor(req);
  const profile = user.student ?? user.staff ?? null;
  res.json({ user: { ...safeUser(user), profile: profile ? { ...profile, departmentName: profile.department?.name ?? null } } });
}));

authRouter.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({ phone: z.string().trim().max(30).optional(), address: z.string().trim().max(240).optional(), email: z.string().email().max(254).optional() }).strict();
  const changes = schema.parse(req.body);
  const user = await getActor(req);
  if (user.student) await prisma.student.update({ where: { id: user.student.id }, data: { phone: changes.phone, address: changes.address } });
  else if (user.staff) await prisma.staff.update({ where: { id: user.staff.id }, data: { phone: changes.phone } });
  if (changes.email) await prisma.user.update({ where: { id: user.id }, data: { email: changes.email } });
  if (!user.student && !user.staff && !changes.email) throw new ApiError(400, 'Enter an email address to update your profile.');
  res.json({ ok: true });
}));

authRouter.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/) }).parse(req.body);
  const user = await getActor(req);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new ApiError(400, 'Current password is incorrect.');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { passwordHash, forcePasswordChange: false, refreshTokenHash: null } });
  await issueCookies(res, updatedUser);
  await audit({ userId: user.id, action: 'PASSWORD_CHANGED', tableName: 'users', recordId: user.id });
  res.json({ ok: true });
}));

authRouter.post('/password-reset/request', authLimiter, validateBody(z.object({ loginId: z.string().trim().min(2).max(40) })), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { loginId: req.body.loginId } });
  // Same response for existing and missing IDs avoids account enumeration.
  if (user?.email && user.isActive) {
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.passwordResetOtp.create({ data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
      await transporter.sendMail({ from: process.env.SMTP_FROM, to: user.email, subject: 'College ERP password reset code', text: `Your verification code is ${code}. It expires in 10 minutes.` });
    } else if (process.env.NODE_ENV !== 'production') console.info(`Development password reset code for ${user.loginId}: ${code}`);
    else throw new ApiError(503, 'Password reset email is not configured.');
  }
  res.json({ message: 'If the account has a registered email, a reset code will be sent.' });
}));

authRouter.post('/password-reset/confirm', authLimiter, validateBody(z.object({ loginId: z.string().trim().min(2).max(40), code: z.string().regex(/^\d{6}$/), newPassword: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/) })), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { loginId: req.body.loginId } });
  if (!user) throw new ApiError(400, 'The code is invalid or expired.');
  const otp = await prisma.passwordResetOtp.findFirst({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, orderBy: { expiresAt: 'desc' } });
  if (!otp || !(await bcrypt.compare(req.body.code, otp.codeHash))) {
    if (otp) await prisma.passwordResetOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, 'The code is invalid or expired.');
  }
  const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await prisma.$transaction([
    prisma.passwordResetOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash, forcePasswordChange: false, refreshTokenHash: null, failedLoginCount: 0, lockedUntil: null } }),
  ]);
  await audit({ userId: user.id, action: 'PASSWORD_RESET', tableName: 'users', recordId: user.id });
  res.json({ ok: true });
}));
