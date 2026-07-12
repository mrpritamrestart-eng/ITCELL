import mongoose, { Schema, models } from "mongoose";

const stockBalanceSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "StationeryItem", required: true, unique: true },
    itemName: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

stockBalanceSchema.index({ item: 1 }, { unique: true });

const StockBalance = models.StockBalance || mongoose.model("StockBalance", stockBalanceSchema);
export default StockBalance;
