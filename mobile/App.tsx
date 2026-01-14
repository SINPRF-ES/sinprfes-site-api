import React, { useEffect } from 'react';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigation from './src/navigation';
import { initDb } from './src/database/db';
import { setupGlobalErrorHandling } from './src/infra/errorHandling';
import ErrorBoundary from './src/components/ErrorBoundary';

// Inicializa o sistema de captura de erros globalmente
setupGlobalErrorHandling();

export default function App() {
  useEffect(() => {
    initDb().catch((e) => console.warn('Erro ao inicializar DB:', e));
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </ErrorBoundary>
  );
}
