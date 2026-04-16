const { v4: uuidv4 } = require('uuid');

const GAME_WIDTH = 3000;
const GAME_HEIGHT = 2000;
const PELLET_COUNT = 300;

function randomPos() {
  return {
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT
  };
}
function randomColor() {
  return `hsl(${Math.floor(Math.random()*360)}, 70%, 60%)`;
}

function createPellet() {
  const pos = randomPos();
  return {
    id: uuidv4(),
    x: pos.x,
    y: pos.y,
    mass: 3 + Math.random() * 3,
    color: "#E6C23A"
  };
}

function createPlayer(id) {
  const pos = randomPos();
  return {
    id,
    color: randomColor(),
    cells: [
      {
        id: uuidv4(),
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        mass: 30,
        splitTimeout: 0
      }
    ],
    input: {
      mouseX: pos.x,
      mouseY: pos.y,
      mouseDown: false,
      space: false,
      w: false
    }
  };
}

function addPlayer(id, players) {
  players[id] = createPlayer(id);
}
function removePlayer(id, players) {
  delete players[id];
}

function handlePlayerInput(id, input, players) {
  const p = players[id];
  if (!p) return;
  p.input = { ...p.input, ...input };
}

// ========== Game loop ==========
function gameTick(players, pellets, io) {
  // Move pellets with velocity
  for (const pellet of pellets) {
    if ('vx' in pellet) {
      pellet.x += pellet.vx;
      pellet.y += pellet.vy;
      pellet.vx *= pellet.decay;
      pellet.vy *= pellet.decay;
      if (Math.abs(pellet.vx) < 0.4 && Math.abs(pellet.vy) < 0.4) {
        pellet.vx = 0;
        pellet.vy = 0;
      }
    }
  }
  // Remove out-of-bounds pellets
  pellets = pellets.filter(p =>
    p.x > 0 && p.x < GAME_WIDTH && p.y > 0 && p.y < GAME_HEIGHT
  );

  // Players
  for (const player of Object.values(players)) {
    for (const cell of player.cells) {
      // Direction to mouse
      const dx = player.input.mouseX - cell.x;
      const dy = player.input.mouseY - cell.y;
      const dir = Math.atan2(dy, dx);
      let speed = 4 + 50 / Math.max(cell.mass, 10);

      // BOOST / "Slither" (mouseDown)
      if (player.input.mouseDown && cell.mass > 20) {
        speed *= 1.65;
        if (Math.random() < 0.22) {
          cell.mass -= 0.5;
          pellets.push({
            id: uuidv4(),
            x: cell.x - Math.cos(dir) * cell.mass * 0.72,
            y: cell.y - Math.sin(dir) * cell.mass * 0.72,
            mass: 1.5,
            color: "#F48A16"
          });
        }
      }

      // Move cell
      cell.x += Math.cos(dir) * speed;
      cell.y += Math.sin(dir) * speed;
      cell.x = Math.max(Math.min(cell.x, GAME_WIDTH), 0);
      cell.y = Math.max(Math.min(cell.y, GAME_HEIGHT), 0);

      // SPLIT (space)
      if (player.input.space && cell.splitTimeout <= 0 && cell.mass >= 30) {
        cell.splitTimeout = 15;
        const newMass = cell.mass / 2;
        cell.mass /= 2;
        player.cells.push({
          id: uuidv4(),
          x: cell.x + Math.cos(dir)*40,
          y: cell.y + Math.sin(dir)*40,
          vx: Math.cos(dir)*10,
          vy: Math.sin(dir)*10,
          mass: newMass,
          color: player.color,
          splitTimeout: 25
        });
      }
      if (cell.splitTimeout > 0) cell.splitTimeout--;

      // SHOOT (W)
      if (player.input.w && cell.mass > 20) {
        shootPellet(cell, dir, pellets);
        player.input.w = false;
      }

      // Eat pellets
      for (let pellet of pellets.slice()) {
        if (distance(cell.x, cell.y, pellet.x, pellet.y) < Math.sqrt(cell.mass + pellet.mass)*2.4) {
          cell.mass += pellet.mass;
          pellets = pellets.filter(p => p.id !== pellet.id);
        }
      }
    }
  }

  // Refill if too few pellets
  while (pellets.length < PELLET_COUNT) pellets.push(createPellet());
}

function distance(x1,y1,x2,y2){
  return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
}

function shootPellet(cell, dir, pellets, power = 7, loss = 7) {
  if (cell.mass < loss + 10) return;
  cell.mass -= loss;
  pellets.push({
    id: uuidv4(),
    x: cell.x + Math.cos(dir)*cell.mass*0.6,
    y: cell.y + Math.sin(dir)*cell.mass*0.6,
    mass: loss,
    color: "#85DD65",
    vx: Math.cos(dir) * power,
    vy: Math.sin(dir) * power,
    decay: 0.98
  });
}

function getGameState(players, pellets) {
  return {
    players: Object.values(players).map(player => ({
      id: player.id,
      color: player.color,
      cells: player.cells.map(cell => ({
        id: cell.id,
        x: cell.x,
        y: cell.y,
        mass: cell.mass
      })),
      score: player.cells.reduce((acc, cell) => acc + cell.mass, 0)
    })),
    pellets: pellets.map(p => ({
      x: p.x, y: p.y, mass: p.mass, color: p.color
    })),
    bounds: { width: GAME_WIDTH, height: GAME_HEIGHT }
  };
}

module.exports = {
  handlePlayerInput,
  getGameState,
  gameTick,
  addPlayer,
  removePlayer
};