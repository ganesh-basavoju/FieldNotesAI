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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const media = useAppStore((s) => s.media);
  const audioNotes = useAppStore((s) => s.audioNotes);
  const projects = useAppStore((s) => s.projects);
  const authToken = useAppStore((s) => s.authToken);
  const currentUser = useAppStore((s) => s.currentUser);
  const logout = useAppStore((s) => s.logout);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          logout();
        },
      },
    ]);
  };

  const userInitial = currentUser?.name
    ? currentUser.name.charAt(0).toUpperCase()
    : "?";

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

        {authToken && currentUser ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/profile");
            }}
            style={({ pressed }) => [styles.profileBanner, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{currentUser.name}</Text>
              {currentUser.company ? (
                <Text style={styles.profileCompany}>{currentUser.company}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(auth)/login");
            }}
            style={({ pressed }) => [styles.profileBanner, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.avatarCircleGuest}>
              <Ionicons name="person" size={28} color={Colors.dark.textMuted} />
            </View>
            <Text style={styles.signInText}>Sign in or Sign up</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
          </Pressable>
        )}

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
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={[styles.settingInfo, { flex: 1 }]}>
                <View style={styles.settingIconBg}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.dark.accentSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>AI Job Chat</Text>
                  <Text style={styles.webhookUrl} numberOfLines={2}>{settings.aiJobWebhookUrl}</Text>
                </View>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={[styles.settingInfo, { flex: 1 }]}>
                <View style={styles.settingIconBg}>
                  <Ionicons name="chatbubbles-outline" size={18} color={Colors.dark.accentSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>AI Portfolio Chat</Text>
                  <Text style={styles.webhookUrl} numberOfLines={2}>{settings.aiPortfolioWebhookUrl}</Text>
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

        {authToken ? (
          <View style={styles.section}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
            >
              <View style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={20} color={Colors.dark.error} />
                <Text style={styles.logoutText}>Sign Out</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
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
  profileBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.dark.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  avatarCircleGuest: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.dark.inputBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  profileCompany: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  signInText: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
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
  storageValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.error + '15',
    borderWidth: 1,
    borderColor: Colors.dark.error + '30',
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.error,
  },
});
