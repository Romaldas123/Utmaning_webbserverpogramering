function renderGame(gameState) {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  if (!gameState || !gameState.players) return;

  const me = (window.socket && gameState.players.find(p => p.id === window.socket.id))
    || gameState.players[0];
  if (!me || !me.cells.length) return;

  // Zoom/skalning: zoomar ut ju större du är
  const score = me.cells.reduce((a, c) => a + c.mass, 0);
  const zoom = Math.max(0.3, Math.min(1.24, 90 / Math.sqrt(score)));

  // Kamerans fokuspunkt
  const camX = me.cells[0].x;
  const camY = me.cells[0].y;

  // Karta och offset (för att kunna översätta musrörelser)
  window.camOffsetX = camX - canvas.width / (2 * zoom);
  window.camOffsetY = camY - canvas.height / (2 * zoom);

  ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2 - camX * zoom, canvas.height / 2 - camY * zoom);

  // Rita rutnätsbakgrund – klassisk agar-stil
  ctx.fillStyle = "#f7fafc";
  ctx.fillRect(0, 0, gameState.bounds.width, gameState.bounds.height);

  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  for (let x = 0; x <= gameState.bounds.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, gameState.bounds.height);
    ctx.stroke();
  }
  for (let y = 0; y <= gameState.bounds.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(gameState.bounds.width, y);
    ctx.stroke();
  }

  // Rita pellets
  for (const pellet of gameState.pellets) {
    ctx.beginPath();
    ctx.fillStyle = pellet.color;
    ctx.arc(pellet.x, pellet.y, Math.sqrt(pellet.mass) * 5, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Rita spelare
  for (const player of gameState.players) {
    for (const cell of player.cells) {
      ctx.beginPath();
      ctx.fillStyle = player.color;
      ctx.arc(cell.x, cell.y, Math.sqrt(cell.mass) * 13, 0, 2 * Math.PI);
      ctx.shadowColor = "#1114";
      ctx.shadowBlur = (player.id === me.id) ? 15 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Cirkla om egen boll
      if (player.id === me.id) {
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
      }
    }
  }

  // Skala om till hela canvas när vi ritar minimap och UI
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Rita score
  ctx.font = "bold 24px sans-serif";
  ctx.fillStyle = "#555";
  ctx.fillText(`Score: ${Math.floor(score)}`, 20, 36);

  // Rita minimap nere till höger
  const mapW = 200, mapH = 130;
  ctx.globalAlpha = 0.97;
  ctx.fillStyle = "#fcfdff";
  ctx.fillRect(canvas.width-mapW-15, canvas.height-mapH-15, mapW, mapH);
  ctx.strokeStyle = "#aaa";
  ctx.strokeRect(canvas.width-mapW-15, canvas.height-mapH-15, mapW, mapH);

  // Rita spelare på minikarta
  for (const player of gameState.players) {
    for (const cell of player.cells) {
      ctx.beginPath();
      ctx.arc(
        canvas.width-mapW-15 + (cell.x / gameState.bounds.width) * mapW,
        canvas.height-mapH-15 + (cell.y / gameState.bounds.height) * mapH,
        (player.id === me.id ? 8 : 5),
        0, 2 * Math.PI
      );
      ctx.fillStyle = player.color;
      ctx.fill();
      if (player.id === me.id) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#222";
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}