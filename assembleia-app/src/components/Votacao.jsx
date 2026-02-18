import React, { useState, useEffect } from 'react';
import client from '../api/client';
import useAssembleiaStore from '../store/useAssembleiaStore';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

function Votacao({ assembleiaId }) {
  const { assembleiaState, updateAssembleiaState } = useAssembleiaStore();
  const { votacaoAtiva } = assembleiaState;
  const [meuVoto, setMeuVoto] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (votacaoAtiva?.encerra_em) {
        const interval = setInterval(() => {
            const end = new Date(votacaoAtiva.encerra_em).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, Math.floor((end - now) / 1000));
            setTimeLeft(diff);
            if (diff === 0) clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [votacaoAtiva?.encerra_em]);

  useEffect(() => {
      // Verificar se já votei (reidratação)
      const v = votacaoAtiva?.votos?.find(v => v.filiado_id === assembleiaState.user_id);
      if (v) setMeuVoto(v.voto);
  }, [votacaoAtiva?.votos]);

  const handleVoto = async (voto) => {
    try {
      await client.post(`/api/assembleias/${assembleiaId}/votacoes/${votacaoAtiva.id}/voto`, { voto });
      setMeuVoto(voto);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao registrar voto');
    }
  };

  if (!votacaoAtiva) return null;

  return (
    <div className="votacao-card">
      <div className="votacao-header">
        <h3>{votacaoAtiva.titulo}</h3>
        <span className="timer">{timeLeft}s</span>
      </div>
      <p>{votacaoAtiva.descricao}</p>

      {!assembleiaState.elegivel ? (
          <div className="warning">Você não estava presente no início desta votação e não pode votar agora.</div>
      ) : (
          <div className="voto-actions">
            <button
                className={`btn-voto btn-sim ${meuVoto === 'SIM' ? 'active' : ''}`}
                onClick={() => handleVoto('SIM')}
            >
                <ThumbsUp /> SIM
            </button>
            <button
                className={`btn-voto btn-nao ${meuVoto === 'NAO' ? 'active' : ''}`}
                onClick={() => handleVoto('NAO')}
            >
                <ThumbsDown /> NÃO
            </button>
          </div>
      )}

      <div className="placar">
          <div className="placar-item">
              <label>SIM</label>
              <span>{votacaoAtiva.contagem?.SIM || 0}</span>
          </div>
          <div className="placar-item">
              <label>NÃO</label>
              <span>{votacaoAtiva.contagem?.NAO || 0}</span>
          </div>
          <div className="placar-item">
              <label>ABSTENÇÕES</label>
              <span>{votacaoAtiva.contagem?.ABSTENCAO || 0}</span>
          </div>
      </div>

      <div className="votos-nominais">
          <h4>Votos Nominais</h4>
          <ul>
              {votacaoAtiva.votos?.map((v, i) => (
                  <li key={i}>
                      <span>{v.nome}</span>
                      <span className={`voto-badge voto-${v.voto.toLowerCase()}`}>{v.voto}</span>
                  </li>
              ))}
          </ul>
      </div>
    </div>
  );
}

export default Votacao;
