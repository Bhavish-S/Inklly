import { Platform } from 'react-native';
import { colors } from '../theme';

export const tabScreenOptions = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: '#94A3B8',
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  tabBarStyle: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    ...(Platform.OS === 'android' ? { paddingTop: 4 } : {}),
  },
  headerTitleStyle: { color: colors.text, fontWeight: '700' as const, fontSize: 18 },
  headerStyle: { backgroundColor: colors.white },
  headerShadowVisible: false,
  sceneStyle: { backgroundColor: colors.bg },
};
