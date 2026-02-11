import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface ConfidenceBadgeProps {
  score: number;
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);
  const color =
    percentage >= 80 ? Colors.dark.success :
    percentage >= 50 ? Colors.dark.warning :
    Colors.dark.error;

  return (
    <View style={[styles.badge, { borderColor: color + '40', backgroundColor: color + '10' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{percentage}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
