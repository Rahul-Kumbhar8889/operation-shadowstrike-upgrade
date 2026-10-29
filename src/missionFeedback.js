export function reviveMessage(revive,playerId){
 const seconds=Math.ceil(Math.max(0,revive.remaining));
 if(playerId===revive.targetId)return `TEAMMATE REVIVING YOU • ${seconds}s • Stay close and avoid danger.`;
 return `REVIVING TEAMMATE • ${seconds}s • Stay within 3m; taking damage interrupts. Costs one injection.`;
}
