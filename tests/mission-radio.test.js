import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMissionRadio} from '../src/missionRadio.js';
test('radio is opt-in, deduplicates snapshots, and announces each new objective',()=>{
 const spoken=[];let cancelled=0;const synth={cancel(){cancelled++;},speak(voice){spoken.push(voice.text);}};
 class Voice{constructor(text){this.text=text;}}
 const radio=createMissionRadio(synth,Voice);assert.equal(radio.announce('a','first'),false);
 assert.equal(radio.setEnabled(true),true);assert.equal(radio.announce('a','first'),true);
 assert.equal(radio.announce('a','first'),false);assert.equal(radio.announce('b','second'),true);
 assert.deepEqual(spoken,['first','second']);radio.stop();assert.equal(radio.announce('b','second'),true);
 radio.setEnabled(false);assert.equal(radio.announce('c','third'),false);assert.ok(cancelled>=4);
});
test('unavailable or failing speech leaves gameplay running',()=>{
 const unavailable=createMissionRadio(null,null);assert.equal(unavailable.available,false);assert.equal(unavailable.setEnabled(true),false);
 const radio=createMissionRadio({cancel(){},speak(){throw new Error('unavailable');}},class{});radio.setEnabled(true);assert.equal(radio.announce('x','hello'),false);
});
