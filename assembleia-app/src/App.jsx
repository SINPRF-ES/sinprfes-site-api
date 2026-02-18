import React, { useEffect, useState } from 'react';
import useAssembleiaStore from './store/useAssembleiaStore';
import Login from './components/Login';
import AssembleiaList from './components/AssembleiaList';
import AssembleiaRoom from './components/AssembleiaRoom';
import client from './api/client';

function App() {
  const { user, token, currentAssembleia, setUser, setToken } = useAssembleiaStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      client.get('/api/auth/me')
        .then(res => {
          setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="loading">Carregando...</div>;

  if (!token || !user) {
    return <Login />;
  }

  if (currentAssembleia) {
    return <AssembleiaRoom />;
  }

  return <AssembleiaList />;
}

export default App;
