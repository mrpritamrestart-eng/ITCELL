import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is missing in .env.local file");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  mongooseCache?: MongooseCache;
};

const cached = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!globalForMongoose.mongooseCache) {
  globalForMongoose.mongooseCache = cached;
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      dbName: "stationery_billing",
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}