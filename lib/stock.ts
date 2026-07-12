import mongoose from "mongoose";
import StockBalance from "@/models/StockBalance";
import StockTransaction from "@/models/StockTransaction";
import StationeryItem from "@/models/StationeryItem";

export async function ensureStockBalances(itemIds?: mongoose.Types.ObjectId[]) {
  const match: Record<string, unknown> = { isVoided: { $ne: true } };
  if (itemIds?.length) match.item = { $in: itemIds };

  const rows = await StockTransaction.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalIn: number;
    totalOut: number;
    itemName: string;
    unit: string;
  }>([
    { $match: match },
    { $sort: { transactionDate: 1, createdAt: 1 } },
    {
      $group: {
        _id: "$item",
        totalIn: { $sum: "$quantityIn" },
        totalOut: { $sum: "$quantityOut" },
        itemName: { $last: "$itemName" },
        unit: { $last: "$unit" },
      },
    },
  ]);

  const existingQuery = itemIds?.length ? { item: { $in: itemIds } } : {};
  const existing = await StockBalance.find(existingQuery).select("item").lean();
  const existingIds = new Set(existing.map((row) => String(row.item)));
  const missingRows = rows.filter((row) => !existingIds.has(String(row._id)));
  const negativeRows = missingRows.filter((row) => (row.totalIn || 0) - (row.totalOut || 0) < 0);
  if (negativeRows.length) {
    const names = negativeRows.slice(0, 5).map((row) => row.itemName).join(", ");
    throw new Error(`Legacy stock transactions me negative balance mila: ${names}. Data Maintenance migration/correction required hai.`);
  }

  if (missingRows.length) {
    await StockBalance.bulkWrite(
      missingRows.map((row) => ({
        updateOne: {
          filter: { item: row._id },
          update: {
            $setOnInsert: {
              item: row._id,
              itemName: row.itemName,
              unit: row.unit,
              quantity: (row.totalIn || 0) - (row.totalOut || 0),
            },
          },
          upsert: true,
        },
      }))
    );
  }

  if (itemIds?.length) {
    const items = await StationeryItem.find({ _id: { $in: itemIds } }).lean();
    await StockBalance.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { item: item._id },
          update: {
            $setOnInsert: {
              item: item._id,
              itemName: item.name,
              unit: item.unit,
              quantity: 0,
            },
          },
          upsert: true,
        },
      }))
    );
  }
}

export async function changeStockBalance(input: {
  itemId: mongoose.Types.ObjectId;
  itemName: string;
  unit: string;
  delta: number;
  session: mongoose.ClientSession;
}) {
  const { itemId, itemName, unit, delta, session } = input;
  if (delta >= 0) {
    return StockBalance.findOneAndUpdate(
      { item: itemId },
      {
        $inc: { quantity: delta },
        $set: { itemName, unit },
        $setOnInsert: { item: itemId },
      },
      { new: true, upsert: true, session }
    );
  }

  return StockBalance.findOneAndUpdate(
    { item: itemId, quantity: { $gte: Math.abs(delta) } },
    { $inc: { quantity: delta }, $set: { itemName, unit } },
    { new: true, session }
  );
}
