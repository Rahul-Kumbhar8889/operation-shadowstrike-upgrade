export function reviveMessage(revive,playerId){
 const seconds=Math.ceil(Math.max(0,revive.remaining));
 if(playerId===revive.targetId)return `TEAMMATE REVIVING YOU • ${seconds}s • Stay close and avoid danger.`;
 return `REVIVING TEAMMATE • ${seconds}s • Stay within 3m; taking damage interrupts. Costs one injection.`;
}
import {objectiveNavigation} from './navigation.js';
export function teammateMessage(player,teammate){
 const {distance,direction}=objectiveNavigation(player,[teammate.x,teammate.z]);
 return teammate.alive===false?`TEAMMATE DOWN • ${distance}m ${direction} • Revive within 3m using E and one injection`:`TEAMMATE • ${distance}m ${direction}`;
}
export function extractionMessage(player,point,guards,teammate,network){
 const distance=Math.hypot(player.x-point[0],player.z-point[1]);
 if(distance>2.4)return 'MOVE INTO THE CENTER OF THE EXTRACTION ZONE';
 const nearby=guards.filter(g=>g.hp>0&&Math.hypot(g.x-player.x,g.z-player.z)<12).length;
 if(nearby)return `CLEAR ${nearby} NEARBY GUARD${nearby===1?'':'S'} WITHIN 12m`;
 if(network&&!teammate)return 'WAIT FOR YOUR TEAMMATE TO JOIN';
 if(network&&teammate.alive!==false&&Math.hypot(teammate.x-point[0],teammate.z-point[1])>4)return 'WAIT FOR YOUR TEAMMATE WITHIN 4m OF EXTRACTION';
 return 'EXTRACTION READY — PRESS E';
}
const interactionMessages={
 player_down:'YOU ARE DOWN — WAIT FOR A TEAMMATE TO REVIVE YOU',
 need_teammate:'WAIT FOR YOUR TEAMMATE TO JOIN THE ROOM',
 mission_not_active:'START THE CO-OP MISSION FIRST',
 action_in_progress:'A SQUAD ACTION IS ALREADY IN PROGRESS',
 no_injection:'NO INJECTIONS LEFT — CANNOT REVIVE TEAMMATE',
 charge_armed:'CHARGE ARMED — RETREAT BEYOND 12m',
 automatic_zone:'ENTER THE MARKED ZONE AND CLEAR NEARBY GUARDS',
 rack_too_far:'MOVE WITHIN 2.4m OF AN UNSECURED DATA RACK',
 guards_nearby:'CLEAR GUARDS WITHIN 12m BEFORE INTERACTING',
 objective_too_far:'MOVE WITHIN 2.4m OF THE MARKED OBJECTIVE',
 team_not_at_extraction:'BOTH LIVING PLAYERS MUST BE WITHIN 4m OF EXTRACTION',
 objective_interrupted:'ACTION INTERRUPTED — RETURN TO THE OBJECTIVE AND CLEAR THREATS',
 revive_interrupted:'REVIVE INTERRUPTED — STAY WITHIN 3m AND AVOID DAMAGE',
};
export function interactionMessage(reason){return interactionMessages[reason]||'ACTION UNAVAILABLE — CHECK MISSION OBJECTIVE';}
