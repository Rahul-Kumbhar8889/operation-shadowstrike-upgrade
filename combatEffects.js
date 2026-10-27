import * as THREE from 'three';
// Procedural sound and particle effects; no external audio assets.
let context;
function tone(freq,duration,type='sawtooth',gain=.045){try{context??=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume();const osc=context.createOscillator(),amp=context.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,context.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(35,freq*.22),context.currentTime+duration);amp.gain.setValueAtTime(gain,context.currentTime);amp.gain.exponentialRampToValueAtTime(.0001,context.currentTime+duration);osc.connect(amp).connect(context.destination);osc.start();osc.stop(context.currentTime+duration);}catch{}}
export function playGunshot(weapon='assault'){tone(weapon==='sniper'?95:weapon==='pistol'?210:145,weapon==='sniper'?.3:.15,'sawtooth',.07);}
export function playReload(){tone(440,.08,'square',.016);setTimeout(()=>tone(640,.09,'triangle',.016),130);}
export function playHitConfirmation(){tone(920,.09,'sine',.025);}
export function playElimination(){tone(660,.18,'triangle',.045);setTimeout(()=>tone(1000,.25,'triangle',.03),120);}
export function playImpact(){tone(180,.08,'triangle',.015);}
export function playExplosion(){tone(75,.55,'sawtooth',.075);}
export function createCombatEffects(scene){
 const active=[];const material=(color)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false});
 function particle(position,color,size=.12,velocity=new THREE.Vector3(),life=.25){const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,6,4),material(color));mesh.position.copy(position);scene.add(mesh);active.push({mesh,velocity,life,initial:life});return mesh;}
 function muzzleFlash(origin,weapon='assault'){const p=origin?.isVector3?origin:new THREE.Vector3(origin?.x||0,origin?.y||1.7,origin?.z||0);particle(p,0xffe7a1,weapon==='sniper'?.38:.24,new THREE.Vector3(),.075);playGunshot(weapon);}
 function shellEjection(origin){const p=origin?.isVector3?origin:new THREE.Vector3(origin?.x||0,origin?.y||1.7,origin?.z||0);particle(p,0xe0bb6c,.055,new THREE.Vector3(1.5,1.3,.2),.45);}
 function bulletImpact(position){const p=position?.isVector3?position:new THREE.Vector3(position?.x||0,position?.y||0,position?.z||0);for(let i=0;i<7;i++){const a=i*2.399;particle(p,0xf6c778,.055,new THREE.Vector3(Math.cos(a)*2,Math.random()*2,Math.sin(a)*2),.2);}playImpact();}
 function explosion(position){const p=position?.isVector3?position:new THREE.Vector3(position?.x||0,position?.y||0,position?.z||0);for(let i=0;i<18;i++){const a=i*2.399;particle(p,i%2?0xff6b1f:0xffd66b,.14,new THREE.Vector3(Math.cos(a)*3,Math.random()*3,Math.sin(a)*3),.55);}playExplosion();}
 function update(dt){const t=Math.min(dt||.016,.05);for(let i=active.length-1;i>=0;i--){const e=active[i];e.life-=t;e.mesh.position.addScaledVector(e.velocity,t);e.velocity.y-=5*t;e.mesh.material.opacity=Math.max(0,e.life/e.initial);if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();active.splice(i,1);}}}
 function dispose(){for(const e of active){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();}active.length=0;}
 return {muzzleFlash,shellEjection,bulletImpact,explosion,update,dispose};
}
