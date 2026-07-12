import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { mongooseCache?: MongooseCache };
const cached = globalForMongoose.mongooseCache ?? { conn: null, promise: null };
if (!globalForMongoose.mongooseCache) globalForMongoose.mongooseCache = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured. Add it to .env.local or deployment environment variables.");

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        dbName: process.env.MONGODB_DB_NAME || "stationery_billing",
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
