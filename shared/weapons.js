// One authoritative catalogue used by the browser and multiplayer server.
export const WEAPONS = {
  assault:{name:'AR-4 ASSAULT RIFLE',short:'AR-4',magazine:30,damage:25,targetDamage:50,fireInterval:150,reloadMs:1200,range:80,pellets:1,automatic:true,noise:48},
  sniper:{name:'SR-8 PRECISION RIFLE',short:'SR-8',magazine:5,damage:75,targetDamage:100,fireInterval:1200,reloadMs:2200,range:80,pellets:1,noise:65},
  pistol:{name:'P-12 SIDEARM',short:'P-12',magazine:12,damage:20,targetDamage:40,fireInterval:350,reloadMs:1000,range:55,pellets:1,noise:28},
  smg:{name:'SPECTRE SUPPRESSED SMG',short:'SMG',magazine:35,damage:18,targetDamage:30,fireInterval:85,reloadMs:1400,range:40,pellets:1,automatic:true,noise:12},
  shotgun:{name:'BREACHER PUMP SHOTGUN',short:'SHOTGUN',magazine:8,damage:12,targetDamage:16,fireInterval:900,reloadMs:2300,range:24,pellets:8,spread:.075,noise:50},
  lmg:{name:'SENTINEL LIGHT MACHINE GUN',short:'LMG',magazine:75,damage:22,targetDamage:40,fireInterval:115,reloadMs:3200,range:75,pellets:1,automatic:true,noise:60},
};
export const createAmmo=()=>Object.fromEntries(Object.entries(WEAPONS).map(([id,w])=>[id,w.magazine]));
export function shotDirections(direction, weapon) {
  if(weapon.pellets===1)return [{...direction}];
  const d=direction, horizontal=Math.hypot(d.x,d.z);
  const right=horizontal>.0001?{x:-d.z/horizontal,y:0,z:d.x/horizontal}:{x:1,y:0,z:0};
  const up={x:d.y*right.z-d.z*right.y,y:d.z*right.x-d.x*right.z,z:d.x*right.y-d.y*right.x};
  return Array.from({length:weapon.pellets},(_,i)=>{
    const angle=i*2.399963, radius=weapon.spread*Math.sqrt(i/(weapon.pellets-1));
    const x=d.x+radius*(Math.cos(angle)*right.x+Math.sin(angle)*up.x),y=d.y+radius*(Math.cos(angle)*right.y+Math.sin(angle)*up.y),z=d.z+radius*(Math.cos(angle)*right.z+Math.sin(angle)*up.z),n=Math.hypot(x,y,z);
    return {x:x/n,y:y/n,z:z/n};
  });
}
