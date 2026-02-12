import { Router, Request, Response } from "express";
import { Session } from "../models/Session";
import { Task } from "../models/Task";
import { TranscriptSegment } from "../models/TranscriptSegment";
import { EvidenceLink } from "../models/EvidenceLink";
import { Project } from "../models/Project";

const router = Router();

router.post("/n8n-callback", async (req: Request, res: Response) => {
  try {
    const { sessionId, ...resultData } = req.body;

    if (!sessionId) {
      res.status(400).json({ message: "sessionId is required" });
      return;
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    const result = Array.isArray(resultData) ? resultData[0] : resultData;

    await Session.findByIdAndUpdate(sessionId, {
      webhookStatus: "received",
      webhookResult: result,
    });

    if (result.tasks && Array.isArray(result.tasks)) {
      for (const task of result.tasks) {
        const linkMediaAssetIds = task.linkMediaAssetIds || [];
        const linkTranscriptSegmentIds = task.linkTranscriptSegmentIds || [];

        const newTask = new Task({
          userId: session.userId,
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

        for (const mediaId of linkMediaAssetIds) {
          const evidenceLink = new EvidenceLink({
            userId: session.userId,
            taskId: newTask._id,
            targetType: "media",
            targetId: mediaId,
            linkType: "suggested",
            linkScore: task.confidence || 0.5,
            createdBy: "system",
          });
          await evidenceLink.save();
        }

        for (const segmentId of linkTranscriptSegmentIds) {
          const evidenceLink = new EvidenceLink({
            userId: session.userId,
            taskId: newTask._id,
            targetType: "transcript",
            targetId: segmentId,
            linkType: "suggested",
            linkScore: task.confidence || 0.5,
            createdBy: "system",
          });
          await evidenceLink.save();
        }
      }

      const totalCount = await Task.countDocuments({ projectId: session.projectId });
      const openCount = await Task.countDocuments({
        projectId: session.projectId,
        status: { $in: ["open", "in_progress"] },
      });
      await Project.findByIdAndUpdate(session.projectId, {
        taskCount: totalCount,
        openTaskCount: openCount,
      });
    }

    if (result.transcriptSegments && Array.isArray(result.transcriptSegments)) {
      for (const seg of result.transcriptSegments) {
        const segment = new TranscriptSegment({
          userId: session.userId,
          audioNoteId: seg.audioNoteId || (session.audioIds.length > 0 ? session.audioIds[0] : null),
          projectId: session.projectId,
          text: seg.text || "",
          startMs: seg.startMs || 0,
          endMs: seg.endMs || 0,
          confidence: seg.confidence ?? 1,
        });
        await segment.save();
      }
    }

    if (result.evidenceLinks && Array.isArray(result.evidenceLinks)) {
      for (const link of result.evidenceLinks) {
        const evidenceLink = new EvidenceLink({
          userId: session.userId,
          taskId: link.taskId,
          targetType: link.targetType,
          targetId: link.targetId,
          linkType: link.linkType || "suggested",
          linkScore: link.linkScore || 0.5,
          createdBy: "system",
        });
        await evidenceLink.save();
      }
    }

    res.json({ status: "received", sessionId });
  } catch (error: any) {
    console.error("Webhook callback error:", error);
    res.status(500).json({ message: "Failed to process webhook callback" });
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

export default router;
