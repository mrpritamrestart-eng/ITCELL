import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { writeAuditLog } from "@/lib/audit";
import { csvEscape, normaliseCsvHeader, parseCsv } from "@/lib/csv";
import { parseDateOnly, todayInIndia } from "@/lib/date-utils";
import { connectDB } from "@/lib/mongodb";
import { nextDocumentNumber } from "@/lib/sequence";
import { ensureStockBalances } from "@/lib/stock";
import StationeryItem from "@/models/StationeryItem";
import StockBalance from "@/models/StockBalance";
import StockReconciliation from "@/models/StockReconciliation";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_HEADERS = [
  "item_id",
  "item_name",
  "unit",
  "current_system_quantity",
  "actual_stock_quantity",
  "remarks",
] as const;

function cleanFileName(value: unknown) {
  return String(value || "stock-reconciliation.csv")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "-")
    .slice(0, 150);
}

function readQuantity(value: string, rowNumber: number, columnName: string) {
  const cleaned = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(cleaned)) {
    throw new Error(`CSV row ${rowNumber}: ${columnName} me valid non-negative quantity required hai (maximum 4 decimal places)`);
  }
  const quantity = Number(cleaned);
  if (!Number.isFinite(quantity) || quantity > 1_000_000_000) {
    throw new Error(`CSV row ${rowNumber}: ${columnName} quantity allowed range se bahar hai`);
  }
  return quantity;
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.000001;
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response) return auth.response;

  try {
    await connectDB();

    if (request.nextUrl.searchParams.get("download") === "sample") {
      const items = await StationeryItem.find({ isActive: true })
        .sort({ name: 1 })
        .select("name unit")
        .lean();
      await ensureStockBalances(items.map((item) => item._id));
      const balances = await StockBalance.find({
        item: { $in: items.map((item) => item._id) },
      })
        .select("item quantity")
        .lean();
      const balanceMap = new Map(
        balances.map((balance) => [String(balance.item), Number(balance.quantity) || 0])
      );

      const lines = [REQUIRED_HEADERS.map(csvEscape).join(",")];
      for (const item of items) {
        const quantity = balanceMap.get(String(item._id)) || 0;
        lines.push(
          [
            String(item._id),
            item.name,
            item.unit,
            quantity,
            quantity,
            "",
          ]
            .map(csvEscape)
            .join(",")
        );
      }

      const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
      const today = todayInIndia();
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="actual-stock-sample-${today}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const batches = await StockReconciliation.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .select(
        "batchNo reconciliationDate reason sourceFileName totalRows changedRows unchangedRows createdBy createdAt"
      )
      .lean();

    return NextResponse.json({ success: true, batches });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Stock reconciliation data load nahi ho paya",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (auth.response || !auth.session) return auth.response;

  let session: mongoose.ClientSession | null = null;
  try {
    await connectDB();
    const body = (await request.json()) as {
      csvText?: unknown;
      reconciliationDate?: unknown;
      reason?: unknown;
      fileName?: unknown;
    };

    const csvText = String(body.csvText || "");
    const dateText = String(body.reconciliationDate || "");
    const reason = String(body.reason || "").trim();
    const sourceFileName = cleanFileName(body.fileName);

    if (!csvText.trim()) throw new Error("CSV file empty hai");
    if (csvText.length > 2_000_000) throw new Error("CSV file allowed size se badi hai");
    if (reason.length < 5) {
      throw new Error("Reconciliation reason kam se kam 5 characters ka hona chahiye");
    }
    if (dateText > todayInIndia()) {
      throw new Error("Future date par stock reconciliation save nahi ki ja sakti");
    }
    const reconciliationDate = parseDateOnly(dateText);

    const csvRows = parseCsv(csvText);
    if (csvRows.length < 2) throw new Error("CSV me item rows nahi hain");

    const headerMap = new Map<string, number>();
    csvRows[0].forEach((header, index) => {
      const normalised = normaliseCsvHeader(header);
      if (normalised) headerMap.set(normalised, index);
    });
    for (const header of REQUIRED_HEADERS) {
      if (!headerMap.has(header)) {
        throw new Error(`CSV header '${header}' missing hai. Fresh sample CSV download karke use karein.`);
      }
    }

    const items = await StationeryItem.find({ isActive: true })
      .sort({ name: 1 })
      .select("name unit")
      .lean();
    if (!items.length) throw new Error("Active stationery items available nahi hain");
    await ensureStockBalances(items.map((item) => item._id));

    const itemMap = new Map(items.map((item) => [String(item._id), item]));
    const balances = await StockBalance.find({
      item: { $in: items.map((item) => item._id) },
    })
      .select("item quantity")
      .lean();
    const balanceMap = new Map(
      balances.map((balance) => [String(balance.item), Number(balance.quantity) || 0])
    );

    type ParsedRow = {
      itemId: string;
      itemName: string;
      unit: string;
      sampleSystemQuantity: number;
      actualQuantity: number;
      remarks: string;
      rowNumber: number;
    };
    const parsedRows: ParsedRow[] = [];
    const seenIds = new Set<string>();

    for (let index = 1; index < csvRows.length; index += 1) {
      const row = csvRows[index];
      if (row.every((value) => !value.trim())) continue;
      const rowNumber = index + 1;
      const value = (header: (typeof REQUIRED_HEADERS)[number]) =>
        row[headerMap.get(header) as number] ?? "";
      const itemId = value("item_id").trim();
      if (!mongoose.isValidObjectId(itemId)) {
        throw new Error(`CSV row ${rowNumber}: item_id invalid hai`);
      }
      if (seenIds.has(itemId)) {
        throw new Error(`CSV row ${rowNumber}: same item duplicate hai`);
      }
      seenIds.add(itemId);

      const item = itemMap.get(itemId);
      if (!item) {
        throw new Error(
          `CSV row ${rowNumber}: item current active master me available nahi hai. Fresh sample download karein.`
        );
      }
      const itemName = value("item_name").trim();
      const unit = value("unit").trim();
      if (itemName !== item.name || unit !== item.unit) {
        throw new Error(
          `CSV row ${rowNumber}: item name/unit master se match nahi karta. Item details edit na karein; fresh sample use karein.`
        );
      }

      parsedRows.push({
        itemId,
        itemName,
        unit,
        sampleSystemQuantity: readQuantity(
          value("current_system_quantity"),
          rowNumber,
          "current_system_quantity"
        ),
        actualQuantity: readQuantity(
          value("actual_stock_quantity"),
          rowNumber,
          "actual_stock_quantity"
        ),
        remarks: value("remarks").trim().slice(0, 500),
        rowNumber,
      });
    }

    const missingItems = items.filter((item) => !seenIds.has(String(item._id)));
    if (missingItems.length) {
      const names = missingItems.slice(0, 5).map((item) => item.name).join(", ");
      throw new Error(
        `CSV me ${missingItems.length} active item missing hain (${names}${missingItems.length > 5 ? ", ..." : ""}). Sample ki rows delete na karein.`
      );
    }
    if (parsedRows.length !== items.length) {
      throw new Error("CSV item count active item master se match nahi karta");
    }

    for (const row of parsedRows) {
      const current = balanceMap.get(row.itemId) || 0;
      if (!nearlyEqual(row.sampleSystemQuantity, current)) {
        throw new Error(
          `CSV row ${row.rowNumber}: ${row.itemName} ka system stock sample download ke baad change ho gaya hai (${row.sampleSystemQuantity} se ${current}). Fresh sample CSV download karke retry karein.`
        );
      }
    }

    const changedRows = parsedRows.filter(
      (row) => !nearlyEqual(row.actualQuantity, row.sampleSystemQuantity)
    );
    if (!changedRows.length) {
      return NextResponse.json({
        success: true,
        noChanges: true,
        message: "CSV valid hai, lekin actual stock aur system stock me koi difference nahi mila.",
        summary: { totalRows: parsedRows.length, changedRows: 0, unchangedRows: parsedRows.length },
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    // Re-check inside the transaction. The conditional balance update below also
    // prevents a concurrent purchase/out-entry from being silently overwritten.
    const liveBalances = await StockBalance.find({
      item: { $in: items.map((item) => item._id) },
    })
      .session(session)
      .select("item quantity")
      .lean();
    const liveBalanceMap = new Map(
      liveBalances.map((balance) => [String(balance.item), Number(balance.quantity) || 0])
    );
    for (const row of parsedRows) {
      const liveQuantity = liveBalanceMap.get(row.itemId) || 0;
      if (!nearlyEqual(liveQuantity, row.sampleSystemQuantity)) {
        throw new Error(
          `${row.itemName} ka stock upload ke dauran change ho gaya. Fresh sample download karke retry karein.`
        );
      }
    }

    const batchNo = await nextDocumentNumber("REC", reconciliationDate, session);
    const reconciliationItems = parsedRows.map((row) => ({
      item: new mongoose.Types.ObjectId(row.itemId),
      itemName: row.itemName,
      unit: row.unit,
      previousQuantity: row.sampleSystemQuantity,
      actualQuantity: row.actualQuantity,
      difference: row.actualQuantity - row.sampleSystemQuantity,
      remarks: row.remarks,
    }));

    const [batch] = await StockReconciliation.create(
      [
        {
          batchNo,
          reconciliationDate,
          reason,
          sourceFileName,
          totalRows: parsedRows.length,
          changedRows: changedRows.length,
          unchangedRows: parsedRows.length - changedRows.length,
          items: reconciliationItems,
          createdBy: auth.session.username,
        },
      ],
      { session }
    );

    for (const row of changedRows) {
      const updated = await StockBalance.findOneAndUpdate(
        {
          item: new mongoose.Types.ObjectId(row.itemId),
          quantity: row.sampleSystemQuantity,
        },
        {
          $set: {
            quantity: row.actualQuantity,
            itemName: row.itemName,
            unit: row.unit,
          },
        },
        { new: true, session }
      );
      if (!updated) {
        throw new Error(
          `${row.itemName} ka stock concurrently change hua hai. Upload rollback kar diya gaya; fresh sample se retry karein.`
        );
      }
    }

    await StockTransaction.insertMany(
      changedRows.map((row) => {
        const difference = row.actualQuantity - row.sampleSystemQuantity;
        return {
          item: new mongoose.Types.ObjectId(row.itemId),
          itemName: row.itemName,
          unit: row.unit,
          transactionType:
            difference > 0 ? "RECONCILIATION_IN" : "RECONCILIATION_OUT",
          quantityIn: difference > 0 ? difference : 0,
          quantityOut: difference < 0 ? Math.abs(difference) : 0,
          transactionDate: reconciliationDate,
          referenceModel: "StockReconciliation",
          referenceId: batch._id,
          remarks: `${batchNo}: ${reason}${row.remarks ? ` | ${row.remarks}` : ""}`,
          createdBy: auth.session.username,
        };
      }),
      { session }
    );

    await session.commitTransaction();

    await writeAuditLog({
      action: "RECONCILE",
      entityType: "StockReconciliation",
      entityId: String(batch._id),
      performedBy: auth.session.username,
      summary: `${batchNo} - CSV physical stock reconciliation; ${changedRows.length} items adjusted`,
      metadata: {
        sourceFileName,
        totalRows: parsedRows.length,
        changedRows: changedRows.length,
        reason,
      },
    }).catch((auditError) => console.error("Stock reconciliation audit log failed", auditError));

    return NextResponse.json(
      {
        success: true,
        message: `${batchNo} successfully saved. ${changedRows.length} item(s) actual stock ke according adjusted.`,
        batchNo,
        summary: {
          totalRows: parsedRows.length,
          changedRows: changedRows.length,
          unchangedRows: parsedRows.length - changedRows.length,
          increasedItems: changedRows.filter(
            (row) => row.actualQuantity > row.sampleSystemQuantity
          ).length,
          decreasedItems: changedRows.filter(
            (row) => row.actualQuantity < row.sampleSystemQuantity
          ).length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "CSV stock reconciliation save nahi ho payi",
      },
      { status: 400 }
    );
  } finally {
    await session?.endSession();
  }
}
