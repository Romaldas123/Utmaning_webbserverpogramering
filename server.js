const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { handlePlayerInput, getGameState, gameTick, addPlayer, removePlayer } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let players = {};
let pellets = [];

function resetPellets() {
  pellets = [];
  for (let i = 0; i < 350; i++) { pellets.push(require('./gameLogic').createPellet()); }
}
resetPellets();

io.on('connection', (socket) => {
  addPlayer(socket.id, players);

  socket.on('input', (input) => handlePlayerInput(socket.id, input, players));

  socket.on('disconnect', () => removePlayer(socket.id, players));
});

setInterval(() => {
  gameTick(players, pellets, io);
  io.emit('gameState', getGameState(players, pellets));
}, 1000 / 60);

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});