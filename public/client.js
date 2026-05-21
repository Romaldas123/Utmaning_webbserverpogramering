window.socket = io();

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const lobby = document.getElementById('lobby');
const lobbyForm = document.getElementById('lobbyForm');
const lobbyMessage = document.getElementById('lobbyMessage');
const playerNameInput = document.getElementById('playerName');
const playerColorInput = document.getElementById('playerColor');
const colorSwatches = document.getElementById('colorSwatches');
const presetColors = ['#2f6bde', '#56d62d', '#e33f2f', '#f59e0b', '#8b5cf6', '#06b6d4'];
const input = {
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  space: false,
  w: false
};

window.gameCanvas = canvas;
window.gameCtx = ctx;
window.gameCamera = {
  x: 0,
  y: 0,
  zoom: 1,
  initialized: false
};

let latestState = null;
let gameMode = 'lobby';
let pendingSplit = false;
let pendingEject = false;
let mouseClientX = window.innerWidth / 2;
let mouseClientY = window.innerHeight / 2;

function resetLocalPlayerState() {
  latestState = null;
  pendingSplit = false;
  pendingEject = false;
  input.mouseDown = false;
  input.space = false;
  input.w = false;
  window.gameCamera.x = 0;
  window.gameCamera.y = 0;
  window.gameCamera.zoom = 1;
  window.gameCamera.initialized = false;
}

function setLobbyVisible(visible, message = '') {
  lobby.classList.toggle('is-hidden', !visible);
  lobbyMessage.textContent = message;
}

function selectColor(color) {
  playerColorInput.value = color;

  for (const swatch of colorSwatches.querySelectorAll('.swatch')) {
    swatch.classList.toggle('is-selected', swatch.dataset.color === color);
  }
}

for (const color of presetColors) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'swatch';
  swatch.dataset.color = color;
  swatch.style.background = color;
  swatch.setAttribute('aria-label', color);
  swatch.addEventListener('click', () => selectColor(color));
  colorSwatches.appendChild(swatch);
}

selectColor(playerColorInput.value);

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  window.gameDpr = dpr;
}

function screenToWorld(clientX, clientY) {
  const camera = window.gameCamera;
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    x: camera.x + (clientX - width / 2) / camera.zoom,
    y: camera.y + (clientY - height / 2) / camera.zoom
  };
}

function updateMouseWorldPosition() {
  const world = screenToWorld(mouseClientX, mouseClientY);
  input.mouseX = world.x;
  input.mouseY = world.y;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

canvas.addEventListener('mousemove', (event) => {
  mouseClientX = event.clientX;
  mouseClientY = event.clientY;
  updateMouseWorldPosition();
});

canvas.addEventListener('mousedown', () => {
  input.mouseDown = true;
});

window.addEventListener('mouseup', () => {
  input.mouseDown = false;
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) pendingSplit = true;
    input.space = true;
  }

  if (event.code === 'KeyW') {
    if (!event.repeat) pendingEject = true;
    input.w = true;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') input.space = false;
  if (event.code === 'KeyW') input.w = false;
});

lobbyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  resetLocalPlayerState();
  gameMode = 'joining';
  setLobbyVisible(true, 'Ansluter...');

  socket.emit('joinGame', {
    name: playerNameInput.value,
    color: playerColorInput.value
  });
});

playerColorInput.addEventListener('input', () => {
  selectColor(playerColorInput.value);
});

setInterval(() => {
  if (gameMode !== 'playing') return;

  updateMouseWorldPosition();
  socket.emit('input', {
    ...input,
    split: pendingSplit,
    eject: pendingEject
  });
  pendingSplit = false;
  pendingEject = false;
}, 1000 / 45);

socket.on('joinedGame', () => {
  resetLocalPlayerState();
  gameMode = 'playing';
  setLobbyVisible(false);
});

socket.on('gameState', (state) => {
  if (gameMode !== 'playing') return;
  latestState = state;
});

socket.on('gameOver', (event) => {
  const killerText = event && event.killerName ? `Uppäten av ${event.killerName}.` : 'Du blev uppäten.';
  resetLocalPlayerState();
  gameMode = 'lobby';
  setLobbyVisible(true, `${killerText} Spela igen?`);
});

socket.on('disconnect', () => {
  resetLocalPlayerState();
  gameMode = 'lobby';
  setLobbyVisible(true, 'Anslutningen bröts.');
});

function drawFallback() {
  const dpr = window.gameDpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#121618';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = '#f7fafc';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Laddar...', window.innerWidth / 2, window.innerHeight / 2);
  ctx.textAlign = 'start';
}

function animationLoop(time) {
  if (gameMode === 'playing' && latestState) {
    renderGame(latestState, time);
  } else {
    drawFallback();
  }

  requestAnimationFrame(animationLoop);
}

requestAnimationFrame(animationLoop);
