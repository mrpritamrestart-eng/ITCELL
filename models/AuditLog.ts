import mongoose, { Schema, models } from "mongoose";

const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String, trim: true },
    performedBy: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
const AuditLog = models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
