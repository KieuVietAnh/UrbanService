import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "@expo-google-fonts/geist/useFonts";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { initApi } from "@/config/api";
import { queryClient } from "@/config/query-client";
import { ToastProvider } from "@/components/shared";
import { useAuthGuard, useAuthStore } from "@/features/auth";
import { canAccessMobileWorkspace } from "@/features/auth/mobile-access";
import { APP_ROLES } from '@urbanmind/shared-types';
import BrandSplashScreen from "@/screens/splash/SplashScreen";

const BRAND_SPLASH_DURATION_MS = 900;

void SplashScreen.preventAutoHideAsync();

// Ensure API is configured before any child component or data fetch runs.
initApi();

function RootNavigation({ showBrandSplash }: { showBrandSplash: boolean }) {
  useAuthGuard();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  if (showBrandSplash || !hasHydrated) return <BrandSplashScreen />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="unsupported-role" />
      <Stack.Protected guard={canAccessMobileWorkspace(user, APP_ROLES.SERVICE_USER)}>
        <Stack.Screen name="(resident)" />
      </Stack.Protected>
      <Stack.Protected guard={canAccessMobileWorkspace(user, APP_ROLES.SYSTEM_STAFF)}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [showBrandSplash, setShowBrandSplash] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    "Geist-Regular": Geist_400Regular,
    "Geist-Medium": Geist_500Medium,
    "Geist-SemiBold": Geist_600SemiBold,
    "Geist-Bold": Geist_700Bold,
  });

  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (!fontsReady) return undefined;

    // The branded React screen is already mounted when the native splash is
    // hidden, preventing a white flash between the two launch surfaces.
    void SplashScreen.hideAsync();
    const timer = setTimeout(() => setShowBrandSplash(false), BRAND_SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [fontsReady]);

  // Keep the native splash visible while bundled fonts are loading.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider
          statusBarTranslucent
          navigationBarTranslucent
          preserveEdgeToEdge
        >
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <RootNavigation showBrandSplash={showBrandSplash} />
            </ToastProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
