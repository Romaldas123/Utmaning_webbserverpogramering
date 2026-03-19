const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Visa filerna i public-mappen
app.use(express.static('public'));

// En lista för att lagra alla aktiva spelare
let players = {};

io.on('connection', (socket) => {
  console.log('En spelare anslöt! ID:', socket.id);

  // Skapa en startposition för den nya spelaren
  players[socket.id] = {
    x: 400,
    y: 300,
    id: socket.id
  };

  // När servern får en ny position från en spelare
  socket.on('updatePosition', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;

      // Skicka ut den nya positionen till ALLA ANDRA spelare
      // Detta gör att de ser din cirkel röra sig
      socket.broadcast.emit('playerMoved', { 
        id: socket.id, 
        x: data.x, 
        y: data.y 
      });
    }
  });

  // När någon stänger fliken
  socket.on('disconnect', () => {
    console.log('Spelare lämnade.');
    delete players[socket.id];
    // Berätta för alla andra att ta bort den här cirkeln
    io.emit('playerDisconnected', socket.id);
  });
});

http.listen(3000, () => {
  console.log('Servern körs på http://localhost:3000');
});