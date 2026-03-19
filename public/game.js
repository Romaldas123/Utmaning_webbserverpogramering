const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    r: 20,
    color: 'blue'
};

let mouse = { x: canvas.width / 2, y: canvas.height / 2 };

window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
});

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let dx = mouse.x - player.x;
    let dy = mouse.y - player.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    let maxSpeed = 3; 
    let friction = 0.03; // Hur snabbt den saktar ner 

    if (distance > 1) {
        let speed = Math.min(maxSpeed, distance * friction);
        player.x += (dx / distance) * speed;
        player.y += (dy / distance) * speed;
    }

    socket.emit('updatePosition', { x: player.x, y: player.y });

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();

    requestAnimationFrame(draw);
}

draw();