import React from 'react';
import { WebScreen } from '../../components/WebScreen';
import { urls } from '../../config';

export default function MerchantOrdersScreen() {
  return <WebScreen uri={urls.merchantOrders()} pullToRefresh={false} />;
}
