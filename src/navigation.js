// World north is negative Z, matching the tactical map.
export function objectiveNavigation(position, destination) {
  const dx=destination[0]-position.x, dz=destination[1]-position.z;
  const degrees=(Math.atan2(dx,-dz)*180/Math.PI+360)%360;
  const direction=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];
  return {distance:Math.round(Math.hypot(dx,dz)),direction,degrees:Math.round(degrees)%360};
}
