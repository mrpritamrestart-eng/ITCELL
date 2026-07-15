import mongoose, { Schema, models } from "mongoose";

const stationeryItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    unit: { type: String, required: true, trim: true },
    minimumRequired: { type: Number, default: 0, min: 0 },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

stationeryItemSchema.index({ name: 1 }, { unique: true });
stationeryItemSchema.index({ isActive: -1, sortOrder: 1, name: 1 });
const StationeryItem = models.StationeryItem || mongoose.model("StationeryItem", stationeryItemSchema);
export default StationeryItem;
