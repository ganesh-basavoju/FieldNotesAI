import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Colors from '@/constants/colors';

interface GradientTextProps {
  text: string;
  style?: any;
}

export function GradientText({ text, style }: GradientTextProps) {
  return (
    <View>
      <Text style={[styles.text, style, { color: Colors.dark.accentLight }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: 'Inter_700Bold',
  },
});
