import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useAppStore } from "./store";
import Colors from "@/constants/colors";
import type { Project, CaptureSession, WebhookResult, TaskItem, MediaAsset } from "./types";

/**
 * Generate an HTML evidence report for a project and export as PDF.
 */
export async function generateProjectReport(projectId: string): Promise<string | null> {
    const store = useAppStore.getState();
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) return null;

    const session = store.sessions.find((s) => s.projectId === projectId);
    const wr = session?.webhookResult as WebhookResult | undefined;
    const projectTasks = store.tasks.filter((t) => t.projectId === projectId);
    const projectMedia = store.media.filter((m) => m.projectId === projectId);

    const html = buildReportHTML(project, session, wr, projectTasks, projectMedia);

    try {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        return uri;
    } catch (err) {
        console.warn("PDF generation failed:", err);
        return null;
    }
}

export async function shareProjectReport(projectId: string): Promise<void> {
    const pdfUri = await generateProjectReport(projectId);
    if (!pdfUri) return;

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
        await Sharing.shareAsync(pdfUri, {
            mimeType: "application/pdf",
            dialogTitle: "Share Project Report",
        });
    }
}

function buildReportHTML(
    project: Project,
    session: CaptureSession | undefined,
    wr: WebhookResult | undefined,
    tasks: TaskItem[],
    media: MediaAsset[]
): string {
    const date = new Date(project.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const participantsHtml = project.participants
        .map((p) => `<li><strong>${esc(p.name)}</strong> — ${esc(p.role)}</li>`)
        .join("");

    const summaryBullets = wr?.dailyLog?.summaryBullets || [];
    const summaryHtml = summaryBullets.length > 0
        ? summaryBullets
            .map((b: any) => `<li>${esc(typeof b === "string" ? b : b.text)}</li>`)
            .join("")
        : "<li><em>No summary available</em></li>";

    const tasksHtml = tasks.length > 0
        ? tasks
            .map(
                (t) =>
                    `<tr>
              <td>${esc(t.title)}</td>
              <td><span class="badge badge-${t.status}">${t.status.replace("_", " ")}</span></td>
              <td><span class="badge badge-${t.priority}">${t.priority}</span></td>
              <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
            </tr>`
            )
            .join("")
        : `<tr><td colspan="4"><em>No tasks</em></td></tr>`;

    const issuesHtml = wr?.issues && wr.issues.length > 0
        ? wr.issues
            .map(
                (i) => `<div class="issue-card">
          <h4>${esc(i.title)}</h4>
          <p>${esc(i.description)}</p>
        </div>`
            )
            .join("")
        : "";

    const changeOrdersHtml = wr?.changeOrderCandidates && wr.changeOrderCandidates.length > 0
        ? `<h2>Change Order Candidates</h2>` +
        wr.changeOrderCandidates
            .map(
                (co) => `<div class="co-card">
          <h4>${esc(co.title)}</h4>
          <p>${esc(co.description)}</p>
          ${co.confidence != null ? `<span class="confidence">${Math.round(co.confidence * 100)}% confidence</span>` : ""}
        </div>`
            )
            .join("")
        : "";

    const transcriptHtml = wr?.transcriptSegments && wr.transcriptSegments.length > 0
        ? wr.transcriptSegments
            .slice(0, 20)
            .map(
                (seg: any) =>
                    `<div class="transcript-row">
              <span class="time">${seg.time || formatMs(seg.startMs)}</span>
              ${seg.speaker ? `<span class="speaker">${esc(seg.speaker)}</span>` : ""}
              <span class="text">${esc(seg.text)}</span>
            </div>`
            )
            .join("")
        : "";

    const approvalHtml = session?.approvalStatus === "approved"
        ? `<div class="approved-stamp">
        ✓ Approved on ${new Date(session.approvedAt || 0).toLocaleDateString()} by ${esc(session.approvedBy || "User")}
      </div>`
        : "";

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 24px; color: #0D0816; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #6C63FF; margin: 24px 0 12px; border-bottom: 2px solid #6C63FF30; padding-bottom: 6px; }
  h3 { font-size: 14px; margin: 16px 0 8px; }
  h4 { font-size: 13px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  .meta span { margin-right: 16px; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
  th { background: #f8f8fc; font-weight: 600; color: #444; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-open { background: #e3e3e3; color: #666; }
  .badge-in_progress { background: #dbeafe; color: #1d4ed8; }
  .badge-done { background: #dcfce7; color: #15803d; }
  .badge-blocked { background: #fecaca; color: #dc2626; }
  .badge-low { background: #f3f4f6; color: #6b7280; }
  .badge-medium { background: #fef3c7; color: #d97706; }
  .badge-high { background: #fecaca; color: #dc2626; }
  .issue-card { background: #fef2f2; border-left: 3px solid #ef4444; padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; }
  .co-card { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; }
  .confidence { font-size: 11px; color: #16a34a; font-weight: 600; }
  .transcript-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12px; }
  .time { color: #6C63FF; font-weight: 600; min-width: 40px; }
  .speaker { color: #888; font-weight: 500; min-width: 100px; }
  .text { flex: 1; }
  .approved-stamp { background: #dcfce7; border: 1px solid #86efac; padding: 10px 16px; border-radius: 8px; margin: 16px 0; color: #15803d; font-weight: 600; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
</style>
</head>
<body>
  <h1>${esc(project.name)}</h1>
  <div class="meta">
    <span>Job: ${esc(project.jobId)}</span>
    <span>Date: ${date}</span>
    <span>Mode: ${esc(project.mode)}</span>
  </div>

  ${approvalHtml}

  <h2>Participants</h2>
  <ul>${participantsHtml}</ul>

  <h2>Summary</h2>
  <ul>${summaryHtml}</ul>

  ${issuesHtml ? `<h2>Issues</h2>${issuesHtml}` : ""}

  <h2>Tasks</h2>
  <table>
    <thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead>
    <tbody>${tasksHtml}</tbody>
  </table>

  ${changeOrdersHtml}

  ${transcriptHtml ? `<h2>Key Transcript Excerpts</h2>${transcriptHtml}` : ""}

  <div class="footer">
    Generated by FieldNotesAI • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
  </div>
</body>
</html>`;
}

function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatMs(ms: number | undefined): string {
    if (!ms) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
