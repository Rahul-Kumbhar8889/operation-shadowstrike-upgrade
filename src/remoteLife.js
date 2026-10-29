// State snapshots must not hide a downed soldier or restart its fall each tick.
export function syncRemoteLife(remote,alive){
 const wasAlive=remote.alive;remote.alive=alive;remote.group.visible=true;
 if(wasAlive&&!alive)remote.deathAge=0;
 if(!wasAlive&&alive){
  remote.deathAge=0;remote.group.rotation.x=remote.group.rotation.z=0;remote.group.position.y=0;
  remote.group.traverse(o=>{if(['Torso','Knee','Elbow'].includes(o.name))o.rotation.x=0;});
  if(remote.group.userData.aimRig)remote.group.userData.aimRig.rotation.x=0;
 }
}
