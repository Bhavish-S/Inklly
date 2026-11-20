import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewOpenWindowEvent,
  WebViewProgressEvent,
  WebViewScrollEvent,
} from 'react-native-webview/lib/WebViewTypes';
import { useFocusEffect } from 'expo-router';
import { APP_USER_AGENT_SUFFIX, isInkllyUrl } from '../config';
import { isExternalScheme, openExternal, shouldOpenHttpExternally } from '../lib/links';
import { colors } from '../theme';
import { EmptyState } from './EmptyState';

export type InkWebViewHandle = {
  reload: () => void;
  goHome: () => void;
};

type Props = {
  uri: string;
  /** Pull-to-refresh (native on iOS, RefreshControl wrapper on Android). */
  pullToRefresh?: boolean;
  /** Called whenever the page URL changes, including SPA pushState/replaceState navigations. */
  onNavigate?: (url: string, title?: string) => void;
};

/**
 * Patches history.pushState/replaceState so the native side hears about SPA route changes
 * (onShouldStartLoadWithRequest does not fire for them).
 */
const NAV_BRIDGE_JS = `
(function () {
  if (window.__inkllyBridge) return; window.__inkllyBridge = true;
  function post() {
    try {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'inklly:nav', url: String(window.location.href), title: String(document.title || '')
      }));
    } catch (e) {}
  }
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    history[name] = function () { var r = original.apply(this, arguments); setTimeout(post, 50); return r; };
  });
  window.addEventListener('popstate', function () { setTimeout(post, 50); });
  window.addEventListener('load', function () { setTimeout(post, 300); });
})();
true;
`;

export const InkWebView = forwardRef<InkWebViewHandle, Props>(function InkWebView(
  { uri, pullToRefresh = true, onNavigate },
  ref
) {
  // `WebView<{}>`: the library's default generic (`undefined`) collapses its props to `never` under strict TS.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  const webRef = useRef<WebView<{}>>(null);
  const [instanceKey, setInstanceKey] = useState(0);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const canGoBackRef = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;

  const reload = useCallback(() => {
    setError(null);
    if (webRef.current && !error) webRef.current.reload();
    else setInstanceKey((k) => k + 1);
  }, [error]);

  useImperativeHandle(
    ref,
    () => ({
      reload,
      goHome: () => {
        setError(null);
        setInstanceKey((k) => k + 1);
      },
    }),
    [reload]
  );

  // Android hardware back: go back inside the WebView before leaving the screen.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBackRef.current && webRef.current) {
          webRef.current.goBack();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  const loadInWebView = useCallback((url: string) => {
    webRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
  }, []);

  const handleShouldStart = useCallback(
    (req: ShouldStartLoadRequest) => {
      const url = req.url;
      if (isExternalScheme(url)) {
        openExternal(url, loadInWebView);
        return false;
      }
      if (shouldOpenHttpExternally(url)) {
        Linking.openURL(url).catch(() => undefined);
        return false;
      }
      return true;
    },
    [loadInWebView]
  );

  const handleOpenWindow = useCallback(
    (e: WebViewOpenWindowEvent) => {
      const url = e.nativeEvent.targetUrl;
      if (!url || url === 'about:blank') return;
      if (isExternalScheme(url)) openExternal(url, loadInWebView);
      else if (isInkllyUrl(url)) loadInWebView(url);
      else Linking.openURL(url).catch(() => undefined);
    },
    [loadInWebView]
  );

  const handleNavState = useCallback(
    (nav: WebViewNavigation) => {
      canGoBackRef.current = nav.canGoBack;
      if (nav.url && /^https?:/i.test(nav.url)) onNavigate?.(nav.url, nav.title);
    },
    [onNavigate]
  );

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data?.type === 'inklly:nav' && typeof data.url === 'string') onNavigate?.(data.url, data.title);
      } catch {
        // Messages from the page that aren't ours are ignored.
      }
    },
    [onNavigate]
  );

  const handleProgress = useCallback(
    (e: WebViewProgressEvent) => {
      Animated.timing(progress, { toValue: e.nativeEvent.progress, duration: 150, useNativeDriver: false }).start();
    },
    [progress]
  );

  const handleError = useCallback((e: WebViewErrorEvent) => {
    const { description, code } = e.nativeEvent;
    // -999 on iOS = navigation cancelled (e.g. by our own interception); not a real error.
    if (code === -999) return;
    setRefreshing(false);
    setError({
      title: "You're offline",
      description:
        description && !/net::|NSURLErrorDomain/i.test(description)
          ? description
          : 'Inklly could not load this page. Check your internet connection and try again.',
    });
  }, []);

  const handleScroll = useCallback((e: WebViewScrollEvent) => {
    setAtTop(e.nativeEvent.contentOffset.y <= 0);
  }, []);

  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title={error.title}
        message={error.description}
        actionLabel="Retry"
        onAction={reload}
      />
    );
  }

  const webview = (
    <WebView<{}>
      key={instanceKey}
      ref={webRef}
      source={{ uri }}
      style={styles.webview}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      allowFileAccess
      allowsInlineMediaPlayback
      geolocationEnabled
      mixedContentMode="compatibility"
      setSupportMultipleWindows
      allowsBackForwardNavigationGestures
      pullToRefreshEnabled={pullToRefresh && Platform.OS === 'ios'}
      nestedScrollEnabled
      applicationNameForUserAgent={APP_USER_AGENT_SUFFIX}
      injectedJavaScriptBeforeContentLoaded={NAV_BRIDGE_JS}
      onShouldStartLoadWithRequest={handleShouldStart}
      onOpenWindow={handleOpenWindow}
      onNavigationStateChange={handleNavState}
      onMessage={handleMessage}
      onLoadStart={() => {
        setLoading(true);
        progress.setValue(0.05);
      }}
      onLoadProgress={handleProgress}
      onLoadEnd={() => {
        setLoading(false);
        setRefreshing(false);
      }}
      onError={handleError}
      onScroll={handleScroll}
      onRenderProcessGone={() => setInstanceKey((k) => k + 1)}
      onContentProcessDidTerminate={() => webRef.current?.reload()}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    />
  );

  return (
    <View style={styles.container}>
      {pullToRefresh && Platform.OS === 'android' ? (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              enabled={atTop}
              colors={[colors.primary]}
              onRefresh={() => {
                setRefreshing(true);
                webRef.current?.reload();
              }}
            />
          }
        >
          {webview}
        </ScrollView>
      ) : (
        webview
      )}
      {loading && (
        <View style={styles.progressTrack} pointerEvents="none">
          <Animated.View
            style={[
              styles.progressBar,
              { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  webview: { flex: 1, backgroundColor: colors.white },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'transparent' },
  progressBar: { height: 3, backgroundColor: colors.accent, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});
