import mongoose, { Schema, models } from "mongoose";

const outItemSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "StationeryItem", required: true },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const outEntrySchema = new Schema(
  {
    issueNo: { type: String, trim: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    branchName: { type: String, required: true, trim: true },
    branchCode: { type: String, trim: true },
    issueDate: { type: Date, required: true, index: true },
    receiverName: { type: String, trim: true },
    items: { type: [outItemSchema], required: true },
    totalQuantity: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "VOID"], default: "ACTIVE", index: true },
    createdBy: { type: String, required: true, trim: true, default: "admin" },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, trim: true },
    voidReason: { type: String, trim: true },
  },
  { timestamps: true }
);

outEntrySchema.index({ issueNo: 1 }, { unique: true, partialFilterExpression: { issueNo: { $type: "string" } } });
outEntrySchema.index({ issueDate: -1, createdAt: -1 });
outEntrySchema.index({ branch: 1, issueDate: -1 });

const OutEntry = models.OutEntry || mongoose.model("OutEntry", outEntrySchema);
export default OutEntry;
