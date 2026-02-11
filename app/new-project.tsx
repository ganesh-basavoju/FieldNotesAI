import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";

export default function NewProjectScreen() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const addProject = useAppStore((s) => s.addProject);

  const isValid = name.trim().length > 0 && address.trim().length > 0;

  const handleCreate = async () => {
    if (!isValid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addProject(name.trim(), address.trim(), clientName.trim() || "No Client");
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>New Project</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Project Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Smith Residence Renovation"
            placeholderTextColor={Colors.dark.textMuted}
            autoFocus
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. 123 Main St, City, State"
            placeholderTextColor={Colors.dark.textMuted}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Client Name</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Optional"
            placeholderTextColor={Colors.dark.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>

        <Pressable
          onPress={handleCreate}
          disabled={!isValid}
          style={({ pressed }) => [
            !isValid && styles.createButtonDisabled,
            pressed && isValid && styles.createButtonPressed,
          ]}
        >
          {isValid ? (
            <LinearGradient
              colors={[Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButton}
            >
              <Ionicons name="add-circle" size={20} color="#FFF" />
              <Text style={styles.createButtonText}>Create Project</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.createButton, styles.createButtonDisabled]}>
              <Ionicons name="add-circle" size={20} color={Colors.dark.textMuted} />
              <Text style={[styles.createButtonText, styles.createButtonTextDisabled]}>Create Project</Text>
            </View>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.lavender,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  createButtonDisabled: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  createButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  createButtonTextDisabled: {
    color: Colors.dark.textMuted,
  },
});
