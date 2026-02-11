import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Alert,
  Animated as RNAnimated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { AreaSelector } from "@/components/AreaSelector";
import { sendSessionToWebhook } from "@/lib/sync-service";
import type { AreaType, CaptureMode } from "@/lib/types";

const MODE_CONFIG: Record<CaptureMode, { icon: keyof typeof Ionicons.glyphMap; label: string; description: string }> = {
  photo_speak: { icon: "camera-outline", label: "Photo + Speak", description: "Take photo, then record voice note" },
  walkthrough: { icon: "walk-outline", label: "Walkthrough", description: "Continuous audio with rapid captures" },
  voice_only: { icon: "mic-outline", label: "Voice Note", description: "Audio recording only" },
};

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const projects = useAppStore((s) => s.projects);
  const areas = useAppStore((s) => s.areas);
  const addMedia = useAppStore((s) => s.addMedia);
  const addAudioNote = useAppStore((s) => s.addAudioNote);
  const startSession = useAppStore((s) => s.startSession);
  const endSession = useAppStore((s) => s.endSession);
  const addMediaToSession = useAppStore((s) => s.addMediaToSession);
  const addAudioToSession = useAppStore((s) => s.addAudioToSession);

  const [mode, setMode] = useState<CaptureMode>("photo_speak");
  const [selectedArea, setSelectedArea] = useState<AreaType | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);
  const [lastCapturedUri, setLastCapturedUri] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  const project = projects.find((p) => p.id === currentProjectId);
  const projectAreas = areas.filter((a) => a.projectId === currentProjectId);

  const currentArea = projectAreas.find((a) => a.type === selectedArea);

  useEffect(() => {
    if (isRecording) {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed to record voice notes.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Could not start recording");
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const tempUri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (!tempUri) return null;

      const audioDir = `${FileSystem.documentDirectory}audio/`;
      const dirInfo = await FileSystem.getInfoAsync(audioDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
      }
      const filename = `recording_${Date.now()}.m4a`;
      const permanentUri = `${audioDir}${filename}`;
      await FileSystem.copyAsync({ from: tempUri, to: permanentUri });

      return permanentUri;
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setIsRecording(false);
      return null;
    }
  };

  const handleTakePhoto = async () => {
    if (!selectedArea || !currentProjectId) {
      Alert.alert("Select Area", "Please select an area before capturing.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await saveMedia(result.assets[0].uri, "photo");
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      await saveMedia(result.assets[0].uri, "photo");
    }
  };

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    if (!currentProjectId || !currentArea || !selectedArea) throw new Error("Missing context");
    const session = await startSession(currentProjectId, currentArea.id, selectedArea, mode);
    setSessionId(session.id);
    return session.id;
  };

  const saveMedia = async (uri: string, type: "photo" | "video") => {
    if (!selectedArea || !currentProjectId || !currentArea) return;

    const sid = await ensureSession();

    const media = await addMedia({
      projectId: currentProjectId,
      areaId: currentArea.id,
      areaType: selectedArea,
      type,
      uri,
      capturedAt: Date.now(),
      sessionId: sid,
    });

    await addMediaToSession(sid, media.id);

    setCapturedCount((c) => c + 1);
    setLastCapturedUri(uri);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (mode === "photo_speak") {
      Alert.alert("Record Voice Note?", "Would you like to attach a voice note to this photo?", [
        { text: "Skip", style: "cancel" },
        {
          text: "Record",
          onPress: () => startRecording(),
        },
      ]);
    }
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      const uri = await stopRecording();
      if (uri && selectedArea && currentProjectId && currentArea) {
        const sid = await ensureSession();
        const audio = await addAudioNote({
          projectId: currentProjectId,
          areaId: currentArea.id,
          areaType: selectedArea,
          uri,
          durationMs: recordingDuration * 1000,
          capturedAt: Date.now(),
          sessionId: sid,
        });
        await addAudioToSession(sid, audio.id);
        setCapturedCount((c) => c + 1);

        if (mode === "voice_only" && sid) {
          await endSession(sid);
          sendSessionToWebhook(sid).catch(() => {});
          setSessionId(null);
        }
      }
    } else {
      if (!selectedArea) {
        Alert.alert("Select Area", "Please select an area before recording.");
        return;
      }
      await startRecording();
    }
  };

  const handleStartWalkthrough = async () => {
    if (!selectedArea || !currentProjectId || !currentArea) {
      Alert.alert("Select Area", "Please select an area before starting a walkthrough.");
      return;
    }
    const session = await startSession(currentProjectId, currentArea.id, selectedArea, "walkthrough");
    setSessionId(session.id);
    setCapturedCount(0);
    await startRecording();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleEndWalkthrough = async () => {
    const uri = await stopRecording();
    if (uri && selectedArea && currentProjectId && currentArea) {
      const audio = await addAudioNote({
        projectId: currentProjectId,
        areaId: currentArea.id,
        areaType: selectedArea,
        uri,
        durationMs: recordingDuration * 1000,
        capturedAt: Date.now(),
        sessionId: sessionId || undefined,
      });
      if (sessionId) {
        await addAudioToSession(sessionId, audio.id);
      }
    }
    if (sessionId) {
      await endSession(sessionId);
      sendSessionToWebhook(sessionId).catch(() => {});
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '50', Colors.dark.background]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topBar}>
        <Pressable onPress={async () => {
          if (sessionId && !isRecording && mode !== "walkthrough") {
            await endSession(sessionId);
            sendSessionToWebhook(sessionId).catch(() => {});
          }
          router.back();
        }} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.dark.text} />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.projectLabel} numberOfLines={1}>{project?.name || "Select Project"}</Text>
          {capturedCount > 0 && (
            <Text style={styles.captureCount}>{capturedCount} captured</Text>
          )}
        </View>
        {mode === "walkthrough" && sessionId ? (
          <Pressable onPress={handleEndWalkthrough} style={styles.endButton}>
            <Text style={styles.endButtonText}>End</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <View style={styles.areaSection}>
        <Text style={styles.areaLabel}>Area</Text>
        <AreaSelector selectedArea={selectedArea} onSelect={setSelectedArea} />
      </View>

      <View style={styles.modeSelector}>
        {(Object.entries(MODE_CONFIG) as [CaptureMode, typeof MODE_CONFIG[CaptureMode]][]).map(([key, config]) => (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMode(key);
            }}
            style={[styles.modeChip, mode === key && styles.modeChipActive]}
          >
            <Ionicons name={config.icon} size={16} color={mode === key ? "#FFF" : Colors.dark.textMuted} />
            <Text style={[styles.modeLabel, mode === key && styles.modeLabelActive]}>{config.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.captureArea}>
        {isRecording ? (
          <View style={styles.recordingIndicator}>
            <RNAnimated.View style={[styles.recordingPulse, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.recordingDot} />
            </RNAnimated.View>
            <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
            <Text style={styles.recordingLabel}>Recording</Text>
          </View>
        ) : (
          <View style={styles.readyIndicator}>
            <View style={styles.readyIconBg}>
              <Ionicons name={MODE_CONFIG[mode].icon} size={48} color={Colors.dark.accentSoft} />
            </View>
            <Text style={styles.readyLabel}>{MODE_CONFIG[mode].description}</Text>
          </View>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) }]}>
        {mode === "photo_speak" ? (
          <View style={styles.controlRow}>
            <Pressable
              onPress={handleVoiceRecord}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            >
              <Ionicons name={isRecording ? "stop" : "mic"} size={28} color={isRecording ? Colors.dark.error : Colors.dark.accentSoft} />
            </Pressable>

            <Pressable
              onPress={handleTakePhoto}
              style={({ pressed }) => [styles.mainButton, pressed && styles.mainButtonPressed]}
              disabled={isRecording}
            >
              <LinearGradient
                colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mainButtonInner}
              >
                <Ionicons name="camera" size={32} color="#FFF" />
              </LinearGradient>
            </Pressable>

            <View style={{ width: 56 }} />
          </View>
        ) : mode === "walkthrough" ? (
          <View style={styles.controlRow}>
            {sessionId ? (
              <>
                <Pressable
                  onPress={handleTakePhoto}
                  style={({ pressed }) => [styles.mainButton, pressed && styles.mainButtonPressed]}
                >
                  <LinearGradient
                    colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.mainButtonInner}
                  >
                    <Ionicons name="camera" size={32} color="#FFF" />
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleStartWalkthrough}
                style={({ pressed }) => [pressed && styles.buttonPressed]}
              >
                <LinearGradient
                  colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startWalkthroughButton}
                >
                  <Ionicons name="play" size={24} color="#FFF" />
                  <Text style={styles.startWalkthroughText}>Start Walkthrough</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.controlRow}>
            <Pressable
              onPress={handleVoiceRecord}
              style={({ pressed }) => [
                styles.mainButton,
                isRecording && styles.mainButtonRecording,
                pressed && styles.mainButtonPressed,
              ]}
            >
              {isRecording ? (
                <View style={[styles.mainButtonInner, styles.mainButtonInnerRecording]}>
                  <Ionicons name="stop" size={32} color="#FFF" />
                </View>
              ) : (
                <LinearGradient
                  colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mainButtonInner}
                >
                  <Ionicons name="mic" size={32} color="#FFF" />
                </LinearGradient>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  projectLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  captureCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.accentSoft,
  },
  endButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.error,
  },
  endButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  areaSection: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  areaLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  modeSelector: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  modeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  modeChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  modeLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  modeLabelActive: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
  },
  captureArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  recordingIndicator: {
    alignItems: "center",
    gap: 16,
  },
  recordingPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.error + "25",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.error,
  },
  recordingTime: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: 2,
  },
  recordingLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.error,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  readyIndicator: {
    alignItems: "center",
    gap: 16,
  },
  readyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  controls: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  mainButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: Colors.dark.accentLight + '60',
  },
  mainButtonRecording: {
    borderColor: Colors.dark.error + "80",
  },
  mainButtonPressed: {
    transform: [{ scale: 0.92 }],
  },
  mainButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
  },
  mainButtonInnerRecording: {
    backgroundColor: Colors.dark.error,
  },
  secondaryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  startWalkthroughButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 28,
  },
  startWalkthroughText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
});
