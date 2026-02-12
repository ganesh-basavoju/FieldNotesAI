import mongoose from "mongoose";

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not set - database features will be unavailable");
    return;
  }

  async function attemptConnect(): Promise<void> {
    try {
      connectionAttempts++;
      console.log(`MongoDB connection attempt ${connectionAttempts}...`);
      await mongoose.connect(uri!, {
        dbName: "fieldcapture",
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      isConnected = true;
      connectionAttempts = 0;
      console.log("MongoDB connected successfully");
    } catch (error: any) {
      console.error(`MongoDB connection attempt ${connectionAttempts} failed:`, error.message);
      if (connectionAttempts < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY / 1000}s...`);
        setTimeout(attemptConnect, RETRY_DELAY);
      } else {
        console.error("MongoDB: Max retries reached. Database features unavailable.");
        console.error("Ensure your MongoDB Atlas cluster has this IP whitelisted (or use 0.0.0.0/0 for dev).");
      }
    }
  }

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
    isConnected = false;
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected");
    isConnected = false;
  });

  mongoose.connection.on("connected", () => {
    isConnected = true;
  });

  await attemptConnect();
}

export function isDBConnected(): boolean {
  return isConnected;
}

export function getDB() {
  return mongoose.connection;
}
