import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { Project, WebhookStatus } from '@/lib/types';

const MODE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  photo_speak: 'camera-outline',
  walkthrough: 'walk-outline',
  voice_only: 'mic-outline',
};

const MODE_LABELS: Record<string, string> = {
  photo_speak: 'Photo + Voice',
  walkthrough: 'Walkthrough',
  voice_only: 'Voice Note',
};

const STATUS_CONFIG: Record<WebhookStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Pending', color: Colors.dark.warning, icon: 'time-outline' },
  sent: { label: 'Processing', color: Colors.dark.info, icon: 'hourglass-outline' },
  received: { label: 'Completed', color: Colors.dark.success, icon: 'checkmark-circle' },
  failed: { label: 'Failed', color: Colors.dark.error, icon: 'close-circle' },
};

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const timeAgo = getTimeAgo(project.updatedAt);
  const status = STATUS_CONFIG[project.webhookStatus] || STATUS_CONFIG.pending;
  const modeIcon = MODE_ICONS[project.mode] || 'document-outline';
  const modeLabel = MODE_LABELS[project.mode] || project.mode;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <LinearGradient
        colors={[Colors.dark.card, 'rgba(138, 92, 246, 0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={[Colors.dark.accentGradientStart + '30', Colors.dark.accentGradientEnd + '30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <Ionicons name={modeIcon} size={20} color={Colors.dark.accentSoft} />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
            <Text style={styles.jobId} numberOfLines={1}>Job: {project.jobId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name={modeIcon} size={13} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{modeLabel}</Text>
          </View>
          {project.participants && project.participants.length > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>{project.participants.length}</Text>
            </View>
          )}
          {project.scopes && project.scopes.length > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="layers-outline" size={13} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>{project.scopes.length} scope{project.scopes.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="camera-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.statValue}>{project.mediaCount}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="checkbox-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.statValue}>{project.taskCount}</Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 16,
    gap: 10,
    borderRadius: 17,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.dark.text,
  },
  jobId: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 54,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.dark.textMuted,
    textTransform: 'capitalize' as const,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 54,
    paddingTop: 4,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.dark.textMuted,
  },
  timeAgo: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.dark.textMuted,
    marginLeft: 'auto',
  },
});
