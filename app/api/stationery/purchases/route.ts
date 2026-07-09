import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import PurchaseEntry from "@/models/PurchaseEntry";
import StationeryItem from "@/models/StationeryItem";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PurchaseRequestItem = {
  itemId: string;
  quantity: number;
  rate: number;
};

type ItemDoc = {
  _id: {
    toString: () => string;
  };
  name: string;
  unit: string;
};

export async function POST(request: Request) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    const body = await request.json();

    const purchaseDate = body.purchaseDate;
    const shopName = body.shopName;
    const invoiceNumber = body.invoiceNumber || "";
    const remarks = body.remarks || "";
    const items = body.items as PurchaseRequestItem[];

    if (!purchaseDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Purchase date is required",
        },
        { status: 400 }
      );
    }

    if (!shopName || !String(shopName).trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Shop name is required",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one purchase item is required",
        },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.itemId) {
        return NextResponse.json(
          {
            success: false,
            message: "Item is required in every row",
          },
          { status: 400 }
        );
      }

      if (!item.quantity || Number(item.quantity) <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Quantity must be greater than 0",
          },
          { status: 400 }
        );
      }

      if (Number(item.rate) < 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Rate cannot be negative",
          },
          { status: 400 }
        );
      }
    }

    const itemIds = items.map((item) => item.itemId);

    const dbItems = (await StationeryItem.find({
      _id: { $in: itemIds },
      isActive: true,
    }).lean()) as unknown as ItemDoc[];

    if (dbItems.length !== itemIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more stationery items are invalid",
        },
        { status: 400 }
      );
    }

    const itemMap = new Map(
      dbItems.map((item) => [item._id.toString(), item])
    );

    const purchaseItems = items.map((item) => {
      const dbItem = itemMap.get(item.itemId);

      if (!dbItem) {
        throw new Error("Stationery item not found");
      }

      const quantity = Number(item.quantity);
      const rate = Number(item.rate) || 0;
      const total = quantity * rate;

      return {
        item: item.itemId,
        itemName: dbItem.name,
        quantity,
        unit: dbItem.unit,
        rate,
        total,
      };
    });

    const grandTotal = purchaseItems.reduce((sum, item) => {
      return sum + item.total;
    }, 0);

    session.startTransaction();

    const createdPurchases = await PurchaseEntry.create(
      [
        {
          purchaseDate: new Date(purchaseDate),
          shopName: String(shopName).trim(),
          invoiceNumber: String(invoiceNumber).trim(),
          items: purchaseItems,
          grandTotal,
          remarks: String(remarks).trim(),
        },
      ],
      { session }
    );

    const purchaseEntry = createdPurchases[0];

    const stockTransactions = purchaseItems.map((item) => ({
      item: item.item,
      itemName: item.itemName,
      unit: item.unit,
      transactionType: "PURCHASE_IN",
      quantityIn: item.quantity,
      quantityOut: 0,
      transactionDate: new Date(purchaseDate),
      referenceModel: "PurchaseEntry",
      referenceId: purchaseEntry._id,
      remarks: String(remarks).trim(),
    }));

    await StockTransaction.insertMany(stockTransactions, { session });

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      message: "Purchase entry saved successfully",
      purchaseEntry,
    });
  } catch (error) {
    await session.abortTransaction();

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to save purchase entry",
      },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}