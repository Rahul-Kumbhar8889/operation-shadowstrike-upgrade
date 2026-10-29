// Two-player voice chat. The microphone is only opened after an explicit click.
export function createVoiceChat({socket,button,audio,status}){
 let stream=null,peer=null,peerId=null,generation=0,muted=false,starting=false,offersStarted=false;
 let pendingCandidates=[];
 let iceServers=[{urls:'stun:stun.l.google.com:19302'}];
 const say=text=>{status.textContent=text;};
 const render=()=>{button.textContent=starting?'VOICE CONNECTING…':stream?(muted?'MIC MUTED':'MUTE MIC'):'ENABLE VOICE';button.disabled=starting;button.setAttribute('aria-pressed',String(!!stream&&!muted));};
 const signal=data=>socket.emit('voice-signal',data);
 function closePeer(){if(peer){peer.onicecandidate=peer.ontrack=peer.onconnectionstatechange=null;peer.close();}peer=null;peerId=null;offersStarted=false;pendingCandidates=[];audio.srcObject=null;}
 function stop(notify=true){generation++;starting=false;if(notify&&socket.connected)socket.emit('voice-ready',{enabled:false});closePeer();stream?.getTracks().forEach(t=>t.stop());stream=null;muted=false;render();say('Voice off');}
 function connect(id){
  if(!stream)return null;if(peer&&peerId===id)return peer;closePeer();peerId=id;
  const current=new RTCPeerConnection({iceServers});peer=current;
  stream.getAudioTracks().forEach(track=>current.addTrack(track,stream));
  current.onicecandidate=event=>{if(peer===current&&event.candidate)signal({candidate:event.candidate.toJSON()});};
  current.ontrack=event=>{if(peer!==current)return;audio.srcObject=event.streams[0];audio.play().catch(()=>say('Audio blocked • tap RETRY VOICE'));};
  current.onconnectionstatechange=()=>{if(peer!==current)return;const state=current.connectionState;if(state==='connected')say(muted?'Connected • mic muted':'Voice connected');else if(state==='failed')say('Voice connection failed; try again or another network');else if(state==='disconnected')say('Voice disconnected');};
  return current;
 }
 async function refreshIce(){
  if(typeof socket.timeout!=='function')return;
  try{const data=await socket.timeout(3000).emitWithAck('voice-config');if(data?.ok&&Array.isArray(data.iceServers)&&data.iceServers.length)iceServers=data.iceServers;}catch{/* direct connectivity remains available */}
 }
 async function retry(){
  if(!stream||!socket.connected){say('Enable voice first');return;}
  // Rebuild both peers while retaining the already-authorized microphone.
  const token=generation;closePeer();say('Retrying voice…');await refreshIce();if(token!==generation||!stream||!socket.connected)return;socket.emit('voice-ready',{enabled:true,reply:false,restart:true});
  audio.play().catch(()=>{});
 }
 async function enable(){
  if(starting)return;
  if(stream){muted=!muted;stream.getAudioTracks().forEach(t=>{t.enabled=!muted;});render();say(muted?'Mic muted':'Mic on');if(!muted)audio.play().catch(()=>{});return;}
  if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined'){say('Voice unavailable in this browser');return;}
  const token=++generation;starting=true;render();say('Allow microphone access');
  try{const fresh=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(token!==generation||!socket.connected){fresh.getTracks().forEach(t=>t.stop());return;}stream=fresh;await refreshIce();if(token!==generation||!stream||!socket.connected)return;starting=false;render();say('Mic on • waiting for teammate');socket.emit('voice-ready',{enabled:true,reply:false});}
  catch{if(token===generation){starting=false;render();say('Microphone unavailable or permission denied');}}
 }
 button.addEventListener('click',enable);
 socket.on('voice-ready',async data=>{
  if(!stream||!data?.from)return;if(!data.enabled){closePeer();say('Teammate voice off');return;}
  if(data.restart){const token=generation;closePeer();await refreshIce();if(token!==generation||!stream||!socket.connected)return;}
  if(!data.reply)socket.emit('voice-ready',{enabled:true,reply:true});
  const current=connect(data.from);if(!current||socket.id>=data.from||offersStarted)return;
  offersStarted=true;try{await current.setLocalDescription(await current.createOffer());if(peer===current)signal({description:current.localDescription.toJSON()});}catch{say('Voice setup failed');}
 });
 socket.on('voice-signal',async data=>{
  if(!stream||!data?.from)return;const current=connect(data.from);if(!current)return;
  try{
   if(data.description){await current.setRemoteDescription(data.description);for(const candidate of pendingCandidates)await current.addIceCandidate(candidate);pendingCandidates=[];
    if(data.description.type==='offer'){await current.setLocalDescription(await current.createAnswer());if(peer===current)signal({description:current.localDescription.toJSON()});}}
   else if(data.candidate){if(current.remoteDescription)await current.addIceCandidate(data.candidate);else pendingCandidates.push(data.candidate);}
  }catch{say('Voice setup failed; leave and rejoin voice');}
 });
 render();say('Voice off');return {stop,retry,peerLeft(){stop(false);say('Teammate left • voice off');}};
}
