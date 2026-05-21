const { v4: uuidv4 } = require('uuid');

const GAME_WIDTH = 7600;
const GAME_HEIGHT = 5200;
const PELLET_COUNT = 1100;
const PELLET_GRID_SIZE = 180;
const MAX_CELLS_PER_PLAYER = 8;

const CELL_RADIUS_SCALE = 10;
const PELLET_RADIUS_SCALE = 4.2;

const BASE_SPEED = 135;
const SPEED_MASS_FACTOR = 1150;
const BOOST_MULTIPLIER = 1.7;
const BOOST_MIN_MASS = 22;
const BOOST_MASS_LOSS_PER_SECOND = 30;
const BOOST_DROP_INTERVAL = 0.08;
const BOOST_DROP_VISUAL_MASS = 1.4;
const BOOST_DROP_VALUE_MASS = 0.35;

const SPLIT_MIN_MASS = 36;
const SPLIT_IMPULSE = 760;
const SPLIT_DECAY_PER_TICK = 0.91;
const EJECT_MIN_MASS = 26;
const EJECT_MASS = 9;
const EJECT_SPEED = 620;
const EJECT_INTERVAL = 0.18;
const BOOST_SELF_EAT_DELAY = 2.5;
const EJECT_SELF_EAT_DELAY = 0.8;
const LEADERBOARD_LIMIT = 8;
const PLAYER_EAT_MASS_RATIO = 1.15;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomPos() {
  return {
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT
  };
}

function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 52%)`;
}

function sanitizePlayerName(name) {
  const cleaned = String(name || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);

  return cleaned || 'Spelare';
}

function sanitizeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : randomColor();
}

function distanceSquared(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

function cellRadius(mass) {
  return Math.sqrt(mass) * CELL_RADIUS_SCALE;
}

function pelletRadius(mass) {
  return Math.sqrt(mass) * PELLET_RADIUS_SCALE;
}

function createPellet(
  x,
  y,
  mass,
  color = '#E6C23A',
  vx = 0,
  vy = 0,
  valueMass = mass,
  kind = 'food',
  ownerId = null,
  selfEatDelay = 0
) {
  const pos = (Number.isFinite(x) && Number.isFinite(y)) ? { x, y } : randomPos();
  const visualMass = Number.isFinite(mass) ? mass : 3 + Math.random() * 3;

  return {
    id: uuidv4(),
    x: clamp(pos.x, 0, GAME_WIDTH),
    y: clamp(pos.y, 0, GAME_HEIGHT),
    vx,
    vy,
    mass: visualMass,
    valueMass: Number.isFinite(valueMass) ? valueMass : visualMass,
    color,
    kind,
    ownerId,
    selfEatDelay,
    age: 0,
    decay: 0.965,
    eaten: false
  };
}

function createPlayer(id, options = {}) {
  const pos = randomPos();

  return {
    id,
    name: sanitizePlayerName(options.name),
    color: sanitizeColor(options.color),
    cells: [{
      id: uuidv4(),
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      mass: 40,
      mergeTimer: 0,
      boostDropTimer: 0,
      ejectTimer: 0
    }],
    input: {
      mouseX: pos.x,
      mouseY: pos.y,
      mouseDown: false,
      spaceDown: false,
      wDown: false,
      splitRequested: false,
      ejectRequested: false
    }
  };
}

function addPlayer(id, players, options = {}) {
  players[id] = createPlayer(id, options);
  return players[id];
}

function removePlayer(id, players) {
  delete players[id];
}

function handlePlayerInput(id, input, players) {
  const player = players[id];
  if (!player || !input) return;

  if (Number.isFinite(input.mouseX)) player.input.mouseX = clamp(input.mouseX, 0, GAME_WIDTH);
  if (Number.isFinite(input.mouseY)) player.input.mouseY = clamp(input.mouseY, 0, GAME_HEIGHT);

  player.input.mouseDown = Boolean(input.mouseDown);

  const nextSpaceDown = Boolean(input.space);
  if ((input.split || nextSpaceDown) && !player.input.spaceDown) {
    player.input.splitRequested = true;
  }
  player.input.spaceDown = nextSpaceDown;

  const nextWDown = Boolean(input.w);
  if ((input.eject || nextWDown) && !player.input.wDown) {
    player.input.ejectRequested = true;
  }
  player.input.wDown = nextWDown;
}

function getMergeCooldown(mass) {
  return clamp(3.2 + Math.sqrt(Math.max(mass, 1)) * 0.52, 4, 20);
}

function createInitialPellets() {
  return Array.from({ length: PELLET_COUNT }, () => createPellet());
}

function movePellets(pellets, dt) {
  const tickScale = dt * 60;

  for (const pellet of pellets) {
    pellet.eaten = false;
    pellet.age = (pellet.age || 0) + dt;

    if (pellet.vx || pellet.vy) {
      pellet.x += pellet.vx * dt;
      pellet.y += pellet.vy * dt;
      pellet.vx *= Math.pow(pellet.decay || 0.965, tickScale);
      pellet.vy *= Math.pow(pellet.decay || 0.965, tickScale);

      if (Math.abs(pellet.vx) < 8 && Math.abs(pellet.vy) < 8) {
        pellet.vx = 0;
        pellet.vy = 0;
      }
    }
  }

  compactPellets(pellets);
}

function compactPellets(pellets) {
  let writeIndex = 0;

  for (let readIndex = 0; readIndex < pellets.length; readIndex++) {
    const pellet = pellets[readIndex];
    const outsideWorld = pellet.x < 0 || pellet.x > GAME_WIDTH || pellet.y < 0 || pellet.y > GAME_HEIGHT;

    if (!pellet.eaten && !outsideWorld) {
      pellets[writeIndex] = pellet;
      writeIndex++;
    }
  }

  pellets.length = writeIndex;
}

function gridKey(gridX, gridY) {
  return `${gridX}:${gridY}`;
}

function buildPelletGrid(pellets) {
  const grid = new Map();

  for (let index = 0; index < pellets.length; index++) {
    const pellet = pellets[index];
    const gridX = Math.floor(pellet.x / PELLET_GRID_SIZE);
    const gridY = Math.floor(pellet.y / PELLET_GRID_SIZE);
    const key = gridKey(gridX, gridY);

    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(index);
  }

  return grid;
}

function eatNearbyPellets(playerId, cell, pellets, pelletGrid) {
  const radius = cellRadius(cell.mass);
  const minX = Math.floor((cell.x - radius) / PELLET_GRID_SIZE);
  const maxX = Math.floor((cell.x + radius) / PELLET_GRID_SIZE);
  const minY = Math.floor((cell.y - radius) / PELLET_GRID_SIZE);
  const maxY = Math.floor((cell.y + radius) / PELLET_GRID_SIZE);

  for (let gridX = minX; gridX <= maxX; gridX++) {
    for (let gridY = minY; gridY <= maxY; gridY++) {
      const indexes = pelletGrid.get(gridKey(gridX, gridY));
      if (!indexes) continue;

      for (const index of indexes) {
        const pellet = pellets[index];
        if (!pellet || pellet.eaten) continue;
        if (pellet.ownerId === playerId && pellet.age < pellet.selfEatDelay) continue;

        const eatRadius = radius + pelletRadius(pellet.mass) * 0.35;
        if (distanceSquared(cell.x, cell.y, pellet.x, pellet.y) <= eatRadius * eatRadius) {
          cell.mass += pellet.valueMass;
          pellet.eaten = true;
        }
      }
    }
  }
}

function directionToMouse(player, cell) {
  const dx = player.input.mouseX - cell.x;
  const dy = player.input.mouseY - cell.y;
  const length = Math.hypot(dx, dy);

  if (length < 1) {
    return { x: 0, y: 0 };
  }

  return {
    x: dx / length,
    y: dy / length
  };
}

function moveCell(player, cell, dt, pellets) {
  const direction = directionToMouse(player, cell);
  const speed = (BASE_SPEED + SPEED_MASS_FACTOR / Math.sqrt(Math.max(cell.mass, 16)))
    * (player.input.mouseDown && cell.mass > BOOST_MIN_MASS ? BOOST_MULTIPLIER : 1);

  if (player.input.mouseDown && cell.mass > BOOST_MIN_MASS) {
    applyBoostTrail(player.id, cell, direction, dt, pellets);
  } else {
    cell.boostDropTimer = 0;
  }

  const tickScale = dt * 60;
  cell.x += direction.x * speed * dt + cell.vx * dt;
  cell.y += direction.y * speed * dt + cell.vy * dt;
  cell.vx *= Math.pow(SPLIT_DECAY_PER_TICK, tickScale);
  cell.vy *= Math.pow(SPLIT_DECAY_PER_TICK, tickScale);
  cell.x = clamp(cell.x, 0, GAME_WIDTH);
  cell.y = clamp(cell.y, 0, GAME_HEIGHT);
  cell.mergeTimer = Math.max(0, cell.mergeTimer - dt);
}

function applyBoostTrail(playerId, cell, direction, dt, pellets) {
  cell.mass = Math.max(BOOST_MIN_MASS, cell.mass - BOOST_MASS_LOSS_PER_SECOND * dt);
  cell.boostDropTimer += dt;

  while (cell.boostDropTimer >= BOOST_DROP_INTERVAL && cell.mass > BOOST_MIN_MASS) {
    cell.boostDropTimer -= BOOST_DROP_INTERVAL;

    pellets.push(createPellet(
      cell.x - direction.x * (cellRadius(cell.mass) * 0.72),
      cell.y - direction.y * (cellRadius(cell.mass) * 0.72),
      BOOST_DROP_VISUAL_MASS,
      '#F48A16',
      -direction.x * 45,
      -direction.y * 45,
      BOOST_DROP_VALUE_MASS,
      'boost',
      playerId,
      BOOST_SELF_EAT_DELAY
    ));
  }
}

function splitCell(player, cell, direction) {
  if (player.cells.length >= MAX_CELLS_PER_PLAYER || cell.mass < SPLIT_MIN_MASS) return;

  const newMass = cell.mass / 2;
  const radius = cellRadius(newMass);
  const mergeCooldown = getMergeCooldown(newMass);
  cell.mass = newMass;
  cell.mergeTimer = mergeCooldown;

  player.cells.push({
    id: uuidv4(),
    x: clamp(cell.x + direction.x * radius * 1.35, 0, GAME_WIDTH),
    y: clamp(cell.y + direction.y * radius * 1.35, 0, GAME_HEIGHT),
    vx: direction.x * SPLIT_IMPULSE,
    vy: direction.y * SPLIT_IMPULSE,
    mass: newMass,
    mergeTimer: mergeCooldown,
    boostDropTimer: 0,
    ejectTimer: 0
  });
}

function hasEnoughMassToEject(cell) {
  return cell.mass >= EJECT_MIN_MASS + EJECT_MASS;
}

function ejectMass(playerId, cell, direction, pellets) {
  if (!hasEnoughMassToEject(cell)) return false;

  cell.mass -= EJECT_MASS;
  pellets.push(createPellet(
    cell.x + direction.x * (cellRadius(cell.mass) + 10),
    cell.y + direction.y * (cellRadius(cell.mass) + 10),
    EJECT_MASS,
    '#38df63',
    direction.x * EJECT_SPEED,
    direction.y * EJECT_SPEED,
    EJECT_MASS,
    'ejected',
    playerId,
    EJECT_SELF_EAT_DELAY
  ));

  return true;
}

function applyEjectStream(playerId, cell, direction, dt, pellets, fireImmediately) {
  if (fireImmediately) cell.ejectTimer = 0;
  cell.ejectTimer -= dt;

  while (cell.ejectTimer <= 0 && hasEnoughMassToEject(cell)) {
    if (!ejectMass(playerId, cell, direction, pellets)) break;
    cell.ejectTimer += EJECT_INTERVAL;
  }
}

function resolveOwnCells(player) {
  for (let i = player.cells.length - 1; i >= 0; i--) {
    const first = player.cells[i];

    for (let j = i - 1; j >= 0; j--) {
      const second = player.cells[j];
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const dist = Math.hypot(dx, dy) || 1;
      const r1 = cellRadius(first.mass);
      const r2 = cellRadius(second.mass);
      const canMerge = first.mergeTimer <= 0 && second.mergeTimer <= 0;

      if (canMerge && dist < Math.max(r1, r2) * 0.72) {
        second.x = (second.x * second.mass + first.x * first.mass) / (second.mass + first.mass);
        second.y = (second.y * second.mass + first.y * first.mass) / (second.mass + first.mass);
        second.mass += first.mass;
        player.cells.splice(i, 1);
        break;
      }

      if (!canMerge && dist < r1 + r2) {
        const push = (r1 + r2 - dist) * 0.022;
        const nx = dx / dist;
        const ny = dy / dist;
        first.x = clamp(first.x - nx * push, 0, GAME_WIDTH);
        first.y = clamp(first.y - ny * push, 0, GAME_HEIGHT);
        second.x = clamp(second.x + nx * push, 0, GAME_WIDTH);
        second.y = clamp(second.y + ny * push, 0, GAME_HEIGHT);
      }
    }
  }
}

function canCellEatCell(eaterCell, victimCell) {
  if (eaterCell.mass < victimCell.mass * PLAYER_EAT_MASS_RATIO) return false;

  const eaterRadius = cellRadius(eaterCell.mass);
  const victimRadius = cellRadius(victimCell.mass);
  const eatDistance = Math.max(eaterRadius - victimRadius * 0.28, eaterRadius * 0.35);

  return distanceSquared(eaterCell.x, eaterCell.y, victimCell.x, victimCell.y) <= eatDistance * eatDistance;
}

function resolvePlayerEating(players) {
  const playerList = Object.values(players);
  const deadPlayerIds = new Set();
  const deaths = [];

  for (const eater of playerList) {
    if (deadPlayerIds.has(eater.id)) continue;

    for (const eaterCell of eater.cells) {
      for (const victim of playerList) {
        if (eater.id === victim.id || deadPlayerIds.has(victim.id)) continue;

        for (let i = victim.cells.length - 1; i >= 0; i--) {
          const victimCell = victim.cells[i];
          if (!canCellEatCell(eaterCell, victimCell)) continue;

          eaterCell.mass += victimCell.mass;
          victim.cells.splice(i, 1);

          if (victim.cells.length === 0) {
            deadPlayerIds.add(victim.id);
            deaths.push({
              playerId: victim.id,
              playerName: victim.name,
              killerId: eater.id,
              killerName: eater.name
            });
          }
        }
      }
    }
  }

  for (const playerId of deadPlayerIds) {
    delete players[playerId];
  }

  return deaths;
}

function gameTick(players, pellets, dt = 1 / 60) {
  const safeDt = clamp(dt, 1 / 120, 1 / 20);
  movePellets(pellets, safeDt);

  const pelletGrid = buildPelletGrid(pellets);

  for (const player of Object.values(players)) {
    const cellsAtTickStart = player.cells.slice();

    for (const cell of cellsAtTickStart) {
      if (!player.cells.includes(cell)) continue;

      const direction = directionToMouse(player, cell);
      moveCell(player, cell, safeDt, pellets);

      if (player.input.wDown || player.input.ejectRequested) {
        applyEjectStream(player.id, cell, direction, safeDt, pellets, player.input.ejectRequested);
      } else {
        cell.ejectTimer = 0;
      }

      if (player.input.splitRequested) splitCell(player, cell, direction);

      eatNearbyPellets(player.id, cell, pellets, pelletGrid);
    }

    resolveOwnCells(player);
    player.input.splitRequested = false;
    player.input.ejectRequested = false;
  }

  const deaths = resolvePlayerEating(players);

  compactPellets(pellets);

  while (pellets.length < PELLET_COUNT) {
    pellets.push(createPellet());
  }

  return { deaths };
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function getPlayerScore(player) {
  return player.cells.reduce((total, cell) => total + cell.mass, 0);
}

function getShortPlayerName(playerId) {
  return `Player ${playerId.slice(0, 4)}`;
}

function getLeaderboard(players) {
  return Object.values(players)
    .map(player => ({
      id: player.id,
      name: player.name || getShortPlayerName(player.id),
      color: player.color,
      score: roundNumber(getPlayerScore(player))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_LIMIT)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}

function getGameState(players, pellets) {
  return {
    players: Object.values(players).map(player => ({
      id: player.id,
      name: player.name,
      color: player.color,
      cells: player.cells.map(cell => ({
        id: cell.id,
        x: roundNumber(cell.x),
        y: roundNumber(cell.y),
        mass: roundNumber(cell.mass),
        mergeTimer: roundNumber(cell.mergeTimer)
      })),
      score: roundNumber(getPlayerScore(player))
    })),
    pellets: pellets.map(pellet => ({
      x: roundNumber(pellet.x),
      y: roundNumber(pellet.y),
      mass: roundNumber(pellet.mass),
      color: pellet.color,
      kind: pellet.kind
    })),
    leaderboard: getLeaderboard(players),
    bounds: { width: GAME_WIDTH, height: GAME_HEIGHT }
  };
}

module.exports = {
  addPlayer,
  removePlayer,
  handlePlayerInput,
  getGameState,
  gameTick,
  createPellet,
  createInitialPellets
};
