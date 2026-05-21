const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { performance } = require('perf_hooks');
const {
  addPlayer,
  removePlayer,
  handlePlayerInput,
  getGameState,
  gameTick,
  createInitialPellets
} = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SERVER_TICK_RATE = 60;
const SNAPSHOT_RATE = 30;

app.use(express.static('public'));

const players = {};
const pellets = createInitialPellets();

io.on('connection', (socket) => {
  socket.emit('lobbyReady');

  socket.on('joinGame', (profile = {}) => {
    removePlayer(socket.id, players);

    const player = addPlayer(socket.id, players, {
      name: profile.name,
      color: profile.color
    });

    socket.emit('joinedGame', {
      id: player.id,
      name: player.name,
      color: player.color
    });
    socket.emit('gameState', getGameState(players, pellets));
  });

  socket.on('input', (input) => {
    handlePlayerInput(socket.id, input, players);
  });

  socket.on('disconnect', () => {
    removePlayer(socket.id, players);
  });
});

let lastTickTime = performance.now();

setInterval(() => {
  const now = performance.now();
  const dt = (now - lastTickTime) / 1000;
  lastTickTime = now;

  const events = gameTick(players, pellets, dt);

  for (const death of events.deaths) {
    io.to(death.playerId).emit('gameOver', {
      reason: 'eaten',
      killerName: death.killerName
    });
  }
}, 1000 / SERVER_TICK_RATE);

setInterval(() => {
  io.volatile.emit('gameState', getGameState(players, pellets));
}, 1000 / SNAPSHOT_RATE);

server.listen(PORT, HOST, () => {
  console.log(`Server started on http://${HOST}:${PORT}`);
});
