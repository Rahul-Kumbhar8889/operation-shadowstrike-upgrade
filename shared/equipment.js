// Server-owned inventory and identical geometry rules in story and PvP.
export const EQUIPMENT = {
 frag:{name:'FRAGMENTATION GRENADE',count:3,fuse:1.8,radius:9,damage:120},
 smoke:{name:'SMOKE GRENADE',count:2,fuse:1,radius:6,duration:16},
 injection:{name:'FIELD MEDICAL INJECTION',count:3,heal:350,pvpHeal:35},
};
export const createEquipment=()=>Object.fromEntries(Object.entries(EQUIPMENT).map(([id,e])=>[id,e.count]));
export function blastDamage(distance){return distance>=EQUIPMENT.frag.radius?0:Math.round(EQUIPMENT.frag.damage*(1-distance/EQUIPMENT.frag.radius));}
export function smokeBlocks(a,b,clouds,now){
 const dx=b.x-a.x,dz=b.z-a.z,n=dx*dx+dz*dz;
 return clouds.some(c=>{if(c.expires<=now)return false;const t=n?Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.z-a.z)*dz)/n)):0;return Math.hypot(a.x+t*dx-c.x,a.z+t*dz-c.z)<EQUIPMENT.smoke.radius;});
}
export function healHealth(hp,max,pvp=false){return hp<=0?hp:Math.min(max,hp+(pvp?EQUIPMENT.injection.pvpHeal:EQUIPMENT.injection.heal));}
// A low, forward throw. Stop at geometry; never place a grenade through a wall.
export function throwLanding(origin,direction,boxes,bounds){
 const length=Math.hypot(direction.x,direction.z)||1,dx=direction.x/length,dz=direction.z/length;
 let x=origin.x,z=origin.z;
 for(let d=.3;d<=16;d+=.3){const nx=origin.x+dx*d,nz=origin.z+dz*d;if(Math.abs(nx)>bounds||Math.abs(nz)>bounds||boxes.some(([a,b,w,,depth])=>Math.abs(nx-a)<w/2+.2&&Math.abs(nz-b)<depth/2+.2))break;x=nx;z=nz;}
 return {x,y:.2,z};
}
