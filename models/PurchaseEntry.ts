import mongoose, { Schema, models } from "mongoose";

const purchaseItemSchema = new Schema(
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
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const purchaseEntrySchema = new Schema(
  {
    purchaseDate: {
      type: Date,
      required: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
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

const PurchaseEntry =
  models.PurchaseEntry ||
  mongoose.model("PurchaseEntry", purchaseEntrySchema);

export default PurchaseEntry;