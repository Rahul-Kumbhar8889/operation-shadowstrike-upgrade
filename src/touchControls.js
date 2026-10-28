// Pointer capture keeps movement, looking and firing independent on touch screens.
export function createTouchControls({canvas,keys,look,fire,stopFire,reload,nextWeapon,interact,equipment,camera,menu,active}){
 const enabled=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
 const root=document.createElement('div');root.id='touchControls';root.hidden=true;
 root.innerHTML='<div class="move-pad" aria-label="Movement joystick"><span></span></div><div class="touch-actions"><button data-action="fire">FIRE</button><button data-action="reload">RELOAD</button><button data-action="weapon">WEAPON</button><button data-action="interact">USE / E</button><button data-action="frag">FRAG</button><button data-action="smoke">SMOKE</button><button data-action="injection">HEAL</button><button data-action="camera">VIEW</button><button data-action="menu">MENU</button></div>';
 document.body.append(root);const pad=root.querySelector('.move-pad'),thumb=pad.querySelector('span');let moveId=null,lookId=null,lastX=0,lastY=0;
 function clear(){for(const key of ['KeyW','KeyS','KeyA','KeyD','ShiftLeft'])keys[key]=false;thumb.style.transform='translate(0,0)';moveId=lookId=null;stopFire();}
 function move(e){const r=pad.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/45)),y=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/45));keys.KeyW=y<-.2;keys.KeyS=y>.2;keys.KeyA=x<-.2;keys.KeyD=x>.2;keys.ShiftLeft=Math.hypot(x,y)>.9;thumb.style.transform=`translate(${x*35}px,${y*35}px)`;}
 pad.onpointerdown=e=>{if(!active()||moveId!==null)return;e.preventDefault();moveId=e.pointerId;pad.setPointerCapture(e.pointerId);move(e);};pad.onpointermove=e=>{if(e.pointerId===moveId)move(e);};pad.onpointerup=pad.onpointercancel=()=>{for(const key of ['KeyW','KeyS','KeyA','KeyD','ShiftLeft'])keys[key]=false;thumb.style.transform='translate(0,0)';moveId=null;};
 canvas.addEventListener('pointerdown',e=>{if(!enabled||!active()||lookId!==null)return;lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;});canvas.addEventListener('pointerup',e=>{if(e.pointerId===lookId)lookId=null;});canvas.addEventListener('pointercancel',()=>clear());
 const actions={reload,weapon:nextWeapon,interact,frag:()=>equipment('frag'),smoke:()=>equipment('smoke'),injection:()=>equipment('injection'),camera,menu};
 for(const button of root.querySelectorAll('button')){button.onpointerdown=e=>{e.preventDefault();if(!active())return;button.setPointerCapture(e.pointerId);if(button.dataset.action==='fire')fire();else actions[button.dataset.action]?.();};button.onpointerup=button.onpointercancel=()=>stopFire();}
 window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 return {enabled,update(){const show=enabled&&active();if(root.hidden===show){root.hidden=!show;if(!show)clear();}}};
}
