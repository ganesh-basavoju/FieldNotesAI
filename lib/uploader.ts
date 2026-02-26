import * as FileSystem from "expo-file-system/legacy";
import { useAppStore } from "./store";
import { SessionStorage, SettingsStorage } from "./storage";
import type { WebhookResult } from "./types";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // ms
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Upload a file using fetch + AbortController with configurable timeout.
 * React Native's FormData accepts { uri, name, type } objects natively,
 * unlike Web's Blob/atob approach which crashes silently in RN.
 */
async function uploadWithTimeout(
    url: string,
    fileUri: string,
    fieldName: string,
    metadata: Record<string, any>,
    timeoutMs: number = UPLOAD_TIMEOUT_MS
): Promise<{ status: number; body: string }> {
    // Verify file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) throw new Error("File not found: " + fileUri);

    // Determine MIME type from extension
    const ext = fileUri.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        txt: "text/plain",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        m4a: "audio/mp4",
        aac: "audio/aac",
        ogg: "audio/ogg",
    };
    const mime = mimeMap[ext] || "application/octet-stream";
    const fileName = fileUri.split("/").pop() || `upload.${ext}`;

    // Build FormData using React Native's native file object pattern
    const formData = new FormData();
    formData.append(fieldName, {
        uri: fileUri,
        name: fileName,
        type: mime,
    } as any);
    formData.append("metadata", JSON.stringify(metadata));

    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: "POST",
            body: formData,
            signal: controller.signal,
            // Don't set Content-Type — fetch sets it automatically with boundary
        });

        const body = await response.text();
        return { status: response.status, body };
    } catch (err: any) {
        if (err.name === "AbortError") {
            throw new Error(`Upload timed out after ${timeoutMs / 1000}s`);
        }
        throw new Error(`Upload network error: ${err.message}`);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Retry wrapper — tries up to MAX_RETRIES with exponential backoff.
 */
async function uploadWithRetry(
    url: string,
    fileUri: string,
    fieldName: string,
    metadata: Record<string, any>
): Promise<{ status: number; body: string }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Upload attempt ${attempt + 1}/${MAX_RETRIES + 1}...`);
            const result = await uploadWithTimeout(url, fileUri, fieldName, metadata);
            return result;
        } catch (err: any) {
            lastError = err;
            console.warn(`Upload attempt ${attempt + 1} failed:`, err.message);

            if (attempt < MAX_RETRIES) {
                const delay = RETRY_DELAYS[attempt] || 8000;
                console.log(`Retrying in ${delay / 1000}s...`);
                await sleep(delay);
            }
        }
    }

    throw lastError || new Error("Upload failed after all retries");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload an audio file to the main n8n audio webhook.
 */
export async function uploadAudioFile(
    sessionId: string,
    fileUri: string
): Promise<boolean> {
    const store = useAppStore.getState();
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) return false;

    const settings = await SettingsStorage.get();
    if (!settings.webhookUrl) return false;

    const project = store.projects.find((p) => p.id === session.projectId);

    try {
        await SessionStorage.update(sessionId, { webhookStatus: "sent" });
        if (session.projectId) {
            await store.updateProject(session.projectId, { webhookStatus: "sent" });
        }

        const metadata = {
            projectId: session.projectId,
            projectName: project?.name || "",
            jobId: project?.jobId || "",
            sessionId: session.id,
            area: session.areaType,
            scopes: project?.scopes || [],
            participants: (project?.participants || []).map((p) => ({
                name: p.name,
                role: p.role,
            })),
            consent: {
                method: project?.consentMethod || "verbal",
                given: project?.consentGiven ?? false,
            },
            sessionType: "upload_audio",
            capturedAt: new Date(session.startedAt).toISOString(),
            mediaAssets: [],
            audioNotes: [],
        };

        const result = await uploadWithRetry(
            settings.webhookUrl,
            fileUri,
            "file",
            metadata
        );

        if (result.status >= 200 && result.status < 300) {
            let body: any;
            try {
                body = JSON.parse(result.body);
            } catch {
                body = {};
            }
            const webhookResult = processWebhookResponse(body);
            await SessionStorage.update(sessionId, {
                webhookStatus: "received",
                webhookResult,
            });
            store.sessions = store.sessions.map((s) =>
                s.id === sessionId ? { ...s, webhookStatus: "received", webhookResult } : s
            );
            if (session.projectId) {
                await store.updateProject(session.projectId, { webhookStatus: "received" });
            }

            // Extract tasks from webhook result and add to store
            if (webhookResult.tasks && Array.isArray(webhookResult.tasks)) {
                for (const task of webhookResult.tasks) {
                    try {
                        await store.addTask({
                            projectId: session.projectId,
                            areaId: session.areaId,
                            areaType: session.areaType,
                            title: task.title || "Untitled Task",
                            description: task.description || "",
                            status: (task.status === "open" || task.status === "in_progress" || task.status === "done" || task.status === "blocked")
                                ? task.status : "open",
                            priority: (task.priority === "high" || task.priority === "medium" || task.priority === "low")
                                ? task.priority : "medium",
                            tags: task.tags || [],
                            createdBy: "system",
                            confidence: task.confidence,
                        });
                    } catch (e) {
                        console.warn("Failed to add task from upload:", e);
                    }
                }
            }

            useAppStore.setState({ sessions: [...store.sessions] });
            return true;
        } else {
            await markFailed(sessionId, session.projectId);
            return false;
        }
    } catch (err) {
        console.warn("Upload audio failed:", err);
        await markFailed(sessionId, session.projectId);
        return false;
    }
}

/**
 * Upload a transcript file (PDF/DOC/TXT) to the transcript n8n webhook.
 */
export async function uploadTranscriptFile(
    sessionId: string,
    fileUri: string
): Promise<boolean> {
    const store = useAppStore.getState();
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) return false;

    const settings = await SettingsStorage.get();
    if (!settings.transcriptWebhookUrl) return false;

    const project = store.projects.find((p) => p.id === session.projectId);

    try {
        // Mark as sent locally
        await SessionStorage.update(sessionId, { webhookStatus: "sent" });
        if (session.projectId) {
            await store.updateProject(session.projectId, { webhookStatus: "sent" });
        }

        const metadata = {
            projectId: session.projectId,
            projectName: project?.name || "",
            jobId: project?.jobId || "",
            sessionId: session.id,
            meetingType: (project?.scopes || [])[0] || "scope",
            participants: (project?.participants || []).map((p) => ({
                name: p.name,
                role: p.role,
            })),
            consent: {
                method: project?.consentMethod || "verbal",
                given: project?.consentGiven ?? false,
            },
        };

        // Send file to n8n transcript webhook
        const result = await uploadWithRetry(
            settings.transcriptWebhookUrl,
            fileUri,
            "file",
            metadata
        );

        if (result.status >= 200 && result.status < 300) {
            // Parse and unwrap n8n response (n8n wraps in array)
            let body: any;
            try {
                const parsed = JSON.parse(result.body);
                body = Array.isArray(parsed) ? parsed[0] : parsed;
            } catch {
                body = {};
            }

            console.log(`Transcript: n8n result received, keys: ${Object.keys(body || {}).join(', ')}`);

            // Build local webhookResult and update local store immediately
            const webhookResult = processWebhookResponse(body);
            await SessionStorage.update(sessionId, { webhookStatus: "received", webhookResult });
            store.sessions = store.sessions.map((s) =>
                s.id === sessionId ? { ...s, webhookStatus: "received", webhookResult } : s
            );
            if (session.projectId) {
                await store.updateProject(session.projectId, { webhookStatus: "received" });
            }

            // ─── Forward to BigLogic server (authenticated endpoint) ───────────
            // Uses POST /sessions/:id/store-result — same as how other modes use
            // sync-service.ts processWebhookResult() to forward to BigLogic.
            // The server session ID (serverId / MongoDB _id) goes in the URL.
            try {
                const { apiRequest } = await import('./query-client');
                // Re-read fresh store to get serverId that was set by startSession
                const freshStore = useAppStore.getState();
                const freshSession = freshStore.sessions.find((s) => s.id === sessionId);
                const serverSessionId = freshSession?.serverId || sessionId;

                console.log(`Transcript: posting to /sessions/${serverSessionId}/store-result`);

                const fwdRes = await apiRequest(
                    'POST',
                    `/api/fieldnotesai/sessions/${serverSessionId}/store-result`,
                    body  // already unwrapped; server's processN8nPayload handles parsing
                );

                if (fwdRes.ok) {
                    console.log('Transcript: BigLogic server stored result successfully');
                } else {
                    const errText = await fwdRes.text().catch(() => '');
                    console.warn(`Transcript: /store-result returned ${fwdRes.status}: ${errText.substring(0, 300)}`);
                }
            } catch (fwdErr: any) {
                console.warn('Transcript: failed to forward to BigLogic server:', fwdErr?.message || fwdErr);
            }

            // ─── Extract tasks locally (device A sees them immediately) ────────
            if (webhookResult.tasks && Array.isArray(webhookResult.tasks)) {
                for (const task of webhookResult.tasks) {
                    try {
                        await store.addTask({
                            projectId: session.projectId,
                            areaId: session.areaId,
                            areaType: session.areaType,
                            title: task.title || "Untitled Task",
                            description: task.description || "",
                            status: (task.status === "open" || task.status === "in_progress" || task.status === "done" || task.status === "blocked")
                                ? task.status : "open",
                            priority: (task.priority === "high" || task.priority === "medium" || task.priority === "low")
                                ? task.priority : "medium",
                            tags: task.tags || [],
                            createdBy: "system",
                            confidence: task.confidence,
                        });
                    } catch (e) {
                        console.warn("Failed to add task from transcript:", e);
                    }
                }
            }

            useAppStore.setState({ sessions: [...store.sessions] });
            return true;

        } else {
            // n8n returned non-2xx
            await markFailed(sessionId, session.projectId);
            return false;
        }

    } catch (err) {
        console.warn("Upload transcript failed:", err);
        await markFailed(sessionId, session.projectId);
        return false;
    }
}

async function markFailed(sessionId: string, projectId?: string) {
    await SessionStorage.update(sessionId, { webhookStatus: "failed" });
    const store = useAppStore.getState();
    store.sessions = store.sessions.map((s) =>
        s.id === sessionId ? { ...s, webhookStatus: "failed" } : s
    );
    if (projectId) {
        await store.updateProject(projectId, { webhookStatus: "failed" });
    }
    useAppStore.setState({ sessions: [...store.sessions] });
}

function processWebhookResponse(body: any): WebhookResult {
    // Handle array response (n8n wraps in array)
    const data = Array.isArray(body) ? body[0] : body;
    return {
        transcriptSegments: data.transcriptSegments || data.rawTranscript || [],
        tasks: data.tasks || [],
        issues: data.issues || [],
        questions: data.questions || [],
        changeOrderCandidates: data.changeOrderCandidates || [],
        dailyLog: data.dailyLog || data.editedSummary
            ? {
                summaryBullets: data.dailyLog?.summaryBullets || (data.editedSummary ? [{ bulletId: "summary", text: data.editedSummary.text }] : []),
                confidence: data.dailyLog?.confidence || data.editedSummary?.confidence || 0,
            }
            : undefined,
        audit: data.audit || { aiModel: "Gemini", processedAt: new Date().toISOString() },
        processedAt: Date.now(),
        rawTranscript: data.rawTranscript,
        editedSummary: data.editedSummary,
        actionItems: data.actionItems,
        qualityScoring: data.qualityScoring || data.quality,
    };
}
