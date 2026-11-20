import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Deep link handler: https://inklly.vercel.app/p/<shopCode> (Android App Link) or inklly://p/<shopCode>
 * opens the shop inside the app.
 */
export default function ShopDeepLink() {
  const { shopCode } = useLocalSearchParams<{ shopCode: string }>();
  if (!shopCode) return <Redirect href="/" />;
  return <Redirect href={{ pathname: '/shop/[code]', params: { code: shopCode } }} />;
}
