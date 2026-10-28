import { WEAPONS, createAmmo, shotDirections } from '../shared/weapons.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const publicRoot = resolve('dist');
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};


// OPERATION SHADOWSTRIKE
// STEP 19B - ADVANCED WEAPON SERVER

const port = Number(process.env.PORT || 3001);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const originAllowed = (origin) => !origin || allowedOrigins.includes(origin);

const httpServer = createServer(async (req, res) => {
  // Match the path independently of query strings and a trailing slash.
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if ((req.method === 'GET' || req.method === 'HEAD') &&
      (pathname === '/health' || pathname === '/health/')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    try {
      const requested = decodeURIComponent(pathname);
      const file = resolve(publicRoot, '.' + (requested === '/' ? '/index.html' : requested));
      if (file.startsWith(publicRoot + sep) && (await stat(file)).isFile()) {
        res.writeHead(200, {'Content-Type': MIME[extname(file)] || 'application/octet-stream',
          'Cache-Control': requested.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
          'X-Content-Type-Options':'nosniff'});
        if (req.method === 'HEAD') res.end();
        else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
        return;
      }
    } catch { /* Missing assets receive 404; never expose source files. */ }
  }
  res.writeHead(req.url === '/' ? 200 : 404, { 'Content-Type': 'text/plain' });
  res.end(req.url === '/' ? 'Operation Shadowstrike multiplayer server' : 'Not found');
});

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) { callback(null, originAllowed(origin)); },
    methods: ['GET', 'POST'],
  },
  // CORS alone does not restrict WebSocket handshakes.
  allowRequest: (req, callback) => {
    let sameOrigin = false;
    try { sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch {}
    callback(null, sameOrigin || originAllowed(req.headers.origin));
  },
  transports: ['websocket', 'polling'],
});

const rooms = new Map();

const MAX_HP = 100;
const SCORE_LIMIT = 5;
const RESPAWN_MS = 3000;
const MAX_DISTANCE = 80;

const DEFAULT_WEAPON = 'assault';

const obstacles = [
  [-8, -7, 8, 5, 3],
  [9, -10, 5, 7, 7],
  [-12, 8, 6, 3, 6],
  [10, 9, 9, 4, 3],
  [0, -15, 4, 2, 4],
  [-4, 4, 3, 2, 3],
  [5, 3, 3, 2, 3],
];

const targetSpawns = [
  { id: 'T1', x: 0, z: -12 },
  { id: 'T2', x: -10, z: -15 },
  { id: 'T3', x: 12, z: -18 },
  { id: 'T4', x: -15, z: 0 },
  { id: 'T5', x: 15, z: 5 },
];

function createTargets() {
  return new Map(
    targetSpawns.map((target) => [
      target.id,
      {
        ...target,
        hp: 100,
        alive: true,
      },
    ])
  );
}

function makeCode() {
  let code;

  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (code.length !== 6 || rooms.has(code));

  return code;
}

function spawnFor(slot) {
  return slot === 0 ? { x: 0, y: 0, z: 0 } : { x: 3, y: 0, z: 0 };
}

function publicPlayer(id, player) {
  return {
    id,
    position: player.position,
    rotation: player.rotation,
    hp: player.hp,
    kills: player.kills,
    deaths: player.deaths,
    alive: player.alive,
    weapon: player.weapon,
  };
}

function allPlayers(room) {
  return [...room.players].map(([id, player]) => publicPlayer(id, player));
}

function allTargets(room) {
  return [...room.targets.values()];
}

function roundState(room) {
  return { winner: room.winner || null, scoreLimit: SCORE_LIMIT, ready: [...(room.ready || [])] };
}
function sendState(code, room) {
  io.to(code).emit('round-state', roundState(room));
  io.to(code).emit('game-state', allPlayers(room));
}

function sendWeaponState(socket, player) {
  socket.emit('weapon-state', {
    weapon: player.weapon,
    ammo: { ...player.ammo },
    reloading: player.reloading,
    weapons: WEAPONS,
  });
}

function sendAmmo(socket, player) {
  socket.emit('ammo-update', player.ammo[player.weapon]);

  sendWeaponState(socket, player);
}

function validVector(vector) {
  return (
    vector &&
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}

function collides(x, z, radius = 0.38) {
  return obstacles.some(
    ([bx, bz, w, h, d]) =>
      x > bx - w / 2 - radius &&
      x < bx + w / 2 + radius &&
      z > bz - d / 2 - radius &&
      z < bz + d / 2 + radius
  );
}

function rayBoxDistance(origin, dir, box) {
  const [bx, bz, w, h, d] = box;

  const min = {
    x: bx - w / 2,
    y: 0,
    z: bz - d / 2,
  };

  const max = {
    x: bx + w / 2,
    y: h,
    z: bz + d / 2,
  };

  let tMin = 0;
  let tMax = MAX_DISTANCE;

  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis];
    const v = dir[axis];

    if (Math.abs(v) < 0.000001) {
      if (o < min[axis] || o > max[axis]) {
        return Infinity;
      }

      continue;
    }

    let t1 = (min[axis] - o) / v;
    let t2 = (max[axis] - o) / v;

    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);

    if (tMin > tMax) {
      return Infinity;
    }
  }

  return tMin;
}

function rayPlayerDistance(origin, dir, player) {
  const radius = 0.65;

  const dx = origin.x - player.position.x;
  const dz = origin.z - player.position.z;

  const a = dir.x * dir.x + dir.z * dir.z;

  if (a < 0.000001) {
    return Infinity;
  }

  const b = 2 * (dx * dir.x + dz * dir.z);

  const c = dx * dx + dz * dz - radius * radius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return Infinity;
  }

  const root = Math.sqrt(discriminant);

  const distances = [(-b - root) / (2 * a), (-b + root) / (2 * a)];

  for (const t of distances) {
    if (t < 0 || t > MAX_DISTANCE) {
      continue;
    }

    const y = origin.y + dir.y * t;

    if (y >= 0.1 && y <= 2.4) {
      return t;
    }
  }

  return Infinity;
}

function rayTargetDistance(origin, dir, target) {
  return rayBoxDistance(origin, dir, [target.x, target.z, 1, 2, 0.7]);
}

function cancelReload(player) {
  if (player.reloadTimer) {
    clearTimeout(player.reloadTimer);
    player.reloadTimer = null;
  }

  player.reloading = false;
}

function leaveRoom(socket) {
  const code = socket.data.roomCode;

  if (!code) return;

  const room = rooms.get(code);

  socket.leave(code);
  socket.data.roomCode = null;

  if (!room) return;

  const player = room.players.get(socket.id);

  if (player?.respawnTimer) {
    clearTimeout(player.respawnTimer);
  }

  if (player) {
    cancelReload(player);
  }

  room.players.delete(socket.id);
  room.ready?.delete(socket.id);

  socket.to(code).emit('player-left', socket.id);

  if (room.players.size === 0) {
    rooms.delete(code);
  } else {
    sendState(code, room);
  }
}

function addPlayer(socket, room, code) {
  const used = new Set([...room.players.values()].map((player) => player.slot));

  const slot = used.has(0) ? 1 : 0;
  const spawn = spawnFor(slot);

  const player = {
    slot,
    position: { ...spawn },
    rotation: 0,
    hp: MAX_HP,
    kills: 0,
    deaths: 0,
    alive: true,

    weapon: DEFAULT_WEAPON,
    ammo: createAmmo(),

    reloading: false,
    reloadTimer: null,

    lastShot: 0,
    lastMove: Date.now(),
    respawnTimer: null,
  };

  room.players.set(socket.id, player);

  socket.join(code);
  socket.data.roomCode = code;

  return spawn;
}

function roomResponse(socket, room, code, spawn) {
  return {
    ok: true,
    code,
    playerId: socket.id,
    spawn,
    players: allPlayers(room),
    targets: allTargets(room),
    weapons: WEAPONS,
    round: roundState(room),
  };
}

// ================================================
// SOCKET CONNECTION
// ================================================

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // ==============================================
  // CREATE ROOM
  // ==============================================

  socket.on('create-room', (callback) => {
    if (typeof callback !== 'function') {
      return;
    }

    leaveRoom(socket);

    const code = makeCode();

    const room = {
      players: new Map(),
      targets: createTargets(),
      winner: null,
      ready: new Set(),
    };

    rooms.set(code, room);

    const spawn = addPlayer(socket, room, code);

    callback(roomResponse(socket, room, code, spawn));

    sendWeaponState(socket, room.players.get(socket.id));

    sendState(code, room);
  });

  // ==============================================
  // JOIN ROOM
  // ==============================================

  socket.on('join-room', (rawCode, callback) => {
    if (typeof callback !== 'function') {
      return;
    }

    const code = String(rawCode || '')
      .trim()
      .toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      callback({
        ok: false,
        error: 'Room not found',
      });

      return;
    }

    if (room.players.size >= 2 && !room.players.has(socket.id)) {
      callback({
        ok: false,
        error: 'Room is full',
      });

      return;
    }

    if (socket.data.roomCode === code) {
      callback(
        roomResponse(socket, room, code, room.players.get(socket.id).position)
      );

      sendWeaponState(socket, room.players.get(socket.id));

      return;
    }

    leaveRoom(socket);

    const spawn = addPlayer(socket, room, code);

    callback(roomResponse(socket, room, code, spawn));

    const player = room.players.get(socket.id);

    socket.to(code).emit('player-joined', publicPlayer(socket.id, player));

    sendWeaponState(socket, player);
    sendState(code, room);
  });

  // ==============================================
  // PLAYER MOVEMENT
  // ==============================================

  socket.on('player-move', (data) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);

    const player = room?.players.get(socket.id);

    if (
      !player ||
      !player.alive ||
      !validVector(data?.position) ||
      !Number.isFinite(data.rotation)
    ) {
      return;
    }

    const { x, z } = data.position;

    if (Math.abs(x) > 45 || Math.abs(z) > 45) {
      return;
    }

    if (collides(x, z)) return;

    const now = Date.now();

    const elapsed = Math.max(
      0.016,
      Math.min((now - player.lastMove) / 1000, 0.5)
    );

    const distance = Math.hypot(x - player.position.x, z - player.position.z);

    if (distance > 12 * elapsed + 1.5) {
      return;
    }

    player.position = {
      x,
      y: 0,
      z,
    };

    player.rotation = data.rotation;
    player.lastMove = now;

    socket.to(code).emit('player-moved', {
      id: socket.id,
      position: player.position,
      rotation: player.rotation,
    });
  });

  // ==============================================
  // NEW: WEAPON SWITCHING
  // ==============================================

  socket.on('weapon-change', (requested) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);

    const player = room?.players.get(socket.id);

    if (!player || !player.alive) {
      return;
    }

    // Accept only predefined weapon IDs.
    if (typeof requested !== 'string' || !Object.hasOwn(WEAPONS, requested)) {
      return;
    }

    if (player.weapon === requested) {
      sendWeaponState(socket, player);

      return;
    }

    cancelReload(player);

    player.weapon = requested;

    // Prevent switching weapons to bypass
    // the current fire cooldown.
    player.lastShot = Date.now();

    sendAmmo(socket, player);

    io.to(code).emit('weapon-changed', {
      id: socket.id,
      weapon: requested,
    });

    sendState(code, room);
  });

  // ==============================================
  // SHOOTING
  // ==============================================

  socket.on('request-rematch', () => {
    const code=socket.data.roomCode, room=rooms.get(code);
    if(!room?.winner || !room.players.has(socket.id))return;
    room.ready.add(socket.id);
    if(room.players.size===2 && [...room.players.keys()].every(id=>room.ready.has(id))) {
      room.winner=null;room.ready.clear();room.targets=createTargets();
      for(const [id,p] of room.players) {
        clearTimeout(p.respawnTimer);p.respawnTimer=null;cancelReload(p);
        Object.assign(p,{position:spawnFor(p.slot),hp:MAX_HP,alive:true,kills:0,deaths:0,
          ammo:createAmmo(),weapon:DEFAULT_WEAPON,lastShot:0,lastMove:Date.now()});
        io.to(code).emit('player-respawned',{id,position:p.position,hp:MAX_HP,weapon:DEFAULT_WEAPON});
        const targetSocket=io.sockets.sockets.get(id);if(targetSocket)sendAmmo(targetSocket,p);
      }
      io.to(code).emit('targets-reset',allTargets(room));
    }
    sendState(code,room);
  });

  socket.on('shoot', (data) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);

    const shooter = room?.players.get(socket.id);

    if (!shooter || !shooter.alive || room.winner) {
      return;
    }

    const weapon = WEAPONS[shooter.weapon];

    const now = Date.now();

    if (
      now - shooter.lastShot < weapon.fireInterval ||
      shooter.reloading ||
      shooter.ammo[shooter.weapon] <= 0
    ) {
      return;
    }

    if (!validVector(data?.direction)) {
      return;
    }

    const dir = data.direction;

    const length = Math.hypot(dir.x, dir.y, dir.z);

    if (Math.abs(length - 1) > 0.01) {
      return;
    }

    shooter.lastShot = now;

    shooter.ammo[shooter.weapon]--;

    sendAmmo(socket, shooter);

    // Origin is controlled by the server.
    const origin = {
      x: shooter.position.x,
      y: 1.7,
      z: shooter.position.z,
    };

    for (const dir of shotDirections(data.direction, weapon)) {
    let wallDistance = weapon.range;

    for (const box of obstacles) {
      wallDistance = Math.min(wallDistance, rayBoxDistance(origin, dir, box));
    }

    let closest = null;
    let closestDistance = wallDistance;

    // Check opponent.
    for (const [id, player] of room.players) {
      if (id === socket.id || !player.alive) {
        continue;
      }

      const distance = rayPlayerDistance(origin, dir, player);

      if (distance < closestDistance) {
        closestDistance = distance;

        closest = {
          type: 'player',
          id,
          entity: player,
        };
      }
    }

    // Check shared targets.
    for (const target of room.targets.values()) {
      if (!target.alive) continue;

      const distance = rayTargetDistance(origin, dir, target);

      if (distance < closestDistance) {
        closestDistance = distance;

        closest = {
          type: 'target',
          id: target.id,
          entity: target,
        };
      }
    }

    io.to(code).emit('shot-fired', {
      shooterId: socket.id,
      weapon: shooter.weapon,
      origin,
      direction: dir,
      distance: Math.min(closestDistance, MAX_DISTANCE),
    });

    if (!closest) continue;

    // ============================================
    // TARGET DAMAGE
    // ============================================

    if (closest.type === 'target') {
      const target = closest.entity;

      target.hp = Math.max(0, target.hp - weapon.targetDamage);

      io.to(code).emit('target-hit', {
        targetId: target.id,
        shooterId: socket.id,
        weapon: shooter.weapon,
        hp: target.hp,
        damage: weapon.targetDamage,
      });

      if (target.hp === 0) {
        target.alive = false;

        io.to(code).emit('target-destroyed', {
          targetId: target.id,
          shooterId: socket.id,
          remaining: [...room.targets.values()].filter((target) => target.alive)
            .length,
        });
      }

      continue;
    }

    // ============================================
    // PVP DAMAGE
    // ============================================

    const targetId = closest.id;
    const target = closest.entity;

    target.hp = Math.max(0, target.hp - weapon.damage);

    io.to(code).emit('player-hit', {
      targetId,
      shooterId: socket.id,
      weapon: shooter.weapon,
      hp: target.hp,
      damage: weapon.damage,
    });

    if (target.hp === 0) {
      target.alive = false;
      target.deaths++;

      shooter.kills++;
      if(shooter.kills >= SCORE_LIMIT) room.winner=socket.id;

      cancelReload(target);

      io.to(code).emit('player-killed', {
        killerId: socket.id,
        victimId: targetId,
        weapon: shooter.weapon,
      });

      target.respawnTimer = setTimeout(() => {
        if (room.players.get(targetId) !== target) {
          return;
        }

        target.position = spawnFor(target.slot);

        target.hp = MAX_HP;
        target.alive = true;

        target.ammo = createAmmo();
        target.weapon = DEFAULT_WEAPON;

        target.lastShot = 0;
        target.lastMove = Date.now();
        target.respawnTimer = null;

        cancelReload(target);

        io.to(code).emit('player-respawned', {
          id: targetId,
          position: target.position,
          hp: MAX_HP,
          weapon: target.weapon,
        });

        io.to(code).emit('weapon-changed', {
          id: targetId,
          weapon: DEFAULT_WEAPON,
        });

        io.to(targetId).emit('ammo-update', WEAPONS[DEFAULT_WEAPON].magazine);

        const targetSocket = io.sockets.sockets.get(targetId);

        if (targetSocket) {
          sendWeaponState(targetSocket, target);
        }

        sendState(code, room);
      }, RESPAWN_MS);
    }

    sendState(code, room);
    }
  });

  // ==============================================
  // NEW: WEAPON-SPECIFIC RELOAD
  // ==============================================

  socket.on('reload', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);

    const player = room?.players.get(socket.id);

    if (!player || !player.alive || player.reloading) {
      return;
    }

    const weaponId = player.weapon;
    const weapon = WEAPONS[weaponId];

    if (player.ammo[weaponId] >= weapon.magazine) {
      return;
    }

    player.reloading = true;

    sendWeaponState(socket, player);

    player.reloadTimer = setTimeout(() => {
      if (room.players.get(socket.id) !== player) {
        return;
      }

      if (!player.alive || player.weapon !== weaponId) {
        return;
      }

      player.ammo[weaponId] = weapon.magazine;

      player.reloading = false;
      player.reloadTimer = null;

      sendAmmo(socket, player);
    }, weapon.reloadMs);
  });

  // ==============================================
  // DISCONNECT
  // ==============================================

  socket.on('disconnect', () => {
    leaveRoom(socket);

    console.log('Disconnected:', socket.id);
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Multiplayer server running on port ${httpServer.address().port}`);
});
