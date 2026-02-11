import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/EmptyState";
import type { TaskStatus } from "@/lib/types";

type FilterType = "all" | TaskStatus | "today";

const FILTERS: { key: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All", icon: "list-outline" },
  { key: "open", label: "Open", icon: "radio-button-off" },
  { key: "in_progress", label: "Active", icon: "time-outline" },
  { key: "blocked", label: "Blocked", icon: "ban-outline" },
  { key: "done", label: "Done", icon: "checkmark-circle-outline" },
  { key: "today", label: "Today", icon: "today-outline" },
];

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const tasks = useAppStore((s) => s.tasks);
  const evidenceLinks = useAppStore((s) => s.evidenceLinks);
  const projects = useAppStore((s) => s.projects);
  const updateTask = useAppStore((s) => s.updateTask);
  const [filter, setFilter] = useState<FilterType>("all");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filter === "today") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      result = result.filter(
        (t) => t.createdAt >= todayStart.getTime() || (t.dueDate && t.dueDate <= Date.now() + 86400000)
      );
    } else if (filter !== "all") {
      result = result.filter((t) => t.status === filter);
    }
    return result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority] || b.updatedAt - a.updatedAt;
    });
  }, [tasks, filter]);

  const cycleStatus = (task: typeof tasks[0]) => {
    const statusOrder: TaskStatus[] = ["open", "in_progress", "done"];
    const currentIdx = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
    updateTask(task.id, { status: nextStatus });
  };

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.name || "Unknown";
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '30', Colors.dark.background]}
        locations={[0, 0.2, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Tasks</Text>
            <Text style={styles.count}>{filteredTasks.length} items</Text>

            <FlatList
              data={FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.filtersContainer}
              renderItem={({ item: f }) => (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFilter(f.key);
                  }}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                >
                  <Ionicons
                    name={f.icon}
                    size={14}
                    color={filter === f.key ? "#FFF" : Colors.dark.textMuted}
                  />
                  <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.taskWrapper}>
            <Text style={styles.projectLabel}>{getProjectName(item.projectId)}</Text>
            <TaskCard
              task={item}
              onPress={() => router.push({ pathname: "/task/[id]", params: { id: item.id } })}
              onStatusToggle={() => cycleStatus(item)}
              evidenceCount={evidenceLinks.filter((l) => l.taskId === item.id).length}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="checkbox-outline"
            title="No tasks yet"
            subtitle="Tasks will appear here when you capture field data and process it through AI"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  header: {
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.lavender,
  },
  count: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  filtersContainer: {
    gap: 8,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  filterLabelActive: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
  },
  taskWrapper: {
    marginBottom: 12,
    gap: 4,
  },
  projectLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
    paddingLeft: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
});
