import {loadMissionMaterials,applyMissionMaterial} from './missionMaterials.js';
import {applyDeathPose} from './deathPose.js';
import {addGuardDetail} from './guardDetail.js';
import {missionWaypoint,objectiveNavigation} from './navigation.js';
import {reviveMessage,teammateMessage,extractionMessage} from './missionFeedback.js';
import {createMissionRadio} from './missionRadio.js';
import {createExtractionFlyover} from './extractionFlyover.js';
import {guardStep,findGuardCover} from '../shared/guardTactics.js';
import { blastDamage, smokeBlocks } from '../shared/equipment.js';
import { playGunshotAt, playObjective } from './combatEffects.js';
import * as THREE from "three";
import { createSoldier } from "./soldier.js";
import { createEnvironmentTextures,createTerrainTexture } from "./environmentTextures.js";
import {
  MISSIONS,
  sabotageInvestigation,
  objectiveSafe,
  completeSweep,
  advanceRendezvous,
  dualNodes,
  availableDualNode,
  recordDualNode,
  guardSightRange,
  guardResponseMultiplier,
  activeOperationEffect,
  CHARGE_FUSE_SECONDS,
  chargeDamageAt,
  installationLayout,
  approachCover,
  freightCargo,
  checkpointGate,
  defenseRallyPoint,
  guardSpawn,
  campaignObstacles,
  interactMission,
  blocked,
} from "../shared/campaign.js";
export function createCampaign({
  scene,
  obstacles,
  player,
  onDamage,
  onReset,
  message,
  tracer,
  blood=()=>{},
  demolition=()=>{},
  getPlayerId=()=>null,
  getTeammates=()=>[],
}) {
  const textures=createEnvironmentTextures();textures.ground.dispose();textures.ground=createTerrainTexture();textures.ground.repeat.set(15,15);
  const baseAtmosphere={background:scene.background,fog:scene.fog?.clone(),lights:scene.children.filter(o=>o.isLight).map(light=>({light,color:light.color.clone(),intensity:light.intensity}))};
  const operationSkies=new Map();
  let materialGeneration=0;
  const baseColliders=[...obstacles];
  const baseWorld=scene.children.filter(o=>!o.isLight && o!==player);
  const group = new THREE.Group();
  scene.add(group);
  group.visible = false;
  let state = { index: 0, status: "inactive", intel: false },
    enemies = [],
    colliders = [],
    time = 0,
    exit = () => {},
    beacon, waypoint=null,waypointRing=null,waypointClock=0,gateCollider=null,flyover=null,flyoverTime=0,surveillanceLamp=null, installationLights=[], task=null,revive=null, holdRemaining=null,chargeRemaining=null, dualDone=[], smokeClouds=[],network=false,networkWaiting=false,networkSynced=false,networkAction=()=>{},transitionRemaining=null,objectiveProps=[],completedEffects=new Set();
  const ray = new THREE.Raycaster(),
    panel = document.createElement("section");
  panel.id = "missionPanel";
  panel.hidden = true;
  panel.innerHTML =
    '<small>SHADOWSTRIKE / FIELD OPERATIONS</small><h2></h2><p class="brief"></p><p class="objective"></p><p class="teammate-status" hidden></p><p class="operation-effect" hidden></p><progress class="task-progress" max="1" value="0" hidden aria-label="Objective action progress"></progress><details class="operation-plan"><summary>OPERATION PLAN</summary><ol></ol></details><canvas class="radar" width="280" height="150" aria-label="Tactical map: blue player, yellow teammate, red guards, green terminal, cyan extraction"></canvas><p>E interact • V camera • Esc release cursor</p><button class="start" hidden>START CO-OP MISSION</button><button class="next" hidden>NEXT OPERATION</button><button class="retry">RESTART MISSION</button><button class="exit">RETURN TO MENU</button>';
  document.body.append(panel);
  const radio=createMissionRadio(window.speechSynthesis,window.SpeechSynthesisUtterance);
  const radioButton=document.createElement('button');radioButton.type='button';radioButton.textContent=radio.available?'RADIO VOICE OFF':'RADIO VOICE UNAVAILABLE';radioButton.disabled=!radio.available;radioButton.setAttribute('aria-pressed','false');
  panel.append(radioButton);
  radioButton.onclick=()=>{const enabled=radio.setEnabled(!radio.enabled);radioButton.textContent=enabled?'RADIO VOICE ON':'RADIO VOICE OFF';radioButton.setAttribute('aria-pressed',String(enabled));paint();};
  const failure = document.createElement("section");
  failure.id = "missionFailure";
  failure.hidden = true;
  failure.setAttribute("role", "dialog");
  failure.setAttribute("aria-modal", "true");
  failure.setAttribute("aria-labelledby", "missionFailureTitle");
  failure.innerHTML = '<div class="failure-card"><h1 id="missionFailureTitle">MISSION FAILED</h1><p>Your health reached zero. Regroup and try again.</p><button class="restart">RESTART MISSION</button><button class="menu">BACK TO MAIN MENU</button></div>';
  document.body.append(failure);
  failure.querySelector(".restart").onclick = () => network?networkAction('restart'):start(state.index);
  failure.querySelector(".menu").onclick = () => exit();
  const q = (s) => panel.querySelector(s);
  q(".retry").onclick = () => network?networkAction('restart'):start(state.index);
  q(".start").onclick=()=>networkAction('start');
  q(".next").onclick = () => network?networkAction('next'):start((state.index + 1) % MISSIONS.length);
  q(".exit").onclick = () => exit();
  function mesh(geo, color, x, y, z) {
    const o = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    group.add(o);
    return o;
  }
  function cleanup() {
    radio.stop();
    materialGeneration++;
    for (const o of colliders) {
      const i = obstacles.indexOf(o);
      if (i >= 0) obstacles.splice(i, 1);
    }
    colliders = [];
    enemies = [];task=null;smokeClouds=[];
    const gs = new Set(),
      ms = new Set();
    group.traverse((o) => {
      if (o.geometry&&!o.geometry.userData.sharedOperator&&!o.geometry.userData.sharedWeapon) gs.add(o.geometry);
      if (o.material) ms.add(o.material);
    });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => {if(m.map?.isCanvasTexture && !Object.values(textures).includes(m.map))m.map.dispose();m.dispose();});
    group.clear();
    gateCollider=null;flyover=null;flyoverTime=0;
    scene.background=baseAtmosphere.background??null;
    if(baseAtmosphere.fog)scene.fog=baseAtmosphere.fog.clone();
    for(const {light,color,intensity} of baseAtmosphere.lights){light.color.copy(color);light.intensity=intensity;}
  }
  function start(index = 0,options={}) {
    network=!!options.network;networkWaiting=network;networkSynced=false;
    cleanup();
    obstacles.length=0;
    for(const o of baseWorld)o.visible=false;
    failure.hidden = true;transitionRemaining=null;
    state = { index, status: "active", intel: false, step:0 };
    time = 0;waypointClock=0;task=null;revive=null;holdRemaining=null;chargeRemaining=null;dualDone=[];smokeClouds=[];objectiveProps=[];surveillanceLamp=null;installationLights=[];completedEffects.clear();
    group.visible = true;
    panel.hidden = false;
    const m = MISSIONS[index];
    const sky=[0xb6c3bd,0x92a6ac,0x556879,0xc6c4b2][index];
    if(!operationSkies.has(index)){
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
      const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,128);
      gradient.addColorStop(0,index===2?'#142d48':'#507c97');gradient.addColorStop(.5,`#${sky.toString(16).padStart(6,'0')}`);gradient.addColorStop(1,index===2?'#2a393e':'#727765');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,128);
      const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;operationSkies.set(index,texture);
    }
    scene.background=operationSkies.get(index);
    if(scene.fog){scene.fog.color.setHex(sky);scene.fog.near=index===2?65:110;scene.fog.far=index===2?260:350;}
    for(const {light,intensity} of baseAtmosphere.lights){if(light.isDirectionalLight){light.intensity=intensity*(index===2?.38:index===3?.85:1);light.color.setHex(index===2?0x9cb9df:0xffe4bd);}else if(light.isHemisphereLight)light.intensity=intensity*(index===2?.65:1);}

    const floor=mesh(new THREE.PlaneGeometry(500,500),index===1?0x5a655a:0x8a8061,0,-.02,0);floor.rotation.x=-Math.PI/2;floor.material.map=textures.ground;floor.material.bumpMap=textures.ground;floor.material.bumpScale=.04;floor.material.color.set(0xffffff);floor.userData.surface='ground';
    const treeGeometry=new THREE.ConeGeometry(2.7,9,7),treeMaterial=new THREE.MeshStandardMaterial({color:0x42533c});
    const trees=new THREE.InstancedMesh(treeGeometry,treeMaterial,100),dummy=new THREE.Object3D();
    for(let n=0;n<100;n++){const angle=n/100*Math.PI*2,r=175+(n%7)*2,edge=Math.max(Math.abs(Math.cos(angle)),Math.abs(Math.sin(angle)));dummy.position.set(Math.cos(angle)/edge*r,4.5,Math.sin(angle)/edge*r);dummy.scale.setScalar(1+(n%4)*.18);dummy.updateMatrix();trees.setMatrixAt(n,dummy.matrix);}group.add(trees);
    for(let n=0;n<m.sites.length-1;n++){
      const [ax,az]=m.sites[n],[bx,bz]=m.sites[n+1],length=Math.hypot(bx-ax,bz-az);
      const road=mesh(new THREE.PlaneGeometry(5,length),0x727366,(ax+bx)/2,.005,(az+bz)/2);road.rotation.x=-Math.PI/2;road.rotation.z=-Math.atan2(bx-ax,bz-az);road.userData.surface='asphalt';
      // Ground markings are visual only, so existing movement and server collision stay unchanged.
      const dashes=Math.min(18,Math.floor(length/9));
      for(let j=0;j<dashes;j++){
        const t=(j+.5)/dashes,mark=mesh(new THREE.PlaneGeometry(.14,3),0xb7b39a,ax+(bx-ax)*t,.018,az+(bz-az)*t);
        mark.rotation.x=-Math.PI/2;mark.rotation.z=road.rotation.z;
      }
    }
    for(let i=0;i<m.sites.length;i++){
    const [x,z]=m.sites[i], objective=m.steps[i].position,layout=installationLayout(m,i),front=z+layout.d/2;
    // Every installation is entered through a real doorway and interior passage.

    for (const [a, b, w, h, d] of layout.walls) {
      const o = {
        x: a,
        z: b,
        w,
        h,
        d,
        mesh: mesh(new THREE.BoxGeometry(w, h, d), 0x8c927d, a, h / 2, b),
      };
      o.mesh.material.map=textures.concrete;o.mesh.userData.surface='concrete';
      obstacles.push(o);
      colliders.push(o);
    }
    mesh(new THREE.BoxGeometry(layout.w, 0.08, layout.d), 0x55594f, x, 0.04, z);
    mesh(new THREE.BoxGeometry(layout.w+.4, 0.16, layout.d+.4), 0x343c35, x, 3.6, z);
    const step=m.steps[i],ox=objective[0],oz=objective[1],parts=[];
    const part=(geometry,color,dx,y,dz)=>{const o=mesh(geometry,color,ox+dx,y,oz+dz);parts.push(o);return o;};
    let indicator,nodeIndicators=[];
    if(step.kind==='recover'){
      part(new THREE.BoxGeometry(1.25,.7,.7),0x465547,0,.4,0);
      part(new THREE.TorusGeometry(.19,.035,6,12,Math.PI),0xb5baa5,0,.85,0);
      for(const dx of [-.42,.42])part(new THREE.BoxGeometry(.08,.62,.74),0xadb2a0,dx,.4,0);
      indicator=part(new THREE.SphereGeometry(.07,8,6),0x50efb1,.4,.8,0);
    }else if(step.kind==='switch'){
      part(new THREE.BoxGeometry(.9,1.45,.45),0x66726b,0,.76,0);
      const lever=part(new THREE.CylinderGeometry(.045,.045,.45,8),0xb8b49d,0,1.05,.3);lever.rotation.z=.65;
      indicator=part(new THREE.SphereGeometry(.075,8,6),0x50efb1,.25,1.3,.26);
    }else if(step.kind==='download'){
      part(new THREE.BoxGeometry(1.2,1.9,.7),0x263a40,0,.98,0);
      for(let n=0;n<5;n++)part(new THREE.BoxGeometry(1.05,.18,.08),0x53696c,0,.35+n*.28,.39);
      indicator=part(new THREE.BoxGeometry(.55,.25,.04),0x50efb1,0,1.65,.4);
    }else if(step.kind==='plant'||step.kind==='timedcharge'){
      part(new THREE.CylinderGeometry(.5,.5,1.35,14),0x647267,0,.72,0);
      for(const dx of [-.14,0,.14])part(new THREE.CylinderGeometry(.07,.07,.38,8),0x794334,dx,1,.52);
      indicator=part(new THREE.BoxGeometry(.25,.14,.06),0x50efb1,0,1.05,.62);
    }else if(step.kind==='dual'){
      for(const dx of [-2.5,2.5]){
        part(new THREE.BoxGeometry(1.2,1.9,.7),0x263a40,dx,.98,0);
        for(let n=0;n<5;n++)part(new THREE.BoxGeometry(1.05,.18,.08),0x53696c,dx,.35+n*.28,.39);
        nodeIndicators.push(part(new THREE.BoxGeometry(.55,.25,.04),0x50efb1,dx,1.65,.4));
      }
      indicator=nodeIndicators[0];
    }else if(step.kind==='sweep'||step.kind==='rendezvous'){
      const zone=part(new THREE.TorusGeometry(step.radius,.07,6,64),0xd4a65c,0,.08,0);zone.rotation.x=Math.PI/2;
      part(new THREE.BoxGeometry(1.5,.8,.55),0x526150,0,.42,0);
      indicator=part(new THREE.SphereGeometry(.1,8,6),0x50efb1,0,.91,0);
    }else{
      part(new THREE.BoxGeometry(1.15,.7,.7),0x3b5148,0,.4,0);
      part(new THREE.CylinderGeometry(.025,.025,1.9,6),0x919d91,.4,1.65,0);
      indicator=part(new THREE.BoxGeometry(.5,.2,.05),0x50efb1,-.1,.58,.39);
      const zone=part(new THREE.TorusGeometry(step.radius,.055,6,64),0x4e9eae,0,.08,0);zone.rotation.x=Math.PI/2;
    }
    indicator.material.emissive.set(0x1f926a);
    objectiveProps.push({parts,indicator,nodeIndicators,kind:step.kind});
    const light = new THREE.PointLight(0xc6dec9, 18, 11);
    light.position.set(x, 2.8, z);
    group.add(light);
    if(index===1)installationLights.push(light);
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=64;
    const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#14251d';ctx.fillRect(0,0,512,64);ctx.fillStyle='#d9e5ca';ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.fillText(`${i+1} / ${m.actions[i]}`,256,42);
    const texture=new THREE.CanvasTexture(labelCanvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=mesh(new THREE.PlaneGeometry(7,.8),0xffffff,x,2.7,front+.2);sign.material.map=texture;
    if(index===0&&i===0){
      const mount=mesh(new THREE.BoxGeometry(.12,.12,.55),0x333d37,x+3,3.12,front+.42);
      const camera=mesh(new THREE.BoxGeometry(.65,.3,.32),0x53605a,x+3,3.12,front+.72);camera.rotation.y=-.32;
      surveillanceLamp=mesh(new THREE.SphereGeometry(.065,8,6),0xff5945,x+2.73,3.12,front+.9);surveillanceLamp.material.emissive.set(0x8a1408);
    }
    mesh(new THREE.BoxGeometry(2.25,.12,.45),0x353e38,x+layout.doorOffset,3.1,front+.1);
    for(const dx of [-1.12,1.12])mesh(new THREE.BoxGeometry(.12,3.1,.45),0x414a43,x+layout.doorOffset+dx,1.55,front+.1);
    if(layout.sideEntry!==undefined){
      const sideX=x-layout.w/2-.06,sideZ=z+layout.sideEntry;
      mesh(new THREE.BoxGeometry(.4,.12,2.8),0x353e38,sideX,3.1,sideZ);
      for(const dz of [-1.4,1.4])mesh(new THREE.BoxGeometry(.4,3.1,.12),0x414a43,sideX,1.55,sideZ+dz);
      const guide=mesh(new THREE.PlaneGeometry(2.4,.18),0xc5b061,sideX-1,.055,sideZ);guide.rotation.x=-Math.PI/2;
    }
    mesh(new THREE.CylinderGeometry(.27,.3,.6,10),0x7a8177,x+2,4,z);
    for(const dx of layout.windowXs){
      mesh(new THREE.BoxGeometry(1.45,.85,.07),0x263e42,x+dx,1.7,front+.19);
      for(const offset of [-.72,.72])mesh(new THREE.BoxGeometry(.06,.95,.1),0x525e55,x+dx+offset,1.7,front+.24);
      mesh(new THREE.BoxGeometry(1.5,.06,.1),0x525e55,x+dx,2.15,front+.24);
      mesh(new THREE.BoxGeometry(1.5,.06,.1),0x525e55,x+dx,1.25,front+.24);
    }
    if(layout.theme==='detention')for(const dx of layout.windowXs)for(const offset of [-.45,0,.45])mesh(new THREE.CylinderGeometry(.025,.025,.9,6),0x46514a,x+dx+offset,1.7,front+.3);
    if(layout.theme==='communications')for(const dx of [-2,2]){const panel=mesh(new THREE.BoxGeometry(2,.08,2),0x263b4e,x+dx,3.85,z);panel.rotation.x=.15;}
    const fixture=mesh(new THREE.BoxGeometry(1.5,.07,.22),0xceddcc,x,3.45,z);fixture.material.emissive.set(0x63745c);
    // Interior desks and equipment establish scale without closing the passage.
    if(step.kind!=='dual'){
      mesh(new THREE.BoxGeometry(1.8,.75,.7),0x485348,x-2,.4,z-2.6);
      mesh(new THREE.BoxGeometry(.7,1.8,.5),0x303c35,x+3,1,z-2.8);
    }
    // Wall-mounted detail gives each installation a purpose without adding invisible cover.
    const back=z-layout.d/2+.22;
    const display=mesh(new THREE.BoxGeometry(1.45,.85,.12),0x182c2b,x-2,2.1,back);
    display.material.emissive.set(index===1?0x15505a:index===2?0x293b44:0x264639);
    for(let row=0;row<3;row++){
      const line=mesh(new THREE.BoxGeometry(.9-row*.16,.025,.025),index===1?0x73c8c1:0x94b38a,x-2.1-row*.06,2.3-row*.19,back+.075);
      line.material.emissive.set(index===1?0x326860:0x405d38);
    }
    const cabinet=mesh(new THREE.BoxGeometry(.6,.9,.16),0x5d6b5a,x+2,2,back);
    cabinet.material.metalness=.35;
    mesh(new THREE.BoxGeometry(.04,.15,.04),0xb7bb9d,x+2.2,2,back+.1);
    // Contrasting entrance lines help players find the doorway during combat.
    for(const side of [-1,1]){
      const marker=mesh(new THREE.PlaneGeometry(.18,2),0xc5b061,x+layout.doorOffset+side*1.18,.055,front+.8);
      marker.rotation.x=-Math.PI/2;
    }
    }
    // Perimeter terrain, checkpoint towers, fuel stores and an airfield landmark.
    const mountainGeo=new THREE.SphereGeometry(28,20,12,0,Math.PI*2,0,Math.PI/2),mountainMat=new THREE.MeshStandardMaterial({color:0x687263,roughness:1});
    const mountains=new THREE.InstancedMesh(mountainGeo,mountainMat,26);
    for(let n=0;n<26;n++){const a=n/26*Math.PI*2,edge=Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)));dummy.position.set(Math.cos(a)/edge*215,-.5,Math.sin(a)/edge*215);dummy.scale.set(1+(n%3)*.4,1+(n%4)*.2,1);dummy.updateMatrix();mountains.setMatrixAt(n,dummy.matrix);}group.add(mountains);
    for(const [x,z] of [[-145,145],[145,145],[-145,-145],[145,-145]]){
      for(const dx of [-2,2])for(const dz of [-2,2])mesh(new THREE.CylinderGeometry(.13,.17,9,6),0x454e44,x+dx,4.5,z+dz);
      mesh(new THREE.BoxGeometry(5,.3,5),0x3d493c,x,8,z);mesh(new THREE.BoxGeometry(5.4,.2,5.4),0x3d493c,x,11,z);
      mesh(new THREE.BoxGeometry(5,1,0.18),0x6a7666,x,8.6,z-2.5);
    }
    // Service installations vary by operation; all large props have colliders.
    const prop=(x,z,w,h,d,color)=>{const item={x,z,w,h,d,mesh:mesh(new THREE.BoxGeometry(w,h,d),color,x,h/2,z)};obstacles.push(item);colliders.push(item);return item.mesh;};
    // Cover uses the same dimensions as authoritative movement and combat collision.
    for(const [x,z,w,h,d] of approachCover(m)){
      const barrier=prop(x,z,w,h,d,0x777e70);barrier.material.map=textures.concrete;barrier.userData.surface='concrete';
      for(const dx of [-w*.35,w*.35])mesh(new THREE.BoxGeometry(.09,h,.08),0x515b51,x+dx,h/2,z+d/2+.05);
    }
    const gate=checkpointGate(m,0);
    if(gate){const [x,z,w,h,d]=gate,gateMesh=prop(x,z,w,h,d,0x4d5956);gateMesh.userData.surface='metal';gateCollider=colliders[colliders.length-1];}
    for(const [x,z,w,h,d] of freightCargo(m)){
      const cargo=prop(x,z,w,h,d,0x58644b);cargo.userData.surface='metal';
      for(const dx of [-w*.35,w*.35])mesh(new THREE.BoxGeometry(.08,h,.035),0x354038,x+dx,h/2,z+d/2+.025);
    }
    for(let n=0;n<5;n++){const tank=mesh(new THREE.CylinderGeometry(1.4,1.4,3.2,16),0x818575,45+n*4,1.6,-5);tank.material.metalness=.4;tank.userData.surface='metal';const item={x:45+n*4,z:-5,w:2.8,h:3.2,d:2.8,mesh:tank};obstacles.push(item);colliders.push(item);}
    const radarBase=prop(-45,110,5,6,5,0x657269);
    const dish=mesh(new THREE.SphereGeometry(4,20,12,0,Math.PI*2,0,Math.PI/2),0xb1b9ad,-45,9,110);dish.rotation.z=.7;dish.material.side=THREE.DoubleSide;
    if(index===3){const runway=mesh(new THREE.PlaneGeometry(18,230),0x494e49,0,.01,0);runway.rotation.x=-Math.PI/2;for(let n=0;n<20;n++){const stripe=mesh(new THREE.PlaneGeometry(.3,5),0xd0c8a5,0,.025,-105+n*11);stripe.rotation.x=-Math.PI/2;}}
    // Mission-specific silhouettes are solid cover with shared server collision.
    for(const p of m.landmarks){
      const {x,z,w,h,d,kind}=p;
      const solid=prop(x,z,w,h,d,kind==='wagon'?0x655845:0x53645a);
      if(kind==='wagon'){
        for(const dx of [-6,6])for(const dz of [-1.85,1.85]){const wheel=mesh(new THREE.CylinderGeometry(.5,.5,.18,12),0x242b2a,x+dx,.5,z+dz);wheel.rotation.x=Math.PI/2;}
        for(const dz of [-1,1])mesh(new THREE.BoxGeometry(66,.1,.12),0x545d5a,-59,.08,z+dz);
        for(let n=0;n<9;n++)mesh(new THREE.BoxGeometry(.08,2.8,.05),0x3a423c,x-7+n*1.75,2,z+1.94);
      }else if(kind==='antenna'){
        for(let n=0;n<5;n++){const mast=mesh(new THREE.CylinderGeometry(.12,.2,5,8),0x9aa59e,x,7+n*4,z);}
        for(const dx of [-1,1])mesh(new THREE.BoxGeometry(.4,3,.7),0xc2c8bc,x+dx,20,z);
        mesh(new THREE.BoxGeometry(3,.2,.2),0x9aa59e,x,20,z);
      }else if(kind==='truck'){
        const cab=mesh(new THREE.BoxGeometry(2.65,1.25,2),0x405446,x,2,z+2.7);
        mesh(new THREE.BoxGeometry(2.2,.65,.04),0x24424a,x,2.15,z+3.72);
        for(const dx of [-1.5,1.5])for(const dz of [-2,2]){const wheel=mesh(new THREE.CylinderGeometry(.55,.55,.25,12),0x242b2a,x+dx,.55,z+dz);wheel.rotation.z=Math.PI/2;}
      }else if(kind==='aircraft'){
        solid.visible=false;
        const body=mesh(new THREE.CapsuleGeometry(1.8,19,6,16),0x858e87,x,2,z);body.rotation.x=Math.PI/2;
        mesh(new THREE.BoxGeometry(18,.15,4),0x717d75,x,2,z+1);
        mesh(new THREE.BoxGeometry(.2,4,4),0x717d75,x,4,z+9);
        mesh(new THREE.BoxGeometry(8,.15,2.5),0x717d75,x,2.8,z+9);
        for(const dx of [-3,3]){const engine=mesh(new THREE.CylinderGeometry(.7,.7,3,12),0x3e4c46,x+dx,1.2,z+1);engine.rotation.x=Math.PI/2;}
      }
    }
    // Long lanes, cargo cover and a marked extraction landing pad.
    for(let n=0;n<6;n++){
      const x=-5,z=55-n*22,w=5,h=3,d=12;
      const item={x,z,w,h,d,mesh:mesh(new THREE.BoxGeometry(w,h,d),0x4d594c,x,h/2,z)};obstacles.push(item);colliders.push(item);
    }
    // Ground-only landing-zone markings make extraction visible without changing collision.
    const [ex,ez]=m.extract;
    const pad=mesh(new THREE.CircleGeometry(4.6,40),0x39433f,ex,.025,ez);pad.rotation.x=-Math.PI/2;
    const outline=mesh(new THREE.RingGeometry(4.15,4.28,40),0xd0cba5,ex,.035,ez);outline.rotation.x=-Math.PI/2;
    for(const dx of [-.8,.8]){const mark=mesh(new THREE.PlaneGeometry(.22,2.8),0xe4ddbd,ex+dx,.04,ez);mark.rotation.x=-Math.PI/2;}
    const bar=mesh(new THREE.PlaneGeometry(1.8,.22),0xe4ddbd,ex,.04,ez);bar.rotation.x=-Math.PI/2;
    for(const [dx,dz] of [[-3.3,-3.3],[-3.3,3.3],[3.3,-3.3],[3.3,3.3]]){
      const light=mesh(new THREE.SphereGeometry(.12,8,6),0x63d6de,ex+dx,.15,ez+dz);light.material.emissive.setHex(0x23777a);
    }
    beacon = mesh(
      new THREE.TorusGeometry(2, 0.09, 8, 48),
      0x57d7ff,
      m.extract[0],
      0.15,
      m.extract[1],
    );
    beacon.rotation.x = Math.PI / 2;
    flyover=createExtractionFlyover(m.extract);group.add(flyover.aircraft);
    // The suspended marker identifies the active installation without adding a collider.
    waypoint=mesh(new THREE.OctahedronGeometry(.55,0),0x62edb9,0,6,0);
    waypoint.material.emissive.setHex(0x197d5c);
    waypointRing=mesh(new THREE.TorusGeometry(.9,.055,8,32),0x62edb9,0,5.35,0);
    waypointRing.rotation.x=Math.PI/2;waypointRing.material.emissive.setHex(0x197d5c);
    const hitGeometry=new THREE.CapsuleGeometry(.38,1.04,4,8),hitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
    enemies = m.guards.map(([a, b], i) => {
      const model = createSoldier(0x75664a);
      const spawn=guardSpawn([a,b],campaignObstacles(m));model.position.set(spawn[0],0,spawn[1]);
      group.add(model);
      const hitbox=new THREE.Mesh(hitGeometry,hitMaterial);hitbox.position.set(model.position.x,.9,model.position.z);group.add(hitbox);
      return {
        model,hitbox,
        detail:addGuardDetail(model),
        hp: 100,
        home: model.position.clone(),
        phase: i * 2,
        lastFire: 0,
      };
    });
    onReset({ x:m.building[0]+installationLayout(m).doorOffset, z:m.building[1]+installationLayout(m).d/2+11 });
    const generation=materialGeneration;
    loadMissionMaterials().then(maps=>{if(generation!==materialGeneration)return;group.traverse(o=>{if(o.isMesh&&o.userData.surface)applyMissionMaterial(o.material,maps,o.userData.surface);});});
    paint();
    message(m.brief);
  }
  function paint() {
    const m = MISSIONS[state.index],
      left = enemies.filter((e) => e.hp > 0).length;
    const teammates=network?getTeammates():[],teammate=teammates[0],teamLabel=q('.teammate-status');
    teamLabel.hidden=!teammate;teamLabel.textContent=teammate?teammateMessage(player.position,teammate):'';
    teamLabel.classList.toggle('down',teammate?.alive===false);
    q("h2").textContent = m.name;
    q(".brief").textContent = state.status==='complete'?m.debrief:m.brief;
    const step=state.step||0, current=m.steps[step];
    if(gateCollider){const closed=!!checkpointGate(m,step);gateCollider.mesh.visible=closed;const i=obstacles.indexOf(gateCollider);if(!closed&&i>=0)obstacles.splice(i,1);}

    if(state.status==='active'&&!(network&&networkWaiting))radio.announce(`${state.index}:${step}:${dualDone.join(',')}`,current?`Command. ${current.action}. ${current.hint}`:'Command. Objectives complete. Proceed to extraction and clear nearby guards.');
    if(state.status==='complete')radio.announce(`${state.index}:complete`,m.debrief);
    if(state.status==='failed')radio.announce(`${state.index}:failed`,'Command. Mission failed. Regroup and restart the operation.');
    const effect=activeOperationEffect(state.index,step),effectLabel=q('.operation-effect');effectLabel.textContent=effect;effectLabel.hidden=!effect;
    for(const light of installationLights)light.intensity=step>=2?0:18;
    if(surveillanceLamp){surveillanceLamp.material.color.set(step>0?0x43514a:0xff5945);surveillanceLamp.material.emissive.set(step>0?0x000000:0x8a1408);}
    const progress=q('.task-progress');progress.hidden=!task&&!revive&&holdRemaining===null;progress.value=revive?Math.max(0,1-revive.remaining/4):task&&current?Math.max(0,1-task.remaining/current.duration):holdRemaining!==null&&current?Math.max(0,1-holdRemaining/current.duration):0;
    const plan=q('.operation-plan ol');
    const planKey=`${state.index}:${step}`;
    if(plan.dataset.key!==planKey){plan.dataset.key=planKey;plan.replaceChildren(...m.steps.map((item,i)=>{const li=document.createElement('li');li.textContent=`${i<step?'✓ ':i===step?'→ ':''}${item.action}`;if(i===step)li.setAttribute('aria-current','step');return li;}));}

    for(let i=0;i<objectiveProps.length;i++){const prop=objectiveProps[i],done=i<step,isCharge=['plant','timedcharge'].includes(prop.kind);if(done&&!completedEffects.has(i)){completedEffects.add(i);if(isCharge){const [x,z]=m.steps[i].position;if(!network||networkSynced)demolition(new THREE.Vector3(x,1,z));for(const o of prop.parts)o.material.color.multiplyScalar(.25);}}for(const o of prop.parts)o.visible=!(done&&(prop.kind==='recover'||isCharge&&o===prop.indicator));prop.indicator.material.color.set(done?0x66716c:i===step?0x50efb1:0xcb984c);prop.indicator.material.emissive.set(done?0x000000:i===step?0x1f926a:0x392400);}
    for(let i=0;i<objectiveProps.length;i++)if(objectiveProps[i].kind==='dual')objectiveProps[i].nodeIndicators.forEach((light,n)=>{const done=i<step||i===step&&dualDone.includes(n);light.material.color.set(done?0x66716c:i===step?0x50efb1:0xcb984c);light.material.emissive.set(done?0x000000:i===step?0x1f926a:0x392400);});
    const target=missionWaypoint(m,step,dualDone),destination=target.position;
    for(const marker of [waypoint,waypointRing]){marker.visible=state.status==='active';marker.position.x=destination[0];marker.position.z=destination[1];marker.material.color.setHex(target.extraction?0x63d6ef:0x62edb9);}
    const navigation=objectiveNavigation(player.position,destination);
    const extractionHint=network?'Both living players must gather within 4m. Clear nearby guards and press E.':'Clear nearby guards and press E.';
    q('.objective').textContent=state.status==='failed'?'MISSION FAILED':state.status==='complete'?'OPERATION COMPLETE':current?`OBJECTIVE ${step+1}/${m.steps.length}: ${current.action} • ${navigation.distance}m ${navigation.direction} • ${current.hint} • ${['sweep','rendezvous'].includes(current.kind)?'Enter the marked zone; no interaction needed':'Press E at the marked equipment'} • ${left} guards alive`:`REACH EXTRACTION • ${navigation.distance}m ${navigation.direction} • ${extractionHint}`;
    if(!current&&state.status==='active'){
      const guards=enemies.map(e=>({x:e.model.position.x,z:e.model.position.z,hp:e.hp}));
      q('.objective').textContent+=` • ${extractionMessage(player.position,m.extract,guards,teammate,network)}`;
    }
    if(current?.kind==='dual'&&state.status==='active')q('.objective').textContent+=` • DATA RACKS ${dualDone.length}/2`;
    if(current?.kind==='rendezvous'&&state.status==='active'&&holdRemaining!==null)q('.objective').textContent=`SECURE DETENTION YARD • ${Math.ceil(holdRemaining)}s • Keep all living squad members inside and guards outside the zone.`;
    if(task && state.status==='active')q('.objective').textContent=`${current.action} • ${Math.ceil(task.remaining)}s • Stay within ${current.radius}m${current.kind==='defend'?' — KEEP FIGHTING; defend the relay':' — nearby threats interrupt'}`;
    if(revive&&state.status==='active')q('.objective').textContent=reviveMessage(revive,getPlayerId());
    if(current?.kind==='timedcharge'&&state.status==='active'&&chargeRemaining!==null)q('.objective').textContent=`CHARGE ARMED • ${Math.ceil(chargeRemaining)}s • RETREAT BEYOND 12m OR TAKE 250 DAMAGE`;
    q('.start').hidden=!network||state.status!=='waiting'||networkWaiting;
    q('.retry').hidden=network&&state.status!=='failed'&&state.status!=='complete';
    if(network && (networkWaiting||state.status==='waiting'))q('.objective').textContent=networkWaiting?'CO-OP: WAITING FOR SECOND PLAYER — safe exploration available; share your room code':'SQUAD READY — press START CO-OP MISSION or Enter';
    if(state.status==='complete')q('.objective').textContent=transitionRemaining!==null?`OPERATION COMPLETE — next operation in ${Math.ceil(transitionRemaining)}s`:'CAMPAIGN COMPLETE — all four operations secured';
    q(".next").hidden = state.status !== "complete" || transitionRemaining!==null;
    q(".next").textContent =
      state.index === MISSIONS.length-1 ? "REPLAY CAMPAIGN" : "NEXT OPERATION";
    const ctx = q(".radar").getContext("2d");
    ctx.fillStyle = "#101e20";
    ctx.fillRect(0, 0, 280, 150);
    const center = [0,0],
      scale = .43;
    const px = (x) => 140 + (x - center[0]) * scale,
      pz = (z) => 65 + (z - center[1]) * scale;
    ctx.fillStyle = "#637367";
    for (const o of obstacles)
      ctx.fillRect(
        px(o.x - o.w / 2),
        pz(o.z - o.d / 2),
        o.w * scale,
        o.d * scale,
      );
    ctx.fillStyle = "#84efb6";
    for(const s of m.steps.slice(state.step||0))ctx.fillRect(px(s.position[0])-3,pz(s.position[1])-3,6,6);
    const activePoint=state.intel?m.extract:destination;
    ctx.strokeStyle='#e8d38d';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(px(player.position.x),pz(player.position.z));ctx.lineTo(px(activePoint[0]),pz(activePoint[1]));ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle = "#57d7ff";
    ctx.beginPath();
    ctx.arc(px(m.extract[0]), pz(m.extract[1]), 5, 0, Math.PI * 2);
    ctx.stroke();
    for (const e of enemies)
      if (e.hp > 0) {
        ctx.fillStyle = "#fa8767";
        ctx.beginPath();
        ctx.arc(
          px(e.model.position.x),
          pz(e.model.position.z),
          2.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    for(const teammate of teammates){
      ctx.fillStyle=teammate.alive===false?'#ff775e':'#ffe18a';ctx.fillRect(px(teammate.x)-3,pz(teammate.z)-3,6,6);
      if(teammate.alive===false){ctx.strokeStyle='#ffe9de';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px(teammate.x)-5,pz(teammate.z));ctx.lineTo(px(teammate.x)+5,pz(teammate.z));ctx.moveTo(px(teammate.x),pz(teammate.z)-5);ctx.lineTo(px(teammate.x),pz(teammate.z)+5);ctx.stroke();}
    }
    ctx.save();
    ctx.translate(px(player.position.x), pz(player.position.z));
    ctx.rotate(-player.rotation.y);
    ctx.fillStyle = "#61d4ff";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#acbdba";
    ctx.font = "10px monospace";
    const point = state.intel ? m.extract : destination;
    const {distance:mapDistance,direction,degrees}=objectiveNavigation(player.position,point);
    ctx.fillText(
      `${state.intel ? "EXTRACTION" : m.steps[state.step||0].kind.toUpperCase()} ${mapDistance}m ${direction} ${degrees}° | N ↑`,
      8,
      142,
    );
  }
  function lineClear(from, to, respectSmoke=true) {
    const dir = to.clone().sub(from);
    ray.far = dir.length();
    ray.set(from, dir.normalize());
    return (!respectSmoke || !smokeBlocks(from,to,smokeClouds,Date.now())) && !ray.intersectObjects(
      obstacles.map((o) => o.mesh),
      false,
    ).length;
  }
  function update(dt, running) {
    if(flyover&&state.status==='complete'){
      flyoverTime+=dt;
      const progress=network&&transitionRemaining!==null?1-transitionRemaining/5:flyoverTime/5;
      flyover.update(progress,dt);
    }
    if(waypoint&&waypointRing){waypointClock+=dt;waypoint.position.y=6+Math.sin(waypointClock*2)*.2;waypoint.rotation.y+=dt;waypointRing.rotation.z+=dt*.6;}
    for(const e of enemies){if(e.hp<=0){e.deathAge=(e.deathAge||0)+dt;applyDeathPose(e.model,e.deathAge);}e.detail(e.model.position.distanceTo(player.position),e.hp<=0,e.deathAge||0);}
    if(!network&&state.status==='complete'&&transitionRemaining!==null){transitionRemaining-=dt;if(transitionRemaining<=0){start(state.index+1);return;}paint();}
    if(network){for(const e of enemies)if(e.hp>0)e.model.userData.updateAnimation?.(dt,!!e.networkMoving,false);return;}
    if (state.status !== "active" || !running) return;
    time += dt;
    const activeStep=MISSIONS[state.index].steps[state.step||0];
    if(chargeRemaining!==null&&activeStep?.kind==='timedcharge'){
      chargeRemaining=Math.max(0,chargeRemaining-dt);
      if(chargeRemaining===0){const damage=chargeDamageAt(player.position,activeStep.position);chargeRemaining=null;state={...state,step:state.step+1,intel:state.step+1===MISSIONS[state.index].steps.length};playObjective();message('FUEL CHARGE DETONATED — NEXT INSTALLATION MARKED');if(damage)onDamage(damage);if(state.status!=='active')return;}
    }
    if(!state.intel&&activeStep?.kind==='sweep'){
      const next=completeSweep(state,player.position,enemies.map(e=>({x:e.model.position.x,z:e.model.position.z,hp:e.hp})));
      if(next!==state){state=next;playObjective();message('CHECKPOINT SECURED — NEXT INSTALLATION MARKED');}
    }
    if(!state.intel&&activeStep?.kind==='rendezvous'){
      const guards=enemies.map(e=>({x:e.model.position.x,z:e.model.position.z,hp:e.hp}));
      holdRemaining=advanceRendezvous(activeStep,holdRemaining,dt,[player.position],guards);
      if(holdRemaining===0){state={...state,step:state.step+1,intel:state.step+1===MISSIONS[state.index].steps.length};holdRemaining=null;playObjective();message('DETENTION YARD SECURED — NEXT INSTALLATION MARKED');}
    }
    smokeClouds=smokeClouds.filter(c=>c.expires>Date.now());
    if(task){const m=MISSIONS[state.index],current=m.steps[state.step||0],checkStep=current.kind==='dual'?{...current,position:dualNodes(current)[task.node]}:current;
      const safe=objectiveSafe(checkStep,player.position,enemies.filter(e=>e.hp>0&&e.model.position.distanceTo(player.position)<12).length);
      if(!safe){task=null;message('ACTION INTERRUPTED — return to the marked equipment; clear threats for non-defense tasks');}
      else {task.remaining-=dt;if(task.remaining<=0){const node=task.node;task=null;if(current.kind==='dual'){const oldStep=state.step;state=recordDualNode({...state,dualDone},node);dualDone=state.dualDone;playObjective();message(state.step!==oldStep?'BOTH DATA RACKS SECURED — NEXT INSTALLATION MARKED':'DATA RACK SECURED — FIND THE SECOND RACK');}else if(current.kind==='timedcharge'){chargeRemaining=CHARGE_FUSE_SECONDS;message('CHARGE ARMED — RETREAT BEYOND 12m');}else completeInteraction();}}
    }
    const boxes = obstacles.map((o) => [o.x, o.z, o.w, o.h, o.d]);
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const eye = e.model.position.clone().add(new THREE.Vector3(0, 1.7, 0)),
        target = player.position.clone().add(new THREE.Vector3(0, 1.7, 0));
      const distance = eye.distanceTo(target),
        visible = distance < guardSightRange(state.index,state.step||0) && lineClear(eye, target);
      const defense=task&&MISSIONS[state.index].steps[state.step||0]?.kind==='defend';
      const rally=defenseRallyPoint(state.index,state.step,!!defense,e.model.position);
      const sabotage=sabotageInvestigation(state.index,state.step,e.model.position);
      if(visible&&e.hp<=50&&!defense&&time>=(e.nextCoverAttempt||0)){e.coverTarget=findGuardCover(e.model.position,player.position,boxes);e.coverUntil=time+2.5;e.nextCoverAttempt=time+10;}
      const cover=e.coverTarget&&time<e.coverUntil?e.coverTarget:null;
      const dest = cover?new THREE.Vector3(cover.x,0,cover.z):visible
        ? player.position
        : rally?new THREE.Vector3(rally.x,0,rally.z):e.alertUntil>time ? e.lastKnown : sabotage?new THREE.Vector3(sabotage.x,0,sabotage.z):e.home
            .clone()
            .add(
              new THREE.Vector3(
                Math.sin(time * 0.35 + e.phase) * 2,
                0,
                Math.cos(time * 0.35 + e.phase) * 2,
              ),
            );
      const dir = dest.clone().sub(e.model.position);
      dir.y = 0;
      let moving = dir.length() > (cover ? .3 : visible ? 6 : 0.3);
      if (moving) {
        const speed = (visible||rally||sabotage||cover ? 2.2 : 1) * dt;
        const next=guardStep(e.model.position,dest,boxes,speed);
        moving=Math.hypot(next.x-e.model.position.x,next.z-e.model.position.z)>.00001;
        e.model.position.x=next.x;e.model.position.z=next.z;dir.normalize();
      }
      if (dir.lengthSq() > 0) e.model.rotation.y = Math.atan2(-dir.x, -dir.z);
      e.model.userData.updateAnimation?.(dt, moving, false);
      if(visible)e.model.userData.setAimDirection?.(target.clone().sub(eye));
      if (visible && time - e.lastFire > 1.35) {
        e.lastFire = time;
        e.model.userData.playRecoil?.();
        playGunshotAt('assault',eye,player.position,player.rotation.y);
        tracer(eye, target.clone().sub(eye).normalize(), distance);
        onDamage(MISSIONS[state.index].damage);
        if (state.status !== "active") break;
      }
    }
    beacon.material.emissive.set(state.intel ? 0x168b99 : 0x000000);
    paint();
  }
  function aimMeshes() {
    return enemies.filter(e=>e.hp>0).map(e=>{
      e.hitbox.position.set(e.model.position.x,.9,e.model.position.z);
      e.hitbox.updateWorldMatrix(true,false);e.hitbox.userData.guard=e;
      return e.hitbox;
    });
  }
  function hit(origin, direction, damage, wallDistance) {
    if (state.status !== "active") return false;
    ray.set(origin, direction);
    ray.far = wallDistance;
    const hit = ray.intersectObjects(aimMeshes(), false)[0];
    if (!hit) return false;
    const e = hit.object.userData.guard;
    blood(hit.point);
    e.hp = Math.max(0, e.hp - damage);
    if (!e.hp) {
      e.deathAge=0;
      message("GUARD NEUTRALIZED");
    }
    paint();
    return true;
  }
  function completeInteraction() {
    const before = state;
    state = interactMission(
      state,
      player.position,
      enemies.filter((e) => e.hp > 0 && e.model.position.distanceTo(player.position)<12).length,
    );
    if (state !== before) {
      playObjective();
      message(
        state.status === "complete"
          ? "OPERATION COMPLETE"
          : state.intel ? "ALL OBJECTIVES SECURED — PROCEED TO EXTRACTION" : "OBJECTIVE COMPLETE — NEXT INSTALLATION MARKED",
      );
      if (state.status === "complete") {transitionRemaining=state.index<MISSIONS.length-1?5:null;if(transitionRemaining===null)document.exitPointerLock?.();}
    } else if (state.status === "active")
      message(
        "Follow the numbered objective. Clear guards within 12m, then press E within 2.4m of its terminal.",
      );
    paint();
  }
  function interact(){
    if(network){networkAction('interact');return;}
    if(state.status!=='active'||task||chargeRemaining!==null)return;
    if(!state.intel&&['sweep','rendezvous'].includes(MISSIONS[state.index].steps[state.step||0]?.kind)){message('ENTER THE MARKED ZONE AND CLEAR NEARBY GUARDS');return;}
    const m=MISSIONS[state.index],point=m.steps[state.step||0]?.position||m.extract;
    const threats=enemies.filter(e=>e.hp>0&&e.model.position.distanceTo(player.position)<12).length;
    if(!state.intel&&m.steps[state.step||0]?.kind==='dual'){
      const node=availableDualNode(m.steps[state.step||0],player.position,dualDone);
      if(node<0||threats){message('MOVE WITHIN 2.4m OF AN UNSECURED DATA RACK AND CLEAR NEARBY GUARDS');return;}
      task={node,remaining:m.steps[state.step||0].duration};paint();return;
    }
    if(state.intel ? Math.hypot(player.position.x-point[0],player.position.z-point[1])>2.4||threats>0 : !objectiveSafe(m.steps[state.step||0],player.position,threats,true)){message('Press E within 2.4m of the marked equipment. Clear nearby guards for collection, switches, charges and downloads.');return;}
    if(state.intel){completeInteraction();return;}
    task={remaining:m.steps[state.step||0].duration};paint();
  }
  function blast(position){
    if(state.status!=='active')return;
    const origin=new THREE.Vector3(position.x,.9,position.z);
    for(const e of enemies){if(e.hp<=0)continue;const target=e.model.position.clone().add(new THREE.Vector3(0,1,0)),damage=blastDamage(origin.distanceTo(target));if(damage && lineClear(origin,target,false)){e.hp=Math.max(0,e.hp-damage);if(!e.hp){e.deathAge=0;blood(target);}}}paint();
  }
  return {
    start,
    setNetworkAction(fn){networkAction=fn;},
    sync(snapshot){
      if(!network)return;
      const previous=state.step,previousNodes=dualDone.length;state={index:snapshot.index,status:snapshot.status,step:snapshot.step,intel:snapshot.intel};networkWaiting=snapshot.waiting;task=snapshot.task;holdRemaining=snapshot.holdRemaining??null;chargeRemaining=snapshot.chargeRemaining??null;dualDone=snapshot.dualDone||[];revive=snapshot.revive||null;transitionRemaining=snapshot.transitionRemaining??null;
      for(const data of snapshot.guards){const e=enemies[data.id];if(!e)continue;e.networkMoving=Math.hypot(e.model.position.x-data.x,e.model.position.z-data.z)>.01;const killed=e.hp>0&&data.hp<=0;e.hp=data.hp;if(killed){e.deathAge=0;blood(new THREE.Vector3(data.x,1.1,data.z));}e.model.position.x=data.x;e.model.position.z=data.z;e.model.rotation.y=data.rotation;if(e.hp>0){e.model.position.y=0;e.model.rotation.x=0;}}
      if(networkSynced&&state.step>previous){
        playObjective();
        message(state.intel?'ALL OBJECTIVES SECURED — BOTH PLAYERS GO TO EXTRACTION':'OBJECTIVE COMPLETE — NEXT INSTALLATION MARKED');
      }
      else if(networkSynced&&state.step===previous&&dualDone.length>previousNodes){playObjective();message('DATA RACK SECURED — FIND THE SECOND RACK');}
      paint();networkSynced=true;
      if(state.status==='failed'){panel.hidden=true;failure.hidden=false;document.exitPointerLock?.();}
      else {panel.hidden=false;failure.hidden=true;}
      if(state.status==='complete'&&transitionRemaining===null)document.exitPointerLock?.();
    },
    guardImpact(position){blood(new THREE.Vector3(position.x,position.y||1.1,position.z));},
    blast,
    onShot(origin,noise){const range=noise*guardResponseMultiplier(state.index,state.step||0);for(const e of enemies)if(e.hp>0&&e.model.position.distanceTo(origin)<range){e.lastKnown=origin.clone();e.alertUntil=time+8;}},
    smoke(position){smokeClouds.push({...position,expires:Date.now()+16000});},
    update,
    hit,
    interact,
    aimMeshes,
    get bounds(){return 155;},
    get canExplore(){return network&&(state.status==='waiting'||state.status==='active'&&networkWaiting);},
    get active() {
      return state.status !== "inactive";
    },
    get running() {
      return state.status === "active" && (!network||!networkWaiting);
    },
    fail() {
      state.status = "failed";
      paint();
      panel.hidden = true;
      failure.hidden = false;
      failure.querySelector(".restart").focus({preventScroll:true});
      document.exitPointerLock?.();
    },
    stop() {
      cleanup();network=false;networkWaiting=false;
      state.status = "inactive";
      panel.hidden = true;
      failure.hidden = true;
      group.visible = false;
      obstacles.splice(0,obstacles.length,...baseColliders);
      for(const o of baseWorld)o.visible=true;
    },
    setExit(fn) {
      exit = fn;
    },
  };
}
