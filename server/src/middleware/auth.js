import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { ApiError } from './errors.js';

const roles = ['STUDENT', 'TEACHER', 'HOD', 'ADMIN'];

export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.accessToken;
    if (!token) throw new ApiError(401, 'Sign in required.');
    const claims = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (!roles.includes(claims.role)) throw new ApiError(401, 'Invalid session.');
    const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { role: true, isActive: true, forcePasswordChange: true } });
    if (!user?.isActive || user.role !== claims.role) throw new ApiError(401, 'Account is unavailable. Please sign in again.');
    req.auth = { ...claims, forcePasswordChange: user.forcePasswordChange };
    if (user.forcePasswordChange && !['/me', '/change-password', '/logout'].includes(req.path)) throw new ApiError(403, 'Change your temporary password before using the portal.');
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, 'Session expired. Please sign in again.'));
  }
}

export function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.auth || !allowed.includes(req.auth.role)) return next(new ApiError(403, 'You do not have access to this action.'));
    next();
  };
}

export async function getActor(req) {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
    include: { student: { include: { department: true } }, staff: { include: { department: true } } },
  });
  if (!user?.isActive) throw new ApiError(401, 'Account is unavailable.');
  return user;
}

export async function assertOfferingAccess(user, offeringId) {
  const offering = await prisma.courseOffering.findUnique({
    where: { id: offeringId },
    include: { section: true, course: true },
  });
  if (!offering) throw new ApiError(404, 'Class not found.');
  if (user.role === 'TEACHER' && offering.staffId !== user.staff?.id) throw new ApiError(403, 'This class is not assigned to you.');
  if (user.role === 'HOD' && offering.course.departmentId !== user.staff?.departmentId) throw new ApiError(403, 'This class is outside your department.');
  if (user.role === 'STUDENT' && (offering.sectionId !== user.student?.sectionId || offering.section.semester !== user.student?.semester)) throw new ApiError(403, 'This class is not part of your enrollment.');
  return offering;
}
