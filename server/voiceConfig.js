import {createHmac} from 'node:crypto';

// Optional coturn REST authentication. Never return the shared secret itself.
export function makeVoiceConfig({turnUrls='',turnSecret='',userId,now=Date.now()}){
 const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
 const urls=turnUrls.split(',').map(s=>s.trim()).filter(Boolean);
 if(!turnSecret||!userId||!urls.length||urls.some(url=>!/^turns?:[^\s]+$/i.test(url)))return {iceServers,relayAvailable:false};
 const username=`${Math.floor(now/1000)+3600}:${userId}`;
 const credential=createHmac('sha1',turnSecret).update(username).digest('base64');
 iceServers.push({urls,username,credential});
 return {iceServers,relayAvailable:true};
}
