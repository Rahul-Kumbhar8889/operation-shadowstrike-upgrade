import {blocked} from './campaign.js';

// Try the direct path first, then short angled steps around corners.
export function guardStep(position,target,boxes,distance){
 const dx=target.x-position.x,dz=target.z-position.z,total=Math.hypot(dx,dz);
 if(total<.001||distance<=0)return {...position};
 const step=Math.min(distance,total),angle=Math.atan2(dz,dx);
 for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2]){
  const x=position.x+Math.cos(angle+turn)*step,z=position.z+Math.sin(angle+turn)*step;
  // Sample the path as well as the end, preventing movement through thin walls.
  let clear=true;for(let n=1;n<=Math.ceil(step/.2);n++){const t=n/Math.ceil(step/.2);if(blocked(position.x+(x-position.x)*t,position.z+(z-position.z)*t,boxes)){clear=false;break;}}
  if(clear)return {x,z};
 }
 return {...position};
}

// Pick nearby cover on the side of an obstacle opposite the visible threat.
export function findGuardCover(position,threat,boxes){
 let best=null,bestDistance=Infinity;
 for(const [x,z,w,,d] of boxes){
  if(Math.hypot(x-position.x,z-position.z)>9)continue;
  const dx=x-threat.x,dz=z-threat.z;
  const candidates=Math.abs(dx)/(w||1)>Math.abs(dz)/(d||1)
   ?[{x:x+Math.sign(dx||1)*(w/2+.65),z}]
   :[{x,z:z+Math.sign(dz||1)*(d/2+.65)}];
  for(const p of candidates){const distance=Math.hypot(p.x-position.x,p.z-position.z);
   if(distance>7||distance<.6||distance>=bestDistance||blocked(p.x,p.z,boxes))continue;
   // Ensure the player-to-cover line crosses this solid obstacle.
   const segments=Math.ceil(Math.hypot(p.x-threat.x,p.z-threat.z)/.2);let sheltered=false;
   for(let n=1;n<segments;n++){const t=n/segments;if(blocked(threat.x+(p.x-threat.x)*t,threat.z+(p.z-threat.z)*t,[[x,z,w,0,d]],0)){sheltered=true;break;}}
   if(sheltered){best=p;bestDistance=distance;}
  }
 }
 return best;
}
