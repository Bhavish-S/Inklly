import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '../../components/EmptyState';
import { WebScreen } from '../../components/WebScreen';
import { urls } from '../../config';
import { useTrackRecorder } from '../../lib/useTrackRecorder';

export default function ShopScreen() {
  const { code, name } = useLocalSearchParams<{ code: string; name?: string }>();
  const onNavigate = useTrackRecorder();

  if (!code) return <EmptyState icon="alert-circle-outline" title="Shop not found" message="This shop link is invalid." />;

  return <WebScreen uri={urls.shop(code)} title={name || 'Print shop'} onNavigate={onNavigate} />;
}
