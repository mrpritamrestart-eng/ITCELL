import mongoose, { Schema, models } from "mongoose";

const counterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const Counter = models.Counter || mongoose.model("Counter", counterSchema);
export default Counter;
