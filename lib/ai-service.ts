import { useAppStore } from "./store";
import { SettingsStorage } from "./storage";
import type { CaptureSession, WebhookResult, Project } from "./types";

export type AIChatMode = "job" | "portfolio";

export interface AIChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    sources?: AISource[];
}

export interface AISource {
    projectName: string;
    jobId: string;
    type: "transcript" | "task" | "issue" | "change_order" | "summary";
    excerpt: string;
    date: string;
}

interface AIRequestPayload {
    query: string;
    mode: AIChatMode;
    userId: string;
    userName: string;
    jobId?: string;
    jobName?: string;
    context: AIJobContext[];
    conversationHistory: { role: string; content: string }[];
}

interface AIJobContext {
    projectId: string;
    projectName: string;
    jobId: string;
    mode: string;
    createdAt: string;
    summary?: string;
    tasks: { title: string; status: string; priority: string; description: string }[];
    issues: { title: string; description: string; severity?: string }[];
    changeOrders: { title: string; description: string }[];
    transcriptExcerpts: { speaker?: string; text: string }[];
    approvalStatus?: string;
    approvedAt?: string;
    approvedBy?: string;
}

const AI_TIMEOUT_MS = 60_000; // 60 seconds

/**
 * Build context from approved session data for a specific job.
 */
function buildJobContext(projectId: string): AIJobContext | null {
    const store = useAppStore.getState();
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) return null;

    const session = store.sessions.find(
        (s) => s.projectId === projectId && s.approvalStatus === "approved"
    );
    // Allow unapproved sessions too — they just won't have webhookResult
    const activeSession = session || store.sessions.find((s) => s.projectId === projectId);
    const wr = activeSession?.webhookResult as WebhookResult | undefined;

    const projectTasks = store.tasks.filter((t) => t.projectId === projectId);

    return {
        projectId: project.id,
        projectName: project.name,
        jobId: project.jobId,
        mode: project.mode,
        createdAt: new Date(project.createdAt).toISOString(),
        summary: wr?.dailyLog?.summaryBullets?.map((b: any) => b.text || b).join("; ") ||
            activeSession?.editedSummary || undefined,
        tasks: projectTasks.map((t) => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            description: t.description,
        })),
        issues: (wr?.issues || []).map((i) => ({
            title: i.title,
            description: i.description,
            severity: i.severity,
        })),
        changeOrders: (wr?.changeOrderCandidates || []).map((c) => ({
            title: c.title,
            description: c.description,
        })),
        transcriptExcerpts: (wr?.transcriptSegments || []).slice(0, 50).map((t: any) => ({
            speaker: t.speaker || t.speakerRole,
            text: t.text,
        })),
        approvalStatus: activeSession?.approvalStatus,
        approvedAt: activeSession?.approvedAt
            ? new Date(activeSession.approvedAt).toISOString()
            : undefined,
        approvedBy: activeSession?.approvedBy,
    };
}

/**
 * Build context from all projects belonging to the current user.
 */
function buildPortfolioContext(): AIJobContext[] {
    const store = useAppStore.getState();
    const contexts: AIJobContext[] = [];

    for (const project of store.projects) {
        const ctx = buildJobContext(project.id);
        if (ctx) contexts.push(ctx);
    }

    return contexts;
}

/**
 * Extract clean text from various Gemini response formats.
 * The LangChain googleGemini node returns: {"parts":[{"text":"..."}],"role":"model"}
 */
function extractGeminiText(raw: any): string {
    if (!raw) return "";
    // If it's already a plain string without JSON structure, return it
    if (typeof raw === "string") {
        // Check if the string is a JSON object containing parts
        if (raw.startsWith("{") || raw.startsWith("[")) {
            try {
                const parsed = JSON.parse(raw);
                return extractGeminiText(parsed);
            } catch {
                return raw; // Not valid JSON, return as-is
            }
        }
        return raw;
    }
    // Object with parts array (Gemini format)
    if (raw.parts && Array.isArray(raw.parts)) {
        return raw.parts.map((p: any) => p.text || "").join("");
    }
    // Direct text field
    if (raw.text) return typeof raw.text === "string" ? raw.text : extractGeminiText(raw.text);
    // Output field
    if (raw.output) return typeof raw.output === "string" ? raw.output : extractGeminiText(raw.output);
    // Content field
    if (raw.content) return typeof raw.content === "string" ? raw.content : extractGeminiText(raw.content);
    // Message content
    if (raw.message?.content) return raw.message.content;
    // Candidates array (raw API format)
    if (raw.candidates?.[0]?.content?.parts?.[0]?.text) {
        return raw.candidates[0].content.parts[0].text;
    }
    // Fallback
    return typeof raw === "string" ? raw : JSON.stringify(raw);
}

/**
 * Send a query to the AI Intelligence n8n webhook.
 */
export async function sendAIQuery(
    query: string,
    mode: AIChatMode,
    jobId?: string,
    conversationHistory: AIChatMessage[] = []
): Promise<{ answer: string; sources: AISource[] }> {
    const store = useAppStore.getState();
    const settings = await SettingsStorage.get();

    // Pick the correct webhook URL based on mode
    const webhookUrl = mode === "job" ? settings.aiJobWebhookUrl : settings.aiPortfolioWebhookUrl;
    if (!webhookUrl) {
        throw new Error(`AI ${mode} webhook URL not configured. Go to Settings to set it up.`);
    }

    const user = store.currentUser;
    if (!user) {
        throw new Error("Please sign in to use AI chat.");
    }

    // Build context based on mode
    let context: AIJobContext[] = [];
    let jobName: string | undefined;

    if (mode === "job" && jobId) {
        const project = store.projects.find((p) => p.id === jobId);
        jobName = project?.name;
        const jobCtx = buildJobContext(jobId);
        if (jobCtx) context = [jobCtx];
    } else {
        context = buildPortfolioContext();
    }

    // Build conversation history for context continuity
    const history = conversationHistory.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
    }));

    const payload: AIRequestPayload = {
        query,
        mode,
        userId: user.id,
        userName: user.name,
        jobId,
        jobName,
        context,
        conversationHistory: history,
    };

    // Send to n8n webhook using fetch + AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`AI request failed (${response.status})`);
        }

        const responseText = await response.text();
        try {
            const data = JSON.parse(responseText);
            const result = Array.isArray(data) ? data[0] : data;
            const rawAnswer = result.answer || result.response || result.text || result.output || "";
            return {
                answer: extractGeminiText(rawAnswer) || "I couldn't generate a response.",
                sources: (result.sources || []).map((s: any) => ({
                    projectName: s.projectName || s.project || "",
                    jobId: s.jobId || "",
                    type: s.type || "summary",
                    excerpt: s.excerpt || s.text || "",
                    date: s.date || "",
                })),
            };
        } catch {
            return { answer: extractGeminiText(responseText) || responseText, sources: [] };
        }
    } catch (err: any) {
        if (err.name === "AbortError") {
            throw new Error("AI request timed out");
        }
        throw new Error(err.message || "Network error contacting AI service");
    } finally {
        clearTimeout(timer);
    }
}

