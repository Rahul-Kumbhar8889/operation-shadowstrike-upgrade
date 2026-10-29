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
