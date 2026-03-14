const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('En spelare anslöt! ID:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Spelare lämnade.');
  });
});

http.listen(3000, () => {
  console.log('Servern körs på http://localhost:3000');
});