import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { Session } from "../models/Session";
import { User } from "../models/User";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const filter: any = { userId: req.userId };
    if (projectId) filter.projectId = projectId;

    const sessions = await Session.find(filter).sort({ startedAt: -1 });
    res.json({ sessions: sessions.map((s: any) => s.toJSON()) });
  } catch (error: any) {
    console.error("Get sessions error:", error);
    res.status(500).json({ message: "Failed to get sessions" });
  }
});

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId,
      areaId,
      areaType,
      mode,
      sessionType,
      meetingMetadata,
    } = req.body;

    if (!projectId || !areaId || !areaType || !mode) {
      res.status(400).json({ message: "projectId, areaId, areaType, and mode are required" });
      return;
    }

    if (sessionType === "meeting" && meetingMetadata) {
      if (!meetingMetadata.consentGiven) {
        res.status(400).json({ message: "Consent must be given for meeting recordings" });
        return;
      }
    }

    const session = new Session({
      userId: req.userId,
      projectId,
      areaId,
      areaType,
      mode,
      sessionType: sessionType || "walkthrough",
      startedAt: new Date(),
      meetingMetadata: sessionType === "meeting" ? {
        ...meetingMetadata,
        consentTimestamp: new Date(),
      } : undefined,
      approvalStatus: sessionType === "meeting" ? "pending" : undefined,
    });

    await session.save();
    res.status(201).json({ session: session.toJSON() });
  } catch (error: any) {
    console.error("Create session error:", error);
    res.status(500).json({ message: "Failed to create session" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    res.json({ session: session.toJSON() });
  } catch (error: any) {
    console.error("Get session error:", error);
    res.status(500).json({ message: "Failed to get session" });
  }
});

router.put("/:id/end", async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { endedAt: new Date() },
      { new: true }
    );
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    res.json({ session: session.toJSON() });
  } catch (error: any) {
    console.error("End session error:", error);
    res.status(500).json({ message: "Failed to end session" });
  }
});

router.post("/:id/approve", async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    if (session.sessionType !== "meeting") {
      res.status(400).json({ message: "Only meeting sessions can be approved" });
      return;
    }

    session.approvalStatus = "approved";
    session.approvedAt = new Date();
    session.approvedBy = new (await import("mongoose")).default.Types.ObjectId(req.userId!);
    await session.save();

    const participants = session.meetingMetadata?.participants || [];
    const emailRecipients = participants
      .filter((p: any) => p.email)
      .map((p: any) => p.email);

    if (emailRecipients.length > 0) {
      console.log(`[EMAIL DISPATCH] Meeting approved for session ${session._id}`);
      console.log(`[EMAIL DISPATCH] Recipients: ${emailRecipients.join(", ")}`);
      console.log(`[EMAIL DISPATCH] Meeting type: ${session.meetingMetadata?.meetingType}`);
      console.log(`[EMAIL DISPATCH] Summary would be sent with webhook results`);
    }

    res.json({
      session: session.toJSON(),
      emailDispatched: emailRecipients.length > 0,
      recipients: emailRecipients,
    });
  } catch (error: any) {
    console.error("Approve session error:", error);
    res.status(500).json({ message: "Failed to approve session" });
  }
});

router.post("/:id/dispatch", async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    if (session.approvalStatus !== "approved") {
      res.status(400).json({ message: "Session must be approved before dispatching" });
      return;
    }

    const participants = session.meetingMetadata?.participants || [];
    const emailRecipients = participants
      .filter((p: any) => p.email)
      .map((p: any) => ({ name: p.name, email: p.email, role: p.role }));

    const user = await User.findById(req.userId);

    console.log(`[EMAIL DISPATCH] Dispatching meeting notes for session ${session._id}`);
    console.log(`[EMAIL DISPATCH] Sent by: ${user?.name} (${user?.email})`);
    console.log(`[EMAIL DISPATCH] To: ${emailRecipients.map((r: any) => `${r.name} <${r.email}>`).join(", ")}`);
    console.log(`[EMAIL DISPATCH] Meeting Type: ${session.meetingMetadata?.meetingType}`);
    console.log(`[EMAIL DISPATCH] Project: ${session.projectId}`);

    res.json({
      dispatched: true,
      recipients: emailRecipients,
      message: "Meeting notes dispatched (mock - will use SendGrid in production)",
    });
  } catch (error: any) {
    console.error("Dispatch session error:", error);
    res.status(500).json({ message: "Failed to dispatch session notes" });
  }
});

export default router;
