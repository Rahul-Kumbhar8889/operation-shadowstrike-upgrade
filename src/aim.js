import * as THREE from 'three';
const center=new THREE.Vector2(0,0);

// Aim through the screen center while compensating for third-person camera offset.
export function aimDirection(camera,origin,objects,range,raycaster){
 camera.updateMatrixWorld();raycaster.setFromCamera(center,camera);
 raycaster.far=range+camera.position.distanceTo(origin);
 const hits=raycaster.intersectObjects(objects,false);
 const point=hits.length?hits[0].point:raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction,raycaster.far);
 return point.clone().sub(origin).normalize();
}
