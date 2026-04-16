window.renderGame = function(gameState) {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Leta upp din spelare (om socket.id finns)
  const me = (window.socket && gameState.players.find(p => p.id === window.socket.id))
            || gameState.players[0];
  if (!me || !me.cells.length) return;

  // Center kameran på din första cell
  const camX = me.cells[0].x;
  const camY = me.cells[0].y;
  // Zoom beroende på massa
  const zoom = Math.min(1.2, 80/Math.sqrt(me.cells.reduce((a,c)=>a+c.mass,0)));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pellets
  for(const pellet of gameState.pellets) {
    ctx.beginPath();
    ctx.fillStyle = pellet.color;
    ctx.arc(
      canvas.width/2 + (pellet.x-camX)*zoom, 
      canvas.height/2 + (pellet.y-camY)*zoom, 
      Math.sqrt(pellet.mass)*4*zoom, 0, 2*Math.PI
    );
    ctx.fill();
  }
  // Alla spelare/celler
  for(const player of gameState.players) {
    for(const cell of player.cells) {
      ctx.beginPath();
      ctx.fillStyle = player.color;
      ctx.arc(
        canvas.width/2 + (cell.x-camX)*zoom,
        canvas.height/2 + (cell.y-camY)*zoom,
        Math.sqrt(cell.mass)*8*zoom, 0, 2*Math.PI
      );
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#222";
      ctx.stroke();
    }
  }
  // Score
  document.getElementById('score').innerText =
    `Score: ${Math.floor(me.cells.reduce((a,c)=>a+c.mass,0))}`;
};