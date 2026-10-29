export const CAMPAIGN_MAX_HP = 1000;
export const GUARD_BULLET_DAMAGE = 70; // 14 hits leave 20 HP; hit 15 is fatal.

// Five separated installations and a distinct objective chain per operation.
export const MISSIONS = [
 {name:'01 / RAILWAY INTERDICTION',brief:'Cross the freight compound, disable surveillance, recover the dispatch codes and sabotage the supply network before extraction.',building:[-65,55],sites:[[-65,55],[-35,15],[30,20],[35,-35],[-30,-60]],extract:[75,-80],actions:['DISABLE SURVEILLANCE','RECOVER DISPATCH CODES','OPEN FREIGHT CHECKPOINT','SABOTAGE FUEL CONTROL','RECOVER TRANSPORT MANIFEST'],guards:[[-65,55],[-59,62],[-35,15],[-29,22],[30,20],[36,27],[35,-35],[41,-28],[-30,-60],[-24,-53],[62,-70],[78,-74]],damage:GUARD_BULLET_DAMAGE},
 {name:'02 / SIGNAL BLACKOUT',brief:'Infiltrate five installations: obtain the keycard, cut power, disable the uplink, retrieve encryption data and shut down the radar.',building:[65,55],sites:[[65,55],[35,10],[-30,20],[-40,-35],[25,-65]],extract:[-75,-80],actions:['ACQUIRE SECURITY KEYCARD','CUT GENERATOR POWER','DISABLE SATELLITE UPLINK','DOWNLOAD ENCRYPTION DATA','SHUT DOWN RADAR'],guards:[[65,55],[71,62],[35,10],[41,17],[-30,20],[-24,27],[-40,-35],[-34,-28],[25,-65],[31,-58],[-65,-72],[-78,-74]],damage:GUARD_BULLET_DAMAGE},
 {name:'03 / NIGHTFALL EXTRACTION',brief:'Raid the command district, recover access codes, disable the alarm, secure the detention records and erase the command archive. Clear the landing zone and extract.',building:[-65,55],sites:[[-65,55],[-30,10],[35,25],[40,-35],[-30,-65]],extract:[75,-80],actions:['RECOVER ACCESS CODES','DISABLE BASE ALARM','SECURE DETENTION RECORDS','UNLOCK HANGAR CONTROL','ERASE COMMAND ARCHIVE'],guards:[[-65,55],[-59,62],[-30,10],[-24,17],[35,25],[41,32],[40,-35],[46,-28],[-30,-65],[-24,-58],[64,-70],[78,-74],[70,-85],[80,-82]],damage:GUARD_BULLET_DAMAGE}
];
// Extend the three original operations with a sixth installation and wider routes.
for(const m of MISSIONS){
 m.sites=m.sites.map(([x,z])=>[x*1.35,z*1.35]);
 m.sites.push([120,0]);m.actions.push('UPLOAD FIELD EVIDENCE');
 m.building=m.sites[0];m.extract=m.extract.map(v=>v*1.35);
 m.guards=m.guards.map(([x,z])=>[x*1.35,z*1.35]);
 m.guards.push([120,0],[126,7],[110,-10],[115,18]);
}
MISSIONS.push({name:'04 / IRON HORIZON',brief:'Penetrate the airfield perimeter, disable its radar and power station, recover flight records, sabotage fuel logistics and clear the command bunker before extraction.',
 building:[-120,100],sites:[[-120,100],[-70,45],[15,85],[95,35],[65,-45],[-20,-85],[-110,-110]],extract:[120,-125],
 actions:['BREACH PERIMETER CONTROL','DISABLE AIRFIELD RADAR','CUT RUNWAY POWER','RECOVER FLIGHT RECORDS','SABOTAGE FUEL PUMPS','DOWNLOAD COMMAND INTELLIGENCE','UNLOCK EXTRACTION CORRIDOR'],
 guards:[[-120,100],[-114,107],[-70,45],[-64,52],[15,85],[21,92],[95,35],[101,42],[65,-45],[71,-38],[-20,-85],[-14,-78],[-110,-110],[-104,-103],[40,5],[-45,-20],[110,-115],[125,-120],[118,-132],[100,-125]],damage:GUARD_BULLET_DAMAGE});
for(const m of MISSIONS){m.steps=m.sites.map(([x,z],i)=>({position:[x,z-2],action:m.actions[i],duration:i%3===1?10:i%3===2?6:3}));m.objective=m.steps[0].position;m.action=m.actions[0];}
// Objective mechanics are shared by solo and the authoritative co-op server.
const operationPlans = [
 [['switch','ISOLATE CCTV','Cut the security feed to reduce guard detection range across the compound.'],['recover','SEIZE DISPATCH CODES','Recover the dispatch case from the office.'],['sweep','CLEAR FREIGHT CHECKPOINT','Enter the checkpoint zone and eliminate guards within 14m of its center.'],['plant','RIG FUEL CONTROL','Attach a demolition charge to the fuel controller.'],['recover','RECOVER TRANSPORT MANIFEST','Collect the transport dossier.'],['defend','TRANSMIT FIELD EVIDENCE','Hold the relay area while headquarters receives the evidence.']],
 [['recover','ACQUIRE SECURITY KEYCARD','Take the access card from the security office.'],['switch','CUT GENERATOR POWER','Isolate the generator breaker.'],['plant','DESTROY UPLINK CONTROL','Rig the uplink; disrupting communications reduces the guard response radius to gunfire.'],['dual','COPY ENCRYPTION NODES','Secure both data racks separately; clear nearby guards and press E at each rack.'],['switch','SHUT DOWN RADAR','Cut the radar tracking circuit.'],['defend','HOLD EMERGENCY RELAY','Protect the relay during the final transmission.']],
 [['recover','RECOVER ACCESS CODES','Collect the command access case.'],['switch','DISABLE BASE ALARM','Disconnect the alarm to reduce the guard response radius to gunfire.'],['download','COPY DETENTION RECORDS','Download the detention records at the server rack.'],['defend','SECURE HANGAR OVERRIDE','Defend the hangar controls until the route opens.'],['plant','DEMOLISH COMMAND ARCHIVE','Place a charge on the archive controller.'],['recover','RECOVER EVACUATION DOSSIER','Take the evacuation dossier before extraction.']],
 [['switch','BREACH PERIMETER CONTROL','Open the airfield security circuit.'],['plant','SABOTAGE AIRFIELD RADAR','Rig the radar to reduce guard detection range across the airfield.'],['switch','CUT RUNWAY POWER','Isolate the runway lighting breaker.'],['recover','RECOVER FLIGHT RECORDS','Take the flight recorder case.'],['plant','SABOTAGE FUEL PUMPS','Rig the fuel pump control panel.'],['download','DOWNLOAD COMMAND INTELLIGENCE','Stay at the server to copy the command archive.'],['defend','HOLD EXTRACTION CORRIDOR','Defend the corridor override until extraction is cleared.']]
];
for (let index=0; index<MISSIONS.length; index++) {
 const m=MISSIONS[index];
 m.steps=m.steps.map((step,i)=>{const [kind,action,hint]=operationPlans[index][i];return {...step,kind,action,hint,duration:({recover:1,switch:3,plant:7,download:14,defend:25,sweep:0,dual:7})[kind],radius:kind==='defend'?14:kind==='sweep'?10:2.4};});
 m.actions=m.steps.map(step=>step.action);m.action=m.actions[0];
}
export function objectiveSafe(step,position,livingGuards=0,starting=false){
 if(!step)return false;
 const radius=starting?2.4:step.radius;
 return Math.hypot(position.x-step.position[0],position.z-step.position[1])<=radius&&(step.kind==='defend'||livingGuards===0);
}
export function sweepReady(step,player,guards){
 if(step?.kind!=='sweep'||!player)return false;
 const [x,z]=step.position;
 return Math.hypot(player.x-x,player.z-z)<=step.radius&&
  !guards.some(g=>g.hp>0&&Math.hypot(g.x-x,g.z-z)<14);
}
export function completeSweep(state,player,guards){
 if(state.status!=='active'||state.intel)return state;
 const m=MISSIONS[state.index],step=state.step||0;
 if(!sweepReady(m.steps[step],player,guards))return state;
 return {...state,step:step+1,intel:step+1===m.steps.length};
}
export function dualNodes(step){return [[step.position[0]-2.5,step.position[1]],[step.position[0]+2.5,step.position[1]]];}
export function availableDualNode(step,position,done=[]){
 if(step?.kind!=='dual')return -1;
 return dualNodes(step).findIndex(([x,z],i)=>!done.includes(i)&&Math.hypot(position.x-x,position.z-z)<=2.4);
}
export function recordDualNode(state,node){
 const step=MISSIONS[state.index]?.steps[state.step||0],done=state.dualDone||[];
 if(state.status!=='active'||step?.kind!=='dual'||![0,1].includes(node)||done.includes(node))return state;
 const next=[...done,node];return next.length===2?{...state,step:(state.step||0)+1,dualDone:[],intel:(state.step||0)+1===MISSIONS[state.index].steps.length}:{...state,dualDone:next};
}
// Cutting the railway compound's CCTV gives the team a tangible stealth advantage.
// Later missions use their existing standard detection distance.
export function guardSightRange(missionIndex,step){return missionIndex===0&&step>0?16:missionIndex===3&&step>=2?19:23;}
export function guardResponseMultiplier(missionIndex,step){return missionIndex===1&&step>=3?.65:missionIndex===2&&step>=2?.55:1;}
export function activeOperationEffect(missionIndex,step){
 if(missionIndex===0&&step>0)return 'CCTV OFF • GUARD DETECTION REDUCED';
 if(missionIndex===1&&step>=3)return 'UPLINK DISRUPTED • GUARD RESPONSE RADIUS REDUCED';
 if(missionIndex===2&&step>=2)return 'ALARM OFF • GUARD RESPONSE RADIUS REDUCED';
 if(missionIndex===3&&step>=2)return 'RADAR OFF • GUARD DETECTION REDUCED';
 return '';
}
// Solid landmarks give each operation a distinct combat lane and cover layout.
MISSIONS[0].landmarks=[-80,-59,-38].map(x=>({kind:'wagon',x,z:-125,w:17,h:3.4,d:3.8}));
MISSIONS[1].landmarks=[{kind:'antenna',x:118,z:112,w:5,h:5,d:5}];
MISSIONS[2].landmarks=[{kind:'truck',x:90,z:85,w:3,h:3,d:7},{kind:'truck',x:96,z:85,w:3,h:3,d:7}];
MISSIONS[3].landmarks=[{kind:'aircraft',x:24,z:0,w:4,h:4,d:24}];
export function missionWalls([x, z]) {
  // South entrance is two metres wide; every wall has identical collision/render geometry.
  return [
    [x - 5, z, 0.35, 3.5, 8],
    [x + 5, z, 0.35, 3.5, 8],
    [x, z - 4, 10, 3.5, 0.35],
    [x - 3, z + 4, 4, 3.5, 0.35],
    [x + 3, z + 4, 4, 3.5, 0.35],
    [x - 2, z, 5.5, 3.5, 0.25],
  ];
}
// These layouts define both visible walls and authoritative collision.
export function installationLayout(m,site=0){
 const [x,z]=m.sites[site],index=MISSIONS.indexOf(m);
 if(index===0&&site!==2)return {w:10,d:8,doorOffset:0,windowXs:[-3,3],theme:'freight',walls:missionWalls([x,z])};
 if(index===0){const w=16,d=12,half=w/2,depth=d/2;return {w,d,doorOffset:0,windowXs:[-5,5],theme:'freight-checkpoint',walls:[[x-half,z,.35,3.5,d],[x+half,z,.35,3.5,d],[x,z-depth,w,3.5,.35],[x-4.5,z+depth,7,3.5,.35],[x+4.5,z+depth,7,3.5,.35],[x-4.5,z,7,3.5,.25],[x+4.5,z,7,3.5,.25]]};}
 if(index===1&&site===3){const w=16,d=12,half=w/2,depth=d/2;return {w,d,doorOffset:0,windowXs:[-5,5],theme:'communications',walls:[[x-half,z,.35,3.5,d],[x+half,z,.35,3.5,d],[x,z-depth,w,3.5,.35],[x-4.5,z+depth,7,3.5,.35],[x+4.5,z+depth,7,3.5,.35],[x-4.5,z,7,3.5,.25],[x+4.5,z,7,3.5,.25]]};}
 const w=index===1?12:index===2?10:14,d=index===2?12:index===1?10:8,half=w/2,depth=d/2,doorOffset=index===3?4:0;
 const walls=[[x-half,z,.35,3.5,d],[x+half,z,.35,3.5,d],[x,z-depth,w,3.5,.35]];
 const left=half+doorOffset-1,right=half-doorOffset-1;
 walls.push([x-half+left/2,z+depth,left,3.5,.35],[x+half-right/2,z+depth,right,3.5,.35]);
 if(index===1)walls.push([x-3.5,z,5,3.5,.25],[x+3.5,z,5,3.5,.25]);
 if(index===2)walls.push([x-3,z-1,4,3.5,.25],[x-3,z+2,4,3.5,.25]);
 if(index===3)walls.push([x-2.75,z,8.5,3.5,.25]);
 return {w,d,doorOffset,windowXs:index===3?[-4,0]:index===1?[-4,4]:[-3,3],theme:index===1?'communications':index===2?'detention':'bunker',walls};
}
export function guardSpawn(position,boxes){
 const [x,z]=position;if(!blocked(x,z,boxes))return [x,z];
 for(let distance=1;distance<=6;distance++)for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){const px=x+dx*distance,pz=z+dz*distance;if(!blocked(px,pz,boxes))return [px,pz];}
 throw new Error('No clear guard spawn near installation');
}
export function blocked(x, z, boxes, r = 0.38) {
  return boxes.some(
    ([a, b, w, , d]) =>
      Math.abs(x - a) < w / 2 + r && Math.abs(z - b) < d / 2 + r,
  );
}
export function interactMission(state, position, livingGuards) {
 if(state.status!=='active')return state;
 const m=MISSIONS[state.index],step=state.step||0;
 if(step<m.steps.length&&['sweep','dual'].includes(m.steps[step].kind))return state;
 const point=step<m.steps.length?m.steps[step].position:m.extract;
 if(step<m.steps.length ? !objectiveSafe(m.steps[step],position,livingGuards) : Math.hypot(position.x-point[0],position.z-point[1])>2.4||livingGuards>0)return state;
 if(step<m.steps.length)return {...state,step:step+1,intel:step+1===m.steps.length};
 return {...state,status:'complete'};
}

// Shared physical layout for cooperative movement, sight and weapon validation.
export function campaignObstacles(m){
 const boxes=m.sites.flatMap((_,i)=>installationLayout(m,i).walls);
 for(const p of m.landmarks)boxes.push([p.x,p.z,p.w,p.h,p.d]);
 for(let n=0;n<6;n++)boxes.push([-5,55-n*22,5,3,12]);
 for(let n=0;n<5;n++)boxes.push([45+n*4,-5,2.8,3.2,2.8]);
 boxes.push([-45,110,5,6,5]);return boxes;
}
