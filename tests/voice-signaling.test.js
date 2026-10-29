import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {io} from 'socket.io-client';

test('voice signaling stays inside the sender room and ignores invalid payloads',async()=>{
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('server timeout')),10000);server.stdout.on('data',data=>{const m=data.toString().match(/running on port (\d+)/);if(m){clearTimeout(timer);resolve(`http://127.0.0.1:${m[1]}`);}});});
 const sockets=[];
 try{
  for(let i=0;i<3;i++){const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);await once(s,'connect');}
  const [a,b,outsider]=sockets;const room=await a.timeout(2000).emitWithAck('create-room');await b.timeout(2000).emitWithAck('join-room',room.code);await outsider.timeout(2000).emitWithAck('create-room');
  let leaked=0,invalid=0;outsider.on('voice-ready',()=>leaked++);outsider.on('voice-signal',()=>leaked++);b.on('voice-signal',()=>invalid++);
  const ready=once(b,'voice-ready');a.emit('voice-ready',{enabled:true});assert.deepEqual((await ready)[0],{from:a.id,enabled:true,reply:false});
  const retry=once(b,'voice-ready');a.emit('voice-ready',{enabled:true,restart:true});assert.deepEqual((await retry)[0],{from:a.id,enabled:true,reply:false,restart:true});
  const received=once(b,'voice-signal');a.emit('voice-signal',{description:{type:'offer',sdp:'test-offer'}});assert.deepEqual((await received)[0],{from:a.id,description:{type:'offer',sdp:'test-offer'}});
  const count=invalid;a.emit('voice-signal',{description:{type:'bad',sdp:'test'}});outsider.emit('voice-ready',{enabled:true});await new Promise(resolve=>setTimeout(resolve,100));assert.equal(invalid,count);assert.equal(leaked,0);
 }finally{for(const s of sockets)s.disconnect();server.kill();await once(server,'exit');}
});
