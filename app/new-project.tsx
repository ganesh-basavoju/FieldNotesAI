import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { SessionStorage } from "@/lib/storage";
import { uploadAudioFile, uploadTranscriptFile } from "@/lib/uploader";
import type { CaptureMode, ConsentMethod, Participant } from "@/lib/types";

const MODES: { value: CaptureMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "photo_speak", label: "Photo + Voice Note", icon: "camera-outline" },
  { value: "walkthrough", label: "Walkthrough", icon: "walk-outline" },
  { value: "voice_only", label: "Voice Note", icon: "mic-outline" },
  { value: "upload_audio", label: "Upload Audio File", icon: "cloud-upload-outline" },
  { value: "upload_transcript", label: "Upload Transcript", icon: "document-text-outline" },
];

const DEFAULT_SCOPES = ["scope", "schedule", "material", "vendor", "internal"];
const SCOPE_LABELS: Record<string, string> = {
  scope: "Scope",
  schedule: "Schedule",
  material: "Material",
  vendor: "Vendor",
  internal: "Internal",
};

const CONSENT_METHODS: { value: ConsentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "verbal", label: "Verbal", icon: "mic-outline" },
  { value: "written", label: "Written", icon: "create-outline" },
  { value: "contract", label: "Contract", icon: "document-attach-outline" },
];

export default function NewProjectScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const addProject = useAppStore((s) => s.addProject);
  const startSession = useAppStore((s) => s.startSession);
  const authToken = useAppStore((s) => s.authToken);

  const [name, setName] = useState("");
  const [jobId, setJobId] = useState("");
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [customScopes, setCustomScopes] = useState<string[]>([]);
  const [newScopeName, setNewScopeName] = useState("");
  const [showAddScope, setShowAddScope] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([
    { name: "", role: "PM" },
  ]);
  const [consentMethod, setConsentMethod] = useState<ConsentMethod | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string } | null>(null);

  const allScopes = [...DEFAULT_SCOPES, ...customScopes];
  const isUploadMode = mode === "upload_audio" || mode === "upload_transcript";

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const addCustomScope = () => {
    const trimmed = newScopeName.trim();
    if (trimmed && !allScopes.includes(trimmed.toLowerCase())) {
      const key = trimmed.toLowerCase().replace(/\s+/g, '_');
      setCustomScopes((prev) => [...prev, key]);
      SCOPE_LABELS[key] = trimmed;
      setSelectedScopes((prev) => [...prev, key]);
      setNewScopeName("");
      setShowAddScope(false);
    }
  };

  const addParticipant = () => {
    setParticipants((prev) => [...prev, { name: "", role: "" }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof Participant, value: string) => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const pickFile = async () => {
    try {
      const mimeTypes =
        mode === "upload_audio"
          ? ["audio/*"]
          : [
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "text/plain",
            ];

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({ uri: asset.uri, name: asset.name });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn("File picker error:", err);
    }
  };

  const validParticipants = participants.filter((p) => p.name.trim().length > 0);
  const isValid =
    name.trim().length > 0 &&
    jobId.trim().length > 0 &&
    mode !== null &&
    selectedScopes.length > 0 &&
    validParticipants.length > 0 &&
    consentMethod !== null &&
    consentChecked &&
    (!isUploadMode || selectedFile !== null);

  const handleStart = async () => {
    if (!isValid || !mode || !consentMethod) return;

    if (!authToken) {
      Alert.alert("Sign In Required", "Please sign in to continue.", [
        { text: "OK", onPress: () => router.push("/(tabs)/settings") },
      ]);
      return;
    }

    setLoading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const project = await addProject({
        name: name.trim(),
        jobId: jobId.trim(),
        mode,
        scopes: selectedScopes,
        participants: validParticipants,
        consentMethod,
      });

      const projectAreas = useAppStore.getState().areas.filter((a) => a.projectId === project.id);
      const area = projectAreas[0];

      if (!area) {
        Alert.alert("Error", "Could not create project area");
        setLoading(false);
        return;
      }

      const areaType = area.type;
      const meetingMetadata = {
        meetingType: selectedScopes[0] as any,
        participants: validParticipants,
        consentGiven: true,
        consentMethod,
        consentTimestamp: Date.now(),
      };

      const session = await startSession(
        project.id,
        area.id,
        areaType,
        mode,
        "meeting",
        meetingMetadata
      );

      useAppStore.getState().setCurrentProject(project.id);

      if (isUploadMode && selectedFile) {
        // Copy file to local storage so it persists for retries
        const ext = selectedFile.name.split('.').pop() || 'pdf';
        const localUri = `${FileSystem.documentDirectory}uploads/${session.id}.${ext}`;
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}uploads/`, { intermediates: true }).catch(() => {});
        await FileSystem.copyAsync({ from: selectedFile.uri, to: localUri });

        // Save the local file URI on the session for retries
        await SessionStorage.update(session.id, { uploadedFileUri: localUri });
        const store = useAppStore.getState();
        store.sessions = store.sessions.map((s) =>
          s.id === session.id ? { ...s, uploadedFileUri: localUri } : s
        );
        useAppStore.setState({ sessions: [...store.sessions] });

        // Upload using the local copy
        const uploadFn = mode === "upload_audio" ? uploadAudioFile : uploadTranscriptFile;
        const success = await uploadFn(session.id, localUri);

        // End session
        await useAppStore.getState().endSession(session.id);

        if (success) {
          router.replace({
            pathname: "/project/[id]",
            params: { id: project.id },
          });
        } else {
          Alert.alert("Upload Failed", "The file could not be processed. You can retry from the project detail page.");
          router.replace({
            pathname: "/project/[id]",
            params: { id: project.id },
          });
        }
      } else {
        // For live capture modes, navigate to capture screen
        router.replace({
          pathname: "/capture",
          params: { sessionId: session.id, mode },
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create project");
      setLoading(false);
    }
  };

  const selectedMode = MODES.find((m) => m.value === mode);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + '40', Colors.dark.background]}
        locations={[0, 0.25, 0.6]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.topTitle}>New Project</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Smith Residence Renovation"
            placeholderTextColor={Colors.dark.textMuted}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Job ID *</Text>
          <TextInput
            style={styles.input}
            value={jobId}
            onChangeText={setJobId}
            placeholder="e.g. JOB-2026-001"
            placeholderTextColor={Colors.dark.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Select Mode *</Text>
          <Pressable
            onPress={() => setShowModeDropdown(true)}
            style={styles.dropdownTrigger}
          >
            {selectedMode ? (
              <View style={styles.dropdownSelected}>
                <Ionicons name={selectedMode.icon} size={18} color={Colors.dark.accentSoft} />
                <Text style={styles.dropdownSelectedText}>{selectedMode.label}</Text>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Choose capture mode</Text>
            )}
            <Ionicons name="chevron-down" size={18} color={Colors.dark.textMuted} />
          </Pressable>
          <Modal
            visible={showModeDropdown}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setShowModeDropdown(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setShowModeDropdown(false)}>
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.modalTitle}>Select Mode</Text>
                {MODES.map((m) => (
                  <Pressable
                    key={m.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMode(m.value);
                      setSelectedFile(null);
                      setShowModeDropdown(false);
                    }}
                    style={[styles.modalOption, mode === m.value && styles.modalOptionActive]}
                  >
                    <Ionicons
                      name={m.icon}
                      size={20}
                      color={mode === m.value ? Colors.dark.accentSoft : Colors.dark.textMuted}
                    />
                    <Text style={[styles.modalOptionText, mode === m.value && styles.modalOptionTextActive]}>
                      {m.label}
                    </Text>
                    {mode === m.value ? (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.dark.accentSoft} />
                    ) : null}
                  </Pressable>
                ))}
              </Pressable>
            </Pressable>
          </Modal>
        </View>

        {isUploadMode ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {mode === "upload_audio" ? "Select Audio File *" : "Select Transcript File *"}
            </Text>
            <Text style={styles.hint}>
              {mode === "upload_audio"
                ? "Supported: MP3, WAV, M4A, AAC, OGG"
                : "Supported: PDF, DOC, DOCX, TXT"}
            </Text>
            <Pressable onPress={pickFile} style={styles.filePickerBtn}>
              <Ionicons
                name={selectedFile ? "document-attach" : "cloud-upload-outline"}
                size={24}
                color={selectedFile ? Colors.dark.success : Colors.dark.accentSoft}
              />
              <View style={{ flex: 1 }}>
                {selectedFile ? (
                  <Text style={styles.filePickerName} numberOfLines={1}>{selectedFile.name}</Text>
                ) : (
                  <Text style={styles.filePickerPlaceholder}>Tap to select file</Text>
                )}
              </View>
              {selectedFile ? (
                <Pressable
                  onPress={() => setSelectedFile(null)}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.dark.error} />
                </Pressable>
              ) : null}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Area / Location (Meeting Scope) *</Text>
          <Text style={styles.hint}>Select one or more</Text>
          <View style={styles.chipRow}>
            {allScopes.map((scope) => (
              <Pressable
                key={scope}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleScope(scope);
                }}
                style={[styles.chip, selectedScopes.includes(scope) && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, selectedScopes.includes(scope) && styles.chipTextActive]}
                >
                  {SCOPE_LABELS[scope] || scope}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowAddScope(!showAddScope)}
              style={[styles.chip, styles.chipAdd]}
            >
              <Ionicons name="add" size={16} color={Colors.dark.accentSoft} />
              <Text style={styles.chipAddText}>Add New</Text>
            </Pressable>
          </View>
          {showAddScope ? (
            <View style={styles.addScopeRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newScopeName}
                onChangeText={setNewScopeName}
                placeholder="Custom scope name"
                placeholderTextColor={Colors.dark.textMuted}
                onSubmitEditing={addCustomScope}
              />
              <Pressable onPress={addCustomScope} style={styles.addScopeBtn}>
                <Ionicons name="checkmark" size={20} color={Colors.dark.success} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.field}>
          <View style={styles.participantsHeader}>
            <Text style={styles.label}>Participants *</Text>
            <Pressable onPress={addParticipant} hitSlop={8} style={styles.addParticipantBtn}>
              <Ionicons name="add-circle" size={24} color={Colors.dark.accentSoft} />
            </Pressable>
          </View>
          {participants.map((p, i) => (
            <View key={i} style={styles.participantRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={p.name}
                onChangeText={(v) => updateParticipant(i, "name", v)}
                placeholder="Name"
                placeholderTextColor={Colors.dark.textMuted}
              />
              <TextInput
                style={[styles.input, styles.roleInput]}
                value={p.role}
                onChangeText={(v) => updateParticipant(i, "role", v)}
                placeholder="Role"
                placeholderTextColor={Colors.dark.textMuted}
              />
              {participants.length > 1 ? (
                <Pressable onPress={() => removeParticipant(i)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={Colors.dark.error} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Consent Method *</Text>
          <View style={styles.chipRow}>
            {CONSENT_METHODS.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setConsentMethod(c.value);
                }}
                style={[styles.chip, consentMethod === c.value && styles.chipActive]}
              >
                <Ionicons
                  name={c.icon}
                  size={16}
                  color={consentMethod === c.value ? "#FFF" : Colors.dark.textMuted}
                />
                <Text style={[styles.chipText, consentMethod === c.value && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setConsentChecked(!consentChecked);
          }}
          style={styles.consentRow}
        >
          <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
            {consentChecked ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
          </View>
          <Text style={styles.consentText}>
            I confirm consent has been obtained from all participants
          </Text>
        </Pressable>

        <Pressable
          onPress={handleStart}
          disabled={!isValid || loading}
          style={({ pressed }) => [pressed && isValid && styles.startBtnPressed]}
        >
          {isValid ? (
            <LinearGradient
              colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name={isUploadMode ? "cloud-upload" : "play"} size={22} color="#FFF" />
              )}
              <Text style={styles.startBtnText}>
                {loading ? (isUploadMode ? "Uploading..." : "Creating...") : (isUploadMode ? "Upload & Process" : "Start")}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[styles.startBtn, styles.startBtnDisabled]}>
              <Ionicons name={isUploadMode ? "cloud-upload-outline" : "play"} size={22} color={Colors.dark.textMuted} />
              <Text style={[styles.startBtnText, styles.startBtnTextDisabled]}>
                {isUploadMode ? "Upload & Process" : "Start"}
              </Text>
            </View>
          )}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    marginTop: -4,
  },
  input: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  dropdownSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownSelectedText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    zIndex: 9999,
    elevation: 50,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: Colors.dark.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    gap: 4,
    elevation: 50,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  modalOptionActive: {
    backgroundColor: Colors.dark.accent + '20',
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  modalOptionTextActive: {
    color: Colors.dark.accentSoft,
    fontFamily: "Inter_600SemiBold",
  },
  filePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.glassBorder,
    borderStyle: "dashed" as const,
  },
  filePickerName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  filePickerPlaceholder: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  chipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  chipTextActive: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
  },
  chipAdd: {
    borderStyle: "dashed" as const,
    borderColor: Colors.dark.accentSoft + '50',
  },
  chipAddText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.accentSoft,
  },
  addScopeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  addScopeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  participantsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addParticipantBtn: {
    padding: 2,
  },
  participantRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  roleInput: {
    width: 90,
    flex: 0,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 8,
  },
  startBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  startBtnDisabled: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  startBtnText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  startBtnTextDisabled: {
    color: Colors.dark.textMuted,
  },
});
