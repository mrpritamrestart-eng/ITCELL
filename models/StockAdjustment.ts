import mongoose, { Schema, models } from "mongoose";

const stockAdjustmentSchema = new Schema(
  {
    adjustmentNo: { type: String, required: true, unique: true, trim: true },
    adjustmentDate: { type: Date, required: true },
    item: { type: Schema.Types.ObjectId, ref: "StationeryItem", required: true },
    itemName: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    adjustmentType: { type: String, enum: ["INCREASE", "DECREASE"], required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "VOID"], default: "ACTIVE", index: true },
    createdBy: { type: String, required: true, trim: true },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, trim: true },
    voidReason: { type: String, trim: true },
  },
  { timestamps: true }
);

stockAdjustmentSchema.index({ adjustmentDate: -1, createdAt: -1 });
const StockAdjustment = models.StockAdjustment || mongoose.model("StockAdjustment", stockAdjustmentSchema);
export default StockAdjustment;
