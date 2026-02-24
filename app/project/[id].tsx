import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
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
import { shareProjectReport } from "@/lib/export-service";
import { uploadAudioFile, uploadTranscriptFile } from "@/lib/uploader";
import { sendSessionToWebhook } from "@/lib/sync-service";
import type { TaskStatus, WebhookResult, CaptureMode, ApprovalStatus } from "@/lib/types";

const MODE_ICONS: Record<CaptureMode, keyof typeof Ionicons.glyphMap> = {
  photo_speak: 'camera-outline',
  walkthrough: 'walk-outline',
  voice_only: 'mic-outline',
  upload_audio: 'cloud-upload-outline',
  upload_transcript: 'document-text-outline',
};
const MODE_LABELS: Record<CaptureMode, string> = {
  photo_speak: 'Photo + Voice',
  walkthrough: 'Walkthrough',
  voice_only: 'Voice Note',
  upload_audio: 'Upload Audio',
  upload_transcript: 'Upload Transcript',
};

type Tab = "summary" | "tasks" | "transcript";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const project = useAppStore((s) => s.projects.find((p) => p.id === id));
  const session = useAppStore((s) => s.sessions.find((s) => s.projectId === id));
  const updateSession = useAppStore((s) => s.endSession); // we'll use direct state update

  const allMedia = useAppStore((s) => s.media);
  const allAudio = useAppStore((s) => s.audioNotes);
  const allTasks = useAppStore((s) => s.tasks);
  const evidenceLinks = useAppStore((s) => s.evidenceLinks);
  const updateTask = useAppStore((s) => s.updateTask);
  const currentUser = useAppStore((s) => s.currentUser);

  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Review editing state
  const [editingSummary, setEditingSummary] = useState(false);
  const [editedSummaryText, setEditedSummaryText] = useState("");

  const projectMedia = useMemo(
    () => allMedia.filter((m) => m.projectId === id).sort((a, b) => b.capturedAt - a.capturedAt),
    [allMedia, id]
  );

  const projectTasks = useMemo(
    () => allTasks.filter((t) => t.projectId === id).sort((a, b) => b.updatedAt - a.updatedAt),
    [allTasks, id]
  );

  const projectAudio = useMemo(
    () => allAudio.filter((a) => a.projectId === id),
    [allAudio, id]
  );

  const cycleStatus = (task: typeof projectTasks[0]) => {
    const statusOrder: TaskStatus[] = ["open", "in_progress", "done"];
    const currentIdx = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
    updateTask(task.id, { status: nextStatus });
  };

  if (!project) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <EmptyState icon="alert-circle-outline" title="Project not found" />
      </View>
    );
  }

  const isProcessing = project.webhookStatus === "pending" || project.webhookStatus === "sent";
  const isFailed = project.webhookStatus === "failed";
  const wr = session?.webhookResult as WebhookResult | undefined;
  const modeLabel = MODE_LABELS[project.mode] || project.mode;
  const modeIcon = MODE_ICONS[project.mode] || "document-text-outline";
  const isApproved = session?.approvalStatus === "approved";
  const isDiscarded = session?.approvalStatus === "discarded";
  const needsReview = wr && !isApproved && !isDiscarded;

  const handleExport = async () => {
    setExporting(true);
    try {
      await shareProjectReport(project.id);
    } catch (err) {
      console.warn("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleApprove = () => {
    if (!session) return;
    Alert.alert("Approve Notes", "Mark these notes as reviewed and approved?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const store = useAppStore.getState();
          const updated = store.sessions.map((s) =>
            s.id === session.id
              ? {
                  ...s,
                  approvalStatus: "approved" as ApprovalStatus,
                  approvedAt: Date.now(),
                  approvedBy: currentUser?.name || "User",
                }
              : s
          );
          useAppStore.setState({ sessions: updated });
        },
      },
    ]);
  };

  const handleDiscard = () => {
    if (!session) return;
    Alert.alert("Discard Notes", "Are you sure you want to discard these AI-generated notes?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const store = useAppStore.getState();
          const updated = store.sessions.map((s) =>
            s.id === session.id
              ? { ...s, approvalStatus: "discarded" as ApprovalStatus }
              : s
          );
          useAppStore.setState({ sessions: updated });
        },
      },
    ]);
  };

  const handleSaveSummaryEdit = () => {
    if (!session || !editedSummaryText.trim()) return;
    const store = useAppStore.getState();
    const existing = store.sessions.find((s) => s.id === session.id);
    if (!existing) return;

    const versions = existing.summaryVersions || [];
    const newVersion = {
      version: versions.length + 1,
      editedAt: Date.now(),
      editedBy: currentUser?.name || "User",
      summaryText: editedSummaryText.trim(),
    };

    const updated = store.sessions.map((s) =>
      s.id === session.id
        ? {
            ...s,
            editedSummary: editedSummaryText.trim(),
            summaryVersions: [...versions, newVersion],
          }
        : s
    );
    useAppStore.setState({ sessions: updated });
    setEditingSummary(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRetry = async () => {
    if (!session) return;
    setRetrying(true);
    try {
      let success = false;
      if (project.mode === 'upload_audio' || project.mode === 'upload_transcript') {
        const fileUri = session.uploadedFileUri || '';
        if (!fileUri) {
          Alert.alert('File Missing', 'The uploaded file could not be found. Please create a new project and upload again.');
          setRetrying(false);
          return;
        }
        const uploadFn = project.mode === 'upload_audio' ? uploadAudioFile : uploadTranscriptFile;
        success = await uploadFn(session.id, fileUri);
      } else {
        success = await sendSessionToWebhook(session.id);
      }
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Retry Failed', 'Upload failed again. Please check your connection and try later.');
      }
    } catch (err) {
      console.warn('Retry failed:', err);
      Alert.alert('Error', 'An error occurred while retrying.');
    } finally {
      setRetrying(false);
    }
  };

  const handleForceSync = async () => {
    if (!session) return;
    setRetrying(true);
    try {
      const success = await sendSessionToWebhook(session.id);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Sync Failed', 'Force sync failed. Try again later.');
      }
    } catch (err) {
      console.warn('Force sync failed:', err);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '30', Colors.dark.background]}
        locations={[0, 0.2, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
            <Text style={styles.projectClient} numberOfLines={1}>Job: {project.jobId}</Text>
          </View>
          {wr ? (
            <Pressable onPress={handleExport} hitSlop={12} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator size="small" color={Colors.dark.accentSoft} />
              ) : (
                <Ionicons name="share-outline" size={22} color={Colors.dark.accentSoft} />
              )}
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Ionicons name={modeIcon} size={14} color={Colors.dark.accentSoft} />
            <Text style={styles.metaText}>{modeLabel}</Text>
          </View>
          {project.participants?.length > 0 ? (
            <View style={styles.metaBadge}>
              <Ionicons name="people-outline" size={14} color={Colors.dark.accentSoft} />
              <Text style={styles.metaText}>{project.participants.length}</Text>
            </View>
          ) : null}
          {isApproved ? (
            <View style={[styles.metaBadge, { borderColor: Colors.dark.success + '40' }]}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.dark.success} />
              <Text style={[styles.metaText, { color: Colors.dark.success }]}>Approved</Text>
            </View>
          ) : null}
        </View>

        {isFailed ? (
          <View style={styles.failedBanner}>
            <View style={styles.failedBannerHeader}>
              <Ionicons name="alert-circle" size={18} color="#FF5252" />
              <Text style={styles.failedBannerText}>Upload Failed</Text>
            </View>
            <Text style={styles.failedBannerSub}>The webhook did not respond in time or returned an error.</Text>
            <View style={styles.failedBannerActions}>
              <Pressable
                onPress={handleRetry}
                disabled={retrying}
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
              >
                {retrying ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color="#FFF" />
                    <Text style={styles.retryBtnText}>Retry Upload</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={handleForceSync}
                disabled={retrying}
                style={({ pressed }) => [styles.syncBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="sync" size={16} color={Colors.dark.accentSoft} />
                <Text style={styles.syncBtnText}>Force Sync</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isProcessing ? (
          <View style={styles.tabs}>
            {(["summary", "tasks", "transcript"] as Tab[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab);
                }}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
              >
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab === "summary" ? "Summary" : tab === "tasks" ? `Tasks (${projectTasks.length})` : "Transcript"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {isProcessing ? (
        <View style={styles.processingContainer}>
          <View style={styles.processingPill}>
            <ActivityIndicator size="small" color={Colors.dark.accentLight} />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
          <Text style={styles.processingSub}>AI is analyzing your session. This usually takes a moment.</Text>
        </View>
      ) : activeTab === "tasks" ? (
        projectTasks.length > 0 ? (
          <FlatList
            data={projectTasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskList}
            renderItem={({ item }) => (
              <View style={styles.taskWrapper}>
                <TaskCard
                  task={item}
                  onPress={() => router.push({ pathname: "/task/[id]", params: { id: item.id } })}
                  onStatusToggle={() => cycleStatus(item)}
                  evidenceCount={evidenceLinks.filter((l) => l.taskId === item.id).length}
                />
              </View>
            )}
          />
        ) : (
          <EmptyState icon="checkbox-outline" title="No Tasks" subtitle="No tasks were identified." />
        )
      ) : activeTab === "transcript" ? (
        <ScrollView style={styles.detailsScroll} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {wr?.transcriptSegments && wr.transcriptSegments.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubble-outline" size={18} color={Colors.dark.accentSoft} />
                <Text style={styles.sectionTitle}>Full Transcript</Text>
              </View>
              <View style={styles.transcriptCard}>
                {(wr.transcriptSegments as any[]).map((seg: any, idx: number) => (
                  <View key={seg.segmentId || seg.id || idx} style={styles.transcriptRow}>
                    <Text style={styles.transcriptTime}>{seg.time || formatMs(seg.startMs)}</Text>
                    {seg.speaker ? <Text style={styles.transcriptSpeaker}>{seg.speaker}</Text> : null}
                    <Text style={styles.transcriptText}>{seg.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ paddingTop: 40 }}>
              <EmptyState icon="chatbubble-outline" title="No Transcript" subtitle="No transcript data available." />
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.detailsScroll} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {needsReview ? (
            <View style={styles.reviewBanner}>
              <View style={styles.reviewBannerTop}>
                <Ionicons name="eye-outline" size={18} color={Colors.dark.warning} />
                <Text style={styles.reviewBannerText}>Review Required</Text>
              </View>
              <Text style={styles.reviewBannerSub}>
                Review the AI-generated notes below. Edit summary or tasks, then approve or discard.
              </Text>
              <View style={styles.reviewActions}>
                <Pressable onPress={handleApprove} style={styles.approveBtn}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </Pressable>
                <Pressable onPress={handleDiscard} style={styles.discardBtn}>
                  <Ionicons name="trash-outline" size={18} color={Colors.dark.error} />
                  <Text style={styles.discardBtnText}>Discard</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {isApproved && session?.approvedAt ? (
            <View style={styles.approvedBanner}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
              <Text style={styles.approvedText}>
                Approved {new Date(session.approvedAt).toLocaleDateString()} by {session.approvedBy || "User"}
              </Text>
            </View>
          ) : null}

          {wr?.dailyLog && wr.dailyLog.summaryBullets?.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={18} color={Colors.dark.accentSoft} />
                <Text style={styles.sectionTitle}>Summary</Text>
                {needsReview ? (
                  <Pressable
                    onPress={() => {
                      const bullets = wr.dailyLog!.summaryBullets
                        .map((b: any) => typeof b === "string" ? b : b.text)
                        .join("\n• ");
                      setEditedSummaryText(session?.editedSummary || `• ${bullets}`);
                      setEditingSummary(true);
                    }}
                    hitSlop={8}
                    style={styles.editBtn}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.dark.accentSoft} />
                  </Pressable>
                ) : null}
              </View>

              {editingSummary ? (
                <View style={styles.editCard}>
                  <TextInput
                    style={styles.editInput}
                    value={editedSummaryText}
                    onChangeText={setEditedSummaryText}
                    multiline
                    autoFocus
                    placeholder="Edit summary..."
                    placeholderTextColor={Colors.dark.textMuted}
                  />
                  <View style={styles.editActions}>
                    <Pressable onPress={() => setEditingSummary(false)} style={styles.editCancel}>
                      <Text style={styles.editCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleSaveSummaryEdit} style={styles.editSave}>
                      <Text style={styles.editSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.summaryCard}>
                  {session?.editedSummary ? (
                    <Text style={styles.bulletText}>{session.editedSummary}</Text>
                  ) : (
                    wr.dailyLog.summaryBullets.map((bullet: any, idx: number) => (
                      <View key={bullet.bulletId || idx} style={styles.bulletRow}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.bulletText}>{typeof bullet === 'string' ? bullet : bullet.text}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          ) : null}

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

          {projectMedia.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="images-outline" size={18} color={Colors.dark.accentSoft} />
                <Text style={styles.sectionTitle}>Media ({projectMedia.length})</Text>
              </View>
              <View style={styles.mediaGridInline}>
                {projectMedia.map((m) => (
                  <MediaThumbnail key={m.id} media={m} size={(Platform.OS === "web" ? 400 : 375) / 3 - 24} showStatus />
                ))}
              </View>
            </View>
          ) : null}

          {!wr && !isProcessing ? (
            <View style={{ paddingTop: 40 }}>
              <EmptyState icon="document-outline" title="No AI Data" subtitle="No processing results found." />
            </View>
          ) : null}

          {wr?.qualityScoring ? (
            <View style={styles.section}>
              <View style={styles.qualityRow}>
                <View style={styles.qualityChip}>
                  <Text style={styles.qualityLabel}>Transcript</Text>
                  <Text style={styles.qualityValue}>{Math.round((wr.qualityScoring.transcriptConfidence || 0) * 100)}%</Text>
                </View>
                <View style={styles.qualityChip}>
                  <Text style={styles.qualityLabel}>Diarization</Text>
                  <Text style={styles.qualityValue}>{Math.round((wr.qualityScoring.diarizationConfidence || 0) * 100)}%</Text>
                </View>
              </View>
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
      )}
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
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { paddingHorizontal: 20, gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.divider },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCenter: { flex: 1 },
  projectName: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.dark.text },
  projectClient: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.glassBorder },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.dark.textSecondary },
  tabs: { flexDirection: "row", gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: Colors.dark.card },
  tabLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },
  tabLabelActive: { color: Colors.dark.accentSoft, fontFamily: "Inter_600SemiBold" },
  processingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 16 },
  processingPill: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.dark.card, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: Colors.dark.accent + "40" },
  processingText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.dark.text },
  processingSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, textAlign: "center", lineHeight: 20 },
  detailsScroll: { flex: 1 },
  section: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.dark.text, flex: 1 },

  // Review banner
  reviewBanner: { marginHorizontal: 20, marginTop: 16, backgroundColor: Colors.dark.warning + '12', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.warning + '30', gap: 10 },
  reviewBannerTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewBannerText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.dark.warning },
  reviewBannerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.textSecondary, lineHeight: 18 },
  reviewActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.dark.success },
  approveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  discardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.dark.error + '15', borderWidth: 1, borderColor: Colors.dark.error + '30' },
  discardBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.dark.error },

  // Approved banner
  approvedBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: Colors.dark.success + '12', borderWidth: 1, borderColor: Colors.dark.success + '30' },
  approvedText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.dark.success },

  // Edit
  editBtn: { padding: 4 },
  editCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.dark.glassBorder, gap: 10 },
  editInput: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.dark.text, lineHeight: 20, minHeight: 100, textAlignVertical: "top" },
  editActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  editCancel: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  editCancelText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },
  editSave: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.dark.accent },
  editSaveText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Summary
  summaryCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.dark.glassBorder },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.dark.accentSoft, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.dark.textSecondary, lineHeight: 20 },

  // Transcript
  transcriptCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: Colors.dark.glassBorder },
  transcriptRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  transcriptTime: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.dark.accentSoft, width: 40, marginTop: 1 },
  transcriptSpeaker: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted, width: 80, marginTop: 1 },
  transcriptText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.dark.text, lineHeight: 20 },

  // Cards
  itemCard: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: Colors.dark.glassBorder },
  itemCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.dark.text, flex: 1, lineHeight: 20 },
  itemCardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.textSecondary, lineHeight: 18 },
  changeOrderBorder: { borderLeftWidth: 3, borderLeftColor: Colors.dark.warning },
  issueBorder: { borderLeftWidth: 3, borderLeftColor: Colors.dark.error },
  questionBorder: { borderLeftWidth: 3, borderLeftColor: Colors.dark.info },
  confidenceChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: Colors.dark.success + "18" },
  confidenceText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.dark.success },

  // Quality
  qualityRow: { flexDirection: "row", gap: 12, justifyContent: "center" },
  qualityChip: { alignItems: "center", gap: 2, backgroundColor: Colors.dark.card, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.glassBorder },
  qualityLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },
  qualityValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.dark.accentSoft },

  // Media
  mediaGridInline: { flexDirection: "row", flexWrap: "wrap", gap: 6 },

  // Audit
  auditRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingVertical: 8 },
  auditText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted },

  // Tasks
  taskList: { padding: 20, paddingBottom: 100 },
  taskWrapper: { marginBottom: 10 },

  // Failed Upload Banner
  failedBanner: { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: "#FF525212", borderWidth: 1, borderColor: "#FF525230", gap: 8 },
  failedBannerHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  failedBannerText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FF5252" },
  failedBannerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, lineHeight: 18 },
  failedBannerActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FF5252", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  retryBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  syncBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.dark.glassBorder, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  syncBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.dark.accentSoft },
});
