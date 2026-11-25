import { prisma } from '../db.js';

export async function audit({ userId, action, tableName, recordId, oldValue, newValue }) {
  await prisma.auditLog.create({ data: {
    userId: userId ?? null,
    action,
    tableName,
    recordId: recordId ?? null,
    oldValue: oldValue ?? undefined,
    newValue: newValue ?? undefined,
  } });
}
