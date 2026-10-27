import * as THREE from 'three';
// Stylized, original tactical soldier with animated gait, aiming and recoil.
export function createSoldier(color = 0x283e35) {
  const soldier = new THREE.Group();
  const mat = (c, metalness=0) => new THREE.MeshStandardMaterial({color:c, roughness:.82, metalness});
  const uniform=mat(color), armor=mat(0x202b28), helmetMat=mat(0x172521), skin=mat(0xb98a67), boots=mat(0x111717), gun=mat(0x151a20,.5), detail=mat(0x55645a);
  function box(parent,w,h,d,m,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  box(soldier,.82,.95,.46,uniform,0,1.42,0);
  box(soldier,.9,.72,.16,armor,0,1.43,-.29);box(soldier,.88,.72,.16,armor,0,1.43,.29);box(soldier,.88,.15,.5,armor,0,.96,0);
  for(const x of [-.25,0,.25])box(soldier,.18,.24,.12,detail,x,1.24,-.43);
  box(soldier,.26,.22,.26,skin,0,1.99,0);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.29,16,12),skin);head.position.y=2.18;head.castShadow=true;soldier.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.34,18,12),helmetMat);helmet.position.y=2.36;helmet.scale.y=.67;helmet.castShadow=true;soldier.add(helmet);
  box(soldier,.72,.08,.52,helmetMat,0,2.29,-.09);
  const legs=[];
  for(const side of [-1,1]){const p=new THREE.Group();p.position.set(side*.23,.92,0);soldier.add(p);box(p,.31,.77,.35,uniform,0,-.36,0);box(p,.33,.2,.1,armor,0,-.34,-.2);box(p,.34,.24,.47,boots,0,-.79,-.08);legs.push(p);}
  box(soldier,.65,.72,.28,armor,0,1.43,.46);box(soldier,.55,.17,.31,detail,0,1.73,.47);
  const aimRig=new THREE.Group();aimRig.name='AimRig';aimRig.position.set(0,1.62,-.08);soldier.add(aimRig);
  for(const side of [-1,1])box(aimRig,.3,.2,.34,armor,side*.48,.04,-.06);
  const rightArm=box(aimRig,.25,.52,.28,uniform,.49,-.16,-.15);rightArm.rotation.set(-.75,0,-.25);
  const leftArm=box(aimRig,.25,.52,.28,uniform,-.49,-.16,-.18);leftArm.rotation.set(-.9,0,.25);
  box(aimRig,.2,.2,.48,uniform,.28,-.22,-.5);box(aimRig,.2,.2,.62,uniform,-.2,-.22,-.65);
  box(aimRig,.2,.16,.2,boots,.2,-.18,-.7);box(aimRig,.2,.16,.2,boots,-.12,-.18,-.88);
  const rifle=new THREE.Group();rifle.name='Rifle';rifle.position.set(.12,-.18,-.28);aimRig.add(rifle);
  box(rifle,.17,.19,.75,gun,0,0,-.28);box(rifle,.14,.14,.48,gun,0,.01,-.84);box(rifle,.065,.065,.5,gun,0,.01,-1.28);box(rifle,.11,.1,.14,detail,0,.01,-1.55);
  const magazine=box(rifle,.14,.32,.2,gun,0,-.24,-.38);magazine.rotation.x=-.18;
  box(rifle,.13,.12,.22,detail,0,.17,-.53);box(rifle,.19,.22,.4,gun,0,-.02,.25);
  const muzzle=new THREE.Object3D();muzzle.name='Muzzle';muzzle.position.set(0,.01,-1.65);rifle.add(muzzle);
  let walkTime=0,walkBlend=0,recoil=0;
  Object.assign(soldier.userData,{aimRig,rifle,muzzle});
  soldier.userData.setAimDirection=(worldDirection)=>{if(!worldDirection||worldDirection.lengthSq()<1e-6)return;const direction=worldDirection.clone().normalize();soldier.updateWorldMatrix(true,false);const local=direction.applyQuaternion(soldier.getWorldQuaternion(new THREE.Quaternion()).invert());const horizontal=Math.hypot(local.x,local.z);aimRig.rotation.y=THREE.MathUtils.clamp(Math.atan2(-local.x,-local.z),-1.1,1.1);aimRig.rotation.x=THREE.MathUtils.clamp(Math.atan2(local.y,Math.max(horizontal,1e-6)),-.65,.65);};
  soldier.userData.playRecoil=()=>{recoil=1;};
  soldier.userData.updateAnimation=(dt,moving=false,sprinting=false)=>{const t=Math.min(Math.max(dt,0),.05);walkBlend=THREE.MathUtils.damp(walkBlend,moving?1:0,10,t);if(moving)walkTime+=t*(sprinting?13:8);const swing=Math.sin(walkTime)*.55*walkBlend;legs[0].rotation.x=swing;legs[1].rotation.x=-swing;aimRig.position.y=1.62+Math.abs(Math.sin(walkTime*2))*.025*walkBlend;recoil=Math.max(0,recoil-t*9);rifle.position.z=-.28+recoil*.12;rifle.rotation.x=recoil*.09;};
  return soldier;
}
