import {sabotageInvestigation,installationLayout,guardSpawn,objectiveSafe,sweepReady,advanceRendezvous,dualNodes,availableDualNode,recordDualNode,guardSightRange,guardResponseMultiplier,CHARGE_FUSE_SECONDS,chargeDamageAt,MISSIONS,campaignObstacles,blocked,CAMPAIGN_MAX_HP,GUARD_BULLET_DAMAGE} from '../shared/campaign.js';
import {smokeBlocks,blastDamage} from '../shared/equipment.js';
import {guardStep,findGuardCover} from '../shared/guardTactics.js';
export function createCoop(index=0){
 const mission=MISSIONS[index],boxes=campaignObstacles(mission);return {index,status:'waiting',step:0,intel:false,task:null,tick:0,revision:0,transitionRemaining:null,revive:null,boxes,guards:mission.guards.map((position,id)=>{const [x,z]=guardSpawn(position,boxes);return {id,x,z,homeX:x,homeZ:z,hp:100,rotation:0,lastFire:0,phase:id*2};})};
}
export function coopSnapshot(room){const c=room.coop;return {index:c.index,status:c.status,step:c.step,intel:c.intel,dualDone:c.dualDone||[],holdRemaining:c.holdRemaining??null,chargeRemaining:c.chargeRemaining??null,task:c.task?{remaining:c.task.remaining,node:c.task.node}:null,revive:c.revive?{remaining:c.revive.remaining,targetId:c.revive.targetId}:null,revision:c.revision,transitionRemaining:c.transitionRemaining,waiting:room.players.size<2,guards:c.guards.map(({id,x,z,hp,rotation})=>({id,x,z,hp,rotation}))};}
export function coopSpawn(c,slot){const [x,z]=MISSIONS[c.index].building;return {x:x+installationLayout(MISSIONS[c.index]).doorOffset+slot*2,y:0,z:z+34};}
export function canCoopAct(room){return !room.coop || (room.coop.status==='active'&&room.players.size===2);}
function sight(c,a,b,rayBox,smokes=[],respectSmoke=true){const dx=b.x-a.x,dy=(b.y??1.7)-(a.y??1.7),dz=b.z-a.z,d=Math.hypot(dx,dy,dz);if(!d)return true;const dir={x:dx/d,y:dy/d,z:dz/d};return (!respectSmoke||!smokeBlocks(a,b,smokes,Date.now()))&&!c.boxes.some(box=>rayBox({...a,y:a.y??1.7},dir,box)<d);}
export function alertCoopGuards(room,position,noise){const c=room.coop,range=noise*guardResponseMultiplier(c.index,c.step);for(const g of c.guards){if(g.hp>0&&Math.hypot(position.x-g.x,position.z-g.z)<range){g.lastKnown={x:position.x,z:position.z};g.alertUntil=c.tick+8;}}}
export function hurtGuard(room,guard,damage,shooterId,emit){if(guard.hp<=0)return;guard.hp=Math.max(0,guard.hp-damage);if(!guard.hp){const p=room.players.get(shooterId);if(p)p.kills++;}emit('coop-guard-hit',{id:guard.id,hp:guard.hp,damage,shooterId,position:{x:guard.x,y:1.2,z:guard.z}});}
export function coopBlast(room,position,shooterId,rayBox,emit){const c=room.coop;for(const g of c.guards){const damage=blastDamage(Math.hypot(position.x-g.x,position.z-g.z));if(damage&&sight(c,{...position,y:.9},{x:g.x,z:g.z,y:1},rayBox,[],false))hurtGuard(room,g,damage,shooterId,emit);}}
export function interactCoopResult(room,id){
 const c=room.coop,p=room.players.get(id),m=MISSIONS[c.index],fail=reason=>({ok:false,reason});
 if(!p?.alive)return fail('player_down');
 if(room.players.size!==2)return fail('need_teammate');
 if(c.status!=='active')return fail('mission_not_active');
 if(c.revive)return fail('action_in_progress');
 const downed=[...room.players].find(([otherId,other])=>otherId!==id&&!other.alive&&Math.hypot(other.position.x-p.position.x,other.position.z-p.position.z)<=3);
 if(downed){if(!(p.equipment?.injection>0))return fail('no_injection');c.revive={id,targetId:downed[0],remaining:4,hp:p.hp};return {ok:true};}
 if(c.chargeRemaining!=null)return fail('charge_armed');
 if(c.task)return fail('action_in_progress');
 if(!c.intel&&['sweep','rendezvous'].includes(m.steps[c.step]?.kind))return fail('automatic_zone');
 if(!c.intel&&m.steps[c.step]?.kind==='dual'){
  const step=m.steps[c.step],node=availableDualNode(step,p.position,c.dualDone||[]);
  const threats=c.guards.filter(g=>g.hp>0&&Math.hypot(g.x-p.position.x,g.z-p.position.z)<12).length;
  if(node<0)return fail('rack_too_far');if(threats)return fail('guards_nearby');c.task={id,node,remaining:step.duration};return {ok:true};
 }
 const point=c.intel?m.extract:m.steps[c.step].position;
 const threats=c.guards.filter(g=>g.hp>0&&Math.hypot(g.x-p.position.x,g.z-p.position.z)<12).length;
 if(Math.hypot(p.position.x-point[0],p.position.z-point[1])>2.4)return fail('objective_too_far');
 if(threats>0&&(c.intel||m.steps[c.step].kind!=='defend'))return fail('guards_nearby');
 if(c.intel){if([...room.players.values()].some(p=>p.alive&&Math.hypot(p.position.x-point[0],p.position.z-point[1])>4))return fail('team_not_at_extraction');c.status='complete';c.transitionRemaining=c.index<MISSIONS.length-1?5:null;c.revision++;}
 else c.task={id,remaining:m.steps[c.step].duration};return {ok:true};
}
export function interactCoop(room,id){return interactCoopResult(room,id).ok;}
export function updateCoop(room,dt,now,rayBox,emit){
 const c=room.coop;if(c.status==='complete'&&c.transitionRemaining!==null&&room.players.size===2){c.transitionRemaining=Math.max(0,c.transitionRemaining-dt);if(c.transitionRemaining===0)return 'advance';return;}if(!canCoopAct(room))return;c.tick+=dt;
 if(c.revive){const r=c.revive,p=room.players.get(r.id),target=room.players.get(r.targetId);
  if(!p?.alive||!target||target.alive||p.hp<r.hp||!(p.equipment?.injection>0)||Math.hypot(p.position.x-target.position.x,p.position.z-target.position.z)>3){c.revive=null;emit('coop-action-interrupted',{id:r.id,reason:'revive_interrupted'});}
  else {r.remaining-=dt;if(r.remaining<=0){p.equipment.injection--;target.alive=true;target.hp=350;c.revive=null;c.revision++;emit('coop-player-revived',{id:r.targetId,reviverId:r.id,hp:350,equipment:{...p.equipment}});}}
 }
 const living=[...room.players].filter(([,p])=>p.alive);
 if(!living.length){c.status='failed';c.task=null;c.revive=null;c.revision++;return;}
 const current=MISSIONS[c.index].steps[c.step];
 if(c.chargeRemaining!=null){
  c.chargeRemaining=Math.max(0,c.chargeRemaining-dt);
  if(c.chargeRemaining===0){
   for(const [id,p] of living){const damage=chargeDamageAt(p.position,current.position);if(!damage)continue;p.hp=Math.max(0,p.hp-damage);emit('player-hit',{targetId:id,shooterId:'charge',hp:p.hp,damage});if(!p.hp){p.alive=false;p.deaths++;emit('coop-player-down',{id});}}
   c.chargeRemaining=null;c.step++;c.intel=c.step===MISSIONS[c.index].steps.length;c.revision++;
  }
 }
 if(!c.intel&&current?.kind==='sweep'&&living.some(([,p])=>sweepReady(current,p.position,c.guards))){c.step++;c.intel=c.step===MISSIONS[c.index].steps.length;c.revision++;}
 if(!c.intel&&current?.kind==='rendezvous'){
  c.holdRemaining=advanceRendezvous(current,c.holdRemaining,dt,living.map(([,p])=>p.position),c.guards);
  if(c.holdRemaining===0){c.step++;c.intel=c.step===MISSIONS[c.index].steps.length;c.holdRemaining=null;c.revision++;}
 }
 if(c.task){const p=room.players.get(c.task.id),step=MISSIONS[c.index].steps[c.step],node=c.task.node,checkStep=step.kind==='dual'?{...step,position:dualNodes(step)[node]}:step;
  if(!p?.alive||!objectiveSafe(checkStep,p.position,c.guards.filter(g=>g.hp>0&&Math.hypot(g.x-p.position.x,g.z-p.position.z)<12).length)){const id=c.task.id;c.task=null;emit('coop-action-interrupted',{id,reason:'objective_interrupted'});}
  else {c.task.remaining-=dt;if(c.task.remaining<=0){if(step.kind==='dual'){const next=recordDualNode(c,node);c.dualDone=next.dualDone;c.step=next.step;}else if(step.kind==='timedcharge')c.chargeRemaining=CHARGE_FUSE_SECONDS;else c.step++;c.intel=c.step===MISSIONS[c.index].steps.length;c.task=null;c.revision++;}}
 }
 for(const g of c.guards){if(g.hp<=0)continue;
  const visible=living.filter(([,p])=>p.alive).map(([id,p])=>({id,p,d:Math.hypot(p.position.x-g.x,p.position.z-g.z)})).filter(t=>t.d<guardSightRange(c.index,c.step)&&sight(c,{x:g.x,z:g.z},t.p.position,rayBox,room.smokes)).sort((a,b)=>a.d-b.d)[0];
  const defense=c.task&&MISSIONS[c.index].steps[c.step]?.kind==='defend';
  const rally=defense&&living.map(([,p])=>p).find(p=>Math.hypot(p.position.x-g.x,p.position.z-g.z)<60);
  const investigating=g.alertUntil>c.tick&&g.lastKnown;
  const sabotage=sabotageInvestigation(c.index,c.step,g);
  if(visible&&g.hp<=50&&!defense&&c.tick>=(g.nextCoverAttempt||0)){g.coverTarget=findGuardCover(g,visible.p.position,c.boxes);g.coverUntil=c.tick+2.5;g.nextCoverAttempt=c.tick+10;}
  const cover=g.coverTarget&&c.tick<g.coverUntil?g.coverTarget:null;
  const target=cover||visible?.p.position||rally?.position||investigating||sabotage||{x:g.homeX+Math.sin(c.tick*.35+g.phase)*2,z:g.homeZ+Math.cos(c.tick*.35+g.phase)*2};
  let dx=target.x-g.x,dz=target.z-g.z,d=Math.hypot(dx,dz);g.moving=d>(cover?.3:visible?6:.3);if(d)g.rotation=Math.atan2(-dx,-dz);
  if(g.moving){const next=guardStep(g,target,c.boxes,(visible||rally||investigating||sabotage||cover?2.2:1)*dt);g.x=next.x;g.z=next.z;}
  if(visible&&now-g.lastFire>=1350){g.lastFire=now;const p=visible.p;p.hp=Math.max(0,p.hp-GUARD_BULLET_DAMAGE);emit('coop-guard-fired',{id:g.id,origin:{x:g.x,y:1.7,z:g.z},target:{...p.position,y:1.7}});emit('player-hit',{targetId:visible.id,shooterId:'guard',hp:p.hp,damage:GUARD_BULLET_DAMAGE});if(!p.hp){p.alive=false;p.deaths++;emit('coop-player-down',{id:visible.id});}}
 }
 if([...room.players.values()].every(p=>!p.alive)){c.status='failed';c.task=null;c.revive=null;c.revision++;}
}
