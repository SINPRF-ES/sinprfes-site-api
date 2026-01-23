import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';

class AssembleiaSocket {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket) return;

    this.socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Conectado');
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Desconectado');
    });
  }

  joinRoom(assembleiaId: string) {
    this.socket?.emit('join_assembleia', assembleiaId);
  }

  leaveRoom(assembleiaId: string) {
    this.socket?.emit('leave_assembleia', assembleiaId);
  }

  onEvent(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
  }

  offEvent(event: string) {
    this.socket?.off(event);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const assembleiaSocket = new AssembleiaSocket();
