const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const WORLD_SIZE = 10000; 
const MAX_PELLETS = 2000; 
let players = {};
let pellets = [];

// Skapar en pellet
function createPellet() {
  return {
    id: Math.random().toString(36).substring(2, 9),
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
    r: 15, // Måste finnas här!
    color: `hsl(${Math.random() * 360}, 70%, 50%)`
  };
}

// Fyll listan
for (let i = 0; i < MAX_PELLETS; i++) {
  pellets.push(createPellet());
}

io.on('connection', (socket) => {
  console.log('Spelare anslöt:', socket.id);

  players[socket.id] = {
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
    r: 20, 
    id: socket.id,
    color: `hsl(${Math.random() * 360}, 80%, 60%)`
  };

  socket.emit('init', { 
    players: players, 
    pellets: pellets, 
    worldSize: WORLD_SIZE,
    yourId: socket.id
  });

  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('updatePosition', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;

      let player = players[socket.id];

      // KOLLISION MED PELLETS
      for (let i = pellets.length - 1; i >= 0; i--) {
        let p = pellets[i];
        let dx = p.x - player.x;
        let dy = p.y - player.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        // Säkerställ att spelaren är större och nuddar mitten
        if (player.r > p.r && distance < player.r) {
          
          let playerArea = Math.PI * Math.pow(player.r, 2);
          let pelletArea = Math.PI * Math.pow(p.r, 2);
          let newArea = playerArea + (pelletArea*1.1);
          
          player.r = Math.sqrt(newArea / Math.PI); 
          
          const eatenId = p.id;
          const newPellet = createPellet();
          pellets[i] = newPellet;

          io.emit('pelletUpdate', {
            eatenId: eatenId,
            newPellet: newPellet,
            playerId: socket.id,
            newRadius: player.r
          });
        }
      }

      socket.broadcast.emit('playerMoved', { 
        id: socket.id, 
        x: data.x, 
        y: data.y,
        r: player.r
      });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

http.listen(3000, () => {
  console.log('Servern körs på http://localhost:3000');
});