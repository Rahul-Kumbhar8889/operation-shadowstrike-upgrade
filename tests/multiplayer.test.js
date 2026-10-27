import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { io } from 'socket.io-client';
import { createLobbyConnection } from '../src/multiplayerConnection.js';

let server, base;
const origin = 'https://game.example.test';
before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: '0', CORS_ORIGINS: origin }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('Backend startup timed out')), 10000);
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Backend exited: ${code}`)); });
    server.stdout.on('data', data => {
      output += data;
      const match = output.match(/running on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
});
after(async () => { if (server?.exitCode === null) { server.kill(); await once(server, 'exit'); } });

function event(socket, name, predicate = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(Error(`Missing ${name}`)); }, timeout);
    function listener(data) {
      if (!predicate(data)) return;
      clearTimeout(timer); socket.off(name, listener); resolve(data);
    }
    socket.on(name, listener);
  });
}
async function client(transport, requestOrigin = origin) {
  const socket = io(base, { autoConnect: false, transports: [transport], reconnection: false,
    extraHeaders: { Origin: requestOrigin }, timeout: 2000 });
  const connected = Promise.race([event(socket, 'connect'), event(socket, 'connect_error').then(error => { throw error; })]);
  socket.connect(); await connected; return socket;
}

test('health, dynamic PORT, exact CORS origins, and denied browser origins', async () => {
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: 'ok' });
  const allowed = await fetch(`${base}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: origin } });
  assert.equal(allowed.status, 200); assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
  const denied = await fetch(`${base}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: 'https://other.example.test' } });
  assert.equal(denied.status, 403);
  const socket = io(base, { autoConnect: false, transports: ['websocket'], reconnection: false,
    extraHeaders: { Origin: 'https://other.example.test' }, timeout: 2000 });
  try { const rejected = event(socket, 'connect_error'); socket.connect(); await rejected; assert.equal(socket.connected, false); }
  finally { socket.disconnect(); }
});

test('two separate players: create/join, movement, weapons, damage, reload, respawn, capacity and leave', async () => {
  const clients = [];
  try {
    const a = await client('websocket'); clients.push(a);
    const b = await client('polling'); clients.push(b);
    const c = await client('websocket'); clients.push(c);
    const room = await a.timeout(2000).emitWithAck('create-room');
    assert.equal(room.ok, true); assert.match(room.code, /^[A-Z0-9]{6}$/); assert.equal(room.targets.length, 5);
    const joined = await b.timeout(2000).emitWithAck('join-room', room.code.toLowerCase());
    assert.equal(joined.ok, true); assert.equal(joined.players.length, 2);
    assert.equal((await c.timeout(2000).emitWithAck('join-room', room.code)).error, 'Room is full');
    assert.equal((await c.timeout(2000).emitWithAck('join-room', '!!!!!!')).error, 'Room not found');
    const moved = event(b, 'player-moved'); a.emit('player-move', { position: { x: 0.1, y: 0, z: 0 }, rotation: 0.2 });
    assert.equal((await moved).position.x, 0.1);
    const weapon = event(a, 'weapon-state', s => s.weapon === 'sniper'); a.emit('weapon-change', 'sniper');
    assert.equal((await weapon).ammo.sniper, 5);
    await new Promise(resolve => setTimeout(resolve, 1250));
    let hit = event(b, 'player-hit'); a.emit('shoot', { direction: { x: 1, y: 0, z: 0 } });
    assert.equal((await hit).hp, 25);
    await new Promise(resolve => setTimeout(resolve, 1250));
    const killed = event(b, 'player-killed'); const respawned = event(b, 'player-respawned');
    a.emit('shoot', { direction: { x: 1, y: 0, z: 0 } }); assert.equal((await killed).victimId, b.id);
    assert.equal((await respawned).hp, 100);
    const reload = event(a, 'weapon-state', s => s.ammo.sniper === 5 && !s.reloading);
    a.emit('reload'); await reload;
    const left = event(a, 'player-left'); const bId = b.id; b.disconnect(); assert.equal(await left, bId);
    assert.equal((await c.timeout(2000).emitWithAck('join-room', room.code)).ok, true);
  } finally { clients.forEach(s => s.disconnect()); }
});

test('lobby client: public URL, retry cleanup, acknowledgement timeout and cancellation', async () => {
  const statuses = [];
  const lobby = createLobbyConnection({ serverUrl: base, onStatus: s => statuses.push(s), ackTimeout: 100 });
  try {
    await assert.rejects(lobby.request('join-room', '!!!!!!'), /Room not found/);
    assert.equal(lobby.socket.listeners('connect').length, 0);
    assert.equal(lobby.socket.listeners('connect_error').length, 0);
    const room = await lobby.request('create-room'); assert.equal(room.ok, true);
    await assert.rejects(lobby.request('unknown-event'), /did not acknowledge/);
    const pending = lobby.request('create-room'); lobby.cancel(); assert.equal(await pending, null);
    assert.equal(lobby.socket.connected, false);
    assert.ok(statuses.some(s => s.includes('Creating room')));
  } finally { lobby.cancel(); }
  const invalid = createLobbyConnection({ serverUrl: 'invalid' });
  await assert.rejects(invalid.request('create-room'), /Invalid multiplayer server URL/); invalid.cancel();
});

test('lobby timeout on an unresponsive server leaves no stale listeners', async () => {
  const { createServer } = await import('node:http');
  const silent = createServer(() => {});
  silent.listen(0, '127.0.0.1'); await once(silent, 'listening');
  const lobby = createLobbyConnection({ serverUrl: `http://127.0.0.1:${silent.address().port}`, connectTimeout: 100 });
  try {
    await assert.rejects(lobby.request('create-room'), /Connection failed.*(timeout|timed out)/);
    assert.equal(lobby.socket.connected, false);
    assert.equal(lobby.socket.listeners('connect').length, 0);
    assert.equal(lobby.socket.listeners('connect_error').length, 0);
  } finally { lobby.cancel(); silent.closeAllConnections(); await new Promise(resolve => silent.close(resolve)); }
});
