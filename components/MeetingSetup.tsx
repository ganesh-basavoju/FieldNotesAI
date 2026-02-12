import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import type {
  MeetingMetadata,
  MeetingType,
  Participant,
  ParticipantRole,
  ConsentMethod,
} from "@/lib/types";

interface MeetingSetupProps {
  visible: boolean;
  onClose: () => void;
  onStart: (metadata: MeetingMetadata) => void;
  projectName: string;
}

const MEETING_TYPES: { value: MeetingType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "scope", label: "Scope", icon: "document-text-outline" },
  { value: "schedule", label: "Schedule", icon: "calendar-outline" },
  { value: "material", label: "Material", icon: "cube-outline" },
  { value: "vendor", label: "Vendor", icon: "business-outline" },
  { value: "internal", label: "Internal", icon: "people-outline" },
];

const PARTICIPANT_ROLES: { value: ParticipantRole; label: string }[] = [
  { value: "pm", label: "PM" },
  { value: "sub", label: "Sub" },
  { value: "owner", label: "Owner" },
  { value: "vendor", label: "Vendor" },
  { value: "internal", label: "Internal" },
];

const CONSENT_METHODS: { value: ConsentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "verbal", label: "Verbal", icon: "mic-outline" },
  { value: "written", label: "Written", icon: "create-outline" },
  { value: "contract", label: "Contract", icon: "document-attach-outline" },
];

export function MeetingSetup({ visible, onClose, onStart, projectName }: MeetingSetupProps) {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [meetingType, setMeetingType] = useState<MeetingType>("scope");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantName, setParticipantName] = useState("");
  const [participantRole, setParticipantRole] = useState<ParticipantRole>("pm");
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentMethod, setConsentMethod] = useState<ConsentMethod>("verbal");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const canStart = consentGiven && participants.length > 0;

  const handleAddParticipant = () => {
    const trimmed = participantName.trim();
    if (!trimmed) return;
    setParticipants((prev) => [...prev, { name: trimmed, role: participantRole }]);
    setParticipantName("");
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    if (!canStart) return;
    onStart({
      meetingType,
      participants,
      consentGiven: true,
      consentMethod,
      consentTimestamp: Date.now(),
    });
    setMeetingType("scope");
    setParticipants([]);
    setParticipantName("");
    setConsentGiven(false);
    setConsentMethod("verbal");
  };

  const handleClose = () => {
    setMeetingType("scope");
    setParticipants([]);
    setParticipantName("");
    setConsentGiven(false);
    setConsentMethod("verbal");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              paddingTop: insets.top + webTopInset + 8,
              paddingBottom: insets.bottom + webBottomInset + 16,
            },
          ]}
        >
          <LinearGradient
            colors={[Colors.dark.gradientStart, Colors.dark.background]}
            locations={[0, 0.5]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.header}>
            <Pressable onPress={handleClose} hitSlop={12} testID="meeting-close-btn">
              <Ionicons name="close" size={28} color={Colors.dark.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Site Meeting</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>{projectName}</Text>
            </View>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Meeting Type</Text>
              <View style={styles.meetingTypeGrid}>
                {MEETING_TYPES.map((mt) => (
                  <Pressable
                    key={mt.value}
                    onPress={() => setMeetingType(mt.value)}
                    style={[
                      styles.meetingTypeChip,
                      meetingType === mt.value && styles.meetingTypeChipActive,
                    ]}
                    testID={`meeting-type-${mt.value}`}
                  >
                    <Ionicons
                      name={mt.icon}
                      size={16}
                      color={meetingType === mt.value ? "#FFF" : Colors.dark.textMuted}
                    />
                    <Text
                      style={[
                        styles.meetingTypeLabel,
                        meetingType === mt.value && styles.meetingTypeLabelActive,
                      ]}
                    >
                      {mt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Participants ({participants.length})</Text>
              <View style={styles.addParticipantRow}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Name"
                  placeholderTextColor={Colors.dark.textMuted}
                  value={participantName}
                  onChangeText={setParticipantName}
                  onSubmitEditing={handleAddParticipant}
                  returnKeyType="done"
                  testID="participant-name-input"
                />
                <Pressable
                  onPress={() => setShowRoleDropdown(!showRoleDropdown)}
                  style={styles.roleSelector}
                  testID="participant-role-selector"
                >
                  <Text style={styles.roleSelectorText}>
                    {PARTICIPANT_ROLES.find((r) => r.value === participantRole)?.label}
                  </Text>
                  <Ionicons
                    name={showRoleDropdown ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={Colors.dark.textMuted}
                  />
                </Pressable>
                <Pressable
                  onPress={handleAddParticipant}
                  style={[
                    styles.addButton,
                    !participantName.trim() && styles.addButtonDisabled,
                  ]}
                  disabled={!participantName.trim()}
                  testID="add-participant-btn"
                >
                  <Ionicons name="add" size={22} color={participantName.trim() ? "#FFF" : Colors.dark.textMuted} />
                </Pressable>
              </View>

              {showRoleDropdown && (
                <View style={styles.roleDropdown}>
                  {PARTICIPANT_ROLES.map((role) => (
                    <Pressable
                      key={role.value}
                      onPress={() => {
                        setParticipantRole(role.value);
                        setShowRoleDropdown(false);
                      }}
                      style={[
                        styles.roleOption,
                        participantRole === role.value && styles.roleOptionActive,
                      ]}
                      testID={`role-option-${role.value}`}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          participantRole === role.value && styles.roleOptionTextActive,
                        ]}
                      >
                        {role.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {participants.length > 0 && (
                <View style={styles.participantList}>
                  {participants.map((p, index) => (
                    <View key={`${p.name}-${index}`} style={styles.participantChip}>
                      <View style={styles.participantInfo}>
                        <Ionicons name="person" size={14} color={Colors.dark.accentLight} />
                        <Text style={styles.participantName}>{p.name}</Text>
                        <View style={styles.participantRoleBadge}>
                          <Text style={styles.participantRoleText}>
                            {PARTICIPANT_ROLES.find((r) => r.value === p.role)?.label}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveParticipant(index)}
                        hitSlop={8}
                        testID={`remove-participant-${index}`}
                      >
                        <Ionicons name="close-circle" size={18} color={Colors.dark.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Consent Method</Text>
              <View style={styles.consentMethodRow}>
                {CONSENT_METHODS.map((cm) => (
                  <Pressable
                    key={cm.value}
                    onPress={() => setConsentMethod(cm.value)}
                    style={[
                      styles.consentMethodChip,
                      consentMethod === cm.value && styles.consentMethodChipActive,
                    ]}
                    testID={`consent-method-${cm.value}`}
                  >
                    <Ionicons
                      name={cm.icon}
                      size={16}
                      color={consentMethod === cm.value ? "#FFF" : Colors.dark.textMuted}
                    />
                    <Text
                      style={[
                        styles.consentMethodLabel,
                        consentMethod === cm.value && styles.consentMethodLabelActive,
                      ]}
                    >
                      {cm.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Pressable
                onPress={() => setConsentGiven(!consentGiven)}
                style={styles.consentRow}
                testID="consent-checkbox"
              >
                <View style={[styles.checkbox, consentGiven && styles.checkboxActive]}>
                  {consentGiven && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.consentText}>
                  I confirm all parties have consented to being recorded
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleStart}
              disabled={!canStart}
              style={({ pressed }) => [pressed && canStart && styles.buttonPressed]}
              testID="start-meeting-btn"
            >
              <LinearGradient
                colors={
                  canStart
                    ? [Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]
                    : [Colors.dark.card, Colors.dark.card]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButton}
              >
                <Ionicons
                  name="play"
                  size={22}
                  color={canStart ? "#FFF" : Colors.dark.textMuted}
                />
                <Text
                  style={[
                    styles.startButtonText,
                    !canStart && styles.startButtonTextDisabled,
                  ]}
                >
                  Start Meeting
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.dark.overlay,
  },
  sheet: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 24,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  meetingTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  meetingTypeChip: {
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
  meetingTypeChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  meetingTypeLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  meetingTypeLabelActive: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
  },
  addParticipantRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.dark.inputBackground,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
  },
  roleSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark.inputBackground,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    borderRadius: 12,
  },
  roleSelectorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    backgroundColor: Colors.dark.card,
  },
  roleDropdown: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    borderRadius: 12,
    overflow: "hidden",
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.glassBorder,
  },
  roleOptionActive: {
    backgroundColor: Colors.dark.accent + "20",
  },
  roleOptionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  roleOptionTextActive: {
    color: Colors.dark.accentLight,
    fontFamily: "Inter_600SemiBold",
  },
  participantList: {
    gap: 8,
  },
  participantChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.glassBg,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  participantRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.dark.accent + "25",
  },
  participantRoleText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.accentLight,
    textTransform: "uppercase" as const,
  },
  consentMethodRow: {
    flexDirection: "row",
    gap: 8,
  },
  consentMethodChip: {
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
  consentMethodChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  consentMethodLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  consentMethodLabelActive: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.glassBg,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  startButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  startButtonTextDisabled: {
    color: Colors.dark.textMuted,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
