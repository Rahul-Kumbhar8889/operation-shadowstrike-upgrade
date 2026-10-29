import {test} from 'node:test';
import assert from 'node:assert/strict';
import {objectiveNavigation} from '../src/navigation.js';

test('objective direction and distance agree with the north-up tactical map',()=>{
  const origin={x:0,z:0};
  for(const [destination,direction,degrees] of [[[0,-10],'N',0],[[10,0],'E',90],[[0,10],'S',180],[[-10,0],'W',270],[[10,-10],'NE',45]]){
    const result=objectiveNavigation(origin,destination);
    assert.equal(result.direction,direction);assert.equal(result.degrees,degrees);
    assert.equal(result.distance,Math.round(Math.hypot(...destination)));
  }
  assert.equal(objectiveNavigation({x:5,z:5},[5.01,-5]).degrees,0);
});
