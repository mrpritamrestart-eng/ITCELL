import AuditLog from "@/models/AuditLog";

export async function writeAuditLog(input: {
  action: string;
  entityType: string;
  entityId?: string;
  performedBy: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await AuditLog.create({ ...input, metadata: input.metadata || {} });
}
