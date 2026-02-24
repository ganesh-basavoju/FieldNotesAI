import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { ProjectCard } from "@/components/ProjectCard";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const projects = useAppStore((s) => s.projects);
  const sessions = useAppStore((s) => s.sessions);
  const tasks = useAppStore((s) => s.tasks);
  const loadAll = useAppStore((s) => s.loadAll);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // Dashboard stats
  const totalProjects = projects.length;
  const completedProjects = projects.filter((p) => p.webhookStatus === "received").length;
  const failedProjects = projects.filter((p) => p.webhookStatus === "failed").length;
  const totalTasks = tasks.length;
  const processingProjects = projects.filter(
    (p) => p.webhookStatus === "pending" || p.webhookStatus === "sent"
  ).length;

  // Recent projects (last 5)
  const recentProjects = projects.slice(0, 5);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const stats = [
    { icon: "folder-open" as const, label: "Total Projects", value: totalProjects, color: Colors.dark.accentLight },
    { icon: "checkmark-circle" as const, label: "Completed", value: completedProjects, color: Colors.dark.success },
    { icon: "close-circle" as const, label: "Failed", value: failedProjects, color: Colors.dark.error },
    { icon: "list" as const, label: "Tasks", value: totalTasks, color: Colors.dark.info },
    { icon: "hourglass" as const, label: "Processing", value: processingProjects, color: Colors.dark.warning },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '40', Colors.dark.background]}
        locations={[0, 0.3, 0.7]}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={recentProjects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.accentLight}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.greeting}>BigLogicAI</Text>
                <Text style={styles.subtitle}>AI Powered Field Notes</Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/new-project");
                }}
                style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
              >
                <LinearGradient
                  colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addButtonGradient}
                >
                  <Ionicons name="add" size={22} color="#FFF" />
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                {stats.slice(0, 3).map((stat) => (
                  <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} color={stat.color} />
                ))}
              </View>
              <View style={styles.statsRow}>
                {stats.slice(3).map((stat) => (
                  <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} color={stat.color} />
                ))}
              </View>
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/new-project");
              }}
              style={({ pressed }) => [pressed && styles.createBtnPressed]}
            >
              <LinearGradient
                colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createBtn}
              >
                <Ionicons name="add-circle" size={22} color="#FFF" />
                <Text style={styles.createBtnText}>Create Project</Text>
              </LinearGradient>
            </Pressable>

            {recentProjects.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Projects</Text>
                <Pressable onPress={() => router.push("/(tabs)/projects")}>
                  <Text style={styles.seeAll}>See All →</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ProjectCard
              project={item}
              onPress={() => {
                useAppStore.getState().setCurrentProject(item.id);
                router.push({ pathname: "/project/[id]", params: { id: item.id } });
              }}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.dark.accentSoft} />
            </View>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>Create your first project to start capturing field data</Text>
          </View>
        }
      />
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <LinearGradient
        colors={[color + '20', color + '08']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statGradient}
      >
        <View style={[styles.statIconBg, { backgroundColor: color + '25' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
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
    gap: 20,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
    marginTop: -2,
  },
  addButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  addButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.92 }],
  },
  statsGrid: {
    gap: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  statGradient: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  createBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  createBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.accentSoft,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 32,
    gap: 12,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.dark.accent + '15',
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
});
