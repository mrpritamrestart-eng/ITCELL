import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import { currentMonthInIndia, isDateInCurrentIndiaMonth, monthBoundsUtc, monthFromDateIndia, parseDateOnly, todayInIndia } from "@/lib/date-utils";
import { positiveNumber } from "@/lib/number-utils";
import { nextDocumentNumber } from "@/lib/sequence";
import { changeStockBalance, ensureStockBalances } from "@/lib/stock";
import { writeAuditLog } from "@/lib/audit";
import Branch from "@/models/Branch";
import StationeryItem from "@/models/StationeryItem";
import OutEntry from "@/models/OutEntry";
import StockTransaction from "@/models/StockTransaction";
import PermissionBatch from "@/models/PermissionBatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OutRequestItem = { itemId: string; quantity: number };
type LeanBranch = { _id: mongoose.Types.ObjectId; name: string; code: string };
type LeanItem = { _id: mongoose.Types.ObjectId; name: string; unit: string };
type LeanOutEntry = {
  _id: mongoose.Types.ObjectId;
  issueNo?: string;
  branch: mongoose.Types.ObjectId;
  issueDate: Date;
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
    const branchId = params.get("branchId");
    const month = params.get("month");
    const from = params.get("from");
    const to = params.get("to");
    const search = String(params.get("search") || "").trim();
    const filter: Record<string, unknown> = {};

    if (status !== "ALL") filter.status = status;
    if (branchId && mongoose.isValidObjectId(branchId)) filter.branch = new mongoose.Types.ObjectId(branchId);
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = parseDateOnly(from);
      if (to) {
        const exclusiveEnd = parseDateOnly(to);
        exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
        dateFilter.$lt = exclusiveEnd;
      }
      filter.issueDate = dateFilter;
    } else if (month) {
      const { start, end } = monthBoundsUtc(month);
      filter.issueDate = { $gte: start, $lt: end };
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { issueNo: { $regex: escaped, $options: "i" } },
        { branchName: { $regex: escaped, $options: "i" } },
        { receiverName: { $regex: escaped, $options: "i" } },
      ];
    }

    const [entries, total] = await Promise.all([
      OutEntry.find(filter).sort({ issueDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      OutEntry.countDocuments(filter),
    ]);
    return NextResponse.json({ success: true, entries, pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Out entry register load nahi ho paya" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;

  let session: mongoose.ClientSession | null = null;
  try {
    await connectDB();
    const body = await request.json();
    const branchId = String(body.branchId || "");
    const issueDateText = String(body.issueDate || "");
    const receiverName = String(body.receiverName || "").trim();
    const remarks = String(body.remarks || "").trim();
    const items = body.items as OutRequestItem[];

    if (!mongoose.isValidObjectId(branchId)) throw new Error("Valid PS/Branch required hai");
    if (!issueDateText) throw new Error("Out date required hai");
    if (issueDateText > todayInIndia()) throw new Error("Future out date allowed nahi hai");
    if (!isDateInCurrentIndiaMonth(issueDateText)) throw new Error(`Stationery Out Entry sirf present month (${currentMonthInIndia()}) me allowed hai`);
    if (!Array.isArray(items) || items.length === 0) throw new Error("Kam se kam ek item required hai");

    const branch = (await Branch.findOne({ _id: branchId, isActive: true }).lean()) as LeanBranch | null;
    if (!branch) throw new Error("Selected PS/Branch invalid ya inactive hai");

    const combined = new Map<string, number>();
    for (const row of items) {
      if (!mongoose.isValidObjectId(row.itemId)) throw new Error("Har row me valid stationery item select karein");
      const quantity = positiveNumber(row.quantity, "Quantity");
      combined.set(row.itemId, (combined.get(row.itemId) || 0) + quantity);
    }

    const itemIds = [...combined.keys()].map((id) => new mongoose.Types.ObjectId(id));
    const dbItems = (await StationeryItem.find({ _id: { $in: itemIds }, isActive: true }).lean()) as LeanItem[];
    if (dbItems.length !== itemIds.length) throw new Error("One or more stationery items invalid/inactive hain");
    const itemMap = new Map(dbItems.map((item) => [String(item._id), item]));
    const outItems = [...combined.entries()].map(([id, quantity]) => {
      const item = itemMap.get(id);
      if (!item) throw new Error("Invalid stationery item");
      return { item: item._id, itemName: item.name, quantity, unit: item.unit };
    });

    await ensureStockBalances(itemIds);
    session = await mongoose.startSession();
    session.startTransaction();

    for (const item of outItems) {
      const updated = await changeStockBalance({ itemId: item.item, itemName: item.itemName, unit: item.unit, delta: -item.quantity, session });
      if (!updated) throw new Error(`${item.itemName} ka available stock requested quantity se kam hai`);
    }

    const issueDate = parseDateOnly(issueDateText);
    const issueNo = await nextDocumentNumber("OUT", issueDate, session);
    const [outEntry] = await OutEntry.create([{
      issueNo,
      branch: branch._id,
      branchName: branch.name,
      branchCode: branch.code,
      issueDate,
      receiverName,
      items: outItems,
      totalQuantity: outItems.reduce((sum, item) => sum + item.quantity, 0),
      remarks,
      status: "ACTIVE",
      createdBy: auth.session.username,
    }], { session });

    await StockTransaction.insertMany(outItems.map((item) => ({
      item: item.item,
      itemName: item.itemName,
      unit: item.unit,
      transactionType: "BRANCH_OUT",
      quantityIn: 0,
      quantityOut: item.quantity,
      transactionDate: issueDate,
      branch: branch._id,
      branchName: branch.name,
      referenceModel: "OutEntry",
      referenceId: outEntry._id,
      remarks,
      createdBy: auth.session.username,
    })), { session });

    await session.commitTransaction();
    await writeAuditLog({ action: "CREATE", entityType: "OutEntry", entityId: String(outEntry._id), performedBy: auth.session.username, summary: `${issueNo} - ${branch.name}`, metadata: { receiverName, itemCount: outItems.length } });
    return NextResponse.json({ success: true, message: `Stationery out entry ${issueNo} saved successfully`, outEntry }, { status: 201 });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Stationery out entry save nahi ho payi" }, { status: 400 });
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
    if (body.action !== "void") throw new Error("Unsupported action");
    if (!mongoose.isValidObjectId(id)) throw new Error("Invalid out entry");
    if (reason.length < 5) throw new Error("Cancellation reason kam se kam 5 characters ka hona chahiye");

    const entry = (await OutEntry.findById(id).lean()) as LeanOutEntry | null;
    if (!entry) throw new Error("Out entry not found");
    if (entry.status === "VOID") throw new Error("Out entry already cancelled hai");

    const month = monthFromDateIndia(entry.issueDate);
    const lockedPermission = await PermissionBatch.findOne({
      month,
      finalizedAt: { $ne: null },
      documents: { $elemMatch: { branch: entry.branch, sourceType: "OUT_RECORD" } },
    }).lean();
    if (lockedPermission) throw new Error("Is month ki permission finalized hai. Permission unlock/correct karne ke baad entry cancel karein.");

    const itemIds = entry.items.map((item) => new mongoose.Types.ObjectId(String(item.item)));
    await ensureStockBalances(itemIds);
    session = await mongoose.startSession();
    session.startTransaction();

    for (const item of entry.items) {
      await changeStockBalance({
        itemId: new mongoose.Types.ObjectId(String(item.item)),
        itemName: item.itemName,
        unit: item.unit,
        delta: Number(item.quantity),
        session,
      });
    }

    await OutEntry.updateOne({ _id: id, status: { $ne: "VOID" } }, {
      $set: { status: "VOID", voidedAt: new Date(), voidedBy: auth.session.username, voidReason: reason },
    }, { session });
    await StockTransaction.updateMany({ referenceModel: "OutEntry", referenceId: entry._id }, {
      $set: { isVoided: true, voidedAt: new Date() },
    }, { session });
    await session.commitTransaction();

    await writeAuditLog({ action: "VOID", entityType: "OutEntry", entityId: id, performedBy: auth.session.username, summary: `${entry.issueNo || id} cancelled`, metadata: { reason } });
    return NextResponse.json({ success: true, message: "Out entry cancelled and stock restored successfully" });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Out entry cancel nahi ho payi" }, { status: 400 });
  } finally {
    await session?.endSession();
  }
}
