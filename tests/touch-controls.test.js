import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTouchControls} from '../src/touchControls.js';

test('touch movement, camera and buttons do not interrupt a held fire pointer',()=>{
 const previous={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia,navigator:globalThis.navigator};
 const listeners={};
 const element=()=>({style:{},setPointerCapture(){},addEventListener(name,fn){this[name]=fn;}});
 const thumb=element(),pad=element(),canvas=element();pad.querySelector=()=>thumb;pad.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
 const buttons=Object.fromEntries(['fire','reload','weapon','interact','frag','smoke','injection','camera','scope','menu'].map(name=>[name,{...element(),dataset:{action:name}}]));
 const root={hidden:true,querySelector:()=>pad,querySelectorAll:()=>Object.values(buttons)};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>root,body:{append(){}},addEventListener(name,fn){listeners[name]=fn;},hidden:false}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(name,fn){listeners[name]=fn;}}});
 Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:true})});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{maxTouchPoints:5}});
 try{
  let firing=false,shots=0,scopeCalls=0;const keys={};
  const controls=createTouchControls({canvas,keys,look(){},fire(){firing=true;shots++;},stopFire(){firing=false;},reload(){},nextWeapon(){},interact(){},equipment(){},camera(){},scope(){scopeCalls++;},menu(){},active:()=>true});
  controls.update();const ev=(pointerId,extra={})=>({pointerId,preventDefault(){},...extra});
  buttons.fire.onpointerdown(ev(1));assert.equal(firing,true);assert.equal(shots,1);
  pad.onpointerdown(ev(2,{clientX:50,clientY:0}));assert.equal(keys.KeyW,true);
  buttons.scope.onpointerdown(ev(3));buttons.scope.onpointerup(ev(3));assert.equal(scopeCalls,1);assert.equal(firing,true);
  pad.onpointerup(ev(2));assert.equal(keys.KeyW,false);assert.equal(firing,true);
  canvas.pointerdown(ev(4,{pointerType:'touch',clientX:10,clientY:10}));canvas.pointercancel(ev(4));assert.equal(firing,true);
  buttons.fire.onpointerup(ev(9));assert.equal(firing,true,'another pointer cannot release fire');
  buttons.fire.onlostpointercapture(ev(1));assert.equal(firing,false);
  buttons.fire.onpointerdown(ev(5));listeners.blur();assert.equal(firing,false,'blur always clears fire');
 }finally{for(const [key,value] of Object.entries(previous))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
});
