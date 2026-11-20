import React from 'react';
import { WebScreen } from '../../components/WebScreen';
import { urls } from '../../config';

export default function CounterScreen() {
  // Pull-to-refresh is off here: the counter has its own scrolling panes; use the header reload button.
  return <WebScreen uri={urls.merchantCounter()} pullToRefresh={false} />;
}
