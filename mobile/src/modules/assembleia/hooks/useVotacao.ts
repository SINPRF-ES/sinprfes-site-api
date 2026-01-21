import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Votacao, VotoContagem, VotoNominal } from '../types';

export function useVotacao(assembleiaId: string, socket: Socket | null, initialState: Votacao | null) {
  const [votacaoAtiva, setVotacaoAtiva] = useState<Votacao | null>(initialState);
  const [contagem, setContagem] = useState<VotoContagem>({ SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 });
  const [votos, setVotos] = useState<VotoNominal[]>([]);
  const [tempoRestante, setTempoRestante] = useState(0);

  useEffect(() => {
     if (initialState) {
        setVotacaoAtiva(initialState);
        setContagem(initialState.contagem || { SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 });
        setVotos(initialState.votos || []);
        if (initialState.encerra_em) {
           const resta = Math.max(0, Math.floor((new Date(initialState.encerra_em).getTime() - Date.now()) / 1000));
           setTempoRestante(resta);
        }
     }
  }, [initialState]);

  useEffect(() => {
    if (!socket) return;

    socket.on('voting_started', (payload: Votacao) => {
      setVotacaoAtiva(payload);
      setContagem(payload.contagem || { SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 });
      setVotos(payload.votos || []);

      if (payload.encerra_em) {
        const resta = Math.max(0, Math.floor((new Date(payload.encerra_em).getTime() - Date.now()) / 1000));
        setTempoRestante(resta);
      }
    });

    socket.on('vote_cast', (payload: { contagem: VotoContagem, votos: VotoNominal[] }) => {
      setContagem(payload.contagem);
      setVotos(payload.votos);
    });

    socket.on('voting_ended', (payload: { id: string, contagem: VotoContagem }) => {
      if (votacaoAtiva?.id === payload.id || !votacaoAtiva) {
        setVotacaoAtiva(null);
        setTempoRestante(0);
      }
    });

    return () => {
      socket.off('voting_started');
      socket.off('vote_cast');
      socket.off('voting_ended');
    };
  }, [socket, votacaoAtiva]);

  useEffect(() => {
    if (tempoRestante > 0) {
      const timer = setInterval(() => {
        setTempoRestante(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [tempoRestante]);

  return { votacaoAtiva, contagem, votos, tempoRestante };
}
