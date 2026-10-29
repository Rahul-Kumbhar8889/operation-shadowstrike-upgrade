import {dualNodes} from '../shared/campaign.js';
// Choose the same destination for the world marker, HUD and tactical map.
export function missionWaypoint(mission,step,completedNodes=[]){
 const current=mission.steps[step];
 if(!current)return {position:mission.extract,extraction:true};
 return {position:current.kind==='dual'?dualNodes(current)[completedNodes.includes(0)?1:0]:current.position,extraction:false};
}
// World north is negative Z, matching the tactical map.
export function objectiveNavigation(position, destination) {
  const dx=destination[0]-position.x, dz=destination[1]-position.z;
  const degrees=(Math.atan2(dx,-dz)*180/Math.PI+360)%360;
  const direction=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];
  return {distance:Math.round(Math.hypot(dx,dz)),direction,degrees:Math.round(degrees)%360};
}
