import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  Keyboard,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { sendAIQuery, type AIChatMessage, type AIChatMode, type AISource } from "@/lib/ai-service";
import { generateId } from "@/lib/generate-id";

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

  const projects = useAppStore((s) => s.projects);
  const currentUser = useAppStore((s) => s.currentUser);

  const [mode, setMode] = useState<AIChatMode>("portfolio");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Track keyboard visibility for Android
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedJobId),
    [projects, selectedJobId]
  );

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    if (mode === "job" && !selectedJobId) {
      const sysMsg: AIChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "Please select a job first to ask questions about it.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, sysMsg]);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText("");

    const userMsg: AIChatMessage = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await sendAIQuery(text, mode, selectedJobId || undefined, messages);

      const aiMsg: AIChatMessage = {
        id: generateId(),
        role: "assistant",
        content: result.answer,
        timestamp: Date.now(),
        sources: result.sources.length > 0 ? result.sources : undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: AIChatMessage = {
        id: generateId(),
        role: "assistant",
        content: `⚠️ ${err.message || "Failed to get a response. Please try again."}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [inputText, loading, mode, selectedJobId, messages]);

  const handleModeSwitch = (newMode: AIChatMode) => {
    if (newMode === mode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode(newMode);
    setMessages([]);
    if (newMode === "portfolio") setSelectedJobId(null);
  };

  const clearChat = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setMessages([]);
  };

  const renderMessage = ({ item }: { item: AIChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={Colors.dark.accentSoft} />
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.msgText, isUser && styles.userMsgText]}>{item.content}</Text>
          {item.sources && item.sources.length > 0 && (
            <View style={styles.sourcesContainer}>
              <Text style={styles.sourcesLabel}>📎 Sources</Text>
              {item.sources.map((s, i) => (
                <View key={i} style={styles.sourceItem}>
                  <Text style={styles.sourceProject}>{s.projectName || s.jobId}</Text>
                  <Text style={styles.sourceExcerpt} numberOfLines={2}>{s.excerpt}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.gradientStart, Colors.dark.gradientMid + "30", Colors.dark.background]}
        locations={[0, 0.2, 0.5]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header — matches Tasks/Projects style */}
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          {messages.length > 0 && (
            <Pressable onPress={clearChat} style={styles.clearBtn} hitSlop={12}>
              <Ionicons name="trash-outline" size={18} color={Colors.dark.textMuted} />
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => handleModeSwitch("job")}
            style={[styles.modeBtn, mode === "job" && styles.modeBtnActive]}
          >
            <Ionicons name="briefcase-outline" size={16} color={mode === "job" ? "#FFF" : Colors.dark.textMuted} />
            <Text style={[styles.modeBtnText, mode === "job" && styles.modeBtnTextActive]}>Job Chat</Text>
          </Pressable>
          <Pressable
            onPress={() => handleModeSwitch("portfolio")}
            style={[styles.modeBtn, mode === "portfolio" && styles.modeBtnActive]}
          >
            <Ionicons name="folder-outline" size={16} color={mode === "portfolio" ? "#FFF" : Colors.dark.textMuted} />
            <Text style={[styles.modeBtnText, mode === "portfolio" && styles.modeBtnTextActive]}>Portfolio Chat</Text>
          </Pressable>
        </View>

        {/* Job Selector (only for Job mode) */}
        {mode === "job" && (
          <Pressable style={styles.jobSelector} onPress={() => setShowJobPicker(true)}>
            <Ionicons name="business-outline" size={16} color={Colors.dark.accentSoft} />
            <Text style={styles.jobSelectorText} numberOfLines={1}>
              {selectedProject ? `${selectedProject.name} (${selectedProject.jobId})` : "Select a job..."}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.dark.textMuted} />
          </Pressable>
        )}

        {/* Mode Description */}
        <Text style={styles.modeDesc}>
          {mode === "job"
            ? "🔎 Ask questions about a specific job's records, tasks, and transcripts."
            : "📂 Query across all your jobs to find patterns, overdue items, and insights."}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messageList, messages.length === 0 && styles.emptyList]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="sparkles" size={32} color={Colors.dark.accentSoft} />
            </View>
            <Text style={styles.emptyTitle}>
              {mode === "job" ? "Job-Level AI" : "Portfolio AI"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {mode === "job"
                ? 'Ask about a specific job:\n"What action items are unresolved?"\n"When did we approve the flooring change?"'
                : 'Ask across all jobs:\n"Which jobs have overdue action items?"\n"Where are scope changes increasing?"'}
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {/* Loading indicator */}
      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={Colors.dark.accentSoft} />
          </View>
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={Colors.dark.accentSoft} />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        </View>
      )}

      {/* Input Area — positioned above tab bar / keyboard */}
      <View style={[styles.inputArea, { marginBottom: keyboardHeight > 0 ? (keyboardHeight + 20) : (Math.max(insets.bottom, 8) + TAB_BAR_HEIGHT) }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={mode === "job" ? "Ask about this job..." : "Ask across your portfolio..."}
            placeholderTextColor={Colors.dark.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!loading}
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
            style={({ pressed }) => [
              styles.sendBtn,
              (!inputText.trim() || loading) && styles.sendBtnDisabled,
              pressed && { opacity: 0.7 },
            ]}
          >
            <LinearGradient
              colors={
                inputText.trim() && !loading
                  ? [Colors.dark.accentGradientStart, Colors.dark.accentGradientEnd]
                  : [Colors.dark.card, Colors.dark.card]
              }
              style={styles.sendBtnGradient}
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() && !loading ? "#FFF" : Colors.dark.textMuted}
              />
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* Job Picker Modal */}
      <Modal
        visible={showJobPicker}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowJobPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowJobPicker(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Job</Text>
            <FlatList
              data={projects}
              keyExtractor={(p) => p.id}
              style={{ maxHeight: 400 }}
              renderItem={({ item: p }) => (
                <Pressable
                  onPress={() => {
                    setSelectedJobId(p.id);
                    setShowJobPicker(false);
                    setMessages([]);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[styles.jobOption, selectedJobId === p.id && styles.jobOptionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobOptionName}>{p.name}</Text>
                    <Text style={styles.jobOptionId}>Job: {p.jobId}</Text>
                  </View>
                  {selectedJobId === p.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.dark.accentSoft} />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.noJobs}>No projects found. Create a project first.</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },

  // Header — matches Dashboard style
  header: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.glassBorder,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.accentSoft,
    letterSpacing: -0.5,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },

  // Mode Toggle
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: Colors.dark.accent,
  },
  modeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textMuted,
  },
  modeBtnTextActive: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
  },

  // Job Selector
  jobSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  jobSelectorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },

  modeDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    lineHeight: 17,
  },

  // Messages
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
    gap: 8,
  },
  msgRowUser: {
    justifyContent: "flex-end",
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.accent + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  msgBubble: {
    maxWidth: "78%",
    borderRadius: 18,
    padding: 14,
    paddingHorizontal: 16,
  },
  userBubble: {
    backgroundColor: Colors.dark.accent,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: Colors.dark.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  msgText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    lineHeight: 20,
  },
  userMsgText: {
    color: "#FFF",
  },

  // Sources
  sourcesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.glassBorder,
    gap: 6,
  },
  sourcesLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.accentSoft,
  },
  sourceItem: {
    backgroundColor: Colors.dark.background + "60",
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  sourceProject: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.accentSoft,
  },
  sourceExcerpt: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    lineHeight: 15,
  },

  // Typing
  typingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 18,
    padding: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  typingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },

  // Input — positioned above the absolute tab bar
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.glassBorder,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  sendBtn: {
    borderRadius: 20,
    overflow: "hidden",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.dark.accent + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
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
    elevation: 50,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    marginBottom: 12,
  },
  jobOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  jobOptionActive: {
    backgroundColor: Colors.dark.accent + "20",
  },
  jobOptionName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  jobOptionId: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  noJobs: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
    textAlign: "center",
    paddingVertical: 20,
  },
});
