import * as FileSystem from "expo-file-system/legacy";
import { Platform, Alert } from "react-native";
import { useAppStore } from "./store";
import {
  SessionStorage,
  SettingsStorage,
  MediaStorage,
  AudioStorage,
} from "./storage";
import { generateId } from "./generate-id";
import type {
  WebhookResult,
} from "./types";

function toISOString(ts: number): string {
  return new Date(ts).toISOString();
}

export async function sendSessionToWebhook(sessionId: string): Promise<boolean> {
  const store = useAppStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) {
    console.warn("Sync: session not found", sessionId);
    return false;
  }

  const settings = await SettingsStorage.get();
  if (!settings.webhookUrl) {
    console.warn("Sync: no webhook URL configured");
    return false;
  }

  try {
    await SessionStorage.update(sessionId, { webhookStatus: "sent" });

    const sessionMedia = store.media.filter((m) => session.mediaIds.includes(m.id));
    const sessionAudio = store.audioNotes.filter((a) => session.audioIds.includes(a.id));
    const project = store.projects.find((p) => p.id === session.projectId);

    const areaLabel = session.areaType.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const mediaAssets = sessionMedia.map((m) => {
      const tags: string[] = [];
      if (m.metadata && Array.isArray((m.metadata as any).tags)) {
        tags.push(...(m.metadata as any).tags);
      }
      return {
        mediaAssetId: m.id,
        type: m.type,
        capturedAt: toISOString(m.capturedAt),
        area: areaLabel,
        tags,
      };
    });

    const audioNotes = sessionAudio.map((a) => {
      const linkedMediaAssetIds = sessionMedia
        .filter((m) => a.linkedMediaId === m.id || (a.sessionId && m.sessionId === a.sessionId))
        .map((m) => m.id);

      const transcript: { time: string; text: string; confidence: number }[] = [];
      if (a.transcript) {
        transcript.push({
          time: "00:00",
          text: a.transcript,
          confidence: 1.0,
        });
      }

      return {
        audioNoteId: a.id,
        linkedMediaAssetIds,
        capturedAt: toISOString(a.capturedAt),
        area: areaLabel,
        durationMs: a.durationMs,
        transcript,
      };
    });

    const metadata = {
      projectId: session.projectId,
      projectName: project?.name || "",
      projectAddress: project?.address || "",
      sessionId: session.id,
      area: areaLabel,
      sessionType: session.mode === "photo_speak" ? "photo_speak" : session.mode === "walkthrough" ? "walkthrough" : "voice_only",
      capturedAt: toISOString(session.startedAt),
      endedAt: session.endedAt ? toISOString(session.endedAt) : undefined,
      mediaAssets,
      audioNotes,
    };

    let audioUri: string | null = null;
    for (const a of sessionAudio) {
      if (a.uri) {
        console.warn("Sync: checking audio URI:", a.uri);
        try {
          const info = await FileSystem.getInfoAsync(a.uri);
          console.warn("Sync: file info:", JSON.stringify(info));
          if (info.exists) {
            audioUri = a.uri;
            break;
          }
        } catch (e) {
          console.warn("Sync: could not check audio file", a.uri, e);
        }
      } else {
        console.warn("Sync: audio note has no URI", a.id);
      }
    }
    console.warn("Sync: final audioUri =", audioUri);

    let response: FileSystem.FileSystemUploadResult | Response;

    if (audioUri) {
      const uploadResult = await FileSystem.uploadAsync(
        settings.webhookUrl,
        audioUri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "file",
          mimeType: "audio/m4a",
          parameters: {
            data: JSON.stringify(metadata),
          },
        }
      );

      console.warn("Sync: upload result status", uploadResult.status);

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        await markSuccess(sessionId, sessionMedia, sessionAudio);

        try {
          if (uploadResult.body && uploadResult.body.trim().length > 0) {
            const result = JSON.parse(uploadResult.body);
            if (result && typeof result === "object") {
              await processWebhookResult(sessionId, result as Partial<WebhookResult>);
            }
          }
        } catch {}

        await useAppStore.getState().loadAll();
        return true;
      } else {
        console.warn("Sync: webhook returned", uploadResult.status, uploadResult.body?.substring(0, 200));
        await markFailed(sessionId, sessionMedia, sessionAudio);
        await useAppStore.getState().loadAll();
        return false;
      }
    } else {
      console.warn("Sync: no audio file found, sending metadata only");
      const res = await fetch(settings.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });

      if (res.ok) {
        await markSuccess(sessionId, sessionMedia, sessionAudio);
        try {
          const text = await res.text();
          if (text && text.trim().length > 0) {
            const result = JSON.parse(text);
            if (result && typeof result === "object") {
              await processWebhookResult(sessionId, result as Partial<WebhookResult>);
            }
          }
        } catch {}
        await useAppStore.getState().loadAll();
        return true;
      } else {
        console.warn("Sync: webhook returned", res.status);
        await markFailed(sessionId, sessionMedia, sessionAudio);
        await useAppStore.getState().loadAll();
        return false;
      }
    }
  } catch (error: any) {
    console.warn("Sync: webhook send failed:", error?.message || error);
    await SessionStorage.update(sessionId, { webhookStatus: "failed" });

    try {
      const sessionMedia = store.media.filter((m) => session.mediaIds.includes(m.id));
      const sessionAudio = store.audioNotes.filter((a) => session.audioIds.includes(a.id));
      await markFailed(sessionId, sessionMedia, sessionAudio);
    } catch {}

    await useAppStore.getState().loadAll();
    return false;
  }
}

async function markSuccess(
  sessionId: string,
  sessionMedia: { id: string }[],
  sessionAudio: { id: string }[]
) {
  await SessionStorage.update(sessionId, { webhookStatus: "received" });
  for (const m of sessionMedia) {
    await MediaStorage.update(m.id, { syncStatus: "uploaded" });
  }
  for (const a of sessionAudio) {
    await AudioStorage.update(a.id, { syncStatus: "uploaded" });
  }
}

async function markFailed(
  sessionId: string,
  sessionMedia: { id: string }[],
  sessionAudio: { id: string }[]
) {
  await SessionStorage.update(sessionId, { webhookStatus: "failed" });
  for (const m of sessionMedia) {
    await MediaStorage.update(m.id, { syncStatus: "failed" });
  }
  for (const a of sessionAudio) {
    await AudioStorage.update(a.id, { syncStatus: "failed" });
  }
}

function normalizeStatus(s: string | undefined): "open" | "in_progress" | "blocked" | "done" {
  if (!s) return "open";
  const lower = s.toLowerCase().replace(/[\s-]+/g, "_");
  if (lower === "open") return "open";
  if (lower === "in_progress" || lower === "inprogress") return "in_progress";
  if (lower === "blocked") return "blocked";
  if (lower === "done" || lower === "completed" || lower === "closed") return "done";
  return "open";
}

function normalizePriority(p: string | undefined): "low" | "medium" | "high" {
  if (!p) return "medium";
  const lower = p.toLowerCase();
  if (lower === "low") return "low";
  if (lower === "high" || lower === "critical" || lower === "urgent") return "high";
  return "medium";
}

async function processWebhookResult(sessionId: string, rawResult: any): Promise<void> {
  const store = useAppStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
  if (!result || typeof result !== "object") return;

  if (result.transcriptSegments && Array.isArray(result.transcriptSegments)) {
    const segments = result.transcriptSegments.map((seg: any) => ({
      id: seg.segmentId || seg.id || generateId(),
      audioNoteId: seg.audioNoteId || "",
      projectId: session.projectId,
      text: seg.text || "",
      startMs: parseTimeToMs(seg.time) || seg.startMs || 0,
      endMs: seg.endMs || 0,
      confidence: seg.confidence ?? 1,
    }));
    await store.addTranscripts(segments);
  }

  if (result.tasks && Array.isArray(result.tasks)) {
    for (const task of result.tasks) {
      await store.addTask({
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
    }
  }

  if (result.evidenceLinks && Array.isArray(result.evidenceLinks)) {
    for (const link of result.evidenceLinks) {
      await store.addEvidenceLink({
        taskId: link.taskId,
        targetType: link.targetType,
        targetId: link.targetId,
        linkType: link.linkType || "suggested",
        linkScore: link.linkScore || 0.5,
        createdBy: "system",
      });
    }
  }

  const webhookResult: any = {
    processedAt: Date.now(),
  };

  if (result.transcriptSegments) webhookResult.transcriptSegments = result.transcriptSegments;
  if (result.tasks) webhookResult.tasks = result.tasks;
  if (result.issues) webhookResult.issues = result.issues;
  if (result.questions) webhookResult.questions = result.questions;
  if (result.changeOrderCandidates) webhookResult.changeOrderCandidates = result.changeOrderCandidates;
  if (result.dailyLog) webhookResult.dailyLog = result.dailyLog;
  if (result.audit) webhookResult.audit = result.audit;

  await SessionStorage.update(sessionId, { webhookResult });
}

function parseTimeToMs(time: string | undefined): number {
  if (!time) return 0;
  const parts = time.split(":");
  if (parts.length === 2) {
    return (parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)) * 1000;
  }
  return 0;
}

export async function syncPendingSessions(): Promise<number> {
  const store = useAppStore.getState();
  const pending = store.sessions.filter(
    (s) => s.endedAt && (s.webhookStatus === "pending" || s.webhookStatus === "failed")
  );

  let synced = 0;
  for (const session of pending) {
    const success = await sendSessionToWebhook(session.id);
    if (success) synced++;
  }
  return synced;
}

export async function retryFailedItems(): Promise<number> {
  const store = useAppStore.getState();
  const failed = store.sessions.filter(
    (s) => s.endedAt && s.webhookStatus === "failed"
  );

  let retried = 0;
  for (const session of failed) {
    const success = await sendSessionToWebhook(session.id);
    if (success) retried++;
  }
  return retried;
}
