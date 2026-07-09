import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import StationeryItem from "@/models/StationeryItem";
import StockTransaction from "@/models/StockTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();

    const items = await StationeryItem.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    const stockTransactions = await StockTransaction.aggregate([
      {
        $group: {
          _id: "$item",
          totalIn: { $sum: "$quantityIn" },
          totalOut: { $sum: "$quantityOut" },
        },
      },
    ]);

    const stockMap = new Map(
      stockTransactions.map((transaction) => [
        String(transaction._id),
        transaction,
      ])
    );

    const stock = items.map((item: any) => {
      const transaction = stockMap.get(String(item._id));

      const totalIn = transaction?.totalIn || 0;
      const totalOut = transaction?.totalOut || 0;
      const availableQuantity = totalIn - totalOut;

      const minimumRequired = item.minimumRequired || 0;
      const needToOrder = Math.max(minimumRequired - availableQuantity, 0);

      let status = "Available";

      if (availableQuantity <= 0) {
        status = "Out of Stock";
      } else if (availableQuantity < minimumRequired) {
        status = "Low Stock";
      }

      return {
        _id: item._id,
        name: item.name,
        unit: item.unit,
        minimumRequired,
        totalIn,
        totalOut,
        availableQuantity,
        needToOrder,
        status,
      };
    });

    return NextResponse.json({
      success: true,
      stock,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch stock",
      },
      { status: 500 }
    );
  }
}