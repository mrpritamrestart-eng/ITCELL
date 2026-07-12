import mongoose, { Schema, models } from "mongoose";

const reconciliationItemSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "StationeryItem", required: true },
    itemName: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    actualQuantity: { type: Number, required: true, min: 0 },
    difference: { type: Number, required: true },
    remarks: { type: String, trim: true },
  },
  { _id: false }
);

const stockReconciliationSchema = new Schema(
  {
    batchNo: { type: String, required: true, unique: true, trim: true },
    reconciliationDate: { type: Date, required: true, index: true },
    reason: { type: String, required: true, trim: true },
    sourceFileName: { type: String, trim: true },
    totalRows: { type: Number, required: true, min: 1 },
    changedRows: { type: Number, required: true, min: 1 },
    unchangedRows: { type: Number, required: true, min: 0 },
    items: { type: [reconciliationItemSchema], required: true },
    createdBy: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

stockReconciliationSchema.index({ createdAt: -1 });

const StockReconciliation =
  models.StockReconciliation ||
  mongoose.model("StockReconciliation", stockReconciliationSchema);

export default StockReconciliation;
