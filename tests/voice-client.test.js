import {test} from 'node:test';import assert from 'node:assert/strict';
import {createVoiceChat} from '../src/voiceChat.js';

test('voice is opt-in, supports mute, and stops microphone on exit',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldPeer=globalThis.RTCPeerConnection;
 let stopped=0,requests=0,click;const track={enabled:true,stop(){stopped++;}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{async getUserMedia(){requests++;return {getTracks:()=>[track],getAudioTracks:()=>[track]};}}}});
 globalThis.RTCPeerConnection=class{};
 const events=[],socket={connected:true,on(){},emit(name,data){events.push([name,data]);}};
 const button={addEventListener(_,fn){click=fn;},setAttribute(){}};const audio={srcObject:null,play:async()=>{}};const status={};
 try{
  const voice=createVoiceChat({socket,button,audio,status});assert.equal(requests,0);assert.equal(button.textContent,'ENABLE VOICE');
  await click();assert.equal(requests,1);assert.equal(button.textContent,'MUTE MIC');assert.equal(events[0][0],'voice-ready');
  await click();assert.equal(track.enabled,false);assert.equal(button.textContent,'MIC MUTED');
  await click();assert.equal(track.enabled,true);await voice.retry();assert.equal(requests,1);assert.equal(events.at(-1)[1].restart,true);voice.stop();assert.equal(stopped,1);assert.equal(button.textContent,'ENABLE VOICE');assert.equal(events.at(-1)[1].enabled,false);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;globalThis.RTCPeerConnection=oldPeer;}
});

test('microphone granted after leaving a room is stopped instead of activated',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldPeer=globalThis.RTCPeerConnection;let resolvePermission,stopped=0,click;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{resolvePermission=resolve;})}}});globalThis.RTCPeerConnection=class{};
 const socket={connected:true,on(){},emit(){}};const button={addEventListener(_,fn){click=fn;},setAttribute(){}};
 try{const voice=createVoiceChat({socket,button,audio:{srcObject:null},status:{}});const pending=click();voice.stop();resolvePermission({getTracks:()=>[{stop(){stopped++;}}]});await pending;assert.equal(stopped,1);assert.equal(button.textContent,'ENABLE VOICE');}
 finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;globalThis.RTCPeerConnection=oldPeer;}
});

test('two enabled players exchange an offer and answer and can retry',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldPeer=globalThis.RTCPeerConnection;
 const peers=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{async getUserMedia(){const track={enabled:true,stop(){}};return {getTracks:()=>[track],getAudioTracks:()=>[track]};}}}});
 globalThis.RTCPeerConnection=class{constructor(){this.remoteDescription=null;this.signalingState='stable';peers.push(this);}addTrack(){}close(){this.closed=true;}async createOffer(){return {type:'offer',sdp:'offer'};}async createAnswer(){return {type:'answer',sdp:'answer'};}async setLocalDescription(d){this.localDescription={...d,toJSON:()=>d};}async setRemoteDescription(d){this.remoteDescription=d;}async addIceCandidate(){}};
 function makeSocket(id){const handlers={};return {id,connected:true,on(name,fn){handlers[name]=fn;},emit(name,data){const other=id==='a'?b:a;queueMicrotask(()=>other.handlers[name]?.({...data,from:id}));},handlers};}
 const a=makeSocket('a'),b=makeSocket('b');function client(socket){let click;const button={addEventListener(_,fn){click=fn;},setAttribute(){}};const voice=createVoiceChat({socket,button,audio:{srcObject:null,play:async()=>{}},status:{}});return {voice,click:()=>click()};}
 try{const ca=client(a),cb=client(b);await ca.click();await cb.click();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(peers.length,2);assert.deepEqual(peers.map(p=>p.remoteDescription?.type).sort(),['answer','offer']);await ca.voice.retry();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(peers.length,4);assert.ok(peers[0].closed&&peers[1].closed);assert.deepEqual(peers.slice(2).map(p=>p.remoteDescription?.type).sort(),['answer','offer']);ca.voice.stop();cb.voice.stop();}
 finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;globalThis.RTCPeerConnection=oldPeer;}
});
