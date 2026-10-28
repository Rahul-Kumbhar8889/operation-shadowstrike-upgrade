import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original articulated human model. Metres: 1.88m crown, 1.70m eye line.
// Static details are merged by material per joint, preserving elbows/knees and recoil.
let fabric;
function camouflage() {
  if (fabric) return fabric;
  const size=128, bytes=new Uint8Array(size*size*4), patches=[];
  let seed=47; const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<90;i++)patches.push([random()*size,random()*size,5+random()*16,i%4]);
  const colors=[[162,171,137],[97,119,82],[61,81,58],[194,190,153]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let c=0;for(const [a,b,r,v] of patches)if((x-a)**2+(y-b)**2<r*r)c=v;
    const noise=(random()-.5)*14;for(let k=0;k<3;k++)bytes[(y*size+x)*4+k]=colors[c][k]+noise;
    bytes[(y*size+x)*4+3]=255;
  }
  fabric=new THREE.DataTexture(bytes,size,size);fabric.colorSpace=THREE.SRGBColorSpace;
  fabric.wrapS=fabric.wrapT=THREE.RepeatWrapping;fabric.magFilter=THREE.LinearFilter;fabric.needsUpdate=true;return fabric;
}
export function createSoldier(color=0x52654b) {
  const root=new THREE.Group();root.name='TacticalOperator';
  const material=(color,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const cloth=material(new THREE.Color(color).lerp(new THREE.Color(0xffffff),.58));cloth.map=camouflage();
  const webbing=material(new THREE.Color(color).lerp(new THREE.Color(0x6b7054),.5));
  const armor=material(0x3b4435), dark=material(0x222923), leather=material(0x242523),skin=material(0xbc9578,.9),metal=material(0x333b3b,.4,.6),lens=material(0x314e51,.23,.65);
  const parts=[];
  function joint(parent,name,x,y,z){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);parts.push(g);return g;}
  const body=joint(root,'Torso',0,0,0);
  function mesh(parent,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function oval(parent,mat,x,y,z,w,h,d){const g=new THREE.SphereGeometry(1,16,12);g.scale(w/2,h/2,d/2);return mesh(parent,g,mat,x,y,z);}
  function rounded(parent,mat,x,y,z,w,h,d,r=.02){return mesh(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);}
  function segment(parent,mat,a,b,r1,r2=r1){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);
    const o=mesh(parent,new THREE.CylinderGeometry(r2,r1,delta.length(),12),mat);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
  // Tailored waist, ribcage and shoulders form one continuous tapered surface.
  const profile=[[.145,.90],[.17,1.00],[.155,1.09],[.19,1.26],[.225,1.43],[.21,1.49],[.14,1.55],[.075,1.58]];
  const torso=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),24);torso.scale(1,1,.66);mesh(body,torso,cloth);
  oval(body,cloth,0,.96,0,.35,.25,.24);
  rounded(body,webbing,0,1.04,0,.36,.055,.27,.018);
  rounded(body,metal,0,1.04,-.145,.075,.045,.016,.008);
  // Curved plate carrier and stitched shoulder straps fit the torso, not a cube shell.
  oval(body,armor,0,1.31,-.105,.41,.46,.14);
  oval(body,armor,0,1.32,.105,.39,.43,.12);
  for(const side of [-1,1]){
    rounded(body,webbing,side*.135,1.47,-.11,.05,.22,.035,.012);
    rounded(body,webbing,side*.13,1.16,-.18,.09,.17,.055,.014);
    rounded(body,webbing,side*.19,1.12,.015,.07,.12,.10,.015);
  }
  for(const y of [1.24,1.29,1.34])rounded(body,webbing,0,y,-.177,.33,.016,.012,.004);
  rounded(body,dark,.13,1.41,-.18,.065,.09,.035,.01);
  segment(body,metal,[.13,1.45,-.18],[.13,1.63,-.18],.006);
  oval(body,webbing,0,1.30,.205,.28,.36,.17);
  rounded(body,webbing,0,1.19,.28,.21,.12,.075,.025);
  // Face: oval cranium, jaw, cheeks, nose and ears; helmet follows the skull.
  segment(body,skin,[0,1.52,0],[0,1.66,0],.065);
  const head=joint(root,'Head',0,1.70,0);
  oval(head,skin,0,.015,0,.235,.29,.23);
  oval(head,skin,0,-.065,-.027,.17,.15,.18);
  oval(head,skin,0,-.008,-.115,.045,.07,.055);
  for(const side of [-1,1]){
    oval(head,skin,side*.116,0,0,.045,.083,.055);
    oval(head,dark,side*.05,.035,-.107,.055,.02,.025);
    rounded(head,webbing,side*.107,.035,-.015,.02,.037,.19,.008);
    oval(head,dark,side*.12,.015,.01,.045,.10,.07);
  }
  rounded(head,lens,0,.032,-.12,.19,.055,.025,.012);
  oval(head,dark,0,-.07,-.094,.15,.10,.06); // fabric face covering
  const helmet=mesh(head,new THREE.SphereGeometry(.142,24,16,0,Math.PI*2,0,Math.PI*.57),webbing,0,.072,0);helmet.scale.set(1,1,.97);
  rounded(head,webbing,0,.057,-.12,.23,.026,.10,.01);
  rounded(head,dark,0,.135,-.13,.045,.055,.022,.007);
  segment(head,dark,[.12,-.02,0],[.04,-.13,-.05],.008);
  segment(head,dark,[-.12,-.02,0],[-.04,-.13,-.05],.008);
  // Separate thigh/shin joints bend at the knee rather than swinging rigid blocks.
  const legs=[];
  for(const side of [-1,1]){
    const hip=joint(root,side<0?'LeftHip':'RightHip',side*.105,.96,0);
    segment(hip,cloth,[0,0,0],[0,-.40,.015],.095,.075);oval(hip,cloth,0,-.17,0,.19,.38,.20);
    rounded(hip,webbing,side*.085,-.16,.01,.055,.15,.13,.016);
    const knee=joint(hip,'Knee',0,-.41,.015);oval(knee,armor,0,0,-.063,.14,.15,.07);
    segment(knee,cloth,[0,0,0],[0,-.36,.015],.072,.05);oval(knee,cloth,0,-.16,.015,.13,.30,.14);
    const boot=rounded(knee,leather,0,-.43,-.035,.14,.13,.27,.035);
    rounded(knee,dark,0,-.49,-.035,.15,.035,.28,.009);
    for(let row=0;row<3;row++)rounded(knee,webbing,0,-.38-row*.025,-.116,.10,.009,.014,.003);
    legs.push({hip,knee});
  }
  const aimRig=joint(root,'AimRig',0,1.46,0);
  for(const side of [-1,1]){
    const shoulder=[side*.235,0,0],elbow=[side*.27,-.24,-.08],hand=side===1?[.12,-.22,-.39]:[-.06,-.20,-.62];
    oval(aimRig,cloth,...shoulder,.17,.22,.20);
    segment(aimRig,cloth,shoulder,elbow,.076,.059);oval(aimRig,cloth,...elbow,.12,.12,.12);
    segment(aimRig,cloth,elbow,hand,.06,.043);oval(aimRig,leather,...hand,.095,.10,.13);
    for(let finger=0;finger<3;finger++)rounded(aimRig,leather,hand[0]+(finger-1)*.023,hand[1]-.025,hand[2]-.04,.021,.06,.06,.008);
  }
  const rifle=joint(aimRig,'Rifle',.10,-.21,-.23);rifle.scale.setScalar(.62);
  rounded(rifle,metal,0,0,-.30,.15,.17,.72,.014);rounded(rifle,dark,0,0,.15,.13,.18,.35,.02);
  rounded(rifle,webbing,0,0,-.80,.13,.14,.40,.012);segment(rifle,metal,[0,.015,-.95],[0,.015,-1.50],.027);
  rounded(rifle,dark,0,-.21,-.32,.11,.28,.17,.015);rounded(rifle,metal,0,.14,-.40,.08,.08,.16,.012);
  const muzzle=new THREE.Object3D();muzzle.name='Muzzle';muzzle.position.set(0,0,-1.5);rifle.add(muzzle);
  // Bake static meshes at each joint into a handful of material batches.
  for(const part of parts){const batches=new Map();for(const child of [...part.children])if(child.isMesh){child.updateMatrix();const g=child.geometry.clone().applyMatrix4(child.matrix);if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(g);part.remove(child);child.geometry.dispose();}
    for(const [mat,geos] of batches){const combined=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g));mesh(part,combined,mat);geos.forEach(g=>g.dispose());}}
  let walk=0,blend=0,recoil=0;
  Object.assign(root.userData,{aimRig,rifle,muzzle,modelVersion:'anatomical-operator-v2',height:1.91});
  root.userData.setAimDirection=direction=>{if(!direction?.lengthSq())return;root.updateWorldMatrix(true,false);const local=direction.clone().normalize().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert());aimRig.rotation.y=THREE.MathUtils.clamp(Math.atan2(-local.x,-local.z),-.75,.75);aimRig.rotation.x=THREE.MathUtils.clamp(Math.atan2(local.y,Math.hypot(local.x,local.z)),-.65,.65);head.rotation.y=aimRig.rotation.y*.6;};
  root.userData.playRecoil=()=>{recoil=1;};
  root.userData.updateAnimation=(dt,moving=false,sprint=false)=>{dt=Math.min(dt,.05);blend=THREE.MathUtils.damp(blend,moving?1:0,10,dt);walk+=dt*(sprint?11:7);for(let i=0;i<2;i++){const phase=walk+i*Math.PI;legs[i].hip.rotation.x=Math.sin(phase)*.55*blend;legs[i].knee.rotation.x=Math.max(0,-Math.sin(phase))*.85*blend;}body.position.y=Math.abs(Math.sin(walk*2))*.018*blend;aimRig.position.y=1.46+body.position.y;recoil=Math.max(0,recoil-dt*9);rifle.position.z=-.23+recoil*.065;rifle.rotation.x=recoil*.055;};
  return root;
}
