import mongoose, { Schema, models } from "mongoose";

const stockTransactionSchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: "StationeryItem",
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    transactionType: {
      type: String,
      enum: ["OPENING_STOCK", "PURCHASE_IN", "BRANCH_OUT"],
      required: true,
    },
    quantityIn: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityOut: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactionDate: {
      type: Date,
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
    },
    branchName: {
      type: String,
      trim: true,
    },
    referenceModel: {
      type: String,
      enum: ["OpeningStock", "PurchaseEntry", "OutEntry"],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const StockTransaction =
  models.StockTransaction ||
  mongoose.model("StockTransaction", stockTransactionSchema);

export default StockTransaction;