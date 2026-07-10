import mongoose, { Schema, models } from "mongoose";

const calculationItemSchema = new Schema(
  {
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
    secondFirmUnitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    secondFirmTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    thirdFirmUnitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    thirdFirmTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const quotationFirmSchema = new Schema(
  {
    firm: {
      type: Schema.Types.ObjectId,
      ref: "Firm",
      required: true,
    },
    firmName: {
      type: String,
      required: true,
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountMode: {
      type: String,
      enum: ["MANUAL", "CALCULATED"],
      required: true,
    },
  },
  {
    _id: false,
  }
);

const quotationCalculationSchema = new Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    selectedPermissionDocumentIds: {
      type: [String],
      required: true,
      default: [],
    },
    selectedPermissionNames: {
      type: [String],
      required: true,
      default: [],
    },
    items: {
      type: [calculationItemSchema],
      required: true,
      default: [],
    },
    firms: {
      type: [quotationFirmSchema],
      required: true,
      validate: {
        validator(value: unknown[]) {
          return Array.isArray(value) && value.length === 3;
        },
        message: "Exactly three firms are required",
      },
    },
    acceptedFirmIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 2,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const QuotationCalculation =
  models.QuotationCalculation ||
  mongoose.model("QuotationCalculation", quotationCalculationSchema);

export default QuotationCalculation;
