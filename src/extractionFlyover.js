import * as THREE from 'three';

// A non-colliding extraction flyover: purely visual, never changes mission state.
export function flyoverPosition(point,progress){
 const t=Math.max(0,Math.min(1,progress));
 return {x:point[0]-18+36*t,y:9+2*Math.sin(Math.PI*t),z:point[1]-7};
}
export function createExtractionFlyover(point){
 const aircraft=new THREE.Group(),bodyMat=new THREE.MeshStandardMaterial({color:0x46554c,metalness:.32,roughness:.7}),glass=new THREE.MeshStandardMaterial({color:0x263d44,metalness:.35,roughness:.25}),dark=new THREE.MeshStandardMaterial({color:0x202a28,metalness:.4,roughness:.7});
 function add(geometry,material,x,y,z){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;aircraft.add(mesh);return mesh;}
 const hull=add(new THREE.SphereGeometry(1,20,12),bodyMat,0,0,0);hull.scale.set(2.4,1.05,1);
 const canopy=add(new THREE.SphereGeometry(1,16,10),glass,1.4,.28,0);canopy.scale.set(.85,.67,.85);
 const tail=add(new THREE.CylinderGeometry(.16,.4,4,10),bodyMat,-3.5,.25,0);tail.rotation.z=Math.PI/2;
 const fin=add(new THREE.BoxGeometry(.85,1.15,.12),bodyMat,-5.35,.7,0);fin.rotation.z=-.25;
 for(const z of [-.8,.8]){add(new THREE.CylinderGeometry(.07,.07,4,8),dark,0,-1.25,z).rotation.z=Math.PI/2;for(const x of [-1.1,1.1])add(new THREE.CylinderGeometry(.06,.06,.65,8),dark,x,-.95,z);}
 add(new THREE.CylinderGeometry(.1,.1,.55,8),dark,0,1.2,0);
 const rotor=new THREE.Group();rotor.position.y=1.52;aircraft.add(rotor);
 for(const rotation of [0,Math.PI/2]){const blade=new THREE.Mesh(new THREE.BoxGeometry(7,.04,.18),dark);blade.rotation.y=rotation;rotor.add(blade);}
 const tailRotor=new THREE.Group();tailRotor.position.set(-5.35,.4,.12);aircraft.add(tailRotor);
 for(const rotation of [0,Math.PI/2]){const blade=new THREE.Mesh(new THREE.BoxGeometry(1.5,.08,.04),dark);blade.rotation.z=rotation;tailRotor.add(blade);}
 aircraft.visible=false;
 return {aircraft,update(progress,dt){const p=flyoverPosition(point,progress);aircraft.position.set(p.x,p.y,p.z);aircraft.rotation.y=0;rotor.rotation.y+=dt*24;tailRotor.rotation.z+=dt*30;aircraft.visible=progress<1;}};
}
