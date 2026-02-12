import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { Project } from "../models/Project";
import { Area } from "../models/Area";
import { Media } from "../models/Media";
import { AudioNote } from "../models/AudioNote";
import { Task } from "../models/Task";
import { Session } from "../models/Session";
import { EvidenceLink } from "../models/EvidenceLink";
import { TranscriptSegment } from "../models/TranscriptSegment";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json({ projects });
  } catch (error: any) {
    console.error("Get projects error:", error);
    res.status(500).json({ message: "Failed to get projects" });
  }
});

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, clientName } = req.body;
    if (!name || !address || !clientName) {
      res.status(400).json({ message: "Name, address, and client name are required" });
      return;
    }

    const project = new Project({ userId: req.userId, name, address, clientName });
    await project.save();

    const defaultAreas = [
      { type: "kitchen", label: "Kitchen" },
      { type: "bath", label: "Bathroom" },
      { type: "roof", label: "Roof" },
      { type: "exterior", label: "Exterior" },
      { type: "other", label: "Other" },
    ];

    const areas = await Area.insertMany(
      defaultAreas.map((a) => ({
        projectId: project._id,
        userId: req.userId,
        type: a.type,
        label: a.label,
      }))
    );

    res.status(201).json({ project: project.toJSON(), areas: areas.map((a: any) => a.toJSON()) });
  } catch (error: any) {
    console.error("Create project error:", error);
    res.status(500).json({ message: "Failed to create project" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const [areas, media, audioNotes, tasks, sessions, evidenceLinks, transcripts] = await Promise.all([
      Area.find({ projectId: project._id }),
      Media.find({ projectId: project._id }),
      AudioNote.find({ projectId: project._id }),
      Task.find({ projectId: project._id }),
      Session.find({ projectId: project._id }).sort({ startedAt: -1 }),
      EvidenceLink.find({ userId: req.userId }).populate("taskId"),
      TranscriptSegment.find({ projectId: project._id }),
    ]);

    res.json({
      project: project.toJSON(),
      areas: areas.map((a: any) => a.toJSON()),
      media: media.map((m: any) => m.toJSON()),
      audioNotes: audioNotes.map((a: any) => a.toJSON()),
      tasks: tasks.map((t: any) => t.toJSON()),
      sessions: sessions.map((s: any) => s.toJSON()),
      evidenceLinks: evidenceLinks.map((e: any) => e.toJSON()),
      transcripts: transcripts.map((t: any) => t.toJSON()),
    });
  } catch (error: any) {
    console.error("Get project detail error:", error);
    res.status(500).json({ message: "Failed to get project details" });
  }
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true }
    );
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    res.json({ project: project.toJSON() });
  } catch (error: any) {
    console.error("Update project error:", error);
    res.status(500).json({ message: "Failed to update project" });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    await Promise.all([
      Area.deleteMany({ projectId: project._id }),
      Media.deleteMany({ projectId: project._id }),
      AudioNote.deleteMany({ projectId: project._id }),
      Task.deleteMany({ projectId: project._id }),
      Session.deleteMany({ projectId: project._id }),
      TranscriptSegment.deleteMany({ projectId: project._id }),
    ]);

    res.json({ message: "Project deleted" });
  } catch (error: any) {
    console.error("Delete project error:", error);
    res.status(500).json({ message: "Failed to delete project" });
  }
});

router.post("/:id/areas", async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const { type, label } = req.body;
    if (!type || !label) {
      res.status(400).json({ message: "Type and label are required" });
      return;
    }

    const area = new Area({ projectId: project._id, userId: req.userId, type, label });
    await area.save();

    res.status(201).json({ area: area.toJSON() });
  } catch (error: any) {
    console.error("Create area error:", error);
    res.status(500).json({ message: "Failed to create area" });
  }
});

router.get("/:id/tasks", async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await Task.find({ projectId: req.params.id, userId: req.userId });
    res.json({ tasks: tasks.map((t: any) => t.toJSON()) });
  } catch (error: any) {
    console.error("Get tasks error:", error);
    res.status(500).json({ message: "Failed to get tasks" });
  }
});

export default router;
