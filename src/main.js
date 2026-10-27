import * as THREE from 'three';
import { createLobbyConnection } from './multiplayerConnection.js';
import { createBattlefield } from './battlefield.js';
import { createSoldier } from './soldier.js';
import { getWeaponImage } from './weaponImages.js';
import { createCombatEffects, playReload, playHitConfirmation, playElimination } from './combatEffects.js';
import './style.css';

// OPERATION SHADOWSTRIKE
// STEP 19B - ADVANCED WEAPONS + WEAPON IMAGE HUD

const app = document.querySelector('#app');
const $ = (selector) => document.querySelector(selector);

const WEAPONS = {
  assault: {
    name: 'ASSAULT RIFLE',
    short: 'ASSAULT',
    magazine: 30,
    damage: 25,
    targetDamage: 50,
    fireInterval: 150,
    reloadMs: 1200,
  },
  sniper: {
    name: 'SNIPER RIFLE',
    short: 'SNIPER',
    magazine: 5,
    damage: 75,
    targetDamage: 100,
    fireInterval: 1200,
    reloadMs: 2200,
  },
  pistol: {
    name: 'PISTOL',
    short: 'PISTOL',
    magazine: 12,
    damage: 20,
    targetDamage: 40,
    fireInterval: 350,
    reloadMs: 1000,
  },
};

const weaponIds = Object.keys(WEAPONS);

let currentWeapon = 'assault';

let ammoByWeapon = {
  assault: 30,
  sniper: 5,
  pistol: 12,
};

let ammo = 30;
let hp = 100;
let alive = true;
let reloading = false;
let lastShot = 0;
let reloadToken = 0;

let currentRoom = null;
let multiplayerActive = false;
let connectionBusy = false;
let lastNetworkUpdate = 0;

let targetKills = 0;

let messageTimer;
let hitTimer;
let muzzleTimer;
let deathInterval;

app.innerHTML = `
  <div id="hud">
    <strong>OPERATION SHADOWSTRIKE</strong>
    <span>TACTICAL MULTIPLAYER COMBAT</span>
    <span>WASD Move | Shift Sprint</span>
    <span>Mouse Move - 360° Camera</span>
    <span>Left Click Shoot | R Reload</span>
    <span>Right Click Change Weapon</span>
    <span>1 / 2 / 3 Select Weapon</span>
    <span>Esc Release Cursor</span>
    <span id="stats">HP: 100 | AMMO: 30/30</span>
    <span id="networkStatus">OFFLINE TRAINING</span>
  </div>

  <div id="crosshair">+</div>
  <div id="hitMarker" class="hidden">✕</div>
  <div id="message"></div>
  <div id="damageFlash"></div>
  <div id="muzzleOverlay"></div>

  <div id="lobby">
    <div class="lobby-card">
      <div class="eyebrow">TACTICAL OPERATIONS NETWORK</div>
      <h1>OPERATION<br>SHADOWSTRIKE</h1>
      <p class="subtitle">MULTIPLAYER COMBAT</p>

      <button id="createRoom">CREATE ROOM</button>

      <div class="separator">OR JOIN YOUR SQUAD</div>

      <input
        id="roomCode"
        placeholder="ENTER 6-CHARACTER ROOM CODE"
        maxlength="6"
        autocomplete="off"
      />

      <button id="joinRoom">JOIN ROOM</button>
      <button id="training" class="secondary">SOLO TRAINING</button>

      <p id="roomStatus" role="status" aria-live="polite">Ready to connect</p>
    </div>
  </div>

  <div id="roomPanel" class="hidden">
    <span id="roomLabel">ROOM: ------</span>
    <span id="playerCount">PLAYERS: 1/2</span>
    <button id="copyCode">COPY CODE</button>
    <button id="leaveRoom">LEAVE</button>
  </div>

  <div id="scoreboard" class="hidden">
    <div class="score-title">LIVE SCOREBOARD</div>
    <div id="scoreRows">Waiting for players...</div>
  </div>

  <div id="deathScreen" class="hidden">
    <h1>YOU WERE ELIMINATED</h1>
    <p>RESPAWNING IN <span id="respawnCount">3</span>...</p>
  </div>

  <div id="game"></div>

  <div id="weaponPanel" style="
    position:fixed;
    bottom:20px;
    right:20px;
    z-index:15;
    width:260px;
    background:rgba(4,12,23,.93);
    border:1px solid #24648a;
    border-radius:12px;
    padding:14px;
    color:white;
    font-family:Arial,sans-serif;
    pointer-events:none;
    box-shadow:0 8px 28px rgba(0,0,0,.4);
  ">
    <div style="
      color:#57d7ff;
      font-size:11px;
      letter-spacing:2px;
    ">EQUIPPED WEAPON</div>

    <div id="weaponPicture" style="
      height:112px;
      margin:6px 0;
      display:flex;
      align-items:center;
      justify-content:center;
    "></div>

    <div id="weaponName" style="
      font-size:18px;
      font-weight:bold;
    ">ASSAULT RIFLE</div>

    <div id="weaponAmmo" style="
      color:#8bffbf;
      font-size:21px;
      font-weight:bold;
      margin-top:6px;
    ">30 / 30</div>

    <div id="weaponDamage" style="
      font-size:11px;
      color:#a9c4d4;
      margin-top:5px;
    ">DAMAGE: 25</div>

    <div style="
      color:#88a2b5;
      font-size:10px;
      margin-top:8px;
    ">RIGHT CLICK TO SWITCH</div>
  </div>

  <div id="weaponSlots" style="
    position:fixed;
    bottom:20px;
    left:20px;
    z-index:15;
    display:flex;
    gap:8px;
    pointer-events:none;
    font-family:Arial,sans-serif;
  "></div>

  <div id="mouseHint" style="
    position:fixed;
    top:50%;
    left:50%;
    transform:translate(-50%,-50%);
    z-index:25;
    background:rgba(3,12,23,.9);
    border:1px solid #36bfff;
    border-radius:12px;
    padding:18px 24px;
    text-align:center;
    color:white;
    font-family:Arial,sans-serif;
    pointer-events:none;
    display:none;
  ">
    <strong style="color:#5ddaff">
      CLICK GAME TO CONTROL CAMERA
    </strong>
    <p style="font-size:12px;margin-bottom:0">
      Mouse Look | Right Click Switch | Esc Release
    </p>
  </div>

  <div id="scopeOverlay" style="
    position:fixed;
    inset:0;
    z-index:12;
    display:none;
    pointer-events:none;
    background:
      linear-gradient(
        to right,
        rgba(0,0,0,.75),
        transparent 26%,
        transparent 74%,
        rgba(0,0,0,.75)
      );
  ">
    <div style="
      position:absolute;
      left:50%;
      top:50%;
      width:min(70vw,70vh);
      height:min(70vw,70vh);
      transform:translate(-50%,-50%);
      border:3px solid rgba(15,25,30,.85);
      border-radius:50%;
      box-shadow:0 0 0 100vmax rgba(0,0,0,.72);
    "></div>
    <div style="
      position:absolute;
      left:50%;
      top:0;
      height:100%;
      width:1px;
      background:rgba(0,0,0,.75);
    "></div>
    <div style="
      position:absolute;
      top:50%;
      left:0;
      width:100%;
      height:1px;
      background:rgba(0,0,0,.75);
    "></div>
  </div>

  <div id="scopeButton" style="
    position:fixed;
    right:22px;
    bottom:240px;
    z-index:15;
    color:#a7dfff;
    font:11px Arial,sans-serif;
    pointer-events:none;
  "></div>
`;

// ==============================================
// WORLD
// ==============================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbac8c5);
scene.fog = new THREE.Fog(0xbac8c5, 48, 155);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);

// Limit fill-rate while retaining antialiasing on ordinary desktop displays.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

$('#game').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc9dce4, 0x69684b, 1.8));

const sun = new THREE.DirectionalLight(0xffe4bd, 3);

sun.position.set(32, 48, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 150 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.0001;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({
    color: 0x344638,
    roughness: 1,
  })
);

ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const obstacles = [];

function addBox(x, z, w, h, d, color = 0x58616b) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color })
  );

  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  scene.add(mesh);
  obstacles.push({ x, z, w, h, d, mesh });
}

addBox(-8, -7, 8, 5, 3);
addBox(9, -10, 5, 7, 7);
addBox(-12, 8, 6, 3, 6);
addBox(10, 9, 9, 4, 3);
addBox(0, -15, 4, 2, 4, 0x766a51);
addBox(-4, 4, 3, 2, 3, 0x766a51);
addBox(5, 3, 3, 2, 3, 0x766a51);

createBattlefield(scene, obstacles, ground, renderer);
const combatFX = createCombatEffects(scene);

function collides(x, z, radius = 0.38) {
  return obstacles.some(
    (o) =>
      x > o.x - o.w / 2 - radius &&
      x < o.x + o.w / 2 + radius &&
      z > o.z - o.d / 2 - radius &&
      z < o.z + o.d / 2 + radius
  );
}

// ==============================================
// SOLDIERS AND WEAPON MODELS
// ==============================================

const soldier = createSoldier(0x304b39);
scene.add(soldier);

const remotePlayers = new Map();

function weaponBox(parent, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);

  return mesh;
}

function buildWeaponModel(id) {
  const group = new THREE.Group();

  const dark = new THREE.MeshStandardMaterial({
    color: id === 'sniper' ? 0x343e31 : 0x242d35,
    metalness: 0.45,
    roughness: 0.5,
  });

  const metal = new THREE.MeshStandardMaterial({
    color: 0x11171c,
    metalness: 0.65,
    roughness: 0.35,
  });

  const accent = new THREE.MeshStandardMaterial({
    color: 0x59666c,
    metalness: 0.35,
    roughness: 0.55,
  });

  if (id === 'assault') {
    weaponBox(group, 0.18, 0.19, 0.82, dark, 0, 0, -0.32);
    weaponBox(group, 0.15, 0.15, 0.53, accent, 0, 0, -0.87);
    weaponBox(group, 0.065, 0.065, 0.54, metal, 0, 0, -1.32);
    weaponBox(group, 0.2, 0.2, 0.38, dark, 0, -0.02, 0.26);
    weaponBox(group, 0.15, 0.32, 0.2, metal, 0, -0.24, -0.37);
    weaponBox(group, 0.12, 0.12, 0.18, accent, 0, 0.17, -0.48);
  }

  if (id === 'sniper') {
    weaponBox(group, 0.17, 0.2, 1.12, dark, 0, 0, -0.4);
    weaponBox(group, 0.075, 0.075, 1.12, metal, 0, 0.02, -1.42);
    weaponBox(group, 0.24, 0.22, 0.48, dark, 0, -0.04, 0.35);
    weaponBox(group, 0.14, 0.3, 0.17, metal, 0, -0.24, -0.36);
    weaponBox(group, 0.09, 0.17, 0.14, metal, 0, 0.2, -0.42);

    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.62, 12),
      metal
    );

    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.3, -0.45);
    group.add(scope);

    weaponBox(group, 0.2, 0.19, 0.08, accent, 0, 0.3, -0.75);
  }

  if (id === 'pistol') {
    weaponBox(group, 0.17, 0.16, 0.55, metal, 0, 0, -0.27);
    weaponBox(group, 0.16, 0.13, 0.35, dark, 0, -0.12, -0.2);

    const grip = weaponBox(group, 0.16, 0.39, 0.17, dark, 0, -0.28, -0.08);

    grip.rotation.x = -0.2;

    weaponBox(group, 0.09, 0.08, 0.1, accent, 0, 0.1, -0.5);
    group.position.z = -0.1;
  }

  return group;
}

function prepareWeaponModels(character) {
  const rifle = character.userData.rifle;
  if (!rifle) return;

  for (const child of [...rifle.children]) {
    if (child.isMesh) child.visible = false;
  }

  const models = {};

  for (const id of weaponIds) {
    const model = buildWeaponModel(id);
    model.visible = id === 'assault';
    rifle.add(model);
    models[id] = model;
  }

  character.userData.weaponModels = models;
}

function setCharacterWeapon(character, id) {
  const models = character.userData.weaponModels;
  if (!models) return;

  for (const key of weaponIds) {
    models[key].visible = key === id;
  }
}

prepareWeaponModels(soldier);

// Opt-in local art study only; Vite removes this branch from production builds.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('soldierPreview') === '1') {
  import('./soldierPreview.js')
    .then(({ enableSoldierPreview }) => enableSoldierPreview(soldier, renderer))
    .catch(error => console.warn('Soldier preview unavailable; keeping original soldier:', error));
}

function addRemotePlayer(data) {
  if (!data || data.id === socket.id) return;

  let remote = remotePlayers.get(data.id);

  if (!remote) {
    const group = createSoldier(0x286ca0);
    prepareWeaponModels(group);
    scene.add(group);

    remote = {
      group,
      targetPosition: new THREE.Vector3(),
      targetRotation: 0,
      weapon: 'assault',
    };

    remotePlayers.set(data.id, remote);
  }

  if (data.position) {
    remote.targetPosition.set(data.position.x, 0, data.position.z);

    remote.group.position.copy(remote.targetPosition);
  }

  remote.targetRotation = data.rotation ?? 0;
  remote.group.rotation.y = remote.targetRotation;
  remote.group.visible = data.alive !== false;

  if (WEAPONS[data.weapon]) {
    remote.weapon = data.weapon;
    setCharacterWeapon(remote.group, data.weapon);
  }
}

function clearRemotePlayers() {
  for (const remote of remotePlayers.values()) {
    scene.remove(remote.group);
  }

  remotePlayers.clear();
}

// ==============================================
// WEAPON HUD
// ==============================================

let scoped = false;

function updateScope() {
  const active =
    scoped &&
    currentWeapon === 'sniper' &&
    alive &&
    $('#lobby').classList.contains('hidden');

  $('#scopeOverlay').style.display = active ? 'block' : 'none';

  $('#scopeButton').textContent =
    currentWeapon === 'sniper' ? 'PRESS Z TO TOGGLE SNIPER SCOPE' : '';

  camera.fov = active ? 25 : 65;
  camera.updateProjectionMatrix();
}

function updateWeaponHUD() {
  const weapon = WEAPONS[currentWeapon];

  ammo = ammoByWeapon[currentWeapon];

  $('#weaponPicture').innerHTML = getWeaponImage(currentWeapon);

  $('#weaponName').textContent = weapon.name;

  $('#weaponAmmo').textContent =
    `${ammo} / ${weapon.magazine}` + (reloading ? '  RELOADING...' : '');

  $('#weaponDamage').textContent =
    `PVP DAMAGE: ${weapon.damage} | ` + `TARGET: ${weapon.targetDamage}`;

  $('#weaponSlots').innerHTML = weaponIds
    .map((id, index) => {
      const selected = id === currentWeapon;

      return `
        <div style="
          min-width:80px;
          padding:10px;
          border-radius:8px;
          text-align:center;
          background:${selected ? 'rgba(20,65,110,.94)' : 'rgba(5,15,25,.85)'};
          border:2px solid ${selected ? '#44cfff' : '#355266'};
          color:${selected ? '#fff' : '#a9b9c6'};
        ">
          <div style="font-size:18px;font-weight:bold">
            ${index + 1}
          </div>
          <div style="font-size:10px;margin-top:5px">
            ${WEAPONS[id].short}
          </div>
          <div style="font-size:11px;margin-top:5px">
            ${ammoByWeapon[id]}/${WEAPONS[id].magazine}
          </div>
        </div>
      `;
    })
    .join('');

  updateScope();
}

function updateHUD() {
  updateWeaponHUD();

  $('#stats').textContent =
    `HP: ${hp} | ` +
    `${WEAPONS[currentWeapon].short}: ` +
    `${ammo}/${WEAPONS[currentWeapon].magazine} | ` +
    `TARGETS: ${targetKills}/5`;
}

function selectWeapon(id, notifyServer = true) {
  if (!WEAPONS[id] || !alive) return;

  const changed = currentWeapon !== id;

  if (changed) {
    reloadToken++;
    reloading = false;
    scoped = false;
  }

  currentWeapon = id;
  setCharacterWeapon(soldier, id);
  updateHUD();

  if (changed) {
    showMessage(`${WEAPONS[id].name} EQUIPPED`);
  }

  if (changed && notifyServer && multiplayerActive && socket.connected) {
    socket.emit('weapon-change', id);
  }
}

function nextWeapon() {
  const index = weaponIds.indexOf(currentWeapon);
  selectWeapon(weaponIds[(index + 1) % weaponIds.length]);
}

// ==============================================
// TARGETS
// ==============================================

const targetSpawns = [
  { id: 'T1', x: 0, z: -12 },
  { id: 'T2', x: -10, z: -15 },
  { id: 'T3', x: 12, z: -18 },
  { id: 'T4', x: -15, z: 0 },
  { id: 'T5', x: 15, z: 5 },
];

const targets = new Map();

function createTarget(data) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.7),
    new THREE.MeshStandardMaterial({
      color: 0xd12e35,
    })
  );

  mesh.position.set(data.x, 1, data.z);
  mesh.userData.targetId = data.id;
  scene.add(mesh);

  const targetAlive = data.alive !== false;

  targets.set(data.id, {
    mesh,
    hp: data.hp ?? 100,
    alive: targetAlive,
  });

  mesh.visible = targetAlive;
}

function resetTargets(list = targetSpawns) {
  for (const target of targets.values()) {
    scene.remove(target.mesh);
    target.mesh.geometry.dispose();
    target.mesh.material.dispose();
  }

  targets.clear();

  for (const data of list) createTarget(data);

  targetKills = [...targets.values()].filter((t) => !t.alive).length;

  updateHUD();
}

function updateTarget(data) {
  const target = targets.get(data.targetId);
  if (!target) return;

  target.hp = data.hp;

  if (target.hp > 0) {
    target.mesh.material.color.set(0xffffff);

    const mesh = target.mesh;

    setTimeout(() => {
      if (targets.get(data.targetId)?.mesh === mesh && target.alive) {
        mesh.material.color.set(0xd12e35);
      }
    }, 180);
  }
}

function destroyTarget(id) {
  const target = targets.get(id);
  if (!target || !target.alive) return;

  target.alive = false;
  target.hp = 0;
  target.mesh.visible = false;

  targetKills = [...targets.values()].filter((t) => !t.alive).length;

  updateHUD();
}

// ==============================================
// EFFECTS
// ==============================================

function showMessage(message) {
  $('#message').textContent = message;

  clearTimeout(messageTimer);

  messageTimer = setTimeout(() => {
    $('#message').textContent = '';
  }, 1300);
}

function showHitMarker() {
  $('#hitMarker').classList.remove('hidden');

  clearTimeout(hitTimer);

  hitTimer = setTimeout(() => {
    $('#hitMarker').classList.add('hidden');
  }, 300);
}

function showMuzzleFlash() {
  $('#muzzleOverlay').classList.add('active');

  clearTimeout(muzzleTimer);

  muzzleTimer = setTimeout(() => {
    $('#muzzleOverlay').classList.remove('active');
  }, 130);
}

function flashDamage() {
  $('#damageFlash').classList.add('active');

  setTimeout(() => {
    $('#damageFlash').classList.remove('active');
  }, 220);
}

const effects = [];

function bulletTracer(origin, direction, distance = 35) {
  const start = new THREE.Vector3(origin.x, origin.y, origin.z);

  const end = start
    .clone()
    .add(
      new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(
        distance
      )
    );

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([start, end]),
    new THREE.LineBasicMaterial({
      color: 0xffdc65,
      transparent: true,
      opacity: 0.9,
    })
  );

  scene.add(line);

  effects.push({
    object: line,
    expires: performance.now() + 120,
  });
}

function updateEffects() {
  const now = performance.now();

  for (let i = effects.length - 1; i >= 0; i--) {
    if (now < effects[i].expires) continue;

    const object = effects[i].object;
    scene.remove(object);
    object.geometry.dispose();
    object.material.dispose();
    effects.splice(i, 1);
  }
}

// ==============================================
// MULTIPLAYER
// ==============================================

const lobbyConnection = createLobbyConnection({
  serverUrl: import.meta.env.VITE_SOCKET_SERVER_URL?.trim() || undefined,
  onStatus(message) { $('#roomStatus').textContent = message; },
});
const socket = lobbyConnection.socket;

function updateScoreboard(players) {
  $('#playerCount').textContent = `PLAYERS: ${players.length}/2`;

  $('#scoreRows').innerHTML = [...players]
    .sort((a, b) => b.kills - a.kills)
    .map(
      (player) => `
      <div class="score-row">
        <span>${player.id === socket.id ? 'YOU' : 'OPPONENT'}</span>
        <span>K: ${player.kills}</span>
        <span>D: ${player.deaths}</span>
        <span>HP: ${player.hp}</span>
        <span>${WEAPONS[player.weapon]?.short || 'ASSAULT'}</span>
      </div>
    `
    )
    .join('');

  const self = players.find((p) => p.id === socket.id);

  if (self) {
    hp = self.hp;
    updateHUD();
  }
}

function resetPlayerWeapons() {
  ammoByWeapon = {
    assault: 30,
    sniper: 5,
    pistol: 12,
  };

  reloadToken++;
  reloading = false;
  scoped = false;
  lastShot = 0;
  selectWeapon('assault', false);
}

function enterRoom(response) {
  currentRoom = response.code;
  multiplayerActive = true;

  alive = true;
  hp = 100;

  resetPlayerWeapons();

  soldier.position.set(response.spawn.x, 0, response.spawn.z);

  soldier.visible = true;
  clearRemotePlayers();
  resetTargets(response.targets || targetSpawns);

  for (const player of response.players || []) {
    addRemotePlayer(player);
  }

  $('#lobby').classList.add('hidden');
  $('#roomPanel').classList.remove('hidden');
  $('#scoreboard').classList.remove('hidden');
  $('#deathScreen').classList.add('hidden');

  $('#roomLabel').textContent = `ROOM: ${currentRoom}`;

  $('#networkStatus').textContent = `ONLINE | ROOM ${currentRoom}`;

  updateScoreboard(response.players || []);
  updateHUD();
  updateMouseHint();

  showMessage('CONNECTED TO COMBAT ROOM');
}

async function requestRoom(eventName, code) {
  if (connectionBusy) return;
  connectionBusy = true;
  $('#createRoom').disabled = true;
  $('#joinRoom').disabled = true;
  try {
    const response = await lobbyConnection.request(eventName, code);
    if (response) enterRoom(response);
  } catch (error) {
    $('#roomStatus').textContent = error.message;
  } finally {
    connectionBusy = false;
    $('#createRoom').disabled = false;
    $('#joinRoom').disabled = false;
  }
}

$('#createRoom').onclick = () => requestRoom('create-room');

$('#joinRoom').onclick = () => {
  const code = $('#roomCode').value.trim().toUpperCase();

  if (code.length !== 6) {
    $('#roomStatus').textContent = 'Enter a valid 6-character room code';
    return;
  }

  requestRoom('join-room', code);
};

$('#training').onclick = () => {
  lobbyConnection.cancel();
  resetPlayerWeapons();
  resetTargets();

  $('#lobby').classList.add('hidden');
  $('#networkStatus').textContent = 'OFFLINE TRAINING';

  updateMouseHint();
  updateHUD();
};

$('#copyCode').onclick = async () => {
  if (!currentRoom) return;

  try {
    await navigator.clipboard.writeText(currentRoom);
    showMessage('ROOM CODE COPIED');
  } catch {
    showMessage(`ROOM CODE: ${currentRoom}`);
  }
};

function leaveGame() {
  currentRoom = null;
  multiplayerActive = false;

  lobbyConnection.cancel();

  alive = true;
  hp = 100;

  clearRemotePlayers();
  clearInterval(deathInterval);
  resetPlayerWeapons();
  resetTargets();

  soldier.visible = true;

  if (mouseLocked()) {
    document.exitPointerLock();
  }

  $('#roomPanel').classList.add('hidden');
  $('#scoreboard').classList.add('hidden');
  $('#deathScreen').classList.add('hidden');
  $('#lobby').classList.remove('hidden');

  $('#networkStatus').textContent = 'OFFLINE TRAINING';
  $('#roomStatus').textContent = 'Ready to connect';

  updateMouseHint();
  updateHUD();
}

$('#leaveRoom').onclick = leaveGame;

// ==============================================
// SOCKET EVENTS
// ==============================================

socket.on('player-joined', (player) => {
  if (!multiplayerActive) return;
  addRemotePlayer(player);
  showMessage('OPPONENT JOINED');
});

socket.on('player-moved', (data) => {
  if (!multiplayerActive) return;

  const remote = remotePlayers.get(data.id);

  if (!remote) {
    addRemotePlayer(data);
    return;
  }

  remote.targetPosition.set(data.position.x, 0, data.position.z);

  remote.targetRotation = data.rotation;
});

socket.on('player-left', (id) => {
  if (!multiplayerActive) return;

  const remote = remotePlayers.get(id);

  if (remote) {
    scene.remove(remote.group);
    remotePlayers.delete(id);
  }

  showMessage('OPPONENT LEFT');
});

socket.on('game-state', (players) => {
  if (!multiplayerActive) return;

  updateScoreboard(players);

  for (const player of players) {
    if (player.id === socket.id) continue;

    if (!remotePlayers.has(player.id)) {
      addRemotePlayer(player);
    }

    const remote = remotePlayers.get(player.id);

    if (remote) {
      remote.group.visible = player.alive !== false;

      if (WEAPONS[player.weapon]) {
        remote.weapon = player.weapon;
        setCharacterWeapon(remote.group, player.weapon);
      }
    }
  }
});

socket.on('weapon-state', (state) => {
  if (!multiplayerActive) return;

  if (state.ammo) {
    for (const id of weaponIds) {
      if (Number.isFinite(state.ammo[id])) {
        ammoByWeapon[id] = state.ammo[id];
      }
    }
  }

  if (WEAPONS[state.weapon]) {
    currentWeapon = state.weapon;
    setCharacterWeapon(soldier, currentWeapon);
  }

  reloading = !!state.reloading;
  updateHUD();
});

socket.on('weapon-changed', (data) => {
  if (!multiplayerActive) return;

  if (data.id === socket.id) {
    if (WEAPONS[data.weapon]) {
      currentWeapon = data.weapon;
      setCharacterWeapon(soldier, currentWeapon);
      updateHUD();
    }

    return;
  }

  const remote = remotePlayers.get(data.id);

  if (remote && WEAPONS[data.weapon]) {
    remote.weapon = data.weapon;
    setCharacterWeapon(remote.group, data.weapon);
  }
});

socket.on('ammo-update', (value) => {
  if (!multiplayerActive) return;

  if (Number.isFinite(value)) {
    ammoByWeapon[currentWeapon] = value;
    updateHUD();
  }
});

socket.on('shot-fired', (data) => {
  if (!multiplayerActive) return;

  bulletTracer(data.origin, data.direction, data.distance);

  if (data.shooterId !== socket.id) {
    const remote = remotePlayers.get(data.shooterId);

    if (remote) {
      remote.group.userData.playRecoil?.();

      if (WEAPONS[data.weapon]) {
        remote.weapon = data.weapon;
        setCharacterWeapon(remote.group, data.weapon);
      }
    }
  }
});

socket.on('target-hit', (data) => {
  if (!multiplayerActive) return;

  updateTarget(data);

  if (data.shooterId === socket.id) {
    showHitMarker();
    playHitConfirmation();
    showMessage(`TARGET HIT +${data.damage}`);
  }
});

socket.on('target-destroyed', (data) => {
  if (!multiplayerActive) return;

  destroyTarget(data.targetId);

  showMessage(
    data.shooterId === socket.id
      ? 'TARGET ELIMINATED!'
      : 'SQUAD DESTROYED A TARGET'
  );
});

socket.on('player-hit', (data) => {
  if (!multiplayerActive) return;

  if (data.targetId === socket.id) {
    hp = data.hp;
    flashDamage();
    showMessage(`HIT! -${data.damage} HP`);
    updateHUD();
  }

  if (data.shooterId === socket.id) {
    showHitMarker();
    playHitConfirmation();
    showMessage(`HIT CONFIRMED +${data.damage}`);
  }
});

socket.on('player-killed', (data) => {
  if (!multiplayerActive) return;

  if (data.victimId === socket.id) {
    alive = false;
    hp = 0;
    scoped = false;
    reloading = false;

    soldier.visible = false;
    updateHUD();

    $('#deathScreen').classList.remove('hidden');

    let seconds = 3;
    $('#respawnCount').textContent = seconds;

    clearInterval(deathInterval);

    deathInterval = setInterval(() => {
      seconds--;
      $('#respawnCount').textContent = Math.max(seconds, 0);

      if (seconds <= 0) clearInterval(deathInterval);
    }, 1000);
  }

  if (data.killerId === socket.id) {
    playElimination();
    showMessage('ENEMY ELIMINATED!');
  }

  const remote = remotePlayers.get(data.victimId);

  if (remote) remote.group.visible = false;
});

socket.on('player-respawned', (data) => {
  if (!multiplayerActive) return;

  if (data.id === socket.id) {
    alive = true;
    hp = 100;

    resetPlayerWeapons();

    soldier.position.set(data.position.x, 0, data.position.z);

    soldier.visible = true;

    $('#deathScreen').classList.add('hidden');
    clearInterval(deathInterval);

    showMessage('RESPAWNED!');
    updateHUD();
  } else {
    const remote = remotePlayers.get(data.id);

    if (remote) {
      remote.targetPosition.set(data.position.x, 0, data.position.z);

      remote.group.position.copy(remote.targetPosition);
      remote.group.visible = true;

      if (WEAPONS[data.weapon]) {
        remote.weapon = data.weapon;
        setCharacterWeapon(remote.group, data.weapon);
      }
    }
  }
});

socket.on('disconnect', (reason) => {
  if (!multiplayerActive) return;

  leaveGame();

  $('#roomStatus').textContent = `Connection lost (${reason}). Rooms are not restored automatically; create or join a room again.`;
});

// ==============================================
// AIMING
// ==============================================

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const UP = new THREE.Vector3(0, 1, 0);

function getFiringOrigin() {
  return new THREE.Vector3(soldier.position.x, 1.7, soldier.position.z);
}

function getAimDirection() {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(center, camera);
  raycaster.far = 100;

  const aimObjects = [
    ...obstacles.map((o) => o.mesh),
    ...[...targets.values()].filter((t) => t.alive).map((t) => t.mesh),
    ...[...remotePlayers.values()]
      .filter((r) => r.group.visible)
      .flatMap((r) => {
        const meshes = [];

        r.group.traverse((object) => {
          if (object.isMesh) meshes.push(object);
        });

        return meshes;
      }),
    ground,
  ];

  const hits = raycaster.intersectObjects(aimObjects, false);

  const aimPoint = hits.length
    ? hits[0].point.clone()
    : raycaster.ray.origin
        .clone()
        .add(raycaster.ray.direction.clone().multiplyScalar(80));

  return aimPoint.sub(getFiringOrigin()).normalize();
}

// ==============================================
// SHOOTING
// ==============================================

function shoot() {
  if (!alive || reloading) return;

  const weapon = WEAPONS[currentWeapon];

  if (ammoByWeapon[currentWeapon] <= 0) {
    showMessage('PRESS R TO RELOAD');
    return;
  }

  if (performance.now() - lastShot < weapon.fireInterval) {
    return;
  }

  lastShot = performance.now();

  const direction = getAimDirection();
  const origin = getFiringOrigin();

  showMuzzleFlash();
  combatFX.muzzleFlash(origin, currentWeapon);
  combatFX.shellEjection(origin);
  soldier.userData.playRecoil?.();
  soldier.userData.setAimDirection?.(direction);

  if (multiplayerActive && socket.connected) {
    socket.emit('shoot', {
      direction: {
        x: direction.x,
        y: direction.y,
        z: direction.z,
      },
    });

    return;
  }

  ammoByWeapon[currentWeapon]--;

  raycaster.set(origin, direction);
  raycaster.far = 80;

  const wallHits = raycaster.intersectObjects(obstacles.map((o) => o.mesh));

  const targetHits = raycaster.intersectObjects(
    [...targets.values()].filter((t) => t.alive).map((t) => t.mesh)
  );

  const wallDistance = wallHits[0]?.distance ?? Infinity;
  const targetHit = targetHits[0];

  const distance = Math.min(wallDistance, targetHit?.distance ?? Infinity, 80);

  bulletTracer(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: direction.x, y: direction.y, z: direction.z },
    distance
  );

  if (targetHit && targetHit.distance < wallDistance) {
    const id = targetHit.object.userData.targetId;
    const target = targets.get(id);

    if (target?.alive) {
      target.hp = Math.max(0, target.hp - weapon.targetDamage);

      showHitMarker();
      playHitConfirmation();

      if (target.hp === 0) {
        destroyTarget(id);
        playElimination();
        showMessage('TARGET ELIMINATED!');
      } else {
        updateTarget({
          targetId: id,
          hp: target.hp,
        });

        showMessage(`TARGET HIT +${weapon.targetDamage}`);
      }
    }
  }

  updateHUD();
}

function reload() {
  if (!alive || reloading) return;

  const id = currentWeapon;
  const weapon = WEAPONS[id];

  if (ammoByWeapon[id] >= weapon.magazine) return;

  reloading = true;
  const token = ++reloadToken;

  showMessage('RELOADING...');
  playReload();
  updateHUD();

  if (multiplayerActive && socket.connected) {
    socket.emit('reload');
    return;
  }

  setTimeout(() => {
    if (token !== reloadToken || !alive) return;

    ammoByWeapon[id] = weapon.magazine;
    reloading = false;

    updateHUD();
    showMessage('RELOAD COMPLETE');
  }, weapon.reloadMs);
}

// ==============================================
// MOUSE CONTROLS
// ==============================================

const keys = {};

let yaw = 0;
let pitch = 0;

const mouseSensitivity = 0.0025;

function gameActive() {
  return $('#lobby').classList.contains('hidden');
}

function mouseLocked() {
  return document.pointerLockElement === renderer.domElement;
}

function updateMouseHint() {
  $('#mouseHint').style.display =
    gameActive() && !mouseLocked() ? 'block' : 'none';
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!gameActive()) return;

  if (!mouseLocked()) {
    if (event.button === 0) {
      renderer.domElement.requestPointerLock?.();
    }
    return;
  }

  if (event.button === 0) shoot();
  if (event.button === 2) nextWeapon();
});

renderer.domElement.addEventListener('contextmenu', (event) =>
  event.preventDefault()
);

document.addEventListener('pointerlockchange', updateMouseHint);

document.addEventListener('mousemove', (event) => {
  if (!mouseLocked() || !gameActive()) return;

  yaw -= event.movementX * mouseSensitivity;
  pitch -= event.movementY * mouseSensitivity;

  pitch = THREE.MathUtils.clamp(pitch, -1.1, 1.1);
});

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
    event.preventDefault();
  }

  if (!gameActive()) return;

  keys[event.code] = true;

  if (event.repeat) return;

  if (event.code === 'KeyR') reload();

  if (event.code === 'Digit1') selectWeapon('assault');
  if (event.code === 'Digit2') selectWeapon('sniper');
  if (event.code === 'Digit3') selectWeapon('pistol');

  if (event.code === 'KeyZ' && currentWeapon === 'sniper') {
    scoped = !scoped;
    updateScope();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

window.addEventListener('blur', () => {
  for (const key in keys) keys[key] = false;
});

// ==============================================
// ANIMATION
// ==============================================

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  let moving = false;

  const sprinting = !!keys.ShiftLeft || !!keys.ShiftRight;

  if (gameActive() && alive && mouseLocked()) {
    const speed = (sprinting ? 9 : 5) * dt;

    const forward = Number(!!keys.KeyW) - Number(!!keys.KeyS);

    const sideways = Number(!!keys.KeyD) - Number(!!keys.KeyA);

    const movement = new THREE.Vector3(sideways, 0, -forward);

    if (movement.lengthSq() > 0) {
      movement.normalize();
      movement.applyAxisAngle(UP, yaw);

      const dx = movement.x * speed;
      const dz = movement.z * speed;

      const oldX = soldier.position.x;
      const oldZ = soldier.position.z;

      const nextX = THREE.MathUtils.clamp(oldX + dx, -45, 45);

      const nextZ = THREE.MathUtils.clamp(oldZ + dz, -45, 45);

      if (!collides(nextX, oldZ)) {
        soldier.position.x = nextX;
      }

      if (!collides(soldier.position.x, nextZ)) {
        soldier.position.z = nextZ;
      }

      moving =
        Math.abs(soldier.position.x - oldX) > 0.0001 ||
        Math.abs(soldier.position.z - oldZ) > 0.0001;
    }
  }

  soldier.rotation.y = yaw;

  soldier.userData.updateAnimation?.(dt, moving, sprinting);

  const cameraOffset = new THREE.Vector3(0.95, 2.75, 4.8);

  cameraOffset.applyAxisAngle(UP, yaw);

  const desiredPosition = soldier.position.clone().add(cameraOffset);

  camera.position.lerp(desiredPosition, Math.min(1, dt * 10));

  const horizontal = Math.cos(pitch);

  const lookDirection = new THREE.Vector3(
    -Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    -Math.cos(yaw) * horizontal
  );

  camera.lookAt(camera.position.clone().add(lookDirection));

  camera.updateMatrixWorld();

  if (alive) {
    soldier.userData.setAimDirection?.(getAimDirection());
  }

  for (const remote of remotePlayers.values()) {
    const previous = remote.group.position.clone();

    remote.group.position.lerp(remote.targetPosition, Math.min(1, dt * 12));

    remote.group.rotation.y = remote.targetRotation;

    const movedDistance = remote.group.position.distanceTo(previous);

    const remoteMoving = remote.group.visible && movedDistance > 0.0001;

    const remoteSpeed = dt > 0 ? movedDistance / dt : 0;

    remote.group.userData.updateAnimation?.(
      dt,
      remoteMoving,
      remoteSpeed > 6.5
    );
  }

  if (
    multiplayerActive &&
    socket.connected &&
    alive &&
    performance.now() - lastNetworkUpdate > 50
  ) {
    lastNetworkUpdate = performance.now();

    socket.emit('player-move', {
      position: {
        x: soldier.position.x,
        y: 0,
        z: soldier.position.z,
      },
      rotation: soldier.rotation.y,
    });
  }

  updateEffects();
  combatFX.update(dt);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

resetTargets();
updateHUD();
updateMouseHint();

console.log('OPERATION SHADOWSTRIKE - FULL UPGRADE READY');
