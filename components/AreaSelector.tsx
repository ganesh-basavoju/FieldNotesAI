import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import type { AreaType } from '@/lib/types';

const AREA_CONFIG: Record<AreaType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  kitchen: { icon: 'restaurant-outline', label: 'Kitchen' },
  bath: { icon: 'water-outline', label: 'Bath' },
  roof: { icon: 'home-outline', label: 'Roof' },
  exterior: { icon: 'sunny-outline', label: 'Exterior' },
  garage: { icon: 'car-outline', label: 'Garage' },
  basement: { icon: 'layers-outline', label: 'Basement' },
  bedroom: { icon: 'bed-outline', label: 'Bedroom' },
  living_room: { icon: 'tv-outline', label: 'Living' },
  other: { icon: 'ellipsis-horizontal-circle-outline', label: 'Other' },
};

interface AreaSelectorProps {
  selectedArea: AreaType | null;
  onSelect: (area: AreaType) => void;
  compact?: boolean;
}

export function AreaSelector({ selectedArea, onSelect, compact }: AreaSelectorProps) {
  const areas: AreaType[] = ['kitchen', 'bath', 'roof', 'exterior', 'garage', 'basement', 'bedroom', 'living_room', 'other'];

  const handleSelect = (area: AreaType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(area);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {areas.map((area) => {
        const config = AREA_CONFIG[area];
        const isSelected = selectedArea === area;
        return (
          <Pressable
            key={area}
            onPress={() => handleSelect(area)}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              compact && styles.chipCompact,
            ]}
          >
            <Ionicons
              name={config.icon}
              size={compact ? 14 : 18}
              color={isSelected ? '#FFFFFF' : Colors.dark.textSecondary}
            />
            <Text
              style={[
                styles.label,
                isSelected && styles.labelSelected,
                compact && styles.labelCompact,
              ]}
            >
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  chipSelected: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accentLight,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.dark.textSecondary,
  },
  labelSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  labelCompact: {
    fontSize: 12,
  },
});
