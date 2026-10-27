import * as THREE from 'three';
import { createEnvironmentTextures } from './environmentTextures.js';
import { createOperationsProof } from './operationsProof.js';

// All solid detail stays inside existing obstacle volumes or outside ±45 play bounds.
// This module never adds collision bodies or changes authoritative game geometry.
export function createBattlefield(scene, obstacles, ground, renderer) {
  const group = new THREE.Group();
  group.name = 'MilitaryCompound';
  scene.add(group);
  const textures = createEnvironmentTextures();
  // Subtle micro-relief changes lighting only; the playable floor stays flat.
  const bump = texture => {
    const result = texture.clone(); result.colorSpace = THREE.NoColorSpace;
    return result;
  };
  ground.material.map = textures.ground;
  ground.material.bumpMap = bump(textures.ground);
  ground.material.bumpScale = 0.035;
  ground.material.color.set(0xffffff);
  ground.material.needsUpdate = true;
  const distantGround = new THREE.Mesh(new THREE.PlaneGeometry(320, 320),
    new THREE.MeshStandardMaterial({ color: 0x77775d, roughness: 1 }));
  distantGround.rotation.x = -Math.PI / 2;
  distantGround.position.y = -0.04;
  distantGround.receiveShadow = true;
  group.add(distantGround);
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...options });
  const concrete = material(0xddd8c4, { map: textures.concrete, bumpMap: bump(textures.concrete), bumpScale: 0.025 });
  const olive = material(0x9ba18b, { map: textures.metal, bumpMap: bump(textures.metal), bumpScale: 0.025, metalness: 0.25 });
  const steel = material(0x48514c, { metalness: 0.55, roughness: 0.65 });
  const trim = material(0x686b5d, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const dark = material(0x242d28);
  const sand = material(0x9e9473, { map: textures.concrete });
  const wood = material(0x7c7052, { map: textures.concrete });
  const glass = material(0x354d50, { metalness: 0.45, roughness: 0.3 });
  const lamp = material(0xd2c6a1, { emissive: 0xffd393, emissiveIntensity: 0.25 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const batches = new Map();
  const operationsFallback = new THREE.Group(); operationsFallback.name = 'OperationsFallback';
  group.add(operationsFallback);
  let owner = group;
  function box(mat, x, y, z, w, h, d, rz = 0) {
    const key = `${owner.uuid}:${mat.uuid}`;
    if (!batches.has(key)) batches.set(key, { mat, owner, items: [] });
    batches.get(key).items.push({ x, y, z, w, h, d, rz });
  }

  obstacles.forEach(({ x, z, w, h, d, mesh }, index) => {
    owner = index === 0 ? operationsFallback : group;
    // Keep the original mesh for raycasts/collision; render a detailed solid shell.
    // Its silhouette and every roof attachment fit within the original box.
    mesh.material.visible = false;
    const roofY = h - 0.28;
    box(concrete, x, roofY / 2, z, w, roofY, d);
    box(dark, x, roofY + 0.02, z, w - 0.16, 0.04, d - 0.16);
    for (const side of [-1, 1]) {
      box(trim, x, h - 0.12, z + side * (d / 2 - 0.08), w, 0.24, 0.16);
      box(trim, x + side * (w / 2 - 0.08), h - 0.12, z, 0.16, 0.24, d);
      // Inset concrete footings and corner pilasters.
      box(trim, x, 0.22, z + side * (d / 2 - 0.025), w, 0.44, 0.05);
      for (const corner of [-1, 1]) {
        box(trim, x + corner * (w / 2 - 0.07), roofY / 2, z + side * (d / 2 - 0.025), 0.14, roofY, 0.05);
      }
    }
    // Facade overlays are coplanar with the collision-box faces; polygon offset
    // avoids z-fighting without projecting visual cover beyond the collider.
    function facade(mat, px, py, pz, width, height, rotation = 0) {
      const faceMaterial = mat.clone();
      faceMaterial.polygonOffset = true;
      faceMaterial.polygonOffsetFactor = -2;
      faceMaterial.polygonOffsetUnits = -2;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMaterial);
      face.position.set(px, py, pz); face.rotation.y = rotation;
      owner.add(face);
      return face;
    }
    // Sealed service panels, not enterable doorways or transparent windows.
    for (const side of [-1, 1]) {
      const rotation = side === 1 ? 0 : Math.PI;
      facade(olive, x - w * 0.22, Math.min(1.15, roofY / 2), z + side * d / 2,
        Math.min(1.35, w * 0.35), Math.min(1.85, roofY - 0.2), rotation);
      if (h > 3) {
        for (let i = 0; i < Math.floor(w / 2); i++) {
          facade(glass, x - w / 2 + 1 + i * 1.8, Math.min(h - 1.2, 2.8), z + side * d / 2, 0.85, 0.65, rotation);
        }
      }
      // A flush vent grille with no apparent traversable opening.
      const vent = facade(dark, x + w * 0.25, Math.min(1.7, roofY * 0.7), z + side * d / 2, 0.7, 0.42, rotation);
      for (let row = 0; row < 4; row++) {
        const louver = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.035), trim);
        louver.position.set(0, -0.15 + row * 0.1, 0); vent.add(louver);
      }
    }
    // Low rooftop equipment and beams remain below the existing collision height.
    box(olive, x, h - 0.14, z, Math.min(1.4, w * 0.4), 0.24, Math.min(0.9, d * 0.4));
    for (const offset of [-0.2, 0, 0.2]) box(steel, x + offset, h - 0.01, z, 0.035, 0.02, Math.min(0.8, d * 0.35));
    // Painted building identifiers add scale and place without external assets.
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#303b32'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#d5cdb0'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
    ctx.fillText(['OPERATIONS', 'COMMS / 02', 'SUPPLY / 03', 'BARRACKS', 'UTILITY / 05', 'STORE / 06', 'STORE / 07'][index], 128, 42);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sign = material(0xffffff, { map, roughness: 1 });
    facade(sign, x, Math.min(h - 0.55, 2.25), z + d / 2, Math.min(w - 0.4, 1.65), 0.4);
    owner = group;
  });

  // Perimeter compound dressing is beyond the movement boundary. Never place
  // crates, sandbag walls, poles or fences in traversable/target shooting lanes.
  for (const side of [-1, 1]) {
    for (let p = -44; p <= 44; p += 4) {
      box(steel, p, 1.4, side * 47, 0.08, 2.8, 0.08);
      box(steel, side * 47, 1.4, p, 0.08, 2.8, 0.08);
    }
    for (const y of [0.2, 1.35, 2.55]) {
      box(steel, 0, y, side * 47, 92, 0.035, 0.035);
      box(steel, side * 47, y, 0, 0.035, 0.035, 92);
    }
    // Fine wire fencing, represented as one line batch below.
  }
  const wires = [];
  for (const side of [-1, 1]) for (let p = -46; p <= 46; p += 0.5) {
    wires.push(p, 0.25, side * 47, Math.min(p + 1.2, 46), 2.5, side * 47);
    wires.push(side * 47, 0.25, p, side * 47, 2.5, Math.min(p + 1.2, 46));
  }
  const fence = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)),
    new THREE.LineBasicMaterial({ color: 0x626a5d, transparent: true, opacity: 0.45 }));
  group.add(fence);

  for (const x of [-49, 49]) for (const z of [-49, 49]) {
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(steel, x + dx, 2.6, z + dz, 0.16, 5.2, 0.16);
    box(wood, x, 5.2, z, 2.5, 0.2, 2.5);
    box(olive, x, 6.9, z, 3, 0.18, 3);
    for (const side of [-1, 1]) {
      box(olive, x, 5.7, z + side * 1.15, 2.4, 0.8, 0.12);
      box(olive, x + side * 1.15, 5.7, z, 0.12, 0.8, 2.4);
      for (const dx of [-1.1, 1.1]) box(steel, x + dx, 6.1, z + side * 1.1, 0.1, 1.5, 0.1);
      // Diagonal braces and ladder, safely outside the accessible arena.
      box(steel, x, 2.8, z + side, 0.1, 5.4, 0.12, side * 0.36);
    }
    for (const dx of [-0.3, 0.3]) box(steel, x + dx, 2.5, z - 1.3, 0.06, 5, 0.06);
    for (let y = 0.3; y < 5; y += 0.38) box(steel, x, y, z - 1.3, 0.65, 0.04, 0.06);
    box(lamp, x, 6.65, z - 1.15, 0.45, 0.12, 0.15);
  }

  for (const z of [-32, -16, 0, 16, 32]) for (const side of [-1, 1]) {
    const x = side * 48.7;
    // Wooden supply crates with steel edge bands.
    box(wood, x, 0.65, z, 1.4, 1.3, 1.5);
    for (const dz of [-0.6, 0.6]) box(steel, x, 0.65, z + dz, 1.42, 1.32, 0.055);
    box(olive, x, 1.5, z, 1.1, 0.4, 1.1);
    for (let layer = 0; layer < 3; layer++) for (let j = 0; j < 5; j++) {
      box(sand, side * 48.7, 0.15 + layer * 0.26, z + 3 + j * 0.7 + (layer % 2) * 0.25, 0.62, 0.27, 0.78, (j % 2 ? 1 : -1) * 0.025);
    }
  }

  const transform = new THREE.Object3D();
  for (const { mat, owner: batchOwner, items } of batches.values()) {
    const instances = new THREE.InstancedMesh(unitBox, mat, items.length);
    items.forEach((item, i) => {
      transform.position.set(item.x, item.y, item.z);
      transform.rotation.set(0, 0, item.rz);
      transform.scale.set(item.w, item.h, item.d); transform.updateMatrix();
      instances.setMatrixAt(i, transform.matrix);
    });
    instances.castShadow = true; instances.receiveShadow = true;
    instances.computeBoundingBox(); instances.computeBoundingSphere();
    batchOwner.add(instances);
  }

  // Distant vegetation silhouettes remain outside both player bounds and fences.
  const treeGeometry = new THREE.ConeGeometry(1, 1, 7);
  const trees = new THREE.InstancedMesh(treeGeometry, material(0x4b5940), 64);
  for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI * 2 / 64;
    const radius = 80 + Math.sin(i * 7.3) * 6;
    const height = 6 + (i % 5);
    transform.position.set(Math.cos(angle) * radius, height / 2 - 0.2, Math.sin(angle) * radius);
    transform.rotation.set(0, i, 0); transform.scale.set(3 + i % 3, height, 3 + i % 3); transform.updateMatrix();
    trees.setMatrixAt(i, transform.matrix);
  }
  trees.computeBoundingSphere(); group.add(trees);
  createOperationsProof(group, obstacles[0], operationsFallback, renderer);
  return group;
}
