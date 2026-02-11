import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const timeAgo = getTimeAgo(project.updatedAt);

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
            <Ionicons name="business" size={20} color={Colors.dark.accentSoft} />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
            <Text style={styles.client} numberOfLines={1}>{project.clientName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
        </View>

        <Text style={styles.address} numberOfLines={1}>{project.address}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="camera-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.statValue}>{project.mediaCount}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="checkbox-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.statValue}>{project.taskCount}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="alert-circle-outline" size={14} color={project.openTaskCount > 0 ? Colors.dark.warning : Colors.dark.textMuted} />
            <Text style={[styles.statValue, project.openTaskCount > 0 && { color: Colors.dark.warning }]}>
              {project.openTaskCount} open
            </Text>
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
  client: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  address: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.dark.textMuted,
    paddingLeft: 54,
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
