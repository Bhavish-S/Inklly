import { useCallback } from 'react';
import { isTrackUrl } from '../config';
import { rememberTrackLink } from './storage';

/** Returns an onNavigate handler that saves any /track?... URL the user opens. */
export function useTrackRecorder() {
  return useCallback((url: string, title?: string) => {
    if (isTrackUrl(url)) rememberTrackLink(url, title).catch(() => undefined);
  }, []);
}
