import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { TaskItem, TaskStatus, TaskPriority } from '@/lib/types';

const STATUS_ICONS: Record<TaskStatus, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  open: { icon: 'radio-button-off', color: Colors.dark.textMuted },
  in_progress: { icon: 'time-outline', color: Colors.dark.info },
  blocked: { icon: 'ban-outline', color: Colors.dark.error },
  done: { icon: 'checkmark-circle', color: Colors.dark.success },
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: Colors.dark.textMuted,
  medium: Colors.dark.warning,
  high: Colors.dark.error,
};

interface TaskCardProps {
  task: TaskItem;
  onPress: () => void;
  onStatusToggle?: () => void;
  evidenceCount?: number;
}

export function TaskCard({ task, onPress, onStatusToggle, evidenceCount }: TaskCardProps) {
  const safeStatus = (task.status || "open").toLowerCase() as any;
  const safePriority = (task.priority || "medium").toLowerCase() as any;
  const statusConfig = STATUS_ICONS[safeStatus as keyof typeof STATUS_ICONS] || STATUS_ICONS.open;
  const priorityColor = PRIORITY_COLORS[safePriority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.medium;

  const handleStatusPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStatusToggle?.();
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Pressable onPress={handleStatusPress} style={styles.statusButton} hitSlop={8}>
        <Ionicons name={statusConfig.icon} size={22} color={statusConfig.color} />
      </Pressable>

      <View style={styles.content}>
        <Text style={[styles.title, task.status === 'done' && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.description ? (
          <Text style={styles.description} numberOfLines={1}>{task.description}</Text>
        ) : null}

        <View style={styles.meta}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={styles.metaText}>
            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
          </Text>

          {task.areaType ? (
            <>
              <View style={styles.metaDivider} />
              <Text style={styles.metaText}>{task.areaType.replace('_', ' ')}</Text>
            </>
          ) : null}

          {task.tags.length > 0 ? (
            <>
              <View style={styles.metaDivider} />
              <Text style={styles.tagText}>{task.tags[0]}</Text>
            </>
          ) : null}

          {(evidenceCount ?? 0) > 0 ? (
            <View style={styles.evidenceChip}>
              <Ionicons name="link-outline" size={11} color={Colors.dark.accentSoft} />
              <Text style={styles.evidenceText}>{evidenceCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {task.confidence != null ? (
        <ConfidenceBadge score={task.confidence} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  statusButton: {
    paddingTop: 2,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.dark.text,
    lineHeight: 20,
  },
  titleDone: {
    textDecorationLine: 'line-through' as const,
    color: Colors.dark.textMuted,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.dark.textMuted,
    textTransform: 'capitalize' as const,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.dark.textMuted,
    opacity: 0.5,
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.dark.accentSoft,
  },
  evidenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.dark.accent + '20',
  },
  evidenceText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.dark.accentSoft,
  },
});
