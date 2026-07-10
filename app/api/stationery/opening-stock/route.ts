import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StationeryItem from "@/models/StationeryItem";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpeningStockRequestItem = {
  itemId: string;
  quantity: number;
};

type LeanStationeryItem = {
  _id: mongoose.Types.ObjectId;
  name: string;
  unit: string;
  minimumRequired?: number;
};

type LeanOpeningTransaction = {
  item: mongoose.Types.ObjectId;
  quantityIn?: number;
};

export async function GET() {
  try {
    await connectDB();

    const items = (await StationeryItem.find({ isActive: true })
      .sort({ name: 1 })
      .lean()) as LeanStationeryItem[];

    const itemIds = items.map((item) => item._id);

    const openingTransactions = (await StockTransaction.find({
      item: { $in: itemIds },
      transactionType: "OPENING_STOCK",
    }).lean()) as LeanOpeningTransaction[];

    const openingStockMap = new Map(
      openingTransactions.map((transaction) => [
        String(transaction.item),
        transaction.quantityIn || 0,
      ])
    );

    const openingStockItems = items.map((item) => ({
      itemId: String(item._id),
      itemName: item.name,
      unit: item.unit,
      minimumRequired: item.minimumRequired || 0,
      quantity: openingStockMap.get(String(item._id)) || 0,
    }));

    return NextResponse.json({
      success: true,
      items: openingStockItems,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Opening stock load nahi ho paya",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const stockDate = body.stockDate;
    const remarks = String(body.remarks || "").trim();
    const items = body.items as OpeningStockRequestItem[];

    if (!stockDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Opening stock date required hai",
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
            message: "Invalid stationery item",
          },
          { status: 400 }
        );
      }

      if (Number(item.quantity) < 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Quantity negative nahi ho sakti",
          },
          { status: 400 }
        );
      }
    }

    const itemIds = items.map((item) => item.itemId);

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

    const operations = items.map((item) => {
      const dbItem = itemMap.get(item.itemId);

      if (!dbItem) {
        throw new Error("Invalid stationery item");
      }

      return {
        updateOne: {
          filter: {
            item: new mongoose.Types.ObjectId(item.itemId),
            transactionType: "OPENING_STOCK",
          },
          update: {
            $set: {
              item: new mongoose.Types.ObjectId(item.itemId),
              itemName: dbItem.name,
              unit: dbItem.unit,
              transactionType: "OPENING_STOCK",
              quantityIn: Number(item.quantity) || 0,
              quantityOut: 0,
              transactionDate: new Date(`${stockDate}T00:00:00`),
              referenceModel: "OpeningStock",
              remarks,
            },
          },
          upsert: true,
        },
      };
    });

    await StockTransaction.bulkWrite(operations);

    return NextResponse.json({
      success: true,
      message: "Opening stock successfully save ho gaya",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Opening stock save nahi ho paya",
      },
      { status: 500 }
    );
  }
}