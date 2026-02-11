import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import type { SyncStatus } from '@/lib/types';

const STATUS_CONFIG: Record<SyncStatus, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  captured: { icon: 'checkmark-circle', color: Colors.dark.statusCaptured, label: 'Captured' },
  syncing: { icon: 'sync-circle', color: Colors.dark.statusSyncing, label: 'Syncing' },
  uploaded: { icon: 'cloud-done', color: Colors.dark.statusUploaded, label: 'Uploaded' },
  failed: { icon: 'warning', color: Colors.dark.statusFailed, label: 'Failed' },
};

interface StatusBadgeProps {
  status: SyncStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.color + '18' }]}>
      <Ionicons name={config.icon} size={compact ? 12 : 14} color={config.color} />
      {!compact && <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
});
