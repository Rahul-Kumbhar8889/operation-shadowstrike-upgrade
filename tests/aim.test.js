import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';import {aimDirection} from '../src/aim.js';
test('aim follows center-screen targets through long weapon range and third-person offset',()=>{
 const camera=new THREE.PerspectiveCamera(65,1,.1,300);camera.position.set(1,1.7,5);camera.lookAt(1,1.7,-110);camera.updateMatrixWorld();
 const target=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());target.position.set(1,1.7,-105);target.updateMatrixWorld();
 const origin=new THREE.Vector3(0,1.7,0),ray=new THREE.Raycaster();
 const long=aimDirection(camera,origin,[target],110,ray);assert.ok(long.x>.008&&long.x<.011);assert.ok(long.z<-.99);
 const short=aimDirection(camera,origin,[target],24,ray);assert.ok(short.x>long.x,'short range fallback accounts for the nearer aim plane');
});
