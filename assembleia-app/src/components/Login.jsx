import React, { useState } from 'react';
import client from '../api/client';
import useAssembleiaStore from '../store/useAssembleiaStore';

function Login() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setToken } = useAssembleiaStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await client.post('/api/auth/login', { cpf, senha });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <h1>SINPRF-ES</h1>
        <h2>Assembleia Digital</h2>
        {error && <div className="error" role="alert">{error}</div>}
        <input
          type="text"
          placeholder="CPF"
          aria-label="CPF"
          inputMode="numeric"
          autoComplete="username"
          value={cpf}
          onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
          required
          disabled={loading}
        />
        <div className="password-input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            aria-label="Senha"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            disabled={loading}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            disabled={loading}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default Login;
