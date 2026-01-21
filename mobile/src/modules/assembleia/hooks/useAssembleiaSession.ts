import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../../config/env';
import assembleiaService from '../services/assembleiaService';
import { Assembleia, PedidoPalavra, Proposta } from '../types';

export function useAssembleiaSession(assembleiaId: string) {
  const [assembleia, setAssembleia] = useState<Assembleia | null>(null);
  const [pedidosPalavra, setPedidosPalavra] = useState<PedidoPalavra[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [mesa, setMesa] = useState<any[]>([]);
  const [quorumVigente, setQuorumVigente] = useState<any>(null);
  const [votacaoAtiva, setVotacaoAtiva] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarEstado = useCallback(async () => {
    try {
      setCarregando(true);
      const data = await assembleiaService.buscarEstadoCompleto(assembleiaId);
      setAssembleia(data.assembleia);
      setPedidosPalavra(data.pedidosPalavra);
      setPropostas(data.propostas);
      setMesa(data.mesa);
      setQuorumVigente(data.quorumVigente);
      setVotacaoAtiva(data.votacaoAtiva);
    } catch (error) {
      console.error('Erro ao carregar estado completo:', error);
    } finally {
      setCarregando(false);
    }
  }, [assembleiaId]);

  useEffect(() => {
    carregarEstado();

    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.emit('join_assembleia', assembleiaId);

    newSocket.on('session_state_changed', (payload) => {
      setAssembleia(prev => prev ? { ...prev, estado: payload.estado } : null);
    });

    newSocket.on('word_queue_updated', (payload) => {
      setPedidosPalavra(payload);
    });

    newSocket.on('new_proposal', (payload) => {
      setPropostas(prev => [...prev, payload]);
    });

    newSocket.on('proposal_updated', (payload) => {
      setPropostas(prev => prev.map(p => p.id === payload.id ? payload : p));
    });

    newSocket.on('mesa_updated', (payload) => {
      setMesa(payload);
    });

    newSocket.on('quorum_count_updated', (payload) => {
      setQuorumVigente((prev: any) => prev ? { ...prev, total: payload.total } : { total: payload.total });
    });

    newSocket.on('new_quorum_call', (payload) => {
       // Reset local se necessário ou apenas atualiza info do token
       setQuorumVigente(payload);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [assembleiaId, carregarEstado]);

  return {
    assembleia,
    pedidosPalavra,
    propostas,
    mesa,
    quorumVigente,
    votacaoAtiva,
    socket,
    carregando,
    refresh: carregarEstado
  };
}
