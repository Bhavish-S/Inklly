import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '../components/EmptyState';
import { WebScreen } from '../components/WebScreen';
import { isInkllyUrl, isTrackUrl, urls } from '../config';
import { useTrackRecorder } from '../lib/useTrackRecorder';

/** Opens any Inklly https URL (tracking links, scanned QR links) in the in-app WebView. */
export default function WebRoute() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const onNavigate = useTrackRecorder();

  if (!url || !isInkllyUrl(url)) {
    return <EmptyState icon="alert-circle-outline" title="Can't open this link" message="Only Inklly links can be opened here." />;
  }

  return (
    <WebScreen uri={urls.inApp(url)} title={isTrackUrl(url) ? 'Track order' : 'Inklly'} onNavigate={onNavigate} />
  );
}
