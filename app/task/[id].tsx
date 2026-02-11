import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { AreaSelector } from "@/components/AreaSelector";
import { MediaThumbnail } from "@/components/MediaThumbnail";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { StatusBadge } from "@/components/StatusBadge";
import type { TaskStatus, TaskPriority, AreaType } from "@/lib/types";

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { value: "open", label: "Open", icon: "radio-button-off", color: Colors.dark.textMuted },
  { value: "in_progress", label: "In Progress", icon: "time-outline", color: Colors.dark.info },
  { value: "blocked", label: "Blocked", icon: "ban-outline", color: Colors.dark.error },
  { value: "done", label: "Done", icon: "checkmark-circle", color: Colors.dark.success },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: Colors.dark.textMuted },
  { value: "medium", label: "Medium", color: Colors.dark.warning },
  { value: "high", label: "High", color: Colors.dark.error },
];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const task = useAppStore((s) => s.tasks.find((t) => t.id === id));
  const media = useAppStore((s) => s.media);
  const audioNotes = useAppStore((s) => s.audioNotes);
  const evidenceLinks = useAppStore((s) => s.evidenceLinks);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const removeEvidenceLink = useAppStore((s) => s.removeEvidenceLink);
  const projects = useAppStore((s) => s.projects);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task?.title || "");
  const [editDescription, setEditDescription] = useState(task?.description || "");

  const taskLinks = useMemo(
    () => evidenceLinks.filter((l) => l.taskId === id),
    [evidenceLinks, id]
  );

  const linkedMedia = useMemo(
    () => taskLinks.filter((l) => l.targetType === "media").map((l) => media.find((m) => m.id === l.targetId)).filter(Boolean),
    [taskLinks, media]
  );

  const linkedAudio = useMemo(
    () => taskLinks.filter((l) => l.targetType === "audio").map((l) => audioNotes.find((a) => a.id === l.targetId)).filter(Boolean),
    [taskLinks, audioNotes]
  );

  if (!task) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.dark.textMuted} />
          <Text style={styles.notFoundText}>Task not found</Text>
        </View>
      </View>
    );
  }

  const project = projects.find((p) => p.id === task.projectId);

  const handleSave = () => {
    updateTask(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
    });
    setIsEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = () => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteTask(task.id);
          router.back();
        },
      },
    ]);
  };

  const handleRemoveLink = (linkId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeEvidenceLink(linkId);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '25', Colors.dark.background]}
        locations={[0, 0.15, 0.4]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Task Detail</Text>
        <View style={styles.headerActions}>
          {isEditing ? (
            <Pressable onPress={handleSave} hitSlop={12}>
              <Ionicons name="checkmark" size={24} color={Colors.dark.success} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                setEditTitle(task.title);
                setEditDescription(task.description);
                setIsEditing(true);
              }}
              hitSlop={12}
            >
              <Ionicons name="create-outline" size={22} color={Colors.dark.accentSoft} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.section}>
          {isEditing ? (
            <>
              <TextInput
                style={styles.titleInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Task title"
                placeholderTextColor={Colors.dark.textMuted}
                multiline
              />
              <TextInput
                style={styles.descriptionInput}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Description"
                placeholderTextColor={Colors.dark.textMuted}
                multiline
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>{task.title}</Text>
              {task.description ? (
                <Text style={styles.description}>{task.description}</Text>
              ) : null}
            </>
          )}

          {task.confidence != null ? (
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>AI Confidence</Text>
              <ConfidenceBadge score={task.confidence} />
            </View>
          ) : null}

          {task.createdBy === "system" ? (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={14} color={Colors.dark.accentSoft} />
              <Text style={styles.aiBadgeText}>AI Generated</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.optionsRow}>
            {STATUS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateTask(task.id, { status: opt.value });
                }}
                style={[styles.statusChip, task.status === opt.value && { backgroundColor: opt.color + "18", borderColor: opt.color + "35" }]}
              >
                <Ionicons name={opt.icon} size={14} color={task.status === opt.value ? opt.color : Colors.dark.textMuted} />
                <Text style={[styles.statusLabel, task.status === opt.value && { color: opt.color }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority</Text>
          <View style={styles.optionsRow}>
            {PRIORITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateTask(task.id, { priority: opt.value });
                }}
                style={[styles.priorityChip, task.priority === opt.value && { backgroundColor: opt.color + "18", borderColor: opt.color + "35" }]}
              >
                <View style={[styles.priorityDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.priorityLabel, task.priority === opt.value && { color: opt.color }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Area</Text>
          <AreaSelector
            selectedArea={task.areaType || null}
            onSelect={(area) => updateTask(task.id, { areaType: area })}
            compact
          />
        </View>

        {linkedMedia.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Media ({linkedMedia.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkedMediaScroll}>
              {linkedMedia.map((m) => {
                if (!m) return null;
                const link = taskLinks.find((l) => l.targetId === m.id);
                return (
                  <View key={m.id} style={styles.linkedMediaItem}>
                    <MediaThumbnail media={m} size={80} />
                    {link ? (
                      <Pressable
                        onPress={() => handleRemoveLink(link.id)}
                        style={styles.unlinkButton}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={18} color={Colors.dark.error} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {linkedAudio.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Audio ({linkedAudio.length})</Text>
            {linkedAudio.map((a) => {
              if (!a) return null;
              const link = taskLinks.find((l) => l.targetId === a.id);
              return (
                <View key={a.id} style={styles.audioLink}>
                  <LinearGradient
                    colors={[Colors.dark.accent + '20', Colors.dark.accent + '08']}
                    style={styles.audioLinkIcon}
                  >
                    <Ionicons name="mic" size={16} color={Colors.dark.accentSoft} />
                  </LinearGradient>
                  <View style={styles.audioLinkInfo}>
                    <Text style={styles.audioLinkArea}>{a.areaType.replace("_", " ")}</Text>
                    <Text style={styles.audioLinkDuration}>{Math.round(a.durationMs / 1000)}s</Text>
                  </View>
                  <StatusBadge status={a.syncStatus} compact />
                  {link ? (
                    <Pressable onPress={() => handleRemoveLink(link.id)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={Colors.dark.error} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Project</Text>
              <Text style={styles.detailValue}>{project?.name || "Unknown"}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>{new Date(task.createdAt).toLocaleString()}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Updated</Text>
              <Text style={styles.detailValue}>{new Date(task.updatedAt).toLocaleString()}</Text>
            </View>
            {task.tags.length > 0 ? (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tags</Text>
                  <View style={styles.tagsList}>
                    {task.tags.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.dark.error} />
          <Text style={styles.deleteButtonText}>Delete Task</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.divider,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    lineHeight: 28,
  },
  titleInput: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    lineHeight: 28,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
  descriptionInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    lineHeight: 22,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    minHeight: 80,
    textAlignVertical: "top",
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  confidenceLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Colors.dark.accent + "18",
  },
  aiBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.accentSoft,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  statusLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  priorityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  linkedMediaScroll: {
    gap: 8,
  },
  linkedMediaItem: {
    position: "relative",
  },
  unlinkButton: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
  },
  audioLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  audioLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  audioLinkInfo: {
    flex: 1,
  },
  audioLinkArea: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
    textTransform: "capitalize" as const,
  },
  audioLinkDuration: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  detailCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.dark.divider,
    marginHorizontal: 14,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
    maxWidth: "60%",
    textAlign: "right",
  },
  tagsList: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    maxWidth: "60%",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.dark.accent + "18",
  },
  tagText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.accentSoft,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.error + "12",
    borderWidth: 1,
    borderColor: Colors.dark.error + "25",
  },
  deleteButtonPressed: {
    opacity: 0.7,
  },
  deleteButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.error,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
});
