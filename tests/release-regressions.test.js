import {test} from 'node:test';import assert from 'node:assert/strict';import {MeshStandardMaterial,Texture} from 'three';
import {createSoldier} from '../src/soldier.js';import {applyDeathPose} from '../src/deathPose.js';import {syncRemoteLife} from '../src/remoteLife.js';import {applyMissionMaterial} from '../src/missionMaterials.js';
test('repeated server snapshots preserve visible corpse and fall progress; respawn restores pose',()=>{
 const remote={group:createSoldier(),alive:true};syncRemoteLife(remote,false);assert.equal(remote.deathAge,0);remote.deathAge=.6;applyDeathPose(remote.group,.6);const tilt=remote.group.rotation.x;
 syncRemoteLife(remote,false);assert.equal(remote.deathAge,.6);assert.equal(remote.group.rotation.x,tilt);assert.ok(remote.group.visible);
 applyDeathPose(remote.group,2);syncRemoteLife(remote,false);assert.ok(remote.group.visible);syncRemoteLife(remote,true);assert.equal(remote.group.rotation.x,0);assert.equal(remote.group.position.y,0);assert.equal(remote.group.getObjectByName('Knee').rotation.x,0);assert.equal(remote.group.userData.aimRig.rotation.x,0);
});
test('PBR upgrade keeps fallback on loading failure and applies distinct surface response',()=>{
 const material=new MeshStandardMaterial({color:0x123456});assert.equal(applyMissionMaterial(material,null,'ground'),false);assert.equal(material.color.getHex(),0x123456);
 const maps={ground:{map:new Texture(),normalMap:new Texture(),roughnessMap:new Texture()},metal:{map:new Texture(),normalMap:new Texture()}};
 assert.ok(applyMissionMaterial(material,maps,'ground'));assert.equal(material.normalMap,maps.ground.normalMap);assert.equal(material.metalness,0);assert.equal(material.normalScale.x,.35);
 applyMissionMaterial(material,maps,'metal');assert.equal(material.metalness,.65);assert.equal(material.normalScale.x,.5);
});
test('all nine original weapon silhouettes render in bounded batches and clone independently',async()=>{
 const {createWeaponModel}=await import('../src/weaponModels.js'),{Box3}=await import('three');const lengths=new Set();
 for(const id of ['assault','sniper','pistol','smg','shotgun','lmg','carbine','battle','marksman']){const model=createWeaponModel(id),other=createWeaponModel(id);assert.ok(model.children.length<=4);assert.notEqual(model,other);model.position.x=4;assert.equal(other.position.x,0);const bounds=new Box3().setFromObject(other);assert.ok(Number.isFinite(bounds.max.z));lengths.add(Math.round((bounds.max.z-bounds.min.z)*100));}
 assert.ok(lengths.size>=6,'different weapon roles have distinct lengths');
});
