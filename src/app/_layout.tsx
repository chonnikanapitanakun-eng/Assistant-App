import '@/i18n';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { isDatabaseLocked, queryClient, useDatabase } from '@/db';
import { Text } from '@/components/ui';
import { useFocusTimerDriver } from '@/features/focus/store';
import { GoogleCalendarAutoSync } from '@/features/google-calendar';
import { configureAndroidChannel, configureNotificationHandler } from '@/features/notifications';
import { useRoutineTasks } from '@/features/routines/queries';
import { SyncAutoRun } from '@/features/sync';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
configureNotificationHandler();
void configureAndroidChannel();

export default function RootLayout() {
  const { t } = useTranslation();
  const { ready, error } = useDatabase();
  useRoutineTasks(ready);
  const { colors, isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  // Fall back to system font rather than blocking the app if Inter fails to load.
  const fontsReady = fontsLoaded || !!fontError;
  useFocusTimerDriver();

  useEffect(() => {
    if ((ready || error) && fontsReady) void SplashScreen.hideAsync();
  }, [ready, error, fontsReady]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
        <Text variant="heading" color="danger">{isDatabaseLocked(error) ? t('db.locked_title') : 'Database error'}</Text>
        <Text color="textSecondary" style={{ textAlign: 'center' }}>{isDatabaseLocked(error) ? t('db.locked_body') : error.message}</Text>
      </View>
    );
  }

  if (!ready || !fontsReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="search" />
            <Stack.Screen name="capture" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
            <Stack.Screen name="task/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="event/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="tx/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="slip" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="bill/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="wallet/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="budget/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="routine/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="routines" />
            <Stack.Screen name="note/[id]" />
            <Stack.Screen name="more" options={{ presentation: 'transparentModal', animation: 'none' }} />
            <Stack.Screen name="focus" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="review" />
          </Stack>
          <GoogleCalendarAutoSync />
          <SyncAutoRun />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
