const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let WORLD_SIZE = 10000;
const GRID_SIZE = 50; 

let player = { x: 0, y: 0, r: 20, color: 'blue', id: null };
let otherPlayers = {};
let pellets = {}; 
let mouse = { x: 0, y: 0 };

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

socket.on('init', (data) => {
    WORLD_SIZE = data.worldSize;
    player.id = data.yourId;
    player.x = data.players[player.id].x;
    player.y = data.players[player.id].y;
    player.r = data.players[player.id].r; 
    player.color = data.players[player.id].color;
    
    data.pellets.forEach(p => pellets[p.id] = p);
    
    otherPlayers = data.players;
    delete otherPlayers[player.id];
});

socket.on('newPlayer', (p) => { otherPlayers[p.id] = p; });

socket.on('playerMoved', (data) => {
    if (otherPlayers[data.id]) {
        otherPlayers[data.id].x = data.x;
        otherPlayers[data.id].y = data.y;
        otherPlayers[data.id].r = data.r; 
    }
});

socket.on('pelletUpdate', (data) => {
    delete pellets[data.eatenId];
    pellets[data.newPellet.id] = data.newPellet;
    
    if (data.playerId === player.id) {
        player.r = data.newRadius;
    } else if (otherPlayers[data.playerId]) {
        otherPlayers[data.playerId].r = data.newRadius;
    }
});

socket.on('playerDisconnected', (id) => { delete otherPlayers[id]; });

// --- RIT-LOGIK ---
function drawGrid(camX, camY) {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    let startX = -camX % GRID_SIZE;
    let startY = -camY % GRID_SIZE;

    ctx.beginPath();
    for (let x = startX; x < canvas.width; x += GRID_SIZE) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = startY; y < canvas.height; y += GRID_SIZE) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 10;
    ctx.strokeRect(-camX, -camY, WORLD_SIZE, WORLD_SIZE);
}

function drawMinimap() {
    const mapSize = 150;
    const padding = 20;
    const x = canvas.width - mapSize - padding;
    const y = padding;
    const ratio = mapSize / WORLD_SIZE;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(x, y, mapSize, mapSize);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(x, y, mapSize, mapSize);

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x + player.x * ratio, y + player.y * ratio, 4, 0, Math.PI * 2);
    ctx.fill();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let centerX = canvas.width / 2;
    let centerY = canvas.height / 2;
    let dx = mouse.x - centerX;
    let dy = mouse.y - centerY;
    let dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > 10) {
        let speed = Math.min(4, dist * 0.05);
        player.x += (dx / dist) * speed;
        player.y += (dy / dist) * speed;
    }

    player.x = Math.max(player.r, Math.min(WORLD_SIZE - player.r, player.x));
    player.y = Math.max(player.r, Math.min(WORLD_SIZE - player.r, player.y));

    socket.emit('updatePosition', { x: player.x, y: player.y });

    let camX = player.x - centerX;
    let camY = player.y - centerY;

    drawGrid(camX, camY);

    // Rita Pellets
    for (let id in pellets) {
        let p = pellets[id];
        if (p.x > camX - 50 && p.x < camX + canvas.width + 50 &&
            p.y > camY - 50 && p.y < camY + canvas.height + 50) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            // LOGISKT SKYDDSNÄT: Om p.r inte existerar, använd 15.
            ctx.arc(p.x - camX, p.y - camY, p.r || 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; // Liten diskret kant på pellets
            ctx.stroke();
        }
    }

    // Rita andra spelare
    for (let id in otherPlayers) {
        let p = otherPlayers[id];
        ctx.fillStyle = 'red';
        ctx.beginPath();
        // Samma skyddsnät här för andras radie
        ctx.arc(p.x - camX, p.y - camY, p.r || 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'black';
        ctx.stroke();
    }

    // Rita dig själv
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'black';
    ctx.stroke();

    drawMinimap();

    requestAnimationFrame(draw);
}

draw();