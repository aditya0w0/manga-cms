import { getPrisma } from "@/lib/database/prisma";

export interface LogAuditInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: any;
  ipAddress?: string;
}

export class AuditService {
  /**
   * Records an immutable audit log entry.
   */
  static async log(input: LogAuditInput) {
    try {
      const db = await getPrisma();
      return await db.auditLog.create({
        data: {
          actorId: input.actorId,
          userId: input.actorId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          changes: input.changes ?? {},
          details: input.changes ?? {},
          ipAddress: input.ipAddress,
        },
      });
    } catch (err) {
      console.error("[AuditService] Failed to record audit log:", err);
      return null;
    }
  }

  /**
   * Retrieves audit logs with filtering.
   */
  static async getLogs(filter?: {
    actorId?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const db = await getPrisma();
    const where: any = {};
    if (filter?.actorId) where.actorId = filter.actorId;
    if (filter?.entityType) where.entityType = filter.entityType;
    if (filter?.entityId) where.entityId = filter.entityId;

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter?.limit ?? 50,
        skip: filter?.offset ?? 0,
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
