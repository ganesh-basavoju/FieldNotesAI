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
import { EmptyState } from "@/components/EmptyState";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const projects = useAppStore((s) => s.projects);
  const media = useAppStore((s) => s.media);
  const tasks = useAppStore((s) => s.tasks);
  const loadAll = useAppStore((s) => s.loadAll);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const totalMedia = media.length;
  const totalTasks = tasks.length;
  const pendingSync = media.filter((m) => m.syncStatus === "captured" || m.syncStatus === "syncing").length;

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '40', Colors.dark.background]}
        locations={[0, 0.3, 0.7]}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={projects}
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
                <Text style={styles.greeting}>FieldCapture</Text>
                <Text style={styles.subtitle}>Pro</Text>
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

            <View style={styles.statsRow}>
              <StatCard icon="camera" label="Media" value={totalMedia} color={Colors.dark.info} />
              <StatCard icon="checkbox" label="Tasks" value={totalTasks} color={Colors.dark.accentLight} />
              <StatCard icon="cloud-upload" label="Pending" value={pendingSync} color={Colors.dark.warning} />
            </View>

            {projects.length > 0 ? (
              <Text style={styles.sectionTitle}>Projects</Text>
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
          <EmptyState
            icon="business-outline"
            title="No projects yet"
            subtitle="Create your first project to start capturing field data"
            actionLabel="New Project"
            onAction={() => router.push("/new-project")}
          />
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
    color: Colors.dark.lavender,
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
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  statGradient: {
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderRadius: 15,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  cardWrapper: {
    marginBottom: 12,
  },
});
