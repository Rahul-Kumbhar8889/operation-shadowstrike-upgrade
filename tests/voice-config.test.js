import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {makeVoiceConfig} from '../server/voiceConfig.js';
test('optional TURN relay uses short-lived credentials without exposing shared secret',()=>{
 const config=makeVoiceConfig({turnUrls:'turn:relay.example:3478,turns:relay.example:5349',turnSecret:'secret-example',userId:'player1',now:1700000000000});
 assert.equal(config.relayAvailable,true);const relay=config.iceServers[1];assert.equal(relay.username,'1700003600:player1');
 assert.equal(relay.credential,createHmac('sha1','secret-example').update(relay.username).digest('base64'));
 assert.ok(!JSON.stringify(config).includes('secret-example'));
 for(const data of [{turnUrls:'turn:relay',userId:'a'},{turnUrls:'https://bad',turnSecret:'x',userId:'a'},{turnUrls:'turn:relay',turnSecret:'x'}])assert.equal(makeVoiceConfig(data).relayAvailable,false);
});
