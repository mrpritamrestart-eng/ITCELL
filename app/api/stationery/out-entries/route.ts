import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import StationeryItem from "@/models/StationeryItem";
import OutEntry from "@/models/OutEntry";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OutRequestItem = {
  itemId: string;
  quantity: number;
};

type LeanBranch = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type LeanStationeryItem = {
  _id: mongoose.Types.ObjectId;
  name: string;
  unit: string;
};

type StockAggregateRow = {
  _id: mongoose.Types.ObjectId;
  totalIn?: number;
  totalOut?: number;
};

function parseLocalDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function isDateInCurrentMonth(dateString: string) {
  const selectedDate = parseLocalDate(dateString);
  const today = new Date();

  return (
    selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth()
  );
}

export async function POST(request: Request) {
  let session: mongoose.ClientSession | null = null;

  try {
    await connectDB();

    const body = await request.json();

    const branchId = body.branchId;
    const issueDate = body.issueDate;
    const receiverName = body.receiverName || "";
    const remarks = body.remarks || "";
    const items = body.items as OutRequestItem[];

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          message: "PS/Branch required hai",
        },
        { status: 400 }
      );
    }

    if (!issueDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Out date required hai",
        },
        { status: 400 }
      );
    }

    if (!isDateInCurrentMonth(issueDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "Stationery Out Entry sirf present month me allowed hai",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Kam se kam ek item required hai",
        },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.itemId) {
        return NextResponse.json(
          {
            success: false,
            message: "Har row me stationery item select karo",
          },
          { status: 400 }
        );
      }

      if (!item.quantity || Number(item.quantity) <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Quantity 0 se jyada honi chahiye",
          },
          { status: 400 }
        );
      }
    }

    const branch = (await Branch.findOne({
      _id: branchId,
      isActive: true,
    }).lean()) as LeanBranch | null;

    if (!branch) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid PS/Branch selected",
        },
        { status: 400 }
      );
    }

    const combinedItemsMap = new Map<string, number>();

    for (const item of items) {
      const currentQuantity = combinedItemsMap.get(item.itemId) || 0;
      combinedItemsMap.set(item.itemId, currentQuantity + Number(item.quantity));
    }

    const combinedItems = Array.from(combinedItemsMap.entries()).map(
      ([itemId, quantity]) => ({
        itemId,
        quantity,
      })
    );

    const itemIds = combinedItems.map((item) => item.itemId);

    const dbItems = (await StationeryItem.find({
      _id: { $in: itemIds },
      isActive: true,
    }).lean()) as LeanStationeryItem[];

    if (dbItems.length !== itemIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more stationery items invalid hain",
        },
        { status: 400 }
      );
    }

    const itemMap = new Map(
      dbItems.map((item) => [String(item._id), item])
    );

    const objectItemIds = itemIds.map(
      (itemId) => new mongoose.Types.ObjectId(itemId)
    );

    const stockData = await StockTransaction.aggregate<StockAggregateRow>([
      {
        $match: {
          item: { $in: objectItemIds },
        },
      },
      {
        $group: {
          _id: "$item",
          totalIn: { $sum: "$quantityIn" },
          totalOut: { $sum: "$quantityOut" },
        },
      },
    ]);

    const stockMap = new Map(
      stockData.map((stock) => [
        String(stock._id),
        {
          totalIn: stock.totalIn || 0,
          totalOut: stock.totalOut || 0,
          available: (stock.totalIn || 0) - (stock.totalOut || 0),
        },
      ])
    );

    for (const item of combinedItems) {
      const dbItem = itemMap.get(item.itemId);

      if (!dbItem) {
        throw new Error("Invalid stationery item");
      }
      const stock = stockMap.get(item.itemId) || {
        totalIn: 0,
        totalOut: 0,
        available: 0,
      };

      if (item.quantity > stock.available) {
        return NextResponse.json(
          {
            success: false,
            message: `${dbItem.name} ka available stock ${stock.available} ${dbItem.unit} hai. Aap ${item.quantity} issue nahi kar sakte.`,
          },
          { status: 400 }
        );
      }
    }

    const outItems = combinedItems.map((item) => {
      const dbItem = itemMap.get(item.itemId);

      if (!dbItem) {
        throw new Error("Invalid stationery item");
      }

      return {
        item: item.itemId,
        itemName: dbItem.name,
        quantity: item.quantity,
        unit: dbItem.unit,
      };
    });

    const totalQuantity = outItems.reduce((sum, item) => {
      return sum + item.quantity;
    }, 0);

    session = await mongoose.startSession();
    session.startTransaction();

    const createdOutEntries = await OutEntry.create(
      [
        {
          branch: branchId,
          branchName: branch.name,
          issueDate: parseLocalDate(issueDate),
          receiverName: String(receiverName).trim(),
          items: outItems,
          totalQuantity,
          remarks: String(remarks).trim(),
        },
      ],
      { session }
    );

    const outEntry = createdOutEntries[0];

    const stockTransactions = outItems.map((item) => ({
      item: item.item,
      itemName: item.itemName,
      unit: item.unit,
      transactionType: "BRANCH_OUT",
      quantityIn: 0,
      quantityOut: item.quantity,
      transactionDate: parseLocalDate(issueDate),
      branch: branchId,
      branchName: branch.name,
      referenceModel: "OutEntry",
      referenceId: outEntry._id,
      remarks: String(remarks).trim(),
    }));

    await StockTransaction.insertMany(stockTransactions, { session });

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      message: "Stationery out entry saved successfully",
      outEntry,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Stationery out entry save nahi ho payi",
      },
      { status: 500 }
    );
  } finally {
    if (session) {
      session.endSession();
    }
  }
}