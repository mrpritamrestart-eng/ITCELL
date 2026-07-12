import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { parseDateOnly, todayInIndia } from "@/lib/date-utils";
import { nonNegativeNumber, positiveNumber, roundMoney } from "@/lib/number-utils";
import { nextDocumentNumber } from "@/lib/sequence";
import { changeStockBalance, ensureStockBalances } from "@/lib/stock";
import { writeAuditLog } from "@/lib/audit";
import PurchaseEntry from "@/models/PurchaseEntry";
import StationeryItem from "@/models/StationeryItem";
import StockTransaction from "@/models/StockTransaction";
import Firm from "@/models/Firm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PurchaseRequestItem = { itemId: string; quantity: number; rate: number };

type LeanItem = {
  _id: mongoose.Types.ObjectId;
  name: string;
  unit: string;
};
type LeanPurchaseEntry = {
  _id: mongoose.Types.ObjectId;
  purchaseNo?: string;
  status?: string;
  items: Array<{ item: mongoose.Types.ObjectId; itemName: string; quantity: number; unit: string }>;
};

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;

  try {
    await connectDB();
    const params = request.nextUrl.searchParams;
    const page = Math.max(Number(params.get("page")) || 1, 1);
    const limit = Math.min(Math.max(Number(params.get("limit")) || 25, 1), 100);
    const status = params.get("status") || "ALL";
    const search = String(params.get("search") || "").trim();
    const from = params.get("from");
    const to = params.get("to");

    const filter: Record<string, unknown> = {};
    if (status !== "ALL") filter.status = status;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = parseDateOnly(from);
      if (to) {
        const end = parseDateOnly(to);
        end.setUTCDate(end.getUTCDate() + 1);
        dateFilter.$lt = end;
      }
      filter.purchaseDate = dateFilter;
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { purchaseNo: { $regex: escaped, $options: "i" } },
        { shopName: { $regex: escaped, $options: "i" } },
        { invoiceNumber: { $regex: escaped, $options: "i" } },
      ];
    }

    const [entries, total] = await Promise.all([
      PurchaseEntry.find(filter)
        .sort({ purchaseDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PurchaseEntry.countDocuments(filter),
    ]);

    return NextResponse.json({ success: true, entries, pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Purchase register load nahi ho paya" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;

  let session: mongoose.ClientSession | null = null;
  try {
    await connectDB();
    const body = await request.json();
    const purchaseDateText = String(body.purchaseDate || "");
    const shopNameInput = String(body.shopName || "").trim();
    const firmId = String(body.firmId || "").trim();
    const invoiceNumber = String(body.invoiceNumber || "").trim();
    const remarks = String(body.remarks || "").trim();
    const items = body.items as PurchaseRequestItem[];

    if (!purchaseDateText) throw new Error("Purchase date is required");
    if (purchaseDateText > todayInIndia()) throw new Error("Future purchase date allowed nahi hai");
    if (!Array.isArray(items) || items.length === 0) throw new Error("At least one purchase item is required");

    const uniqueIds = new Set<string>();
    for (const row of items) {
      if (!mongoose.isValidObjectId(row.itemId)) throw new Error("Invalid stationery item selected");
      if (uniqueIds.has(row.itemId)) throw new Error("Same stationery item ko duplicate rows me add na karein");
      uniqueIds.add(row.itemId);
      positiveNumber(row.quantity, "Quantity");
      nonNegativeNumber(row.rate, "Rate");
    }

    let shopName = shopNameInput;
    let firm: mongoose.Types.ObjectId | null = null;
    if (firmId) {
      if (!mongoose.isValidObjectId(firmId)) throw new Error("Invalid firm selected");
      const firmDoc = await Firm.findOne({ _id: firmId, isActive: true }).lean();
      if (!firmDoc) throw new Error("Selected firm is not active");
      shopName = firmDoc.name;
      firm = new mongoose.Types.ObjectId(firmId);
    }
    if (!shopName) throw new Error("Shop/Firm name is required");

    if (invoiceNumber) {
      const duplicate = await PurchaseEntry.findOne({ shopName, invoiceNumber, status: { $ne: "VOID" } }).lean();
      if (duplicate) return NextResponse.json({ success: false, message: "Is firm ka ye invoice number already saved hai" }, { status: 409 });
    }

    const dbItems = (await StationeryItem.find({ _id: { $in: [...uniqueIds] }, isActive: true }).lean()) as LeanItem[];
    if (dbItems.length !== uniqueIds.size) throw new Error("One or more stationery items are invalid/inactive");
    const itemMap = new Map(dbItems.map((item) => [String(item._id), item]));

    const purchaseItems = items.map((row) => {
      const dbItem = itemMap.get(row.itemId);
      if (!dbItem) throw new Error("Stationery item not found");
      const quantity = positiveNumber(row.quantity, "Quantity");
      const rate = nonNegativeNumber(row.rate, "Rate");
      return { item: dbItem._id, itemName: dbItem.name, quantity, unit: dbItem.unit, rate, total: roundMoney(quantity * rate) };
    });
    const grandTotal = roundMoney(purchaseItems.reduce((sum, row) => sum + row.total, 0));
    const purchaseDate = parseDateOnly(purchaseDateText);

    await ensureStockBalances(dbItems.map((item) => item._id));
    session = await mongoose.startSession();
    session.startTransaction();
    const purchaseNo = await nextDocumentNumber("PUR", purchaseDate, session);

    const [purchaseEntry] = await PurchaseEntry.create([{
      purchaseNo,
      purchaseDate,
      firm,
      shopName,
      invoiceNumber,
      items: purchaseItems,
      grandTotal,
      remarks,
      status: "ACTIVE",
      createdBy: auth.session.username,
    }], { session });

    for (const item of purchaseItems) {
      await changeStockBalance({ itemId: item.item, itemName: item.itemName, unit: item.unit, delta: item.quantity, session });
    }

    await StockTransaction.insertMany(purchaseItems.map((item) => ({
      item: item.item,
      itemName: item.itemName,
      unit: item.unit,
      transactionType: "PURCHASE_IN",
      quantityIn: item.quantity,
      quantityOut: 0,
      transactionDate: purchaseDate,
      referenceModel: "PurchaseEntry",
      referenceId: purchaseEntry._id,
      remarks,
      createdBy: auth.session.username,
    })), { session });

    await session.commitTransaction();
    await writeAuditLog({ action: "CREATE", entityType: "PurchaseEntry", entityId: String(purchaseEntry._id), performedBy: auth.session.username, summary: `${purchaseNo} - ${shopName} - ₹${grandTotal}`, metadata: { invoiceNumber, itemCount: purchaseItems.length } });
    return NextResponse.json({ success: true, message: `Purchase entry ${purchaseNo} saved successfully`, purchaseEntry }, { status: 201 });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    const message = error instanceof Error ? error.message : "Failed to save purchase entry";
    return NextResponse.json({ success: false, message }, { status: message.includes("duplicate key") ? 409 : 400 });
  } finally {
    await session?.endSession();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;

  let session: mongoose.ClientSession | null = null;
  try {
    await connectDB();
    const body = await request.json();
    const id = String(body.id || "");
    const reason = String(body.reason || "").trim();
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid purchase entry");
    if (body.action !== "void") throw new Error("Unsupported action");
    if (reason.length < 5) throw new Error("Cancellation reason kam se kam 5 characters ka hona chahiye");

    const entry = (await PurchaseEntry.findById(id).lean()) as LeanPurchaseEntry | null;
    if (!entry) throw new Error("Purchase entry not found");
    if (entry.status === "VOID") throw new Error("Purchase entry already cancelled hai");
    const itemIds = entry.items.map((item) => new mongoose.Types.ObjectId(String(item.item)));
    await ensureStockBalances(itemIds);

    session = await mongoose.startSession();
    session.startTransaction();
    for (const item of entry.items) {
      const updated = await changeStockBalance({
        itemId: new mongoose.Types.ObjectId(String(item.item)),
        itemName: item.itemName,
        unit: item.unit,
        delta: -Number(item.quantity),
        session,
      });
      if (!updated) throw new Error(`${item.itemName} ka current stock purchase reversal ke liye sufficient nahi hai`);
    }

    await PurchaseEntry.updateOne({ _id: id, status: { $ne: "VOID" } }, {
      $set: { status: "VOID", voidedAt: new Date(), voidedBy: auth.session.username, voidReason: reason },
    }, { session });
    await StockTransaction.updateMany({ referenceModel: "PurchaseEntry", referenceId: entry._id }, {
      $set: { isVoided: true, voidedAt: new Date() },
    }, { session });
    await session.commitTransaction();

    await writeAuditLog({ action: "VOID", entityType: "PurchaseEntry", entityId: id, performedBy: auth.session.username, summary: `${entry.purchaseNo || id} cancelled`, metadata: { reason } });
    return NextResponse.json({ success: true, message: "Purchase entry cancelled and stock reversed successfully" });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Purchase entry cancel nahi ho payi" }, { status: 400 });
  } finally {
    await session?.endSession();
  }
}
