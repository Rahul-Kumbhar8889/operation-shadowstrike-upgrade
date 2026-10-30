import {getQuality,setQuality,applyRendererQuality} from './graphics.js';
import {createWeaponModel} from './weaponModels.js';
import {createVoiceChat} from './voiceChat.js';
import {aimDirection} from './aim.js';
import {interactionMessage} from './missionFeedback.js';
import {syncRemoteLife} from './remoteLife.js';
import {applyDeathPose} from './deathPose.js';
import {createTouchControls} from './touchControls.js';
import {EQUIPMENT,createEquipment,throwLanding,healHealth,smokeBlocks} from '../shared/equipment.js';
import {createEquipmentEffects} from './equipmentEffects.js';
import { WEAPONS, createAmmo, shotDirections } from '../shared/weapons.js';
import * as THREE from 'three';
import { createLobbyConnection } from './multiplayerConnection.js';
import { createBattlefield } from './battlefield.js';
import { createSoldier } from './soldier.js';
import { getWeaponImage } from './weaponImages.js';
import { createCombatEffects, playReload, playHitConfirmation, playElimination, playFootstep, playHeal, playSmoke, playPin, playGunshot, setSoundMuted, unlockAudio, preloadCombatAudio, playGunshotAt, playInjury } from './combatEffects.js';
import './style.css';
import { createCampaign } from './campaign.js';
import { CAMPAIGN_MAX_HP } from '../shared/campaign.js';

// OPERATION SHADOWSTRIKE
// STEP 19B - ADVANCED WEAPONS + WEAPON IMAGE HUD

const app = document.querySelector('#app');
const $ = (selector) => document.querySelector(selector);

const weaponIds = Object.keys(WEAPONS);

let currentWeapon = 'assault';
let inventory=createEquipment(),pendingThrows=[],smokeClouds=[],lastEquipment=0,footstepTime=0,viewKick=0,soundMuted=false;

let ammoByWeapon = createAmmo();

let ammo = 30;
let hp = 100;
let alive = true;
let reloading = false;
let lastShot = 0;
let fireHeld = false;
let reloadToken = 0;

let currentRoom = null;
let lastRoomCode=null;
let multiplayerActive = false;
let coopMode=false;
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
    <span>1–9 Weapons | G Frag | B Smoke | H Injection</span>
    <span>V Camera | M Menu | Esc Release Cursor</span>
    <span id="stats">HP: 100 | AMMO: 30/30</span>
    <span id="networkStatus">OFFLINE TRAINING</span>
    <button id="inGameHelp" type="button" aria-label="Open field manual">FIELD MANUAL · F1</button>
  </div>

  <button id="soundToggle" aria-pressed="false">SOUND ON</button><div id="equipmentHUD"></div><div id="healFlash"></div><div id="smokeOverlay"></div>
  <div id="crosshair">+</div>
  <div id="hitMarker" class="hidden">✕</div>
  <div id="message"></div>
  <div id="damageFlash"></div>
  <div id="muzzleOverlay"></div>

  <div id="lobby">
    <div class="lobby-card">
      <div class="eyebrow">TACTICAL OPERATIONS NETWORK</div>
      <h1>OPERATION<br>SHADOWSTRIKE</h1>
      <p class="subtitle">CO-OP MISSIONS + 1V1 ARENA</p>

      <select id="missionSelect" aria-label="Select story operation"><option value="0">01 / Railway Interdiction</option><option value="1">02 / Signal Blackout</option><option value="2">03 / Nightfall Extraction</option><option value="3">04 / Iron Horizon Airfield</option></select>
      <label class="graphics-setting">GRAPHICS <select id="graphicsQuality" aria-label="Graphics quality"><option value="low">Low — faster</option><option value="balanced">Balanced</option><option value="high">High — more detail</option></select></label>
      <button id="createCoop">CREATE CO-OP MISSION ROOM</button>
      <button id="createRoom" class="secondary">CREATE 1V1 ARENA ROOM (OPTIONAL)</button>

      <div class="separator">OR JOIN YOUR SQUAD</div>

      <input
        id="roomCode"
        placeholder="ENTER 6-CHARACTER ROOM CODE"
        maxlength="6"
        autocomplete="off"
      />

      <button id="joinRoom">JOIN ROOM</button>

      <button id="campaign">SOLO STORY — 4 MISSIONS</button>
      <p class="mode-rules">Co-op: two players fight guards and complete shared missions. Select an operation, create a co-op room, share its code, then Start Mission.<br>Solo story: clear guards, secure intel, extract alive.<br>Multiplayer: 1v1 combat, first to 5 kills wins; both players agree to rematch.<br>Desktop keyboard/mouse or phone touch controls.</p>
      <button id="howToPlay" class="secondary">HOW TO PLAY</button>
      <button id="training" class="secondary">SOLO TRAINING</button>

      <p id="roomStatus" role="status" aria-live="polite">Ready to connect</p>
    </div>
  </div>

  <div id="roomPanel" class="hidden">
    <span id="roomLabel">ROOM: ------</span>
    <span id="playerCount">PLAYERS: 1/2</span>
    <button id="copyCode">COPY CODE</button>
    <button id="voiceButton" aria-pressed="false">ENABLE VOICE</button>
    <button id="voiceRetry">RETRY VOICE</button>
    <button id="voiceOff">VOICE OFF</button>
    <span id="voiceStatus" role="status">Voice off</span>
    <button id="leaveRoom">LEAVE</button>
  </div>
  <audio id="voiceAudio" autoplay playsinline></audio>

  <div id="scoreboard" class="hidden">
    <div class="score-title">LIVE SCOREBOARD</div><p id="roundStatus">FIRST TO 5 KILLS</p><button id="rematch" class="hidden">READY FOR REMATCH</button>
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
const skyCanvas=document.createElement('canvas');skyCanvas.width=1024;skyCanvas.height=512;
const sky=skyCanvas.getContext('2d'),gradient=sky.createLinearGradient(0,0,0,512);gradient.addColorStop(0,'#467b9e');gradient.addColorStop(.45,'#a8c2cd');gradient.addColorStop(.55,'#ccd2bd');gradient.addColorStop(1,'#7d8368');sky.fillStyle=gradient;sky.fillRect(0,0,1024,512);
for(let n=0;n<40;n++){const x=(n*137)%1024,y=90+(n*37)%120;const cloud=sky.createRadialGradient(x,y,1,x,y,70);cloud.addColorStop(0,'rgba(245,245,228,.12)');cloud.addColorStop(1,'rgba(245,245,228,0)');sky.fillStyle=cloud;sky.fillRect(x-70,y-70,140,140);}
const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.mapping=THREE.EquirectangularReflectionMapping;skyTexture.colorSpace=THREE.SRGBColorSpace;scene.background=skyTexture;
scene.fog = new THREE.Fog(0xbac8c5, 95, 340);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  450
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
scene.add(sun);scene.add(sun.target);
applyRendererQuality(renderer,sun);$('#graphicsQuality').value=getQuality();$('#graphicsQuality').onchange=event=>{setQuality(event.target.value);applyRendererQuality(renderer,sun);lobbyRendered=false;};

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
const equipmentFX=createEquipmentEffects(scene);
$('#soundToggle').onclick=()=>{soundMuted=!soundMuted;setSoundMuted(soundMuted);$('#soundToggle').textContent=soundMuted?'SOUND OFF':'SOUND ON';$('#soundToggle').setAttribute('aria-pressed',String(soundMuted));};

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
let firstPerson = false;
const campaign = createCampaign({scene, obstacles, player:soldier, getPlayerId:()=>socket.id, getTeammates:()=>[...remotePlayers.values()].map(remote=>({x:remote.targetPosition.x,z:remote.targetPosition.z,alive:remote.alive})), message:showMessage, tracer:bulletTracer, blood:position=>combatFX.bloodImpact(position), demolition:position=>combatFX.explosion(position),
  onDamage(damage) {
    if (!alive) return;
    hp=Math.max(0,hp-damage);flashDamage();updateHUD();
    if(hp===0){
      alive=false;firstPerson=false;scoped=false;reloadToken++;reloading=false;
      for(const key in keys)keys[key]=false;
      campaign.fail();updateScope();updateMouseHint();
    }
  },
  onReset(position) { alive=true;hp=CAMPAIGN_MAX_HP;soldier.rotation.set(0,0,0);for(const key in keys)keys[key]=false;resetPlayerWeapons();resetTargets([]);soldier.position.set(position.x,0,position.z);soldier.visible=true;firstPerson=true;yaw=0;pitch=0;updateHUD();updateMouseHint(); }
});
campaign.setExit(leaveGame);
campaign.setNetworkAction(action=>socket.emit(action==='interact'?'coop-interact':action==='start'?'coop-start':'coop-restart',action==='next'));


function buildWeaponModel(id) { return createWeaponModel(id); }

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
// Camera-mounted first-person gun uses the same original weapon geometry.
scene.add(camera);
const viewRig=new THREE.Group(),viewWeapons={};camera.add(viewRig);
for(const id of weaponIds){const model=buildWeaponModel(id);model.scale.multiplyScalar(.36);model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=80;}});viewRig.add(model);viewWeapons[id]=model;}
viewRig.position.set(.23,-.25,-.48);
for(const side of [-1,1]){const glove=new THREE.Mesh(new THREE.CapsuleGeometry(.035,.07,4,8),new THREE.MeshStandardMaterial({color:0x303b30,depthTest:false,depthWrite:false}));glove.rotation.x=Math.PI/2;glove.position.set(side===1?.025:-.025,-.065,side===1?-.02:-.27);glove.renderOrder=81;viewRig.add(glove);}



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
  remote.alive=data.alive!==false;
  remote.group.visible = remote.alive;

  if (WEAPONS[data.weapon]) {
    remote.weapon = data.weapon;remote.reloading=false;
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

function toggleScope() {
  if (currentWeapon !== 'sniper') return;
  scoped = !scoped;
  updateScope();
}

function updateScope() {
  const active =
    scoped &&
    currentWeapon === 'sniper' &&
    alive &&
    $('#lobby').classList.contains('hidden');

  $('#scopeOverlay').style.display = active ? 'block' : 'none';

  $('#scopeButton').textContent =
    currentWeapon === 'sniper' ? 'Z / SCOPE: TOGGLE SNIPER ZOOM' : '';

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
    `${weapon.pellets>1 ? weapon.pellets+' × ' : ''}${weapon.damage} DAMAGE • ${weapon.range}m RANGE`;

  $('#weaponSlots').innerHTML = weaponIds
    .map((id, index) => {
      const selected = id === currentWeapon;

      return `
        <div style="
          min-width:60px;
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

  if(typeof viewWeapons!=='undefined')for(const id of weaponIds)viewWeapons[id].visible=id===currentWeapon;
  updateScope();
}

function updateHUD() {
  updateWeaponHUD();
  $('#equipmentHUD').textContent=`G  FRAG ${inventory.frag}  •  B  SMOKE ${inventory.smoke}  •  H  INJECTION ${inventory.injection}`;
  const lowHealth=alive&&hp<=(campaign.active?250:25);
  const lowAmmo=!reloading&&ammo<=Math.ceil(WEAPONS[currentWeapon].magazine*.2);
  const warning=reloading?'RELOADING':ammo===0?'EMPTY — RELOAD':lowHealth?(inventory.injection>0?'LOW HEALTH — USE INJECTION':'LOW HEALTH — NO INJECTIONS'):lowAmmo?'LOW AMMO — RELOAD':'';
  const stats=$('#stats');stats.classList.toggle('critical',lowHealth||ammo===0);
  stats.textContent =
    `HP: ${hp} | ` +
    `${WEAPONS[currentWeapon].short}: ` +
    `${ammo}/${WEAPONS[currentWeapon].magazine} | ` +
    (campaign.active ? (coopMode?'CO-OP OPERATION':'STORY OPERATION') : `${multiplayerActive?'DRILL GUARDS':'TRAINING GUARDS'}: ${targetKills}/5`) +
    (warning ? ` | ${warning}` : '');
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
  // Preserve the authoritative target hit volume; render an original soldier, not a red block.
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,.7),new THREE.MeshBasicMaterial({visible:false}));
  mesh.position.set(data.x,1,data.z);
  const model=createSoldier(0x75664a);model.position.y=-1;mesh.add(model);
  mesh.traverse(o=>{o.userData.targetId=data.id;});
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
    target.mesh.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});
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
  }, Math.max(1800, Math.min(5000, message.length * 65)));
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
  playInjury();
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
const voiceChat=createVoiceChat({socket,button:$('#voiceButton'),audio:$('#voiceAudio'),status:$('#voiceStatus')});
$('#voiceOff').onclick=()=>voiceChat.stop();
$('#voiceRetry').onclick=()=>voiceChat.retry();

function updateScoreboard(players) {
  $('#playerCount').textContent = `PLAYERS: ${players.length}/2${players.length<2?(coopMode?' — WAITING FOR TEAMMATE':' — WAITING FOR OPPONENT'):(coopMode?' — CO-OP SQUAD':' — PVP LIVE')}`;

  $('#scoreRows').innerHTML = [...players]
    .sort((a, b) => b.kills - a.kills)
    .map(
      (player) => `
      <div class="score-row">
        <span>${player.id === socket.id ? 'YOU' : coopMode?'TEAMMATE':'OPPONENT'}</span>
        <span>K: ${player.kills}</span>
        <span>D: ${player.deaths}</span>
        <span>HP: ${player.hp}</span>
        <span>${WEAPONS[player.weapon]?.short || 'ASSAULT'}</span>
      </div>
    `
    )
    .join('');

  const self = players.find((p) => p.id === socket.id);

  if (self && hp!==self.hp) {
    hp = self.hp;
    updateHUD();
  }
}

function resetPlayerWeapons(preserveWorldEffects=false) {
  inventory=createEquipment();lastEquipment=0;if(!preserveWorldEffects){pendingThrows=[];smokeClouds=[];equipmentFX.clear();combatFX.dispose();}
  ammoByWeapon = createAmmo();

  reloadToken++;
  reloading = false;
  scoped = false;
  lastShot = 0;
  selectWeapon('assault', false);
}

function enterRoom(response) {
  campaign.stop();firstPerson=false;soldier.rotation.set(0,0,0);
  currentRoom = response.code;lastRoomCode=response.code;
  multiplayerActive = true;coopMode=response.mode==='coop';
  updateRound(response.round);

  alive = true;
  hp = coopMode?CAMPAIGN_MAX_HP:100;

  resetPlayerWeapons();
  inventory=response.equipment||createEquipment();
  for(const c of response.smokes||[]){smokeClouds.push(c);equipmentFX.smoke(c,(c.expires-Date.now())/1000);}
  updateHUD();

  if(coopMode){campaign.start(response.coop.index,{network:true});campaign.sync(response.coop);}
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

  $('#networkStatus').textContent = `${coopMode?'CO-OP MISSION':'1V1 ARENA'} | ROOM ${currentRoom}`;

  updateScoreboard(response.players || []);
  updateHUD();
  updateMouseHint();

  showMessage(coopMode?'CO-OP ROOM READY — share the code. Both players join, then press START CO-OP MISSION.':'1V1 ARENA — share the code. Drill guards are practice; only opponent kills count toward victory.');
}

async function requestRoom(eventName, code) {
  if (connectionBusy) return;
  connectionBusy = true;
  $('#createRoom').disabled = true;
  $('#joinRoom').disabled = true;$('#createCoop').disabled=true;
  try {
    const response = await lobbyConnection.request(eventName, code);
    if (response) enterRoom(response);
  } catch (error) {
    $('#roomStatus').textContent = error.message;
  } finally {
    connectionBusy = false;
    $('#createRoom').disabled = false;
    $('#joinRoom').disabled = false;$('#createCoop').disabled=false;
  }
}

$('#createCoop').onclick=()=>{preloadCombatAudio();return requestRoom('create-coop',Number($('#missionSelect').value));};
$('#createRoom').onclick = () => {preloadCombatAudio();return requestRoom('create-room');};

$('#joinRoom').onclick = () => {
  preloadCombatAudio();
  const code = $('#roomCode').value.trim().toUpperCase();

  if (code.length !== 6) {
    $('#roomStatus').textContent = 'Enter a valid 6-character room code';
    return;
  }

  requestRoom('join-room', code);
};

$('#campaign').onclick = () => {
  preloadCombatAudio();
  lobbyConnection.cancel();multiplayerActive=false;currentRoom=null;clearRemotePlayers();
  $('#lobby').classList.add('hidden');$('#networkStatus').textContent='STORY OPERATIONS';
  campaign.start(Number($('#missionSelect').value));updateMouseHint();
};
$('#training').onclick = () => {
  preloadCombatAudio();
  campaign.stop();alive=true;hp=100;soldier.position.set(0,0,0);

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
  voiceChat.stop();
  campaign.stop();firstPerson=false;soldier.rotation.set(0,0,0);soldier.position.set(0,0,0);
  currentRoom = null;
  multiplayerActive = false;coopMode=false;

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

function updateRound(round) {
  if(coopMode){$('#roundStatus').textContent='CO-OP • TEAM OBJECTIVES • FRIENDLY FIRE OFF';$('#rematch').classList.add('hidden');return;}
  if(round?.winner){equipmentFX.clear();smokeClouds=[];pendingThrows=[];}
  if(!round)return;
  $('#roundStatus').textContent=round.winner ? `${round.winner===socket.id?'VICTORY':'ROUND LOST'} • ${(round.ready||[]).length}/2 ready for rematch` : `FIRST TO ${round.scoreLimit} KILLS`;
  $('#rematch').classList.toggle('hidden',!round.winner);
  $('#rematch').disabled=(round.ready||[]).includes(socket.id);
  if(round.winner && mouseLocked())document.exitPointerLock();
}
$('#rematch').onclick=()=>socket.emit('request-rematch');
socket.on('round-state', round=>{if(multiplayerActive)updateRound(round);});
socket.on('targets-reset', list=>{if(multiplayerActive)resetTargets(list);});
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
  voiceChat.peerLeft();

  const remote = remotePlayers.get(id);

  if (remote) {
    scene.remove(remote.group);
    remotePlayers.delete(id);
  }

  showMessage(coopMode?'TEAMMATE LEFT — mission paused until a second player joins.':'OPPONENT LEFT');
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
      syncRemoteLife(remote,player.alive!==false);remote.reloading=!!player.reloading;remote.group.userData.setReloading?.(remote.reloading,(WEAPONS[player.weapon]?.reloadMs||1500)/1000);

      if (WEAPONS[player.weapon]) {
        remote.weapon = player.weapon;
        setCharacterWeapon(remote.group, player.weapon);
      }
    }
  }
});

socket.on('weapon-state', (state) => {
  if(state.equipment)inventory={...state.equipment};
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

  reloading = !!state.reloading;soldier.userData.setReloading?.(reloading,WEAPONS[currentWeapon].reloadMs/1000);
  updateHUD();
});

socket.on('reload-state',data=>{if(!multiplayerActive||data.id===socket.id)return;const remote=remotePlayers.get(data.id);if(remote){remote.reloading=data.reloading;remote.group.userData.setReloading?.(data.reloading,(data.duration||1500)/1000);}});
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
    remote.weapon = data.weapon;remote.reloading=false;
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
    if(!data.pellet || data.pellet===0)playGunshotAt(data.weapon,data.origin,soldier.position,yaw);
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
  const struck=data.targetId===socket.id?soldier:remotePlayers.get(data.targetId)?.group;if(struck)combatFX.bloodImpact(struck.position.clone().add(new THREE.Vector3(0,1.15,0)));

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

  if (remote) {remote.alive=false;remote.deathAge=0;remote.group.visible = true;}
});

socket.on('player-respawned', (data) => {
  if (!multiplayerActive) return;

  if (data.id === socket.id) {
    alive = true;
    hp = 100;

    resetPlayerWeapons(true);

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
      remote.alive=true;remote.deathAge=0;remote.group.rotation.x=0;if(remote.group.userData.aimRig)remote.group.userData.aimRig.rotation.x=0;remote.group.visible = true;

      if (WEAPONS[data.weapon]) {
        remote.weapon = data.weapon;
        setCharacterWeapon(remote.group, data.weapon);
      }
    }
  }
});

socket.on('coop-state',snapshot=>{if(!multiplayerActive||!coopMode)return;campaign.sync(snapshot);updateMouseHint();});
socket.on('coop-action-feedback',data=>{if(multiplayerActive&&coopMode)showMessage(interactionMessage(data?.reason));});
socket.on('coop-action-interrupted',data=>{if(multiplayerActive&&coopMode&&data?.id===socket.id)showMessage(interactionMessage(data.reason));});
socket.on('coop-guard-hit',data=>{if(!coopMode)return;if(data.position)campaign.guardImpact(data.position);if(data.shooterId===socket.id){showHitMarker();playHitConfirmation();if(data.hp===0){playElimination();showMessage('GUARD NEUTRALIZED');}}});
socket.on('coop-guard-fired',data=>{if(!coopMode)return;const origin=new THREE.Vector3(data.origin.x,data.origin.y,data.origin.z),direction=new THREE.Vector3(data.target.x,data.target.y,data.target.z).sub(origin);bulletTracer(origin,direction.clone().normalize(),direction.length());if(origin.distanceTo(soldier.position)<80)playGunshotAt('assault',data.origin,soldier.position,yaw);});
socket.on('coop-player-down',data=>{if(!coopMode)return;if(data.id===socket.id){alive=false;hp=0;firstPerson=false;reloading=false;reloadToken++;fireHeld=false;updateHUD();showMessage('YOU ARE DOWN — teammate can revive you: approach within 3m, press E, stay safe for 4s. Costs one injection.');}else{const remote=remotePlayers.get(data.id);if(remote){remote.alive=false;remote.deathAge=0;}showMessage('TEAMMATE DOWN — REACH WITHIN 3m AND PRESS E TO REVIVE');}});
socket.on('coop-player-revived',data=>{
 if(!coopMode)return;
 if(data.reviverId===socket.id)inventory={...data.equipment};
 if(data.id===socket.id){syncRemoteLife({group:soldier,alive:false},true);alive=true;hp=data.hp;firstPerson=true;fireHeld=false;reloading=false;reloadToken++;showMessage('TEAMMATE REVIVED YOU • 350 HP');}
 else {const remote=remotePlayers.get(data.id);if(remote)syncRemoteLife(remote,true);showMessage('TEAMMATE BACK IN THE FIGHT');}
 updateHUD();updateMouseHint();
});
socket.on('coop-reset',data=>{if(!coopMode)return;campaign.start(data.coop.index,{network:true});campaign.sync(data.coop);const self=data.players.find(p=>p.id===socket.id);alive=true;hp=self.hp;soldier.position.set(self.position.x,0,self.position.z);resetPlayerWeapons();for(const p of data.players)addRemotePlayer(p);updateScoreboard(data.players);updateHUD();updateMouseHint();});

socket.on('disconnect', (reason) => {
  if (!multiplayerActive) return;

  leaveGame();

  $('#roomCode').value=lastRoomCode||'';
  $('#roomStatus').textContent = 'Connection lost. Your previous room code is filled in. Press JOIN ROOM to retry; if the room expired, create a new one.';
});

// ==============================================
// AIMING
// ==============================================

const raycaster = new THREE.Raycaster();
const UP = new THREE.Vector3(0, 1, 0);

function getFiringOrigin() {
  return new THREE.Vector3(soldier.position.x, 1.7, soldier.position.z);
}

function getAimDirection() {
  const aimObjects = [
    ...campaign.aimMeshes(),
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

  return aimDirection(camera,getFiringOrigin(),aimObjects,WEAPONS[currentWeapon].range,raycaster);
}

// ==============================================
// SHOOTING
// ==============================================

function shoot() {
  if (!alive || reloading) return;
  if (campaign.active && !campaign.running) { showMessage(coopMode ? 'CO-OP PAUSED: JOIN BOTH PLAYERS, THEN PRESS ENTER TO START' : 'MISSION IS NOT ACTIVE'); return; }

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

  // Cosmetic weapon response; the authoritative aim and damage stay unchanged.
  viewKick=({pistol:.65,smg:.55,carbine:.8,assault:1,lmg:1.15,battle:1.3,marksman:1.35,sniper:1.55,shotgun:1.7})[currentWeapon]||1;
  showMuzzleFlash();
  combatFX.muzzleFlash(origin, currentWeapon);
  combatFX.shellEjection(origin,direction);
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
  campaign.onShot?.(origin, weapon.noise);
  for(const pellet of shotDirections(direction,weapon)){
  const direction=new THREE.Vector3(pellet.x,pellet.y,pellet.z);
  raycaster.set(origin, direction);
  raycaster.far = weapon.range;

  const wallHits = raycaster.intersectObjects(obstacles.map((o) => o.mesh));

  const targetHits = raycaster.intersectObjects(
    [...targets.values()].filter((t) => t.alive).map((t) => t.mesh)
  );

  const wallDistance = wallHits[0]?.distance ?? weapon.range;
  const targetHit = targetHits[0];
  if (campaign.active && campaign.hit(origin,direction,weapon.damage,wallDistance)) {
    showHitMarker();playHitConfirmation();bulletTracer(origin,direction,Math.min(wallDistance,40));updateHUD();continue;
  }


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

  }
  updateHUD();
}

function reload() {
  if (!alive || reloading || (campaign.active && !campaign.running)) return;

  const id = currentWeapon;
  const weapon = WEAPONS[id];

  if (ammoByWeapon[id] >= weapon.magazine) return;

  reloading = true;soldier.userData.setReloading?.(true,weapon.reloadMs/1000);
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

function healedEffect(){playHeal();$('#healFlash').classList.remove('active');void $('#healFlash').offsetWidth;$('#healFlash').classList.add('active');}
function resolveEquipment(data){
 if(data.type==='frag'){combatFX.explosion(data.position);if(!multiplayerActive&&campaign.active)campaign.blast(data.position);}
 else {playSmoke();equipmentFX.smoke(data.position,data.duration||16);const cloud={...data.position,expires:data.expires||Date.now()+16000};smokeClouds.push(cloud);if(campaign.active)campaign.smoke(data.position);}
}
function useEquipment(type){
 if(!gameActive()||!alive||(campaign.active&&!campaign.running)||(lastEquipment>0&&performance.now()-lastEquipment<950))return;
 if(inventory[type]<=0){showMessage('EQUIPMENT DEPLETED');return;}
 const max=campaign.active?CAMPAIGN_MAX_HP:100;
 if(type==='injection'&&hp>=max){showMessage('HEALTH ALREADY FULL');return;}
 lastEquipment=performance.now();unlockAudio();
 if(multiplayerActive){socket.emit('use-equipment',{type,direction:getAimDirection()},response=>{if(!response?.ok)showMessage('EQUIPMENT NOT AVAILABLE');});return;}
 inventory[type]--;
 if(type==='injection'){hp=healHealth(hp,max);healedEffect();showMessage(`FIELD INJECTION — HEALTH ${hp}/${max}`);}
 else {const landing=throwLanding(soldier.position,getAimDirection(),obstacles.map(o=>[o.x,o.z,o.w,o.h,o.d]),campaign.active?campaign.bounds:45);playPin();equipmentFX.thrown(soldier.position,landing,type,EQUIPMENT[type].fuse);pendingThrows.push({type,position:landing,remaining:EQUIPMENT[type].fuse});}
 updateHUD();
}
socket.on('equipment-thrown',data=>{if(!multiplayerActive)return;playPin();equipmentFX.thrown(data.origin,data.landing,data.type,data.fuse);});
socket.on('equipment-resolved',data=>{if(multiplayerActive)resolveEquipment(data);});
socket.on('equipment-healed',data=>{if(multiplayerActive&&data.id===socket.id){hp=data.hp;healedEffect();updateHUD();}});

// ==============================================
// MOUSE CONTROLS
// ==============================================

const keys = {};

let yaw = 0;
let pitch = 0;

const mouseSensitivity = 0.0025;

const touchControls=createTouchControls({canvas:renderer.domElement,keys,
 look(dx,dy){yaw-=dx*.004;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.1,1.1);},
 fire(){fireHeld=true;shoot();},stopFire(){fireHeld=false;},reload,nextWeapon,
 interact:()=>campaign.active&&campaign.interact(),equipment:useEquipment,
 camera:()=>{firstPerson=!firstPerson;},scope:toggleScope,menu:leaveGame,
 active:()=>gameActive()&&alive&&(!campaign.active||campaign.running||campaign.canExplore)&&!document.querySelector('#instructions')?.open});
const instructions=document.createElement('dialog');instructions.id='instructions';
instructions.innerHTML=`<h2>FIELD MANUAL</h2><p><strong>Multiplayer:</strong> create a room and share its six-character code. Your friend opens this same link and joins. First to five kills wins. Respawn takes three seconds; both players must agree to rematch.</p><p><strong>Co-op:</strong> select an operation and Create Co-op Mission Room. Both players join by code, then Start Mission. Guard damage and objectives are shared by the server; teammates cannot hurt each other. Both living players must reach extraction. To revive a downed teammate, approach within 3m and press E. Stay close for 4 seconds without taking damage; one injection restores your teammate to 350HP. If both die, restart together.<br><strong>Story:</strong> choose one of four solo operations. Follow the marked equipment and press E within 2.4m. Collect cases, cut switches, plant charges and download server data after clearing guards within 12m. Defense objectives keep running under enemy fire: stay within the marked 14m area for 25 seconds, or 45 seconds at the Railway relay. Use cover and keep fighting. Both living co-op players must reach extraction; the next operation starts automatically. Follow the green floating marker to the current objective; it turns blue for extraction. Open OPERATION PLAN for the full checklist.</p><p><strong>Desktop:</strong> WASD move, Shift sprint, mouse look, click fire, R reload, 1–9 weapons, G frag, B smoke, H heal, V view, M menu, Esc release mouse. Z scopes the sniper.</p><p><strong>Phone:</strong> landscape works best. Left joystick moves; drag the scene to look. Hold FIRE for automatic weapons. Buttons reload, switch guns, use equipment and interact. SCOPE toggles sniper zoom.</p><p>Three healing injections per life: +350 story HP or +35 multiplayer HP, capped at maximum. Smoke conceals but does not stop bullets. Frag grenades hurt enemies; self damage is disabled.</p><p><a href="/assets/characters/CREDITS.txt" target="_blank" rel="noopener">Character and animation credits</a></p><button autofocus>CLOSE MANUAL</button>`;
instructions.insertAdjacentHTML('afterbegin','<p class="manual-notice">Opening this manual does not pause an active game. Find cover first.</p>');
instructions.querySelector('button').insertAdjacentHTML('beforebegin','<p><strong>Special objectives:</strong> Checkpoint sweep starts automatically when you enter the zone and guards nearby are cleared. For the detention yard, all living squad members must hold the zone for 8 seconds with no nearby guards; leaving or an enemy entering resets the timer. Data racks must each be secured separately.</p>');
document.body.append(instructions);instructions.querySelector('button').onclick=()=>instructions.close();
function openManual(){
  if(instructions.open)return;
  fireHeld=false;for(const key in keys)keys[key]=false;
  if(document.pointerLockElement)document.exitPointerLock?.();
  instructions.showModal();updateMouseHint();
}
instructions.addEventListener('close',updateMouseHint);
$('#howToPlay').onclick=openManual;$('#inGameHelp').onclick=openManual;

function gameActive() {
  return $('#lobby').classList.contains('hidden');
}

function mouseLocked() {
  return touchControls.enabled || document.pointerLockElement === renderer.domElement;
}

function updateMouseHint() {
  $('#mouseHint').style.display =
    gameActive() && alive && !instructions.open && (!campaign.active || campaign.running || campaign.canExplore) && !mouseLocked() ? 'block' : 'none';
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if(event.pointerType==='touch')return;
  if (!gameActive() || !alive || (campaign.active && !campaign.running&&!campaign.canExplore)) return;

  if (document.pointerLockElement !== renderer.domElement) {
    if (event.button === 0) {
      renderer.domElement.requestPointerLock?.();
    }
    return;
  }

  if (event.button === 0) { fireHeld=true;shoot(); }
  if (event.button === 2) nextWeapon();
});

renderer.domElement.addEventListener('contextmenu', (event) =>
  event.preventDefault()
);

document.addEventListener('pointerlockchange', () => {fireHeld=false;updateMouseHint();});
window.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')fireHeld=false;});

document.addEventListener('mousemove', (event) => {
  if (!mouseLocked() || !gameActive()) return;

  yaw -= event.movementX * mouseSensitivity;
  pitch -= event.movementY * mouseSensitivity;

  pitch = THREE.MathUtils.clamp(pitch, -1.1, 1.1);
});

window.addEventListener('keydown', (event) => {
  if(event.code==='F1'&&gameActive()){event.preventDefault();if(!event.repeat)openManual();return;}
  if(instructions.open)return;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
    event.preventDefault();
  }

  if (!gameActive()) return;

  keys[event.code] = true;

  if (event.repeat) return;

  if(event.code==='Enter'&&coopMode&&!campaign.running)socket.emit('coop-start');
  if (event.code === 'KeyR') reload();
  if (event.code === 'KeyG') useEquipment('frag');
  if (event.code === 'KeyB') useEquipment('smoke');
  if (event.code === 'KeyH') useEquipment('injection');
  if (event.code === 'KeyE' && campaign.active) campaign.interact();
  if (event.code === 'KeyV' && alive) firstPerson=!firstPerson;
  if (event.code === 'KeyM') leaveGame();

  if (event.code === 'Digit1') selectWeapon('assault');
  if (event.code === 'Digit2') selectWeapon('sniper');
  if (event.code === 'Digit3') selectWeapon('pistol');
  if (event.code === 'Digit4') selectWeapon('smg');
  if (event.code === 'Digit5') selectWeapon('shotgun');
  if (event.code === 'Digit6') selectWeapon('lmg');
  if (event.code === 'Digit7') selectWeapon('carbine');
  if (event.code === 'Digit8') selectWeapon('battle');
  if (event.code === 'Digit9') selectWeapon('marksman');

  if (event.code === 'KeyZ' && !event.repeat) toggleScope();
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

window.addEventListener('blur', () => {
  fireHeld=false;
  for (const key in keys) keys[key] = false;
});

// ==============================================
// ANIMATION
// ==============================================

const clock = new THREE.Clock();
let lobbyRendered=false,lastWaitingFrame=0;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  touchControls.update();
  if(!gameActive()){fireHeld=false;if(!lobbyRendered){renderer.render(scene,camera);lobbyRendered=true;}return;}
  lobbyRendered=false;
  if(coopMode&&!mouseLocked()){const now=performance.now();if(now-lastWaitingFrame<1000)return;lastWaitingFrame=now;}
  let moving = false;
  if(fireHeld && mouseLocked() && gameActive() && alive && WEAPONS[currentWeapon].automatic)shoot();

  const sprinting = !!keys.ShiftLeft || !!keys.ShiftRight;

  if (gameActive() && alive && mouseLocked() && (!campaign.active || campaign.running || campaign.canExplore)) {
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

      const nextX = THREE.MathUtils.clamp(oldX + dx, campaign.active?-campaign.bounds:-45, campaign.active?campaign.bounds:45);

      const nextZ = THREE.MathUtils.clamp(oldZ + dz, campaign.active?-campaign.bounds:-45, campaign.active?campaign.bounds:45);

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

  if(moving){footstepTime-=dt;if(footstepTime<=0){playFootstep(sprinting);footstepTime=sprinting?.25:.39;}}else footstepTime=0;
  const equipmentRunning=gameActive()&&(!campaign.active||campaign.running);
  if(equipmentRunning){equipmentFX.update(dt);for(let i=pendingThrows.length-1;i>=0;i--){pendingThrows[i].remaining-=dt;if(pendingThrows[i].remaining<=0){resolveEquipment(pendingThrows[i]);pendingThrows.splice(i,1);}}}
  smokeClouds=smokeClouds.filter(c=>c.expires>Date.now());
  $('#smokeOverlay').style.opacity=smokeClouds.some(c=>Math.hypot(soldier.position.x-c.x,soldier.position.z-c.z)<5)?'.87':'0';
  campaign.update(dt,gameActive() && alive && mouseLocked());
  const campaignDead = campaign.active && !alive;
  if (campaignDead) {
    soldier.rotation.order='YXZ';soldier.rotation.y=yaw;
    soldier.userData.deathAge=(soldier.userData.deathAge||0)+dt;applyDeathPose(soldier,soldier.userData.deathAge);
  } else {
    soldier.userData.deathAge=0;soldier.rotation.y=yaw;
    soldier.userData.updateAnimation?.(dt, moving, sprinting,reloading);
  }
  sun.position.set(soldier.position.x+32,48,soldier.position.z+24);sun.target.position.set(soldier.position.x,0,soldier.position.z);
  soldier.visible = campaignDead || (alive && !firstPerson);
  const cameraOffset = campaignDead ? new THREE.Vector3(1.5,2.7,3.4) : firstPerson ? new THREE.Vector3(0,1.7,0) : new THREE.Vector3(0.95, 2.75, 4.8);

  cameraOffset.applyAxisAngle(UP, yaw);

  const desiredPosition = soldier.position.clone().add(cameraOffset);

  // Pull the third-person camera in before walls instead of showing through cover.
  if (!firstPerson) {
    const eye=soldier.position.clone().add(new THREE.Vector3(0,1.7,0));
    const offset=desiredPosition.clone().sub(eye);
    raycaster.set(eye,offset.clone().normalize());raycaster.far=offset.length();
    const obstruction=raycaster.intersectObjects(obstacles.map(o=>o.mesh),false)[0];
    if(obstruction)desiredPosition.copy(eye).add(offset.normalize().multiplyScalar(Math.max(.1,obstruction.distance-.2)));
  }
  camera.position.copy(desiredPosition);

  const horizontal = Math.cos(pitch);

  const lookDirection = new THREE.Vector3(
    -Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    -Math.cos(yaw) * horizontal
  );

  if (campaignDead) {
    const bodyCenter = new THREE.Vector3(0,.15,-1).applyAxisAngle(UP,yaw).add(soldier.position);
    camera.lookAt(bodyCenter);
  } else camera.lookAt(camera.position.clone().add(lookDirection));

  viewKick=Math.max(0,viewKick-dt*8);
  viewRig.visible=firstPerson&&alive&&gameActive()&&!scoped;
  viewRig.position.set(.23+(moving?Math.sin(clock.elapsedTime*8)*.008:0),-.25+(moving?Math.abs(Math.sin(clock.elapsedTime*8))*.012:0),-.48+viewKick*.055);
  viewRig.rotation.x=viewKick*.045+(reloading?-.35:0);
  camera.updateMatrixWorld();

  if (alive) {
    soldier.userData.setAimDirection?.(lookDirection);
  }

  for (const remote of remotePlayers.values()) {
    if(remote.alive===false){remote.group.visible=true;remote.deathAge=(remote.deathAge||0)+dt;applyDeathPose(remote.group,remote.deathAge);continue;}
    remote.group.visible=true;
    const previous = remote.group.position.clone();

    remote.group.position.lerp(remote.targetPosition, Math.min(1, dt * 12));

    remote.group.rotation.y = remote.targetRotation;

    const movedDistance = remote.group.position.distanceTo(previous);

    const remoteMoving = remote.group.visible && movedDistance > 0.0001;

    const remoteSpeed = dt > 0 ? movedDistance / dt : 0;

    remote.group.userData.updateAnimation?.(
      dt,
      remoteMoving,
      remoteSpeed > 6.5,
      !!remote.reloading
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

  for(const remote of remotePlayers.values())if(remote.group.visible && smokeBlocks(camera.position,remote.group.position,smokeClouds,Date.now()))remote.group.visible=false;
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
