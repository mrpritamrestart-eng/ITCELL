import mongoose, { Schema, models } from "mongoose";

const stockTransactionSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "StationeryItem", required: true, index: true },
    itemName: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    transactionType: {
      type: String,
      enum: ["OPENING_STOCK", "PURCHASE_IN", "BRANCH_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "RECONCILIATION_IN", "RECONCILIATION_OUT", "REVERSAL"],
      required: true,
      index: true,
    },
    quantityIn: { type: Number, default: 0, min: 0 },
    quantityOut: { type: Number, default: 0, min: 0 },
    transactionDate: { type: Date, required: true, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch" },
    branchName: { type: String, trim: true },
    referenceModel: {
      type: String,
      enum: ["OpeningStock", "PurchaseEntry", "OutEntry", "StockAdjustment", "StockReconciliation"],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId, index: true },
    remarks: { type: String, trim: true },
    isVoided: { type: Boolean, default: false, index: true },
    voidedAt: { type: Date, default: null },
    reversalOf: { type: Schema.Types.ObjectId, ref: "StockTransaction", default: null },
    createdBy: { type: String, trim: true, default: "admin" },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ item: 1, transactionDate: 1, createdAt: 1 });
stockTransactionSchema.index({ referenceModel: 1, referenceId: 1 });

const StockTransaction = models.StockTransaction || mongoose.model("StockTransaction", stockTransactionSchema);
export default StockTransaction;
