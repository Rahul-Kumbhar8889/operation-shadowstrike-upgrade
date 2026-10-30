import {test} from 'node:test';import assert from 'node:assert/strict';
import {createExtractionFlyover,flyoverPosition} from '../src/extractionFlyover.js';
test('extraction flyover is bounded and is inactive until completion',()=>{
 const point=[100,-50];assert.deepEqual(flyoverPosition(point,-1),{x:82,y:9,z:-57});
 assert.deepEqual(flyoverPosition(point,2),{x:118,y:9,z:-57});
 const flyover=createExtractionFlyover(point);assert.equal(flyover.aircraft.visible,false);
 flyover.update(.5,.1);assert.equal(flyover.aircraft.visible,true);assert.equal(flyover.aircraft.position.x,100);
 flyover.update(1,.1);assert.equal(flyover.aircraft.visible,false);
});
