import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/route-auth";
import { connectDB } from "@/lib/mongodb";
import { parseDateOnly, todayInIndia } from "@/lib/date-utils";
import { nonNegativeNumber, positiveNumber, roundMoney } from "@/lib/number-utils";
import { nextDocumentNumber } from "@/lib/sequence";
import { writeAuditLog } from "@/lib/audit";
import QuotationCalculation from "@/models/QuotationCalculation";
import VendorBill from "@/models/VendorBill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeanCalculation = {
  _id: mongoose.Types.ObjectId;
  invoiceNo: string;
  month: string;
  acceptedFirmIndex: number;
  firms: Array<{ firm: mongoose.Types.ObjectId; firmName: string; totalAmount: number }>;
  status?: string;
};

function text(value: unknown) { return String(value ?? "").trim(); }

export async function GET(request: Request) {
  const auth = await requireRouteAuth();
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const month = text(searchParams.get("month"));
    const status = text(searchParams.get("status"));
    const search = text(searchParams.get("search"));
    const filter: Record<string, unknown> = {};
    if (month) filter.month = month;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { billNo: { $regex: search, $options: "i" } },
      { quotationInvoiceNo: { $regex: search, $options: "i" } },
      { vendorInvoiceNo: { $regex: search, $options: "i" } },
      { acceptedFirmName: { $regex: search, $options: "i" } },
    ];
    const [bills, calculations, existingLinks] = await Promise.all([
      VendorBill.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
      QuotationCalculation.find({ status: { $ne: "VOID" } }).sort({ createdAt: -1 }).limit(500).lean() as unknown as Promise<LeanCalculation[]>,
      VendorBill.find({ status: { $ne: "VOID" } }).select("calculation").lean(),
    ]);
    const linked = new Set(existingLinks.map((entry) => String(entry.calculation)));
    const availableCalculations = calculations
      .filter((calculation) => !linked.has(String(calculation._id)))
      .map((calculation) => {
        const accepted = calculation.firms[calculation.acceptedFirmIndex];
        return {
          _id: String(calculation._id),
          invoiceNo: calculation.invoiceNo,
          month: calculation.month,
          acceptedFirmName: accepted?.firmName || "",
          approvedQuotationAmount: Number(accepted?.totalAmount || 0),
        };
      });
    return NextResponse.json({ success: true, bills, availableCalculations });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Final bills load nahi hue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRouteAuth();
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const id = text(body.id);
    const calculationId = text(body.calculationId);
    const vendorInvoiceNo = text(body.vendorInvoiceNo);
    const invoiceDateText = text(body.vendorInvoiceDate);
    const invoiceAmount = roundMoney(positiveNumber(body.invoiceAmount, "Invoice amount"));
    const deductions = roundMoney(nonNegativeNumber(body.deductions || 0, "Deductions"));
    const varianceReason = text(body.varianceReason);
    const remarks = text(body.remarks);
    if (id && !mongoose.isValidObjectId(id)) throw new Error("Invalid final bill");
    if (!mongoose.isValidObjectId(calculationId)) throw new Error("Accepted quotation select karein");
    if (!vendorInvoiceNo) throw new Error("Vendor invoice number required hai");
    if (!invoiceDateText) throw new Error("Vendor invoice date required hai");
    if (invoiceDateText > todayInIndia()) throw new Error("Future invoice date allowed nahi hai");
    if (deductions > invoiceAmount) throw new Error("Deductions invoice amount se zyada nahi ho sakti");

    const calculation = await QuotationCalculation.findOne({ _id: calculationId, status: { $ne: "VOID" } }).lean() as LeanCalculation | null;
    if (!calculation) throw new Error("Accepted quotation calculation nahi mili");
    const accepted = calculation.firms[calculation.acceptedFirmIndex];
    if (!accepted) throw new Error("Accepted firm calculation invalid hai");
    const approvedQuotationAmount = roundMoney(Number(accepted.totalAmount || 0));
    if (invoiceAmount > approvedQuotationAmount && varianceReason.length < 5) {
      throw new Error("Invoice accepted quotation se zyada hai; variance reason required hai");
    }

    const duplicateLink = await VendorBill.findOne({ calculation: calculationId, status: { $ne: "VOID" }, ...(id ? { _id: { $ne: id } } : {}) }).lean();
    if (duplicateLink) throw new Error("Is quotation ka active final bill already bana hua hai");
    const duplicateInvoice = await VendorBill.findOne({
      acceptedFirmName: accepted.firmName,
      vendorInvoiceNo: { $regex: `^${vendorInvoiceNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      status: { $ne: "VOID" },
      ...(id ? { _id: { $ne: id } } : {}),
    }).lean();
    if (duplicateInvoice) throw new Error("Is firm ka same vendor invoice number already saved hai");

    const existing = id ? await VendorBill.findById(id) : null;
    if (id && !existing) throw new Error("Final bill not found");
    if (existing && existing.status !== "DRAFT") throw new Error("Approved/Paid bill edit nahi ho sakta");

    const payload = {
      calculation: calculation._id,
      quotationInvoiceNo: calculation.invoiceNo,
      month: calculation.month,
      acceptedFirm: accepted.firm,
      acceptedFirmName: accepted.firmName,
      approvedQuotationAmount,
      vendorInvoiceNo,
      vendorInvoiceDate: parseDateOnly(invoiceDateText),
      invoiceAmount,
      deductions,
      netPayable: roundMoney(invoiceAmount - deductions),
      varianceReason,
      remarks,
      updatedBy: auth.session.username,
    };
    const bill = existing
      ? await VendorBill.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true })
      : await VendorBill.create({ ...payload, billNo: await nextDocumentNumber("BIL", new Date()), createdBy: auth.session.username });
    if (!bill) throw new Error("Final bill save nahi hua");
    await writeAuditLog({ action: existing ? "UPDATE" : "CREATE", entityType: "VendorBill", entityId: String(bill._id), performedBy: auth.session.username, summary: `${bill.billNo} final vendor bill ${existing ? "updated" : "created"}`, metadata: { invoiceAmount, deductions } });
    return NextResponse.json({ success: true, message: existing ? "Final bill updated" : "Final bill draft created", bill });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Final bill save nahi hua" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRouteAuth();
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    const id = text(body.id);
    const action = text(body.action).toLowerCase();
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid final bill");
    const bill = await VendorBill.findById(id);
    if (!bill) throw new Error("Final bill not found");
    if (bill.status === "VOID") throw new Error("Bill already cancelled hai");

    if (action === "approve") {
      if (bill.status !== "DRAFT") throw new Error("Only draft bill approve ho sakta hai");
      bill.status = "APPROVED"; bill.approvedAt = new Date(); bill.approvedBy = auth.session.username;
    } else if (action === "pay") {
      if (bill.status !== "APPROVED") throw new Error("Bill payment se pehle approve hona chahiye");
      const paymentDateText = text(body.paymentDate);
      const paymentReference = text(body.paymentReference);
      if (!paymentDateText || paymentDateText > todayInIndia()) throw new Error("Valid payment date required hai");
      if (paymentReference.length < 3) throw new Error("Payment reference required hai");
      bill.status = "PAID"; bill.paymentDate = parseDateOnly(paymentDateText); bill.paymentReference = paymentReference; bill.paidBy = auth.session.username;
    } else if (action === "void") {
      const reason = text(body.reason);
      if (reason.length < 5) throw new Error("Cancellation reason kam se kam 5 characters ka ho");
      bill.status = "VOID"; bill.voidedAt = new Date(); bill.voidedBy = auth.session.username; bill.voidReason = reason;
    } else {
      throw new Error("Unsupported action");
    }
    bill.updatedBy = auth.session.username;
    await bill.save();
    await writeAuditLog({ action: action.toUpperCase(), entityType: "VendorBill", entityId: id, performedBy: auth.session.username, summary: `${bill.billNo} ${action}`, metadata: { status: bill.status } });
    return NextResponse.json({ success: true, message: `Bill ${action} successful`, bill });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Bill update nahi hua" }, { status: 400 });
  }
}
