import mongoose, { Schema, models } from "mongoose";

const purchaseItemSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "StationeryItem", required: true },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseEntrySchema = new Schema(
  {
    purchaseNo: { type: String, trim: true },
    purchaseDate: { type: Date, required: true, index: true },
    firm: { type: Schema.Types.ObjectId, ref: "Firm", default: null },
    shopName: { type: String, required: true, trim: true },
    invoiceNumber: { type: String, trim: true },
    items: { type: [purchaseItemSchema], required: true },
    grandTotal: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "VOID"], default: "ACTIVE", index: true },
    createdBy: { type: String, required: true, trim: true, default: "admin" },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, trim: true },
    voidReason: { type: String, trim: true },
  },
  { timestamps: true }
);


purchaseEntrySchema.index({ purchaseNo: 1 }, { unique: true, partialFilterExpression: { purchaseNo: { $type: "string" } } });
purchaseEntrySchema.index({ purchaseDate: -1, createdAt: -1 });

const PurchaseEntry = models.PurchaseEntry || mongoose.model("PurchaseEntry", purchaseEntrySchema);
export default PurchaseEntry;
