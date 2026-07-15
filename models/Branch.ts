import mongoose, { Schema, models } from "mongoose";

const branchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, unique: true },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

branchSchema.index({ name: 1 }, { unique: true });
branchSchema.index({ code: 1 }, { unique: true });
branchSchema.index({ isActive: -1, sortOrder: 1, name: 1 });
const Branch = models.Branch || mongoose.model("Branch", branchSchema);
export default Branch;
