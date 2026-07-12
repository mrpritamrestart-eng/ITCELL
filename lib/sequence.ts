import mongoose from "mongoose";
import Counter from "@/models/Counter";

export async function nextDocumentNumber(
  prefix: string,
  date: Date,
  session?: mongoose.ClientSession
) {
  const year = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(date);
  const key = `${prefix}-${year}`;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 }, $setOnInsert: { key } },
    { new: true, upsert: true, session }
  );
  return `${prefix}-${year}-${String(counter.value).padStart(5, "0")}`;
}
