import mongoose, { Schema, models } from "mongoose";

const stationeryItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    unit: { type: String, required: true, trim: true },
    minimumRequired: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

stationeryItemSchema.index({ name: 1 }, { unique: true });
const StationeryItem = models.StationeryItem || mongoose.model("StationeryItem", stationeryItemSchema);
export default StationeryItem;
