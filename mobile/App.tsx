import React, { useEffect } from 'react';
import Constants from 'expo-constants';
import ReanimatedPackage from 'react-native-reanimated/package.json';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigation from './src/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initDb } from './src/database/db';
import { setupGlobalErrorHandling } from './src/infra/errorHandling';
import ErrorBoundary from './src/components/ErrorBoundary';
import { logger } from './src/infra/logger';

// Inicializa o sistema de captura de erros globalmente
setupGlobalErrorHandling();

// Log de inicialização com versões importantes
logger.info('App Initializing', {
  expoSdkVersion: Constants.expoVersion,
  reanimatedVersion: ReanimatedPackage.version,
});

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    initDb().catch((e) => console.warn('Erro ao inicializar DB:', e));
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
