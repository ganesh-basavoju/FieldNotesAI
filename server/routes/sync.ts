import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { Project } from "../models/Project";
import { Area } from "../models/Area";
import { Media } from "../models/Media";
import { AudioNote } from "../models/AudioNote";
import { Task } from "../models/Task";
import { EvidenceLink } from "../models/EvidenceLink";
import { Session } from "../models/Session";
import { TranscriptSegment } from "../models/TranscriptSegment";
import { getDownloadUrl } from "../services/s3";

const router = Router();

router.use(authMiddleware);

router.post("/batch", async (req: AuthRequest, res: Response) => {
  try {
    const { projects, areas, media, audioNotes, tasks, evidenceLinks, sessions } = req.body;

    const results: Record<string, any[]> = {};

    if (projects && Array.isArray(projects)) {
      results.projects = [];
      for (const p of projects) {
        const existing = await Project.findOne({ _id: p.id, userId: req.userId });
        if (existing) {
          await Project.findByIdAndUpdate(p.id, { $set: p });
          results.projects.push({ localId: p.id, serverId: p.id, status: "updated" });
        } else {
          const project = new Project({ ...p, userId: req.userId });
          await project.save();
          results.projects.push({ localId: p.id, serverId: project._id.toString(), status: "created" });
        }
      }
    }

    if (areas && Array.isArray(areas)) {
      results.areas = [];
      for (const a of areas) {
        const area = new Area({ ...a, userId: req.userId });
        await area.save();
        results.areas.push({ localId: a.id, serverId: area._id.toString(), status: "created" });
      }
    }

    if (tasks && Array.isArray(tasks)) {
      results.tasks = [];
      for (const t of tasks) {
        const task = new Task({ ...t, userId: req.userId });
        await task.save();
        results.tasks.push({ localId: t.id, serverId: task._id.toString(), status: "created" });
      }
    }

    if (sessions && Array.isArray(sessions)) {
      results.sessions = [];
      for (const s of sessions) {
        const session = new Session({ ...s, userId: req.userId });
        await session.save();
        results.sessions.push({ localId: s.id, serverId: session._id.toString(), status: "created" });
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error("Batch sync error:", error);
    res.status(500).json({ message: "Batch sync failed" });
  }
});

router.post("/trigger-webhook", async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ message: "sessionId is required" });
      return;
    }

    const session = await Session.findOne({ _id: sessionId, userId: req.userId });
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      res.status(500).json({ message: "Webhook URL not configured" });
      return;
    }

    const project = await Project.findById(session.projectId);
    const sessionMedia = await Media.find({ sessionId: session._id });
    const sessionAudio = await AudioNote.find({ sessionId: session._id });

    const areaLabel = session.areaType.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    const mediaAssets = await Promise.all(
      sessionMedia.map(async (m: any) => {
        let url = "";
        try {
          url = await getDownloadUrl(m.s3Key);
        } catch {}
        return {
          mediaAssetId: m._id.toString(),
          type: m.type,
          capturedAt: m.capturedAt.toISOString(),
          area: areaLabel,
          url,
          tags: (m.metadata as any)?.tags || [],
        };
      })
    );

    const audioNotes = await Promise.all(
      sessionAudio.map(async (a: any) => {
        let url = "";
        try {
          url = await getDownloadUrl(a.s3Key);
        } catch {}
        return {
          audioNoteId: a._id.toString(),
          capturedAt: a.capturedAt.toISOString(),
          area: areaLabel,
          durationMs: a.durationMs,
          url,
          linkedMediaAssetIds: a.linkedMediaId ? [a.linkedMediaId.toString()] : [],
        };
      })
    );

    const metadata = {
      projectId: session.projectId.toString(),
      projectName: project?.name || "",
      projectAddress: project?.address || "",
      sessionId: session._id.toString(),
      area: areaLabel,
      sessionType: session.mode,
      capturedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      mediaAssets,
      audioNotes,
    };

    await Session.findByIdAndUpdate(session._id, { webhookStatus: "sent" });

    try {
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });

      if (webhookRes.ok) {
        const text = await webhookRes.text();
        let webhookResult: any = {};
        try {
          const parsed = JSON.parse(text);
          webhookResult = Array.isArray(parsed) ? parsed[0] : parsed;
        } catch {}

        await Session.findByIdAndUpdate(session._id, {
          webhookStatus: "received",
          webhookResult,
        });

        if (webhookResult.tasks && Array.isArray(webhookResult.tasks)) {
          for (const task of webhookResult.tasks) {
            const newTask = new Task({
              userId: req.userId,
              projectId: session.projectId,
              areaId: session.areaId,
              areaType: session.areaType,
              title: task.title || "Untitled Task",
              description: task.description || "",
              status: normalizeStatus(task.status),
              priority: normalizePriority(task.priority),
              tags: task.tags || [],
              createdBy: "system",
              confidence: task.confidence,
            });
            await newTask.save();
          }
          await updateProjectTaskCounts(session.projectId.toString());
        }

        if (webhookResult.transcriptSegments && Array.isArray(webhookResult.transcriptSegments)) {
          for (const seg of webhookResult.transcriptSegments) {
            const segment = new TranscriptSegment({
              userId: req.userId,
              audioNoteId: seg.audioNoteId || session.audioIds[0],
              projectId: session.projectId,
              text: seg.text || "",
              startMs: seg.startMs || 0,
              endMs: seg.endMs || 0,
              confidence: seg.confidence ?? 1,
            });
            await segment.save();
          }
        }

        res.json({ status: "received", webhookResult });
      } else {
        await Session.findByIdAndUpdate(session._id, { webhookStatus: "failed" });
        res.status(502).json({ message: "Webhook returned error", status: webhookRes.status });
      }
    } catch (webhookError: any) {
      await Session.findByIdAndUpdate(session._id, { webhookStatus: "failed" });
      res.status(502).json({ message: "Webhook request failed", error: webhookError.message });
    }
  } catch (error: any) {
    console.error("Trigger webhook error:", error);
    res.status(500).json({ message: "Failed to trigger webhook" });
  }
});

router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const pendingSessions = await Session.countDocuments({
      userId: req.userId,
      webhookStatus: { $in: ["pending", "failed"] },
      endedAt: { $ne: null },
    });

    const totalSessions = await Session.countDocuments({ userId: req.userId });
    const syncedSessions = await Session.countDocuments({
      userId: req.userId,
      webhookStatus: "received",
    });

    res.json({
      pendingSessions,
      totalSessions,
      syncedSessions,
    });
  } catch (error: any) {
    console.error("Sync status error:", error);
    res.status(500).json({ message: "Failed to get sync status" });
  }
});

function normalizeStatus(s: string | undefined): string {
  if (!s) return "open";
  const lower = s.toLowerCase().replace(/[\s-]+/g, "_");
  if (lower === "open") return "open";
  if (lower === "in_progress" || lower === "inprogress") return "in_progress";
  if (lower === "blocked") return "blocked";
  if (lower === "done" || lower === "completed" || lower === "closed") return "done";
  return "open";
}

function normalizePriority(p: string | undefined): string {
  if (!p) return "medium";
  const lower = p.toLowerCase();
  if (lower === "low") return "low";
  if (lower === "high" || lower === "critical" || lower === "urgent") return "high";
  return "medium";
}

async function updateProjectTaskCounts(projectId: string) {
  const totalCount = await Task.countDocuments({ projectId });
  const openCount = await Task.countDocuments({ projectId, status: { $in: ["open", "in_progress"] } });
  await Project.findByIdAndUpdate(projectId, { taskCount: totalCount, openTaskCount: openCount });
}

export default router;
