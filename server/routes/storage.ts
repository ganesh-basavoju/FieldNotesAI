import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { getS3Key, getUploadUrl, getDownloadUrl } from "../services/s3";
import { Media } from "../models/Media";
import { AudioNote } from "../models/AudioNote";

const router = Router();

router.use(authMiddleware);

router.post("/upload-url", async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, type, filename, contentType } = req.body;

    if (!projectId || !type || !filename || !contentType) {
      res.status(400).json({ message: "projectId, type, filename, and contentType are required" });
      return;
    }

    const fileType = type === "photo" || type === "video" ? "media" : type === "thumbnail" ? "thumbnail" : "audio";
    const key = getS3Key(req.userId!, projectId, fileType, filename);
    const uploadUrl = await getUploadUrl(key, contentType);

    res.json({ uploadUrl, key });
  } catch (error: any) {
    console.error("Get upload URL error:", error);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

router.post("/download-url", async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.body;
    if (!key) {
      res.status(400).json({ message: "S3 key is required" });
      return;
    }

    const downloadUrl = await getDownloadUrl(key);
    res.json({ downloadUrl });
  } catch (error: any) {
    console.error("Get download URL error:", error);
    res.status(500).json({ message: "Failed to generate download URL" });
  }
});

router.post("/batch-upload-urls", async (req: AuthRequest, res: Response) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
      res.status(400).json({ message: "Files array is required" });
      return;
    }

    const results = await Promise.all(
      files.map(async (file: { projectId: string; type: string; filename: string; contentType: string }) => {
        const fileType = file.type === "photo" || file.type === "video" ? "media" : file.type === "thumbnail" ? "thumbnail" : "audio";
        const key = getS3Key(req.userId!, file.projectId, fileType, file.filename);
        const uploadUrl = await getUploadUrl(key, file.contentType);
        return { uploadUrl, key, filename: file.filename };
      })
    );

    res.json({ urls: results });
  } catch (error: any) {
    console.error("Batch upload URLs error:", error);
    res.status(500).json({ message: "Failed to generate upload URLs" });
  }
});

router.post("/confirm-upload", async (req: AuthRequest, res: Response) => {
  try {
    const { type, s3Key, projectId, areaId, areaType, sessionId, capturedAt, metadata } = req.body;

    if (!type || !s3Key || !projectId || !areaId || !areaType) {
      res.status(400).json({ message: "type, s3Key, projectId, areaId, and areaType are required" });
      return;
    }

    if (type === "photo" || type === "video") {
      const media = new Media({
        userId: req.userId,
        projectId,
        areaId,
        areaType,
        type,
        s3Key,
        capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
        syncStatus: "uploaded",
        sessionId,
        ...(metadata || {}),
      });
      await media.save();

      await updateProjectCounts(projectId, "media");

      res.status(201).json({ media: media.toJSON() });
    } else if (type === "audio") {
      const { durationMs, linkedMediaId } = req.body;
      const audio = new AudioNote({
        userId: req.userId,
        projectId,
        areaId,
        areaType,
        s3Key,
        durationMs: durationMs || 0,
        capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
        syncStatus: "uploaded",
        sessionId,
        linkedMediaId,
      });
      await audio.save();

      res.status(201).json({ audioNote: audio.toJSON() });
    } else {
      res.status(400).json({ message: "Invalid type. Must be photo, video, or audio" });
    }
  } catch (error: any) {
    console.error("Confirm upload error:", error);
    res.status(500).json({ message: "Failed to confirm upload" });
  }
});

async function updateProjectCounts(projectId: string, countType: "media" | "task") {
  try {
    if (countType === "media") {
      const count = await Media.countDocuments({ projectId });
      await import("../models/Project").then(({ Project }) =>
        Project.findByIdAndUpdate(projectId, { mediaCount: count })
      );
    } else {
      const totalCount = await import("../models/Task").then(({ Task }) =>
        Task.countDocuments({ projectId })
      );
      const openCount = await import("../models/Task").then(({ Task }) =>
        Task.countDocuments({ projectId, status: { $in: ["open", "in_progress"] } })
      );
      await import("../models/Project").then(({ Project }) =>
        Project.findByIdAndUpdate(projectId, { taskCount: totalCount, openTaskCount: openCount })
      );
    }
  } catch (error) {
    console.error("Update project counts error:", error);
  }
}

export default router;
