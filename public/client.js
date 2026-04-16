const socket = io();

let gameState = null;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let input = {
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  space: false,
  w: false
};

canvas.addEventListener('mousemove', e => {
  input.mouseX = e.clientX;
  input.mouseY = e.clientY;
});
canvas.addEventListener('mousedown', e => input.mouseDown = true);
canvas.addEventListener('mouseup', e => input.mouseDown = false);
window.addEventListener('keydown', e => {
  if (e.code === 'Space') input.space = true;
  if (e.code === 'KeyW') input.w = true;
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') input.space = false;
  if (e.code === 'KeyW') input.w = false;
});

setInterval(() => {
  socket.emit('input', input);
}, 1000/30);

socket.on('gameState', state => {
  gameState = state;
  if (window.renderGame) window.renderGame(gameState);
  else drawFallback();
});

function drawFallback() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#222";
  ctx.fillText("Laddar...", canvas.width/2, canvas.height/2);
}