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

test('Render health route accepts query strings, trailing slash and HEAD', async () => {
  for (const path of ['/health', '/health/', '/health?probe=render', '/health/?probe=render']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok' });
  }
  const head = await fetch(`${base}/health`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(`${base}/health-invalid`)).status, 404);
  assert.equal((await fetch(`${base}/health`, { method: 'POST' })).status, 404);
  assert.match(await fetch(base).then(response => response.text()), /Operation Shadowstrike/i);
});

test('same-origin deployment permits multiplayer and never serves source files', async () => {
  const socket = await client('websocket', base);
  try { assert.equal((await socket.timeout(2000).emitWithAck('create-room')).ok,true); }
  finally {socket.disconnect();}
  for(const path of ['/server/index.js','/.env.production','/package.json','/%2e%2e%2fpackage.json']) {
    assert.equal((await fetch(base+path)).status,404,path);
  }
});

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

test('five kills ends combat; rematch requires both players and resets score', async () => {
  const a=await client('websocket'), b=await client('websocket');
  try {
    const room=await a.timeout(2000).emitWithAck('create-room');
    await b.timeout(2000).emitWithAck('join-room',room.code);
    for(let kill=0;kill<5;kill++) {
      const dead=event(b,'player-killed');
      const respawn=event(b,'player-respawned');
      for(let shot=0;shot<4;shot++) {
        const hit=event(b,'player-hit');a.emit('shoot',{direction:{x:1,y:0,z:0}});await hit;
        await new Promise(r=>setTimeout(r,160));
      }
      await dead;await respawn;
    }
    const state=event(a,'round-state',s=>s.winner===a.id&&s.ready.length===1);
    a.emit('request-rematch');assert.equal((await state).winner,a.id);
    let damage=false;const mark=()=>damage=true;b.on('player-hit',mark);
    a.emit('shoot',{direction:{x:1,y:0,z:0}});await new Promise(r=>setTimeout(r,200));
    b.off('player-hit',mark);assert.equal(damage,false,'round result blocks further damage');
    const reset=event(a,'game-state',players=>players.length===2&&players.every(p=>p.kills===0&&p.deaths===0&&p.hp===100));
    b.emit('request-rematch');await reset;
    const hit=event(b,'player-hit');a.emit('shoot',{direction:{x:1,y:0,z:0}});assert.equal((await hit).hp,75);
  } finally {a.disconnect();b.disconnect();}
});

test('new weapons use server ammunition and shotgun resolves eight pellets per shell',async()=>{
 const a=await client('websocket'),b=await client('websocket');
 try{
  const room=await a.timeout(2000).emitWithAck('create-room');await b.timeout(2000).emitWithAck('join-room',room.code);
  let changed=event(a,'weapon-state',s=>s.weapon==='shotgun');a.emit('weapon-change','shotgun');assert.equal((await changed).ammo.shotgun,8);
  await new Promise(r=>setTimeout(r,950));
  let pellets=0;const count=()=>pellets++;b.on('player-hit',count);
  const hit=event(b,'player-hit',s=>s.hp===4);const spent=event(a,'weapon-state',s=>s.ammo.shotgun===7);
  a.emit('shoot',{direction:{x:1,y:0,z:0}});await hit;await spent;b.off('player-hit',count);assert.equal(pellets,8);
  changed=event(a,'weapon-state',s=>s.weapon==='smg');a.emit('weapon-change','smg');assert.equal((await changed).ammo.smg,35);
  await new Promise(r=>setTimeout(r,100));const killed=event(b,'player-killed');a.emit('shoot',{direction:{x:1,y:0,z:0}});await killed;
  changed=event(a,'weapon-state',s=>s.weapon==='lmg');a.emit('weapon-change','lmg');assert.equal((await changed).ammo.lmg,75);
  await new Promise(r=>setTimeout(r,130));const lmg=event(a,'weapon-state',s=>s.ammo.lmg===74);a.emit('shoot',{direction:{x:0,y:0,z:1}});await lmg;
 }finally{a.disconnect();b.disconnect();}
});
