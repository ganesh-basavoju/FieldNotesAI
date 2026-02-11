import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { retryFailedItems, syncPendingSessions } from "@/lib/sync-service";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const media = useAppStore((s) => s.media);
  const audioNotes = useAppStore((s) => s.audioNotes);
  const projects = useAppStore((s) => s.projects);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const capturedCount = media.filter((m) => m.syncStatus === "captured").length;
  const syncingCount = media.filter((m) => m.syncStatus === "syncing").length;
  const uploadedCount = media.filter((m) => m.syncStatus === "uploaded").length;
  const failedCount = media.filter((m) => m.syncStatus === "failed").length;

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '30', Colors.dark.background]}
        locations={[0, 0.25, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
      >
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Status</Text>
          <View style={styles.card}>
            <SyncRow icon="checkmark-circle" color={Colors.dark.statusCaptured} label="Captured" value={capturedCount} />
            <View style={styles.divider} />
            <SyncRow icon="sync-circle" color={Colors.dark.statusSyncing} label="Syncing" value={syncingCount} />
            <View style={styles.divider} />
            <SyncRow icon="cloud-done" color={Colors.dark.statusUploaded} label="Uploaded" value={uploadedCount} />
            <View style={styles.divider} />
            <SyncRow icon="warning" color={Colors.dark.statusFailed} label="Failed" value={failedCount} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Preferences</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIconBg}>
                  <Ionicons name="wifi-outline" size={18} color={Colors.dark.accentSoft} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Wi-Fi Only Upload</Text>
                  <Text style={styles.settingDescription}>Only sync when connected to Wi-Fi</Text>
                </View>
              </View>
              <Switch
                value={settings.wifiOnlyUpload}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ wifiOnlyUpload: val });
                }}
                trackColor={{ false: Colors.dark.inputBackground, true: Colors.dark.accent + "80" }}
                thumbColor={settings.wifiOnlyUpload ? Colors.dark.accentSoft : Colors.dark.textMuted}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIconBg}>
                  <Ionicons name="sync-outline" size={18} color={Colors.dark.accentSoft} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Auto Sync</Text>
                  <Text style={styles.settingDescription}>Automatically upload when online</Text>
                </View>
              </View>
              <Switch
                value={settings.autoSync}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateSettings({ autoSync: val });
                }}
                trackColor={{ false: Colors.dark.inputBackground, true: Colors.dark.accent + "80" }}
                thumbColor={settings.autoSync ? Colors.dark.accentSoft : Colors.dark.textMuted}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Webhook</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={[styles.settingInfo, { flex: 1 }]}>
                <View style={styles.settingIconBg}>
                  <Ionicons name="globe-outline" size={18} color={Colors.dark.accentSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>n8n Endpoint</Text>
                  <Text style={styles.webhookUrl} numberOfLines={2}>{settings.webhookUrl}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage</Text>
          <View style={styles.card}>
            <StorageRow label="Projects" value={projects.length} />
            <View style={styles.divider} />
            <StorageRow label="Media Assets" value={media.length} />
            <View style={styles.divider} />
            <StorageRow label="Audio Notes" value={audioNotes.length} />
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (failedCount > 0) {
                Alert.alert("Retry Sync", `Retry uploading ${failedCount} failed items?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Retry", onPress: async () => {
                    const count = await retryFailedItems();
                    Alert.alert("Sync Complete", `${count} items synced successfully.`);
                  }},
                ]);
              } else {
                syncPendingSessions().then((count) => {
                  Alert.alert("Sync Complete", count > 0 ? `${count} sessions synced.` : "All items are up to date!");
                });
              }
            }}
            style={({ pressed }) => [pressed && styles.retryButtonPressed]}
          >
            <LinearGradient
              colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.retryButton}
            >
              <Ionicons name="refresh-outline" size={20} color="#FFF" />
              <Text style={styles.retryButtonText}>
                {failedCount > 0 ? `Retry ${failedCount} Failed` : "Force Sync"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function SyncRow({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.syncRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.syncLabel}>{label}</Text>
      <Text style={[styles.syncValue, { color }]}>{value}</Text>
    </View>
  );
}

function StorageRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.syncRow}>
      <Text style={styles.syncLabel}>{label}</Text>
      <Text style={styles.storageValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.lavender,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.divider,
    marginHorizontal: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.dark.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  settingDescription: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    marginTop: 1,
  },
  webhookUrl: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    paddingHorizontal: 16,
  },
  syncLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  syncValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  storageValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
});
