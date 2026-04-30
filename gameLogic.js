const { v4: uuidv4 } = require('uuid');

const GAME_WIDTH = 3400;
const GAME_HEIGHT = 2200;
const PELLET_COUNT = 350;

function randomPos() {
  return {
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT
  };
}

// Färgval i agar/slither-stil
function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 52%)`;
}

// Skapa matbit
function createPellet(x, y, mass, color = "#E6C23A") {
  const pos = (x !== undefined && y !== undefined) ? { x, y } : randomPos();
  return {
    id: uuidv4(),
    x: pos.x,
    y: pos.y,
    mass: mass !== undefined ? mass : 3 + Math.random() * 3,
    color
  };
}

// Skapa spelare
function createPlayer(id) {
  const pos = randomPos();
  return {
    id,
    color: randomColor(),
    cells: [{
      id: uuidv4(),
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      mass: 40,
      splitTimeout: 0
    }],
    input: {
      mouseX: pos.x,
      mouseY: pos.y,
      mouseDown: false,
      space: false,
      w: false
    }
  };
}

function addPlayer(id, players) { players[id] = createPlayer(id); }
function removePlayer(id, players) { delete players[id]; }
function handlePlayerInput(id, input, players) {
  const p = players[id];
  if (!p) return;
  p.input = { ...p.input, ...input };
}

// Hjälp-funktioner
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Game loop
function gameTick(players, pellets, io) {
  // Pellets skjuts ut (har vx/vy)
  for (const pellet of pellets) {
    if ('vx' in pellet) {
      pellet.x += pellet.vx;
      pellet.y += pellet.vy;
      pellet.vx *= pellet.decay || 0.97;
      pellet.vy *= pellet.decay || 0.97;
      if (Math.abs(pellet.vx) < 0.4 && Math.abs(pellet.vy) < 0.4) {
        pellet.vx = 0;
        pellet.vy = 0;
      }
    }
  }
  // Ta bort pellets utanför världen
  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i];
    if (p.x < 0 || p.x > GAME_WIDTH || p.y < 0 || p.y > GAME_HEIGHT) pellets.splice(i, 1);
  }

  for (const player of Object.values(players)) {
    for (const cell of player.cells) {
      // Rörelse mot muspekarens världskoordinater
      const dx = player.input.mouseX - cell.x;
      const dy = player.input.mouseY - cell.y;
      const dir = Math.atan2(dy, dx);
      let speed = 4 + 90 / Math.max(cell.mass, 18);

      // Slither-boost (mouseDown)
      if (player.input.mouseDown && cell.mass > 20) {
        speed *= 1.68;
        // Tappa massa och lämna spår av mat
        if (Math.random() < 0.30) {
          cell.mass -= 0.65;
          pellets.push(createPellet(cell.x - Math.cos(dir) * 15, cell.y - Math.sin(dir) * 15, 1.5, "#F48A16"));
        }
      }

      cell.x += Math.cos(dir) * speed;
      cell.y += Math.sin(dir) * speed;
      cell.x = Math.max(Math.min(cell.x, GAME_WIDTH), 0);
      cell.y = Math.max(Math.min(cell.y, GAME_HEIGHT), 0);

      // SPLIT: Space – skjut ut hälften snett fram��t
      if (player.input.space && cell.splitTimeout <= 0 && cell.mass >= 32) {
        cell.splitTimeout = 18;
        const newMass = cell.mass / 2;
        cell.mass /= 2;

        player.cells.push({
          id: uuidv4(),
          x: cell.x + Math.cos(dir) * 50,
          y: cell.y + Math.sin(dir) * 50,
          vx: Math.cos(dir) * 12,
          vy: Math.sin(dir) * 12,
          mass: newMass,
          color: player.color,
          splitTimeout: 25
        });
      }
      if (cell.splitTimeout > 0) cell.splitTimeout--;

      // SHOOT (W): Spottar ut massa
      if (player.input.w && cell.mass > 16) {
        cell.mass -= 2;
        pellets.push({
          id: uuidv4(),
          x: cell.x + Math.cos(dir) * 20,
          y: cell.y + Math.sin(dir) * 20,
          mass: 2,
          color: "#38df63",
          vx: Math.cos(dir) * 9,
          vy: Math.sin(dir) * 9,
          decay: 0.97
        });
        player.input.w = false;
      }
      // Ät pellets (mat och massa på marken)
      for (const pellet of pellets.slice()) {
        const dist = distance(cell.x, cell.y, pellet.x, pellet.y);
        if (dist < Math.sqrt(cell.mass + pellet.mass) * 2.2) {
          cell.mass += pellet.mass;
          pellets.splice(pellets.indexOf(pellet), 1);
        }
      }
    }
    // Sammanfoga celler om de är nära (agera ihopslagning!)
    if (player.cells.length > 1) {
      for (let i = player.cells.length - 1; i > 0; i--) {
        let c1 = player.cells[i], c2 = player.cells[i-1];
        if (distance(c1.x, c1.y, c2.x, c2.y) < Math.sqrt(c1.mass + c2.mass) * 1.3) {
          c2.mass += c1.mass; player.cells.splice(i, 1);
        }
      }
    }
  }
  // Fyll på pellets så de alltid finns PELLET_COUNT st
  while (pellets.length < PELLET_COUNT) pellets.push(createPellet());
}

// Skickar all nödvändig state till klienten
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
      score: player.cells.reduce((a, c) => a + c.mass, 0)
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
  removePlayer,
  createPellet
};