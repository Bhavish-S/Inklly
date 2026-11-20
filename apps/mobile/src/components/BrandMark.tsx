import React from 'react';
import { Image, StyleSheet } from 'react-native';

/** The Inklly app icon (indigo rounded square with the white ink-drop "i"). */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/icon.png')}
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.24 }]}
      accessibilityLabel="Inklly logo"
    />
  );
}

const styles = StyleSheet.create({
  mark: { overflow: 'hidden' },
});
