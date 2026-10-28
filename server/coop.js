import {MISSIONS,campaignObstacles,blocked,CAMPAIGN_MAX_HP,GUARD_BULLET_DAMAGE} from '../shared/campaign.js';
import {smokeBlocks,blastDamage} from '../shared/equipment.js';
export function createCoop(index=0){
 const mission=MISSIONS[index];return {index,status:'waiting',step:0,intel:false,task:null,tick:0,revision:0,boxes:campaignObstacles(mission),guards:mission.guards.map(([x,z],id)=>({id,x,z,homeX:x,homeZ:z,hp:100,rotation:0,lastFire:0,phase:id*2}))};
}
export function coopSnapshot(room){const c=room.coop;return {index:c.index,status:c.status,step:c.step,intel:c.intel,task:c.task?{remaining:c.task.remaining}:null,revision:c.revision,waiting:room.players.size<2,guards:c.guards.map(({id,x,z,hp,rotation})=>({id,x,z,hp,rotation}))};}
export function coopSpawn(c,slot){const [x,z]=MISSIONS[c.index].building;return {x:x+slot*2,y:0,z:z+34};}
export function canCoopAct(room){return !room.coop || (room.coop.status==='active'&&room.players.size===2);}
function sight(c,a,b,rayBox,smokes=[],respectSmoke=true){const dx=b.x-a.x,dy=(b.y??1.7)-(a.y??1.7),dz=b.z-a.z,d=Math.hypot(dx,dy,dz);if(!d)return true;const dir={x:dx/d,y:dy/d,z:dz/d};return (!respectSmoke||!smokeBlocks(a,b,smokes,Date.now()))&&!c.boxes.some(box=>rayBox({...a,y:a.y??1.7},dir,box)<d);}
export function hurtGuard(room,guard,damage,shooterId,emit){if(guard.hp<=0)return;guard.hp=Math.max(0,guard.hp-damage);if(!guard.hp){const p=room.players.get(shooterId);if(p)p.kills++;}emit('coop-guard-hit',{id:guard.id,hp:guard.hp,damage,shooterId});}
export function coopBlast(room,position,shooterId,rayBox,emit){const c=room.coop;for(const g of c.guards){const damage=blastDamage(Math.hypot(position.x-g.x,position.z-g.z));if(damage&&sight(c,{...position,y:.9},{x:g.x,z:g.z,y:1},rayBox,[],false))hurtGuard(room,g,damage,shooterId,emit);}}
export function interactCoop(room,id){
 const c=room.coop,p=room.players.get(id),m=MISSIONS[c.index];if(!p?.alive||!canCoopAct(room)||c.task)return false;
 const point=c.intel?m.extract:m.steps[c.step].position;
 if(Math.hypot(p.position.x-point[0],p.position.z-point[1])>2.4||c.guards.some(g=>g.hp>0&&Math.hypot(g.x-p.position.x,g.z-p.position.z)<12))return false;
 if(c.intel){if([...room.players.values()].some(p=>p.alive&&Math.hypot(p.position.x-point[0],p.position.z-point[1])>4))return false;c.status='complete';c.revision++;}
 else c.task={id,remaining:m.steps[c.step].duration};return true;
}
export function updateCoop(room,dt,now,rayBox,emit){
 const c=room.coop;if(!canCoopAct(room))return;c.tick+=dt;
 const living=[...room.players].filter(([,p])=>p.alive);
 if(!living.length){c.status='failed';c.task=null;c.revision++;return;}
 if(c.task){const p=room.players.get(c.task.id),point=MISSIONS[c.index].steps[c.step].position;
  if(!p?.alive||Math.hypot(p.position.x-point[0],p.position.z-point[1])>2.4||c.guards.some(g=>g.hp>0&&Math.hypot(g.x-p.position.x,g.z-p.position.z)<12))c.task=null;
  else {c.task.remaining-=dt;if(c.task.remaining<=0){c.step++;c.intel=c.step===MISSIONS[c.index].steps.length;c.task=null;c.revision++;}}
 }
 for(const g of c.guards){if(g.hp<=0)continue;
  const visible=living.map(([id,p])=>({id,p,d:Math.hypot(p.position.x-g.x,p.position.z-g.z)})).filter(t=>t.d<23&&sight(c,{x:g.x,z:g.z},t.p.position,rayBox,room.smokes)).sort((a,b)=>a.d-b.d)[0];
  const target=visible?.p.position||{x:g.homeX+Math.sin(c.tick*.35+g.phase)*2,z:g.homeZ+Math.cos(c.tick*.35+g.phase)*2};
  let dx=target.x-g.x,dz=target.z-g.z,d=Math.hypot(dx,dz);g.moving=d>(visible?6:.3);if(d)g.rotation=Math.atan2(-dx,-dz);
  if(g.moving){const step=(visible?2.2:1)*dt;dx=dx/d*step;dz=dz/d*step;if(!blocked(g.x+dx,g.z,c.boxes))g.x+=dx;if(!blocked(g.x,g.z+dz,c.boxes))g.z+=dz;}
  if(visible&&now-g.lastFire>=1350){g.lastFire=now;const p=visible.p;p.hp=Math.max(0,p.hp-GUARD_BULLET_DAMAGE);emit('coop-guard-fired',{id:g.id,origin:{x:g.x,y:1.7,z:g.z},target:{...p.position,y:1.7}});emit('player-hit',{targetId:visible.id,shooterId:'guard',hp:p.hp,damage:GUARD_BULLET_DAMAGE});if(!p.hp){p.alive=false;p.deaths++;emit('coop-player-down',{id:visible.id});}}
 }
 if([...room.players.values()].every(p=>!p.alive)){c.status='failed';c.task=null;c.revision++;}
}
