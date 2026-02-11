import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
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
import { AreaSelector } from "@/components/AreaSelector";
import { MediaThumbnail } from "@/components/MediaThumbnail";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/EmptyState";
import type { AreaType, TaskStatus } from "@/lib/types";

type Tab = "media" | "tasks" | "sessions";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const project = useAppStore((s) => s.projects.find((p) => p.id === id));
  const allMedia = useAppStore((s) => s.media);
  const allAudio = useAppStore((s) => s.audioNotes);
  const allTasks = useAppStore((s) => s.tasks);
  const allSessions = useAppStore((s) => s.sessions);
  const evidenceLinks = useAppStore((s) => s.evidenceLinks);
  const updateTask = useAppStore((s) => s.updateTask);

  const [activeTab, setActiveTab] = useState<Tab>("media");
  const [selectedArea, setSelectedArea] = useState<AreaType | null>(null);

  const projectMedia = useMemo(
    () => allMedia.filter((m) => m.projectId === id).sort((a, b) => b.capturedAt - a.capturedAt),
    [allMedia, id]
  );
  const projectTasks = useMemo(
    () => allTasks.filter((t) => t.projectId === id).sort((a, b) => b.updatedAt - a.updatedAt),
    [allTasks, id]
  );
  const projectSessions = useMemo(
    () => allSessions.filter((s) => s.projectId === id).sort((a, b) => b.startedAt - a.startedAt),
    [allSessions, id]
  );
  const projectAudio = useMemo(
    () => allAudio.filter((a) => a.projectId === id),
    [allAudio, id]
  );

  const filteredMedia = selectedArea
    ? projectMedia.filter((m) => m.areaType === selectedArea)
    : projectMedia;
  const filteredTasks = selectedArea
    ? projectTasks.filter((t) => t.areaType === selectedArea)
    : projectTasks;

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
          <View style={styles.headerCenter}>
            <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
            <Text style={styles.projectClient} numberOfLines={1}>{project.clientName}</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              useAppStore.getState().setCurrentProject(id!);
              router.push("/capture");
            }}
          >
            <LinearGradient
              colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.captureButton}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
            </LinearGradient>
          </Pressable>
        </View>

        <AreaSelector selectedArea={selectedArea} onSelect={(a) => setSelectedArea(selectedArea === a ? null : a)} compact />

        <View style={styles.tabs}>
          {(["media", "tasks", "sessions"] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab === "media" ? `Media (${filteredMedia.length})` : tab === "tasks" ? `Tasks (${filteredTasks.length})` : `Sessions (${projectSessions.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "media" ? (
        filteredMedia.length > 0 ? (
          <FlatList
            key="media-grid-3col"
            data={filteredMedia}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.mediaGrid}
            columnWrapperStyle={styles.mediaRow}
            renderItem={({ item }) => (
              <MediaThumbnail media={item} size={(Platform.OS === "web" ? 400 : 375) / 3 - 16} showStatus />
            )}
          />
        ) : (
          <EmptyState
            icon="camera-outline"
            title="No media captured"
            subtitle="Start a capture session to add photos and videos"
            actionLabel="Capture"
            onAction={() => {
              useAppStore.getState().setCurrentProject(id!);
              router.push("/capture");
            }}
          />
        )
      ) : activeTab === "tasks" ? (
        filteredTasks.length > 0 ? (
          <FlatList
            data={filteredTasks}
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
          <EmptyState
            icon="checkbox-outline"
            title="No tasks yet"
            subtitle="Tasks are generated when AI processes your field captures"
          />
        )
      ) : (
        projectSessions.length > 0 ? (
          <FlatList
            data={projectSessions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: "/session/[id]", params: { id: item.id } })}
                style={({ pressed }) => [styles.sessionCard, pressed && styles.sessionCardPressed]}
              >
                <LinearGradient
                  colors={[Colors.dark.accent + '20', Colors.dark.accent + '08']}
                  style={styles.sessionIcon}
                >
                  <Ionicons
                    name={item.mode === "walkthrough" ? "walk-outline" : item.mode === "voice_only" ? "mic-outline" : "camera-outline"}
                    size={22}
                    color={Colors.dark.accentSoft}
                  />
                </LinearGradient>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionMode}>
                    {item.mode === "photo_speak" ? "Photo + Speak" : item.mode === "walkthrough" ? "Walkthrough" : "Voice Note"}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {item.mediaIds.length} media, {item.audioIds.length} audio
                  </Text>
                  <Text style={styles.sessionTime}>
                    {new Date(item.startedAt).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.webhookBadge, { backgroundColor: item.webhookStatus === "received" ? Colors.dark.success + "18" : item.webhookStatus === "failed" ? Colors.dark.error + "18" : Colors.dark.warning + "18" }]}>
                  <Text style={[styles.webhookText, { color: item.webhookStatus === "received" ? Colors.dark.success : item.webhookStatus === "failed" ? Colors.dark.error : Colors.dark.warning }]}>
                    {item.webhookStatus}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        ) : (
          <EmptyState
            icon="layers-outline"
            title="No sessions yet"
            subtitle="Capture sessions group your field data for AI processing"
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.divider,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerCenter: {
    flex: 1,
  },
  projectName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  projectClient: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  captureButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Colors.dark.card,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  tabLabelActive: {
    color: Colors.dark.accentSoft,
    fontFamily: "Inter_600SemiBold",
  },
  mediaGrid: {
    padding: 12,
    paddingBottom: 100,
  },
  mediaRow: {
    gap: 4,
    marginBottom: 4,
  },
  taskList: {
    padding: 20,
    paddingBottom: 100,
  },
  taskWrapper: {
    marginBottom: 10,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    marginBottom: 10,
  },
  sessionCardPressed: {
    opacity: 0.85,
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionMode: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  sessionMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  sessionTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  webhookBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  webhookText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
  },
});
