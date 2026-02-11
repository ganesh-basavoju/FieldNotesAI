import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { StatusBadge } from './StatusBadge';
import type { MediaAsset } from '@/lib/types';

interface MediaThumbnailProps {
  media: MediaAsset;
  size?: number;
  onPress?: () => void;
  showStatus?: boolean;
}

export function MediaThumbnail({ media, size = 80, onPress, showStatus }: MediaThumbnailProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size },
        pressed && onPress && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: media.uri }}
        style={[styles.image, { width: size, height: size }]}
        contentFit="cover"
        transition={200}
      />
      {media.type === 'video' ? (
        <View style={styles.videoOverlay}>
          <Ionicons name="play-circle" size={24} color="rgba(255,255,255,0.9)" />
        </View>
      ) : null}
      {showStatus ? (
        <View style={styles.statusContainer}>
          <StatusBadge status={media.syncStatus} compact />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  image: {
    borderRadius: 12,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,8,22,0.4)',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
});
