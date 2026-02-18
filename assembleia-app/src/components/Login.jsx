import React, { useState } from 'react';
import client from '../api/client';
import useAssembleiaStore from '../store/useAssembleiaStore';

function Login() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const { setUser, setToken } = useAssembleiaStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await client.post('/api/auth/login', { cpf, senha });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <h1>SINPRF-ES</h1>
        <h2>Assembleia Digital</h2>
        {error && <div className="error">{error}</div>}
        <input
          type="text"
          placeholder="CPF"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}

export default Login;
