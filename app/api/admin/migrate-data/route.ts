import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/api-auth";
import PurchaseEntry from "@/models/PurchaseEntry";
import OutEntry from "@/models/OutEntry";
import StockTransaction from "@/models/StockTransaction";
import StockBalance from "@/models/StockBalance";
import StockAdjustment from "@/models/StockAdjustment";
import AuditLog from "@/models/AuditLog";
import Counter from "@/models/Counter";
import Firm from "@/models/Firm";
import Branch from "@/models/Branch";
import StationeryItem from "@/models/StationeryItem";
import PermissionBatch from "@/models/PermissionBatch";
import QuotationCalculation from "@/models/QuotationCalculation";
import OfficeSetting from "@/models/OfficeSetting";
import VendorBill from "@/models/VendorBill";
import StockReconciliation from "@/models/StockReconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;
  try {
    await connectDB();
    const body = await request.json();
    if (body.confirm !== "MIGRATE") {
      return NextResponse.json({ success: false, message: "Confirmation text MIGRATE required hai" }, { status: 400 });
    }

    const purchases = await PurchaseEntry.find({ $or: [{ purchaseNo: { $exists: false } }, { purchaseNo: "" }] }).select("_id").lean();
    if (purchases.length) {
      await PurchaseEntry.bulkWrite(purchases.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { purchaseNo: `PUR-LEGACY-${String(row._id).slice(-8).toUpperCase()}`, status: "ACTIVE", createdBy: "legacy" } },
        },
      })));
    }
    await PurchaseEntry.updateMany({ status: { $exists: false } }, { $set: { status: "ACTIVE" } });
    await PurchaseEntry.updateMany({ createdBy: { $exists: false } }, { $set: { createdBy: "legacy" } });

    const outEntries = await OutEntry.find({ $or: [{ issueNo: { $exists: false } }, { issueNo: "" }] }).select("_id").lean();
    if (outEntries.length) {
      await OutEntry.bulkWrite(outEntries.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { issueNo: `OUT-LEGACY-${String(row._id).slice(-8).toUpperCase()}`, status: "ACTIVE", createdBy: "legacy" } },
        },
      })));
    }
    await OutEntry.updateMany({ status: { $exists: false } }, { $set: { status: "ACTIVE" } });
    await OutEntry.updateMany({ createdBy: { $exists: false } }, { $set: { createdBy: "legacy" } });
    await StockTransaction.updateMany({ isVoided: { $exists: false } }, { $set: { isVoided: false } });
    await StockTransaction.updateMany({ createdBy: { $exists: false } }, { $set: { createdBy: "legacy" } });

    const balances = await StockTransaction.aggregate<{
      _id: unknown;
      itemName: string;
      unit: string;
      totalIn: number;
      totalOut: number;
    }>([
      { $match: { isVoided: { $ne: true } } },
      { $sort: { transactionDate: 1, createdAt: 1 } },
      { $group: { _id: "$item", itemName: { $last: "$itemName" }, unit: { $last: "$unit" }, totalIn: { $sum: "$quantityIn" }, totalOut: { $sum: "$quantityOut" } } },
    ]);

    const negativeBalances = balances
      .map((row) => ({ ...row, balance: (row.totalIn || 0) - (row.totalOut || 0) }))
      .filter((row) => row.balance < 0);
    if (negativeBalances.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Migration roki gayi: legacy transactions me negative stock mila. Pehle listed items ki old entries verify/correct karein.",
          negativeBalances: negativeBalances.map((row) => ({ itemName: row.itemName, unit: row.unit, balance: row.balance })),
        },
        { status: 409 }
      );
    }

    await StockBalance.deleteMany({});
    if (balances.length) {
      await StockBalance.insertMany(balances.map((row) => ({
        item: row._id,
        itemName: row.itemName,
        unit: row.unit,
        quantity: (row.totalIn || 0) - (row.totalOut || 0),
      })));
    }

    await Promise.all([
      PurchaseEntry.createIndexes(),
      OutEntry.createIndexes(),
      StockTransaction.createIndexes(),
      StockBalance.createIndexes(),
      StockAdjustment.createIndexes(),
      AuditLog.createIndexes(),
      Counter.createIndexes(),
      Firm.createIndexes(),
      Branch.createIndexes(),
      StationeryItem.createIndexes(),
      PermissionBatch.createIndexes(),
      QuotationCalculation.createIndexes(),
      OfficeSetting.createIndexes(),
      VendorBill.createIndexes(),
      StockReconciliation.createIndexes(),
    ]);

    await AuditLog.create({
      action: "MIGRATE",
      entityType: "Database",
      performedBy: auth.session.username,
      summary: `Legacy data migrated; ${purchases.length} purchases, ${outEntries.length} out entries, ${balances.length} stock balances rebuilt`,
      metadata: {},
    });

    return NextResponse.json({
      success: true,
      message: "Data migration and stock balance rebuild completed successfully",
      result: { purchasesUpdated: purchases.length, outEntriesUpdated: outEntries.length, balancesRebuilt: balances.length },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Migration failed" }, { status: 500 });
  }
}
