import React, { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAssembleiaStore from '../store/useAssembleiaStore';
import client from '../api/client';
import Checkin from './Checkin';
import Votacao from './Votacao';
import { ArrowLeft } from 'lucide-react';

function AssembleiaRoom() {
  const {
    currentAssembleia,
    setCurrentAssembleia,
    assembleiaState,
    setAssembleiaState,
    updateAssembleiaState,
    token,
    setSocket,
    socket
  } = useAssembleiaStore();

  const hydrate = async () => {
    try {
      const res = await client.get(`/api/assembleias/${currentAssembleia.id}/estado`);
      setAssembleiaState(res.data);
    } catch (err) {
      console.error("Erro ao hidratar estado", err);
    }
  };

  useEffect(() => {
    hydrate();

    const API_BASE_URL = window.ENV_CONFIG?.API_URL || import.meta.env.VITE_API_URL || '';
    const newSocket = io(API_BASE_URL, {
      auth: { token },
      query: { assembleiaId: currentAssembleia.id }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket conectado');
      hydrate(); // Rehidratar ao reconectar
    });

    newSocket.on('assembleia:status_changed', (data) => {
        updateAssembleiaState({ estado: data.estado });
    });

    newSocket.on('assembleia:token_gerado', (data) => {
        updateAssembleiaState({ quorumVigente: data.quorumVigente });
    });

    newSocket.on('votacao:iniciada', (data) => {
        updateAssembleiaState({ votacaoAtiva: data });
    });

    newSocket.on('voto:updated', (data) => {
        if (assembleiaState?.votacaoAtiva) {
            updateAssembleiaState({
                votacaoAtiva: { ...assembleiaState.votacaoAtiva, ...data }
            });
        }
    });

    newSocket.on('votacao:encerrada', (data) => {
        updateAssembleiaState({ votacaoAtiva: null });
        hydrate(); // Refresh para ver resultados se necessário
    });

    newSocket.on('assembleia:checkin_updated', (data) => {
        updateAssembleiaState({ presentes_total: data.total });
    });

    // iOS background handling
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hydrate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      newSocket.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentAssembleia.id]);

  if (!assembleiaState) return <div>Carregando sala...</div>;

  return (
    <div className="room-container">
      <header>
        <button onClick={() => setCurrentAssembleia(null)}><ArrowLeft /> Voltar</button>
        <h2>{currentAssembleia.titulo}</h2>
        <span className="badge">{assembleiaState.estado}</span>
      </header>

      <main>
        {!assembleiaState.presente && assembleiaState.estado !== 'ENCERRADA' && (
          <Checkin assembleiaId={currentAssembleia.id} />
        )}

        {assembleiaState.votacaoAtiva && (
          <Votacao assembleiaId={currentAssembleia.id} />
        )}

        {assembleiaState.estado === 'ENCERRADA' && (
          <div className="info-card">
            <h3>Assembleia Encerrada</h3>
            <p>Esta assembleia foi finalizada. Os resultados estão disponíveis nos relatórios.</p>
          </div>
        )}

        <div className="stats-grid">
           <div className="stat-card">
              <label>Presentes</label>
              <span>{assembleiaState.presentes_total || 0}</span>
           </div>
           {assembleiaState.quorumVigente && (
             <div className="stat-card">
                <label>Quórum Chamada</label>
                <span>{assembleiaState.quorumVigente.tipo_chamada}</span>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}

export default AssembleiaRoom;
