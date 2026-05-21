const GRID_SIZE = 80;
const CELL_RADIUS_SCALE = 10;
const PELLET_RADIUS_SCALE = 4.2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cellRadius(mass) {
  return Math.sqrt(mass) * CELL_RADIUS_SCALE;
}

function pelletRadius(mass) {
  return Math.sqrt(mass) * PELLET_RADIUS_SCALE;
}

function getPlayerFocus(player) {
  let totalMass = 0;
  let x = 0;
  let y = 0;

  for (const cell of player.cells) {
    totalMass += cell.mass;
    x += cell.x * cell.mass;
    y += cell.y * cell.mass;
  }

  return {
    x: x / totalMass,
    y: y / totalMass,
    score: totalMass
  };
}

function calculateZoom(score) {
  return clamp(12 / Math.sqrt(Math.max(score, 40)), 0.34, 1.15);
}

function inView(x, y, radius, view) {
  return x + radius >= view.left
    && x - radius <= view.right
    && y + radius >= view.top
    && y - radius <= view.bottom;
}

function drawWorldBackground(ctx, gameState, view) {
  ctx.fillStyle = '#f7fafc';
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);

  ctx.strokeStyle = '#dde5ea';
  ctx.lineWidth = 1 / window.gameCamera.zoom;
  ctx.beginPath();

  const startX = Math.floor(view.left / GRID_SIZE) * GRID_SIZE;
  const endX = Math.ceil(view.right / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(view.top / GRID_SIZE) * GRID_SIZE;
  const endY = Math.ceil(view.bottom / GRID_SIZE) * GRID_SIZE;

  for (let x = startX; x <= endX; x += GRID_SIZE) {
    ctx.moveTo(x, view.top);
    ctx.lineTo(x, view.bottom);
  }

  for (let y = startY; y <= endY; y += GRID_SIZE) {
    ctx.moveTo(view.left, y);
    ctx.lineTo(view.right, y);
  }

  ctx.stroke();

  ctx.strokeStyle = '#9fb0ba';
  ctx.lineWidth = 3 / window.gameCamera.zoom;
  ctx.strokeRect(0, 0, gameState.bounds.width, gameState.bounds.height);
}

function drawPellets(ctx, pellets, view) {
  const pathsByColor = new Map();

  for (const pellet of pellets) {
    const radius = pelletRadius(pellet.mass);
    if (!inView(pellet.x, pellet.y, radius, view)) continue;

    if (!pathsByColor.has(pellet.color)) pathsByColor.set(pellet.color, new Path2D());
    const path = pathsByColor.get(pellet.color);
    path.moveTo(pellet.x + radius, pellet.y);
    path.arc(pellet.x, pellet.y, radius, 0, Math.PI * 2);
  }

  for (const [color, path] of pathsByColor.entries()) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
}

function drawPlayers(ctx, players, me, view) {
  for (const player of players) {
    for (const cell of player.cells) {
      const radius = cellRadius(cell.mass);
      if (!inView(cell.x, cell.y, radius, view)) continue;

      ctx.beginPath();
      ctx.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = player.color;

      if (player.id === me.id) {
        ctx.shadowColor = '#1115';
        ctx.shadowBlur = 16 / window.gameCamera.zoom;
      }

      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.lineWidth = (player.id === me.id ? 3 : 1.5) / window.gameCamera.zoom;
      ctx.strokeStyle = player.id === me.id ? '#1d252b' : '#ffffffaa';
      ctx.stroke();

      if (cell.mergeTimer > 0 && player.id === me.id) {
        ctx.beginPath();
        ctx.arc(cell.x, cell.y, radius + 7 / window.gameCamera.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#2f80ed99';
        ctx.lineWidth = 2 / window.gameCamera.zoom;
        ctx.stroke();
      }
    }
  }
}

function drawHud(ctx, gameState, me, score, dpr) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const mapW = 190;
  const mapH = 122;
  const mapX = width - mapW - 16;
  const mapY = height - mapH - 16;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1f2933d9';
  ctx.fillRect(14, 14, 160, 52);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(`Score: ${Math.floor(score)}`, 26, 47);

  drawLeaderboard(ctx, gameState.leaderboard || [], me, width);

  ctx.globalAlpha = 0.96;
  ctx.fillStyle = '#fbfdff';
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = '#8fa0aa';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  for (const player of gameState.players) {
    for (const cell of player.cells) {
      ctx.beginPath();
      ctx.arc(
        mapX + (cell.x / gameState.bounds.width) * mapW,
        mapY + (cell.y / gameState.bounds.height) * mapH,
        player.id === me.id ? 6 : 4,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = player.color;
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

function drawLeaderboard(ctx, leaderboard, me, width) {
  const boardW = 238;
  const rowH = 24;
  const boardX = width - boardW - 16;
  const boardY = 14;
  const rows = Math.max(leaderboard.length, 1);
  const boardH = 42 + rows * rowH;

  ctx.fillStyle = '#1f2933d9';
  ctx.fillRect(boardX, boardY, boardW, boardH);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('Topplista', boardX + 14, boardY + 25);

  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const y = boardY + 44 + i * rowH;
    const isMe = entry.id === me.id;

    if (isMe) {
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(boardX + 8, y - 11, boardW - 16, 21);
    }

    ctx.fillStyle = '#e6edf3';
    ctx.fillText(`${entry.rank}.`, boardX + 14, y);

    ctx.beginPath();
    ctx.arc(boardX + 47, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = entry.color;
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(isMe ? 'Du' : entry.name, boardX + 60, y);

    ctx.textAlign = 'right';
    ctx.fillText(Math.floor(entry.score), boardX + boardW - 14, y);
    ctx.textAlign = 'start';
  }

  ctx.textBaseline = 'alphabetic';
}

function renderGame(gameState) {
  const canvas = window.gameCanvas || document.getElementById('game');
  const ctx = window.gameCtx || canvas.getContext('2d');
  const dpr = window.gameDpr || 1;

  if (!gameState || !gameState.players || !gameState.bounds) return;

  const me = (window.socket && gameState.players.find(player => player.id === window.socket.id))
    || gameState.players[0];
  if (!me || !me.cells.length) return;

  const focus = getPlayerFocus(me);
  const camera = window.gameCamera;
  const targetZoom = calculateZoom(focus.score);

  if (!camera.initialized) {
    camera.x = focus.x;
    camera.y = focus.y;
    camera.zoom = targetZoom;
    camera.initialized = true;
  } else {
    camera.x += (focus.x - camera.x) * 0.14;
    camera.y += (focus.y - camera.y) * 0.14;
    camera.zoom += (targetZoom - camera.zoom) * 0.08;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const viewPadding = 120 / camera.zoom;
  const view = {
    left: camera.x - width / (2 * camera.zoom) - viewPadding,
    right: camera.x + width / (2 * camera.zoom) + viewPadding,
    top: camera.y - height / (2 * camera.zoom) - viewPadding,
    bottom: camera.y + height / (2 * camera.zoom) + viewPadding
  };

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  ctx.setTransform(
    dpr * camera.zoom,
    0,
    0,
    dpr * camera.zoom,
    dpr * (width / 2 - camera.x * camera.zoom),
    dpr * (height / 2 - camera.y * camera.zoom)
  );

  drawWorldBackground(ctx, gameState, view);
  drawPellets(ctx, gameState.pellets, view);
  drawPlayers(ctx, gameState.players, me, view);
  drawHud(ctx, gameState, me, focus.score, dpr);
}
