import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { Task } from "../models/Task";
import { EvidenceLink } from "../models/EvidenceLink";
import { Project } from "../models/Project";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, status, priority } = req.query;
    const filter: any = { userId: req.userId };
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = await Task.find(filter).sort({ updatedAt: -1 });
    res.json({ tasks: tasks.map((t: any) => t.toJSON()) });
  } catch (error: any) {
    console.error("Get tasks error:", error);
    res.status(500).json({ message: "Failed to get tasks" });
  }
});

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, areaId, areaType, title, description, status, priority, tags, dueDate } = req.body;
    if (!projectId || !title) {
      res.status(400).json({ message: "projectId and title are required" });
      return;
    }

    const task = new Task({
      userId: req.userId,
      projectId,
      areaId,
      areaType,
      title,
      description: description || "",
      status: status || "open",
      priority: priority || "medium",
      tags: tags || [],
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdBy: "user",
    });
    await task.save();

    await updateProjectTaskCounts(projectId);

    res.status(201).json({ task: task.toJSON() });
  } catch (error: any) {
    console.error("Create task error:", error);
    res.status(500).json({ message: "Failed to create task" });
  }
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true }
    );
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    await updateProjectTaskCounts(task.projectId.toString());

    res.json({ task: task.toJSON() });
  } catch (error: any) {
    console.error("Update task error:", error);
    res.status(500).json({ message: "Failed to update task" });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    await EvidenceLink.deleteMany({ taskId: task._id });
    await updateProjectTaskCounts(task.projectId.toString());

    res.json({ message: "Task deleted" });
  } catch (error: any) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Failed to delete task" });
  }
});

router.post("/:id/evidence", async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const { targetType, targetId, linkType, linkScore } = req.body;
    if (!targetType || !targetId) {
      res.status(400).json({ message: "targetType and targetId are required" });
      return;
    }

    const link = new EvidenceLink({
      userId: req.userId,
      taskId: task._id,
      targetType,
      targetId,
      linkType: linkType || "suggested",
      linkScore: linkScore || 0.5,
      createdBy: "user",
    });
    await link.save();

    res.status(201).json({ evidenceLink: link.toJSON() });
  } catch (error: any) {
    console.error("Add evidence link error:", error);
    res.status(500).json({ message: "Failed to add evidence link" });
  }
});

router.get("/:id/evidence", async (req: AuthRequest, res: Response) => {
  try {
    const links = await EvidenceLink.find({ taskId: req.params.id, userId: req.userId });
    res.json({ evidenceLinks: links.map((l: any) => l.toJSON()) });
  } catch (error: any) {
    console.error("Get evidence links error:", error);
    res.status(500).json({ message: "Failed to get evidence links" });
  }
});

async function updateProjectTaskCounts(projectId: string) {
  const totalCount = await Task.countDocuments({ projectId });
  const openCount = await Task.countDocuments({ projectId, status: { $in: ["open", "in_progress"] } });
  await Project.findByIdAndUpdate(projectId, { taskCount: totalCount, openTaskCount: openCount });
}

export default router;
