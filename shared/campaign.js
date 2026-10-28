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
export function blocked(x, z, boxes, r = 0.38) {
  return boxes.some(
    ([a, b, w, , d]) =>
      Math.abs(x - a) < w / 2 + r && Math.abs(z - b) < d / 2 + r,
  );
}
export function interactMission(state, position, livingGuards) {
 if(state.status!=='active')return state;
 const m=MISSIONS[state.index],step=state.step||0;
 const point=step<m.steps.length?m.steps[step].position:m.extract;
 if(Math.hypot(position.x-point[0],position.z-point[1])>2.4||livingGuards>0)return state;
 if(step<m.steps.length)return {...state,step:step+1,intel:step+1===m.steps.length};
 return {...state,status:'complete'};
}
