import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { MediaThumbnail } from "@/components/MediaThumbnail";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/EmptyState";
import type { TaskStatus, WebhookResult } from "@/lib/types";

export default function SessionReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const session = useAppStore((s) => s.sessions.find((ses) => ses.id === id));
  const allMedia = useAppStore((s) => s.media);
  const allAudio = useAppStore((s) => s.audioNotes);
  const allTasks = useAppStore((s) => s.tasks);
  const allTranscripts = useAppStore((s) => s.transcripts);
  const evidenceLinks = useAppStore((s) => s.evidenceLinks);
  const updateTask = useAppStore((s) => s.updateTask);

  const sessionMedia = useMemo(
    () => allMedia.filter((m) => session?.mediaIds.includes(m.id)).sort((a, b) => a.capturedAt - b.capturedAt),
    [allMedia, session]
  );

  const sessionAudio = useMemo(
    () => allAudio.filter((a) => session?.audioIds.includes(a.id)),
    [allAudio, session]
  );

  const projectTasks = useMemo(
    () => allTasks.filter((t) => t.projectId === session?.projectId).sort((a, b) => b.createdAt - a.createdAt),
    [allTasks, session]
  );

  const wr = session?.webhookResult as WebhookResult | undefined;

  const cycleStatus = (task: typeof projectTasks[0]) => {
    const statusOrder: TaskStatus[] = ["open", "in_progress", "done"];
    const currentIdx = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
    updateTask(task.id, { status: nextStatus });
  };

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <EmptyState icon="alert-circle-outline" title="Session not found" />
      </View>
    );
  }

  const duration = session.endedAt
    ? Math.round((session.endedAt - session.startedAt) / 1000)
    : 0;
  const durationStr = duration > 0
    ? `${Math.floor(duration / 60)}m ${duration % 60}s`
    : "In progress";

  const isProcessed = wr && wr.processedAt;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '30', Colors.dark.background]}
        locations={[0, 0.2, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Session Review</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.sessionMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{durationStr}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="camera-outline" size={16} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{sessionMedia.length} media</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="mic-outline" size={16} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{sessionAudio.length} audio</Text>
          </View>
          {isProcessed ? (
            <View style={styles.processedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.dark.success} />
              <Text style={[styles.metaText, { color: Colors.dark.success }]}>AI Processed</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {sessionMedia.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Media Timeline</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaScroll}
            >
              {sessionMedia.map((media) => (
                <View key={media.id} style={styles.mediaItem}>
                  <MediaThumbnail media={media} size={100} showStatus />
                  <Text style={styles.mediaTime}>
                    {new Date(media.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {wr?.dailyLog && wr.dailyLog.summaryBullets?.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={Colors.dark.accentSoft} />
              <Text style={styles.sectionTitle}>Daily Log Summary</Text>
            </View>
            <View style={styles.summaryCard}>
              {wr.dailyLog.summaryBullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {wr?.transcriptSegments && wr.transcriptSegments.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.dark.accentSoft} />
              <Text style={styles.sectionTitle}>Transcript</Text>
            </View>
            <View style={styles.transcriptCard}>
              {(wr.transcriptSegments as any[]).map((seg: any, idx: number) => (
                <View key={seg.segmentId || seg.id || idx} style={styles.transcriptRow}>
                  <Text style={styles.transcriptTime}>{seg.time || formatMs(seg.startMs)}</Text>
                  <Text style={styles.transcriptText}>{seg.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkbox-outline" size={18} color={Colors.dark.accentSoft} />
            <Text style={styles.sectionTitle}>Tasks ({projectTasks.length})</Text>
          </View>
          {projectTasks.length > 0 ? (
            projectTasks.map((task) => (
              <View key={task.id} style={styles.taskWrapper}>
                <TaskCard
                  task={task}
                  onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id } })}
                  onStatusToggle={() => cycleStatus(task)}
                  evidenceCount={evidenceLinks.filter((l) => l.taskId === task.id).length}
                />
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="hourglass-outline" size={24} color={Colors.dark.textMuted} />
              <Text style={styles.emptyCardText}>
                Tasks will appear here after AI processing
              </Text>
            </View>
          )}
        </View>

        {wr?.changeOrderCandidates && wr.changeOrderCandidates.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="swap-horizontal-outline" size={18} color={Colors.dark.warning} />
              <Text style={styles.sectionTitle}>Change Orders ({wr.changeOrderCandidates.length})</Text>
            </View>
            {(wr.changeOrderCandidates as any[]).map((co: any, idx: number) => (
              <View key={idx} style={[styles.itemCard, styles.changeOrderBorder]}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardTitle}>{co.title}</Text>
                  {co.confidence != null ? (
                    <View style={styles.confidenceChip}>
                      <Text style={styles.confidenceText}>{Math.round(co.confidence * 100)}%</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.itemCardDesc}>{co.description}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {wr?.issues && wr.issues.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={18} color={Colors.dark.error} />
              <Text style={styles.sectionTitle}>Issues ({wr.issues.length})</Text>
            </View>
            {(wr.issues as any[]).map((issue: any, idx: number) => (
              <View key={idx} style={[styles.itemCard, styles.issueBorder]}>
                <Text style={styles.itemCardTitle}>{issue.title}</Text>
                <Text style={styles.itemCardDesc}>{issue.description}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {wr?.questions && wr.questions.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="help-circle-outline" size={18} color={Colors.dark.info} />
              <Text style={styles.sectionTitle}>Questions ({wr.questions.length})</Text>
            </View>
            {(wr.questions as any[]).map((q: any, idx: number) => (
              <View key={idx} style={[styles.itemCard, styles.questionBorder]}>
                <Text style={styles.itemCardTitle}>{q.text}</Text>
                {q.context ? <Text style={styles.itemCardDesc}>{q.context}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {sessionAudio.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mic-outline" size={18} color={Colors.dark.accentSoft} />
              <Text style={styles.sectionTitle}>Audio Notes</Text>
            </View>
            {sessionAudio.map((audio) => (
              <View key={audio.id} style={styles.audioCard}>
                <LinearGradient
                  colors={[Colors.dark.accent + '20', Colors.dark.accent + '08']}
                  style={styles.audioIcon}
                >
                  <Ionicons name="mic" size={18} color={Colors.dark.accentSoft} />
                </LinearGradient>
                <View style={styles.audioInfo}>
                  <Text style={styles.audioArea}>{audio.areaType.replace("_", " ")}</Text>
                  <Text style={styles.audioDuration}>
                    {Math.round(audio.durationMs / 1000)}s
                  </Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: audio.syncStatus === "uploaded" ? Colors.dark.success : audio.syncStatus === "failed" ? Colors.dark.error : Colors.dark.warning }]} />
              </View>
            ))}
          </View>
        ) : null}

        {wr?.audit ? (
          <View style={styles.section}>
            <View style={styles.auditRow}>
              <Ionicons name="flash-outline" size={14} color={Colors.dark.textMuted} />
              <Text style={styles.auditText}>
                Processed by {wr.audit.aiModel || "AI"} {wr.audit.pipelineVersion ? `v${wr.audit.pipelineVersion}` : ""}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function formatMs(ms: number | undefined): string {
  if (!ms) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.divider,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  sessionMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  processedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  mediaScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  mediaItem: {
    alignItems: "center",
    gap: 6,
  },
  mediaTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  summaryCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.accentSoft,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  transcriptCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  transcriptRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  transcriptTime: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.accentSoft,
    width: 40,
    marginTop: 1,
  },
  transcriptText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    lineHeight: 20,
  },
  taskWrapper: {
    marginBottom: 4,
  },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  emptyCardText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    textAlign: "center",
  },
  itemCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  itemCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemCardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    flex: 1,
    lineHeight: 20,
  },
  itemCardDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  changeOrderBorder: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.warning,
  },
  issueBorder: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.error,
  },
  questionBorder: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.info,
  },
  confidenceChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.dark.success + "18",
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.success,
  },
  audioCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  audioIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  audioInfo: {
    flex: 1,
  },
  audioArea: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
    textTransform: "capitalize" as const,
  },
  audioDuration: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 8,
  },
  auditText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
});
