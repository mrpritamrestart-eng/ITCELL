import mongoose, { Schema, models } from "mongoose";

const vendorBillSchema = new Schema(
  {
    billNo: { type: String, trim: true, index: true },
    calculation: { type: Schema.Types.ObjectId, ref: "QuotationCalculation", required: true, index: true },
    quotationInvoiceNo: { type: String, required: true, trim: true },
    month: { type: String, required: true, trim: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, index: true },
    acceptedFirm: { type: Schema.Types.ObjectId, ref: "Firm", required: true },
    acceptedFirmName: { type: String, required: true, trim: true },
    approvedQuotationAmount: { type: Number, required: true, min: 0 },
    vendorInvoiceNo: { type: String, required: true, trim: true },
    vendorInvoiceDate: { type: Date, required: true },
    invoiceAmount: { type: Number, required: true, min: 0 },
    deductions: { type: Number, required: true, min: 0, default: 0 },
    netPayable: { type: Number, required: true, min: 0 },
    varianceReason: { type: String, trim: true, default: "" },
    remarks: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["DRAFT", "APPROVED", "PAID", "VOID"], default: "DRAFT", index: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, trim: true, default: "" },
    paymentDate: { type: Date, default: null },
    paymentReference: { type: String, trim: true, default: "" },
    paidBy: { type: String, trim: true, default: "" },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: String, trim: true, default: "" },
    voidReason: { type: String, trim: true, default: "" },
    createdBy: { type: String, trim: true, default: "admin" },
    updatedBy: { type: String, trim: true, default: "admin" },
  },
  { timestamps: true }
);

vendorBillSchema.index({ month: 1, createdAt: -1 });
vendorBillSchema.index({ acceptedFirmName: 1, vendorInvoiceNo: 1 });

const VendorBill = models.VendorBill || mongoose.model("VendorBill", vendorBillSchema);
export default VendorBill;
