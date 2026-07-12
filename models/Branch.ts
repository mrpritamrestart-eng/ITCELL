import mongoose, { Schema, models } from "mongoose";

const branchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

branchSchema.index({ name: 1 }, { unique: true });
branchSchema.index({ code: 1 }, { unique: true });
const Branch = models.Branch || mongoose.model("Branch", branchSchema);
export default Branch;
