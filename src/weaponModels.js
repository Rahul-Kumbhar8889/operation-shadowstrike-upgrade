import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Original generic firearm geometry. Visuals never determine damage or shot origin.
const templates=new Map();
export function createWeaponModel(id){
 if(templates.has(id))return templates.get(id).clone(true);
 const root=new THREE.Group(),batches=new Map();
 const steel=new THREE.MeshStandardMaterial({color:0x3a444a,roughness:.52,metalness:.45});
 const polymer=new THREE.MeshStandardMaterial({color:0x252e30,roughness:.88});
 const trim=new THREE.MeshStandardMaterial({color:0x7a817c,roughness:.55,metalness:.35});
 const rubber=new THREE.MeshStandardMaterial({color:0x10191c,roughness:.95});
 function add(g,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0){const m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1));g.applyMatrix4(m);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);}
 function box(w,h,d,mat,x,y,z,rx=0){add(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.12),mat,x,y,z,rx);}
 function tube(radius,length,mat,x,y,z){add(new THREE.CylinderGeometry(radius,radius,length,12),mat,x,y,z,Math.PI/2);}
 function ring(radius,width,mat,x,y,z){add(new THREE.TorusGeometry(radius,width,6,16),mat,x,y,z);}
 function scope(z=-.45){tube(.064,.52,steel,0,.25,z);tube(.082,.1,polymer,0,.25,z-.28);tube(.072,.08,polymer,0,.25,z+.28);ring(.065,.012,trim,0,.25,z-.34);for(const dz of [-.15,.15])box(.06,.13,.08,steel,0,.15,z+dz);box(.055,.05,.055,trim,.06,.27,z);}
 if(id==='pistol'){
  box(.14,.13,.50,steel,0,0,-.24);box(.13,.10,.34,polymer,0,-.105,-.18);box(.13,.28,.16,polymer,0,-.26,-.035,-.22);
  tube(.035,.12,steel,0,0,-.51);ring(.025,.009,rubber,0,0,-.58);
  for(let n=0;n<5;n++)box(.145,.075,.009,rubber,0,.012,-.04-n*.025);
  box(.025,.045,.04,trim,0,.085,-.43);for(const dx of [-.045,.045])box(.02,.035,.035,trim,dx,.085,-.05);
  const guard=new THREE.TorusGeometry(.065,.012,6,16);guard.scale(1,1,.65);add(guard,steel,0,-.16,-.19,0,Math.PI/2);
 }else{
  const sniper=id==='sniper',shotgun=id==='shotgun',smg=id==='smg',lmg=id==='lmg';
  const front=smg?.68:id==='carbine'?.85:sniper?1.9:id==='marksman'?1.7:shotgun?1.65:1.5;
  box(.15,.14,.58,steel,0,0,-.25);tube(.07,.53,steel,0,.055,-.25);
  box(.10,.24,.15,polymer,0,-.21,-.10,-.27);
  box(.14,.13,.13,steel,0,-.055,.075);box(.09,.08,.30,steel,0,0,.25);
  box(.15,.23,.09,polymer,0,-.025,.43);box(.16,.23,.035,rubber,0,-.025,.49);
  // Open skeleton stock, trigger guard, ejection port and selector.
  box(.045,.035,.25,trim,.065,.055,.25);box(.045,.035,.25,trim,-.065,.055,.25);
  const trigger=new THREE.TorusGeometry(.078,.012,6,16);trigger.scale(1,.7,1);add(trigger,steel,0,-.125,-.24,0,Math.PI/2);
  box(.012,.05,.15,rubber,.081,.025,-.24);box(.018,.022,.09,trim,.09,.07,-.20);
  if(shotgun){
   tube(.055,front-.5,steel,0,.025,-(.5+front)/2);tube(.045,.78,steel,0,-.10,-.84);
   box(.18,.17,.34,polymer,0,-.05,-.83);for(let n=0;n<6;n++)box(.19,.12,.012,rubber,0,-.05,-.69-n*.05);
   box(.028,.055,.025,trim,0,.10,-front+.08);
  }else{
   const handguard=smg?.29:sniper?.55:id==='carbine'?.36:.53;
   box(.15,.14,handguard,polymer,0,.015,-.55-handguard/2);
   for(let n=0;n<5;n++){const z=-.58-n*handguard/6;for(const dx of [-.079,.079])box(.008,.04,.045,rubber,dx,.025,z);box(.11,.015,.014,trim,0,.10,z);}
   tube(.028,front-.55,steel,0,.035,-(front+.55)/2);
   if(smg){tube(.065,.34,polymer,0,.035,-front-.10);ring(.043,.012,rubber,0,.035,-front-.28);}
   else {tube(.04,.10,steel,0,.035,-front);ring(.026,.009,rubber,0,.035,-front-.055);}
   if(lmg){box(.31,.24,.25,polymer,0,-.24,-.30);box(.29,.04,.25,trim,0,-.12,-.30);for(const dx of [-.16,.16])box(.025,.36,.025,steel,dx,-.20,-1.14,-.3);}
   else {const magazine=box;magazine(.11,sniper?.17:smg?.35:.28,.17,polymer,0,-.23,-.34,.15);for(let n=0;n<3;n++)box(.116,.015,.15,trim,0,-.16-n*.055,-.34);}
  }
  if(sniper||id==='marksman')scope();
  else if(!shotgun){
   box(.07,.035,.15,steel,0,.13,-.40);ring(.055,.012,steel,0,.19,-.43);box(.012,.02,.018,trim,0,.15,-.43);
   for(const dx of [-.03,.03])box(.012,.08,.025,steel,dx,.12,-front+.16);
  }
  if(sniper){box(.10,.08,.12,polymer,0,.06,.38);tube(.018,.13,trim,.14,.02,-.14);}
  if(id==='battle')box(.13,.29,.19,polymer,0,-.24,-.35);
 }
 for(const [material,geometries] of batches){const flat=geometries.map(g=>g.index?g.toNonIndexed():g);const geometry=mergeGeometries(flat);for(const g of new Set([...geometries,...flat]))g.dispose();geometry.userData.sharedWeapon=true;const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;root.add(mesh);}
 root.userData.weaponId=id;templates.set(id,root);return root.clone(true);
}
