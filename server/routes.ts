import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { connectDB, isDBConnected } from "./db";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import storageRoutes from "./routes/storage";
import syncRoutes from "./routes/sync";
import webhookRoutes from "./routes/webhook";
import sessionRoutes from "./routes/sessions";

export async function registerRoutes(app: Express): Promise<Server> {
  connectDB().catch((err) => {
    console.error("Initial MongoDB connection failed:", err.message);
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/storage", storageRoutes);
  app.use("/api/sync", syncRoutes);
  app.use("/api/webhook", webhookRoutes);
  app.use("/api/sessions", sessionRoutes);

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      database: isDBConnected() ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
