import React, { useState, useRef, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { sendSessionToWebhook } from "@/lib/sync-service";
import type { CaptureMode } from "@/lib/types";

const MODE_CONFIG: Record<CaptureMode, { icon: keyof typeof Ionicons.glyphMap; label: string; description: string }> = {
  photo_speak: { icon: "camera-outline", label: "Photo + Speak", description: "Take photo, then automatically record voice note" },
  walkthrough: { icon: "walk-outline", label: "Walkthrough", description: "Continuous audio with rapid captures" },
  voice_only: { icon: "mic-outline", label: "Voice Note", description: "Audio recording only" },
  upload_audio: { icon: "cloud-upload-outline", label: "Upload Audio", description: "Upload a pre-recorded audio file" },
  upload_transcript: { icon: "document-text-outline", label: "Upload Transcript", description: "Upload a transcript document" },
};

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  
  const { sessionId: paramSessionId, mode: paramMode } = useLocalSearchParams<{ sessionId: string, mode: CaptureMode }>();
  
  const projects = useAppStore((s) => s.projects);
  const sessions = useAppStore((s) => s.sessions);
  const addMedia = useAppStore((s) => s.addMedia);
  const addAudioNote = useAppStore((s) => s.addAudioNote);
  const endSession = useAppStore((s) => s.endSession);
  const addMediaToSession = useAppStore((s) => s.addMediaToSession);
  const addAudioToSession = useAppStore((s) => s.addAudioToSession);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [capturedCount, setCapturedCount] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  const session = sessions.find(s => s.id === paramSessionId);
  const project = projects.find(p => p.id === session?.projectId);
  const mode = paramMode || session?.mode || "photo_speak";

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
    if (!session) return;

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

  const saveMedia = async (uri: string, type: "photo" | "video") => {
    if (!session) return;
    const media = await addMedia({
      projectId: session.projectId,
      areaId: session.areaId,
      areaType: session.areaType,
      type,
      uri,
      capturedAt: Date.now(),
      sessionId: session.id,
    });
    await addMediaToSession(session.id, media.id);
    setCapturedCount((c) => c + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (mode === "photo_speak") {
      if (!isRecording) {
        await startRecording();
      }
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    const uri = await stopRecording();
    if (uri) {
      const audio = await addAudioNote({
        projectId: session.projectId,
        areaId: session.areaId,
        areaType: session.areaType,
        uri,
        durationMs: recordingDuration * 1000,
        capturedAt: Date.now(),
        sessionId: session.id,
      });
      await addAudioToSession(session.id, audio.id);
    }
    
    await endSession(session.id);
    sendSessionToWebhook(session.id).catch(() => {});
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({ pathname: "/project/[id]", params: { id: session.projectId } });
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
        <View style={{ width: 44 }} />
        <View style={styles.topCenter}>
          <Text style={styles.projectLabel} numberOfLines={1}>{project?.name || "Capture"}</Text>
          {capturedCount > 0 ? (
            <Text style={styles.captureCount}>{capturedCount} captured</Text>
          ) : null}
        </View>
        <Pressable onPress={handleEndSession} style={styles.endButton}>
          <Text style={styles.endButtonText}>End</Text>
        </Pressable>
      </View>

      <View style={styles.captureArea}>
        {isRecording ? (
          <View style={styles.recordingIndicator}>
            <RNAnimated.View style={[styles.recordingPulse, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.recordingDot} />
            </RNAnimated.View>
            <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
            <Text style={styles.recordingLabel}>Recording Note...</Text>
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

      <View style={[styles.controls, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40) }]}>
        {mode === "photo_speak" ? (
          <View style={styles.controlRow}>
            <Pressable
              onPress={handleTakePhoto}
              style={({ pressed }) => [styles.mainButton, pressed && styles.mainButtonPressed]}
              disabled={isRecording}
            >
              <LinearGradient
                colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.mainButtonInner, isRecording && { opacity: 0.5 }]}
              >
                <Ionicons name="camera" size={32} color="#FFF" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : mode === "walkthrough" ? (
          <View style={styles.controlRow}>
            {isRecording ? (
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
            ) : (
              <Pressable
                onPress={startRecording}
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
            {!isRecording && (
              <Pressable
                onPress={startRecording}
                style={({ pressed }) => [
                  styles.mainButton,
                  pressed && styles.mainButtonPressed,
                ]}
              >
                <LinearGradient
                  colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mainButtonInner}
                >
                  <Ionicons name="mic" size={32} color="#FFF" />
                </LinearGradient>
              </Pressable>
            )}
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark.error,
  },
  endButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
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
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: Colors.dark.accentLight + '60',
  },
  mainButtonPressed: {
    transform: [{ scale: 0.92 }],
  },
  mainButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
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
