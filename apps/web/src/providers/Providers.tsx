'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ThemeProvider } from './ThemeProvider';
import { WebSocketProvider } from './WebSocketProvider';
import { EncryptionProvider } from './EncryptionProvider';
import { OfflineProvider } from './OfflineProvider';
import { OfflineIndicator } from '@/components/offline';
import { InstallPrompt } from '@/components/pwa';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading spinner only after mount, to avoid hydration issues
  if (!mounted) {
    return <>{children}</>;
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <OfflineProvider>
          <AuthInitializer>
            <EncryptionProvider>
              <WebSocketProvider>
                {children}
                <OfflineIndicator />
                <InstallPrompt />
              </WebSocketProvider>
            </EncryptionProvider>
          </AuthInitializer>
        </OfflineProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
