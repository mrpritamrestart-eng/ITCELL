import mongoose, { Schema, models } from "mongoose";

const outItemSchema = new Schema(
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
  },
  {
    _id: false,
  }
);

const outEntrySchema = new Schema(
  {
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
    },
    issueDate: {
      type: Date,
      required: true,
    },
    receiverName: {
      type: String,
      trim: true,
    },
    items: {
      type: [outItemSchema],
      required: true,
    },
    totalQuantity: {
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

const OutEntry =
  models.OutEntry || mongoose.model("OutEntry", outEntrySchema);

export default OutEntry;