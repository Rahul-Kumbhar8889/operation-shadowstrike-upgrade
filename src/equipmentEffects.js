import * as THREE from 'three';
export function createEquipmentEffects(scene){
 const objects=[],clouds=[];
 function release(item){scene.remove(item.mesh);item.mesh.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}
 function thrown(origin,landing,type,fuse){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.07,.075,.18,10),new THREE.MeshStandardMaterial({color:type==='frag'?0x5c6942:0x9caaab,roughness:.65}));mesh.castShadow=true;scene.add(mesh);objects.push({mesh,origin:new THREE.Vector3(origin.x,1.4,origin.z),landing:new THREE.Vector3(landing.x,.2,landing.z),age:0,fuse});}
 function smoke(position,duration=16){const mesh=new THREE.Group();for(let i=0;i<18;i++){const angle=i*2.399,r=1+(i%4);const p=new THREE.Mesh(new THREE.SphereGeometry(2.2,10,8),new THREE.MeshStandardMaterial({color:0xa9b0ad,roughness:1,transparent:true,opacity:0,depthWrite:false}));p.position.set(Math.cos(angle)*r,1+(i%3)*1.2,Math.sin(angle)*r);p.scale.set(1.3,1,1.2);mesh.add(p);}mesh.position.set(position.x,0,position.z);scene.add(mesh);clouds.push({mesh,age:0,duration});}
 function update(dt){for(let i=objects.length-1;i>=0;i--){const o=objects[i];o.age+=dt;const t=Math.min(1,o.age/Math.min(1,o.fuse));o.mesh.position.lerpVectors(o.origin,o.landing,t);o.mesh.position.y+=Math.sin(t*Math.PI)*3;o.mesh.rotation.z+=dt*6;if(o.age>=o.fuse){release(o);objects.splice(i,1);}}
 for(let i=clouds.length-1;i>=0;i--){const c=clouds[i];c.age+=dt;const fade=Math.min(1,c.age/1.8,(c.duration-c.age)/2);c.mesh.children.forEach((p,n)=>{p.material.opacity=Math.max(0,fade)*.48;p.position.x+=Math.sin(n+c.age*.2)*dt*.05;});if(c.age>=c.duration){release(c);clouds.splice(i,1);}}}
 function clear(){objects.forEach(release);clouds.forEach(release);objects.length=clouds.length=0;}
 return {thrown,smoke,update,clear};
}
