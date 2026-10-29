import * as THREE from 'three';
// Self-hosted recorded firearm audio, with procedural fallback and particle effects.
let context,master,muted=false,noiseBuffer,samplePromise;
const samples=new Map();
export function preloadCombatAudio(){unlockAudio();samplePromise??=Promise.all(['rifle','pistol','sniper','shotgun','smg','reload'].map(async id=>{try{const response=await fetch(`/audio/${id}.ogg`);if(!response.ok)return;const c=unlockAudio();if(c)samples.set(id,await c.decodeAudioData(await response.arrayBuffer()));}catch{}}));return samplePromise;}
export function loadedAudioCount(){return samples.size;}
function sample(id,volume=1,rate=1,pan=0){const c=unlockAudio(),buffer=samples.get(id);if(!c||!buffer){preloadCombatAudio();return false;}const source=c.createBufferSource(),amp=c.createGain();source.buffer=buffer;source.playbackRate.value=rate;amp.gain.value=Math.min(.65,volume*.45);source.connect(amp);if(c.createStereoPanner){const panner=c.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));amp.connect(panner).connect(master);}else amp.connect(master);source.start();return true;}

export function setSoundMuted(value){muted=value;if(master)master.gain.value=muted?0:.55;return muted;}
export function unlockAudio(){try{context??=new (window.AudioContext||window.webkitAudioContext)();if(!master){master=context.createGain();master.gain.value=muted?0:.55;master.connect(context.destination);}if(context.state==='suspended')context.resume();return context;}catch{return null;}}
function tone(freq,duration,type='sine',gain=.045){const c=unlockAudio();if(!c)return;const osc=c.createOscillator(),amp=c.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,c.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.3),c.currentTime+duration);amp.gain.setValueAtTime(gain,c.currentTime);amp.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);osc.connect(amp).connect(master);osc.start();osc.stop(c.currentTime+duration);}
function noise(duration,gain,cutoff=2200){const c=unlockAudio();if(!c)return;if(!noiseBuffer){noiseBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}const source=c.createBufferSource(),filter=c.createBiquadFilter(),amp=c.createGain();source.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=cutoff;amp.gain.setValueAtTime(gain,c.currentTime);amp.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);source.connect(filter).connect(amp).connect(master);source.start(0,Math.random()*.5,duration);}
const profiles={assault:[110,.19,.18,2800],sniper:[60,.55,.30,1800],pistol:[180,.16,.14,4200],smg:[170,.10,.07,1100],shotgun:[70,.42,.28,1900],lmg:[85,.24,.22,2400],carbine:[130,.16,.16,3200],battle:[80,.29,.23,2500],marksman:[95,.34,.21,2800]};
const sampleMap={assault:['rifle',1],carbine:['rifle',1.08],battle:['rifle',.84],lmg:['rifle',.9],marksman:['sniper',1.13],sniper:['sniper',1],pistol:['pistol',1],shotgun:['shotgun',1],smg:['smg',1.12]};
export function playGunshot(weapon='assault',volume=1,pan=0){const [id,rate]=sampleMap[weapon]||sampleMap.assault;if(sample(id,volume*(weapon==='smg'?.55:1),rate,pan))return;const [,d,g,cut]=profiles[weapon]||profiles.assault;noise(d,g*volume,cut);}
export function playGunshotAt(weapon,position,listener,yaw=0){const dx=position.x-listener.x,dz=position.z-listener.z,d=Math.hypot(dx,dz);playGunshot(weapon,Math.max(.04,1/(1+d*.13)),d?(dx*Math.cos(yaw)-dz*Math.sin(yaw))/d:0);}
export function playInjury(){noise(.14,.07,500);}
export function playReload(){if(sample('reload',.5))return;noise(.09,.065,3000);setTimeout(()=>{noise(.12,.07,4000);tone(450,.06,'square',.012);},160);}
export function playHitConfirmation(){noise(.045,.025,1600);}
export function playElimination(){noise(.16,.07,350);}
export function playImpact(){noise(.09,.04,3500);}
export function playExplosion(){noise(1,.36,800);tone(45,.8,'triangle',.22);}
export function playFootstep(sprint=false){noise(.075,sprint?.065:.04,550);tone(80,.07,'sine',.025);}
export function playHeal(){tone(520,.28,'sine',.06);setTimeout(()=>tone(780,.35,'sine',.06),180);}
export function playObjective(){tone(640,.15,'sine',.05);setTimeout(()=>tone(960,.24,'sine',.05),140);}
export function playSmoke(){noise(.9,.1,1800);}
export function playPin(){noise(.06,.06,6500);tone(1300,.07,'triangle',.025);}
export function createCombatEffects(scene){
 const active=[];const material=(color)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false});
 function particle(position,color,size=.12,velocity=new THREE.Vector3(),life=.25){const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,6,4),material(color));mesh.position.copy(position);scene.add(mesh);active.push({mesh,velocity,life,initial:life});return mesh;}
 function muzzleFlash(origin,weapon='assault'){const p=origin?.isVector3?origin:new THREE.Vector3(origin?.x||0,origin?.y||1.7,origin?.z||0);particle(p,0xffe7a1,weapon==='sniper'?.38:.24,new THREE.Vector3(),.075);playGunshot(weapon);}
 function shellEjection(origin,direction){
  const p=origin?.isVector3?origin:new THREE.Vector3(origin?.x||0,origin?.y||1.7,origin?.z||0);
  // Eject to the operator's right, independent of the camera's world heading.
  const dx=Number(direction?.x)||0,dz=Number(direction?.z)||0,length=Math.hypot(dx,dz);
  const velocity=length>1e-6?new THREE.Vector3(-dz/length*1.5,1.3,dx/length*1.5):new THREE.Vector3(1.5,1.3,0);
  particle(p,0xe0bb6c,.055,velocity,.45);
 }
 function bulletImpact(position){const p=position?.isVector3?position:new THREE.Vector3(position?.x||0,position?.y||0,position?.z||0);for(let i=0;i<7;i++){const a=i*2.399;particle(p,0xf6c778,.055,new THREE.Vector3(Math.cos(a)*2,Math.random()*2,Math.sin(a)*2),.2);}playImpact();}
 function explosion(position){const p=position?.isVector3?position:new THREE.Vector3(position?.x||0,position?.y||0,position?.z||0);for(let i=0;i<18;i++){const a=i*2.399;particle(p,i%2?0xff6b1f:0xffd66b,.14,new THREE.Vector3(Math.cos(a)*3,Math.random()*3,Math.sin(a)*3),.55);}playExplosion();}
 function bloodImpact(position){
 const p=position.clone?position.clone():new THREE.Vector3(position.x,position.y||1.1,position.z);
 for(let i=0;i<9;i++){const a=i*2.399;particle(p,0x821b18,.025+(i%3)*.012,new THREE.Vector3(Math.cos(a)*1.2,.6+(i%3)*.3,Math.sin(a)*1.2),.35);}
 const mesh=new THREE.Mesh(new THREE.CircleGeometry(.18+Math.random()*.12,12),new THREE.MeshBasicMaterial({color:0x5c1714,transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));mesh.rotation.x=-Math.PI/2;mesh.scale.y=.65;mesh.position.set(p.x,.018,p.z);scene.add(mesh);active.push({mesh,velocity:new THREE.Vector3(),life:24,initial:24,decal:true});
 while(active.filter(e=>e.decal).length>24){const i=active.findIndex(e=>e.decal),e=active.splice(i,1)[0];scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}
}
 function update(dt){const t=Math.min(dt||.016,.05);for(let i=active.length-1;i>=0;i--){const e=active[i];e.life-=t;e.mesh.position.addScaledVector(e.velocity,t);if(!e.decal)e.velocity.y-=5*t;e.mesh.material.opacity=Math.max(0,e.life/e.initial)*(e.decal?.65:1);if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();active.splice(i,1);}}}
 function dispose(){for(const e of active){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}active.length=0;}
 return {muzzleFlash,shellEjection,bulletImpact,bloodImpact,explosion,update,dispose};
}
