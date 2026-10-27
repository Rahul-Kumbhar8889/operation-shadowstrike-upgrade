import * as THREE from 'three';
// Decorative, collision-free tactical environment. Server collision boxes remain authoritative.
export function createBattlefield(scene) {
  const group=new THREE.Group();group.name='MilitaryBattlefield';scene.add(group);
  const m=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.9,metalness});
  const road=m(0x39434a), line=m(0xb8a66b), sand=m(0x8b7958), wood=m(0x6b5540), metal=m(0x53616a,.35), concrete=m(0x747b75), grass=m(0x425e37);
  function box(w,h,d,material,x,y,z,rotation=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.rotation.y=rotation;o.receiveShadow=true;o.castShadow=true;group.add(o);return o;}
  box(92,.035,7,road,0,.018,19);box(7,.035,92,road,20,.019,0);
  for(let i=-40;i<=40;i+=8){box(3,.045,.13,line,i,.045,19);box(.13,.045,3,line,20,.047,i);}
  // Sandbag walls and original cover props outside spawn and target lines.
  for(const [x,z,r] of [[-23,-20,0],[23,-22,0],[-26,13,0],[26,26,Math.PI/2],[-17,26,0],[28,-5,Math.PI/2]]){
    for(let layer=0;layer<3;layer++)for(let j=0;j<5-layer%2;j++){const b=box(1.03,.34,.55,sand,x+(j-2)*.99+(layer%2)*.4,.23+layer*.33,z,r);b.rotation.z=(j%2?-.02:.02);}
  }
  for(const [x,z] of [[-29,-29],[32,-31],[-30,30],[32,31],[-25,3],[29,13]]){
    box(1.8,1.6,1.8,wood,x,.8,z);box(1.8,.12,1.8,metal,x,1.63,z);
    box(1.4,1.25,1.4,wood,x+2,.625,z+1.1);
  }
  for(const [x,z] of [[-38,-38],[38,-38],[-38,38],[38,38]]){
    for(const dx of [-1.2,1.2])for(const dz of [-1.2,1.2])box(.22,6,.22,metal,x+dx,3,z+dz);
    box(3.2,.25,3.2,wood,x,6,z);box(3.5,.2,3.5,metal,x,7.75,z);
    for(const dx of [-1.45,1.45])box(.12,1.2,3.2,metal,x+dx,6.7,z);
    for(const dz of [-1.45,1.45])box(3.2,1.2,.12,metal,x,6.7,z+dz);
  }
  for(const [x,z] of [[-31,-11],[31,-11],[-31,11],[31,11]]){
    box(.18,7,.18,metal,x,3.5,z);const lamp=new THREE.Mesh(new THREE.ConeGeometry(.65,.7,8),concrete);lamp.position.set(x,7,z);lamp.rotation.x=Math.PI;group.add(lamp);
    const light=new THREE.PointLight(0xffe7b0,.6,13);light.position.set(x,6.7,z);group.add(light);
  }
  // Deterministic low-poly grass clumps.
  let seed=231;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const blade=new THREE.ConeGeometry(.12,.65,3);
  for(let i=0;i<135;i++){
    const x=rnd()*88-44,z=rnd()*88-44;
    if(Math.abs(z-19)<5||Math.abs(x-20)<5||Math.abs(x)<6&&Math.abs(z)<6)continue;
    const mesh=new THREE.Mesh(blade,grass);mesh.position.set(x,.3,z);mesh.rotation.y=rnd()*6.28;mesh.scale.setScalar(.6+rnd()*.8);group.add(mesh);
  }
  // Scenic perimeter silhouettes (not gameplay obstacles).
  const trunk=m(0x4b4032),leaf=m(0x263f2e);
  for(const [x,z] of [[-43,-31],[-43,-4],[-42,31],[42,-25],[42,7],[39,40],[-19,42]]){
    box(.5,3,.5,trunk,x,1.5,z);
    const canopy=new THREE.Mesh(new THREE.ConeGeometry(2.1,5,6),leaf);canopy.position.set(x,5,z);canopy.castShadow=true;group.add(canopy);
  }
  return group;
}
