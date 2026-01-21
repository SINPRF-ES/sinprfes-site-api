import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export function useQuorum(assembleiaId: string, socket: Socket | null, initialState: any) {
  const [quorumVigente, setQuorumVigente] = useState<any>(initialState);
  const [chamadaAtiva, setChamadaAtiva] = useState<{ id: string, valido_ate: string } | null>(null);

  useEffect(() => {
    if (initialState) {
      setQuorumVigente(initialState);
    }
  }, [initialState]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_quorum_call', (payload) => {
      setChamadaAtiva(payload);
      setQuorumVigente(payload);
    });

    socket.on('quorum_count_updated', (payload) => {
      setQuorumVigente((prev: any) => ({ ...prev, total: payload.total }));
    });

    return () => {
      socket.off('new_quorum_call');
      socket.off('quorum_count_updated');
    };
  }, [socket]);

  return { quorumVigente, chamadaAtiva, setChamadaAtiva };
}
