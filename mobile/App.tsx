import React, { useEffect } from 'react';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigation from './src/navigation';
import { initDb } from './src/database/db';

export default function App() {
  useEffect(() => {
    initDb().catch((e) => console.warn('Erro ao inicializar DB:', e));
  }, []);

  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
