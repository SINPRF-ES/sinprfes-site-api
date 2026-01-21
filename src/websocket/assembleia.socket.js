// src/websocket/assembleia.socket.js
const { Server } = require("socket.io");

let io;

function init(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_assembleia", (assembleiaId) => {
      socket.join(`assembleia_${assembleiaId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

function emitEvent(assembleiaId, eventName, payload) {
  if (io) {
    io.to(`assembleia_${assembleiaId}`).emit(eventName, payload);
  }
}

module.exports = {
  init,
  getIO,
  emitEvent
};
