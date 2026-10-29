import {test} from 'node:test';import assert from 'node:assert/strict';
import {reviveMessage} from '../src/missionFeedback.js';
test('revive progress describes the action from each player perspective',()=>{
 const state={remaining:2.4,targetId:'downed'};
 assert.match(reviveMessage(state,'downed'),/REVIVING YOU • 3s/);
 assert.match(reviveMessage(state,'rescuer'),/REVIVING TEAMMATE • 3s/);
 assert.match(reviveMessage(state,'rescuer'),/one injection/);
});
