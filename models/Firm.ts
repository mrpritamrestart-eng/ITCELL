import mongoose, { Schema, models } from "mongoose";

const firmSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Firm = models.Firm || mongoose.model("Firm", firmSchema);

export default Firm;
