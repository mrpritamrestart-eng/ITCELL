import mongoose, { Schema, models } from "mongoose";

const permissionItemSchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: "StationeryItem",
      required: false,
    },

    itemName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.01,
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

const permissionDocumentSchema = new Schema(
  {
    /*
     * OUT_RECORD:
     * Actual Stationery Out Entry se prepared permission.
     *
     * DUMMY:
     * Old billing ke liye manually prepared permission.
     *
     * Dummy permission ka Stock, Out Entry aur Purchase
     * records par koi effect nahi hoga.
     */
    sourceType: {
      type: String,
      enum: ["OUT_RECORD", "DUMMY"],
      required: true,
      default: "OUT_RECORD",
    },

    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    sourceBranchName: {
      type: String,
      required: true,
      trim: true,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
    },

    splitNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    items: {
      type: [permissionItemSchema],
      required: true,
      default: [],
    },
  },
  {
    _id: true,
  }
);

const permissionBatchSchema = new Schema(
  {
    month: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },

    documents: {
      type: [permissionDocumentSchema],
      required: true,
      default: [],
    },

    finalizedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const PermissionBatch =
  models.PermissionBatch ||
  mongoose.model(
    "PermissionBatch",
    permissionBatchSchema
  );

export default PermissionBatch;