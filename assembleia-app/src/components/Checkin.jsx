import React, { useState } from 'react';
import client from '../api/client';
import useAssembleiaStore from '../store/useAssembleiaStore';

function Checkin({ assembleiaId }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { updateAssembleiaState } = useAssembleiaStore();

  const handleCheckin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await client.post(`/api/assembleias/${assembleiaId}/checkin`, { token });
      updateAssembleiaState({ presente: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar check-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkin-card">
      <h3>Credenciamento</h3>
      <p>Informe o token de 6 dígitos exibido pelo presidente para confirmar sua presença.</p>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleCheckin}>
        <input
          type="text"
          placeholder="000000"
          maxLength={6}
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Processando...' : 'Confirmar Presença'}
        </button>
      </form>
    </div>
  );
}

export default Checkin;
