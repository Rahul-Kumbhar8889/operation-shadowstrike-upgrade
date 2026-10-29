import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {once} from 'node:events';import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5189','--strictPort'],{stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),10000);server.stdout.on('data',d=>{if(d.toString().includes('5189')){clearTimeout(timer);resolve();}});server.once('exit',()=>reject(Error('Vite exited')));});
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5189');await page.click('.eyebrow');
 const results=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),{createCampaign}=await import('/src/campaign.js'),{MISSIONS}=await import('/shared/campaign.js');
  const scene=new THREE.Scene(),player=new THREE.Group(),base=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(player,base);const original={x:0,z:0,w:1,h:1,d:1,mesh:base},obstacles=[original];let damage=0;
  const campaign=createCampaign({scene,player,obstacles,onDamage:n=>damage+=n,onReset:p=>player.position.set(p.x,0,p.z),message:()=>{},tracer:()=>{}});const panel=document.querySelectorAll('#missionPanel')[1];const ok=(v,msg)=>{if(!v)throw Error(msg);};const results=[];const audio=await import('/src/combatEffects.js');await audio.preloadCombatAudio();ok(audio.loadedAudioCount()===6,'all six recorded Ogg effects decode in the browser');
  for(let index=0;index<MISSIONS.length;index++){
   campaign.start(index);const m=MISSIONS[index];ok(!base.visible,'base scenery hidden');
   const guards=[...new Set(campaign.aimMeshes().map(mesh=>mesh.userData.guard))];ok(guards.length===m.guards.length,'guard population');await Promise.all(guards.map(g=>g.model.userData.visualReady));ok(guards.every(g=>g.model.userData.modelState==='ready'),'all guards use the rigged model');
   if(index===0){const guard=guards[1];player.position.copy(guard.model.position).add(new THREE.Vector3(0,0,5));scene.updateMatrixWorld(true);campaign.update(1.5,true);ok(damage>0,'guard must fire in clear sight');const before=damage;campaign.smoke(player.position);campaign.update(2,true);ok(damage===before,'smoke must break guard sight');}
   scene.updateMatrixWorld(true);
   campaign.blast(guards[0].model.position);ok(guards[0].hp===0,'nearby grenade blast neutralizes a guard');
   for(const guard of guards.filter(g=>g.hp>0)){const origin=guard.model.position.clone().add(new THREE.Vector3(0,1.25,1));if(!campaign.hit(origin,new THREE.Vector3(0,0,-1),200,2)){const bounds=new THREE.Box3().setFromObject(guard.model);throw Error('guard hit ray '+JSON.stringify({position:guard.model.position.toArray(),bounds:[bounds.min.toArray(),bounds.max.toArray()],meshes:campaign.aimMeshes().filter(o=>o.userData.guard===guard).map(o=>({name:o.name,visible:o.visible,skin:o.isSkinnedMesh}))}));}}
   ok(campaign.aimMeshes().length===0,'all neutralized models remain prone and are no longer targetable');
   for(let step=0;step<m.steps.length;step++){
    const point=m.steps[step].position;player.position.set(point[0],0,point[1]);campaign.interact();
    if(step===0){player.position.x+=4;campaign.update(.1,true);ok(panel.querySelector('.objective').textContent.includes(`OBJECTIVE 1/`),'leaving terminal interrupts action');player.position.x-=4;campaign.interact();}
    campaign.update(m.steps[step].duration-.1,true);ok(panel.querySelector('.objective').textContent.includes('Stay within'),'action cannot finish early');campaign.update(.11,true);
   }
   ok(panel.querySelector('.objective').textContent.includes('REACH EXTRACTION'),'all objectives lead to extraction');player.position.set(...[m.extract[0],0,m.extract[1]]);campaign.interact();ok(!campaign.running,'extraction completes operation');ok(panel.querySelector('.next').hidden===(index<3),'intermediate missions advance automatically; final campaign offers replay');results.push(`${m.name}: timed objectives, interruption, combat and extraction`);campaign.update(index<3?5.1:20,false);ok(panel.querySelector('h2').textContent===MISSIONS[Math.min(index+1,3)].name,'automatic next operation, with final campaign stop');
  }
  campaign.stop();ok(base.visible&&obstacles.length===1&&obstacles[0]===original,'original world and collision restored');return results;
 });
 assert.deepEqual(errors,[]);results.forEach(r=>console.log('PASS:',r));console.log('PASS: smoke blocks guard fire, terminal hold cannot be skipped, prone guard bodies and world restoration.');
}finally{await browser?.close();if(server.exitCode===null){server.kill();await once(server,'exit');}}
