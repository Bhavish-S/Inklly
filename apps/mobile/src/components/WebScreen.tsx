import React, { useLayoutEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { colors } from '../theme';
import { InkWebView, InkWebViewHandle } from './InkWebView';

type Props = {
  uri: string;
  pullToRefresh?: boolean;
  onNavigate?: (url: string, title?: string) => void;
  title?: string;
};

/** A screen-filling InkWebView with a reload button in the navigation header. */
export function WebScreen({ uri, pullToRefresh, onNavigate, title }: Props) {
  const navigation = useNavigation();
  const webRef = useRef<InkWebViewHandle>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...(title ? { title } : {}),
      headerRight: () => (
        <Pressable
          accessibilityLabel="Reload"
          hitSlop={12}
          onPress={() => webRef.current?.reload()}
          style={styles.headerButton}
        >
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, title]);

  return <InkWebView ref={webRef} uri={uri} pullToRefresh={pullToRefresh} onNavigate={onNavigate} />;
}

const styles = StyleSheet.create({
  headerButton: { paddingHorizontal: 16, paddingVertical: 4 },
});
