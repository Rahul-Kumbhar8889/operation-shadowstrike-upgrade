import * as THREE from 'three';

const ROOT = `${import.meta.env.BASE_URL}assets/operations/`;

function daylightReflections(renderer) {
  // Local, original sky/ground approximation. It affects only the proof asset,
  // keeping lighting and appearances of the other six buildings unchanged.
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, '#b3cbd9'); gradient.addColorStop(0.48, '#d9ddd2');
  gradient.addColorStop(0.53, '#a6a18b'); gradient.addColorStop(1, '#79745d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 128);
  const sky = new THREE.CanvasTexture(canvas); sky.colorSpace = THREE.SRGBColorSpace;
  sky.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(sky);
  generator.dispose(); sky.dispose();
  return target;
}

function edgeMask() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 128, 128);
  ctx.globalCompositeOperation = 'destination-in';
  for (const [x0, y0, x1, y1] of [[0, 0, 128, 0], [0, 0, 0, 128]]) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, '#0000'); gradient.addColorStop(0.08, '#000');
    gradient.addColorStop(0.92, '#000'); gradient.addColorStop(1, '#0000');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  }
  // alphaMap reads green, so composite the alpha fade over black.
  const output = document.createElement('canvas'); output.width = output.height = 128;
  const out = output.getContext('2d'); out.fillStyle = 'black'; out.fillRect(0, 0, 128, 128); out.drawImage(canvas, 0, 0);
  return new THREE.CanvasTexture(output);
}

async function pbrMaterials(renderer) {
  const response = await fetch(`${ROOT}materials.json`);
  if (!response.ok) throw new Error(`Material manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (!manifest.available) throw new Error(manifest.reason || 'PBR assets unavailable');
  const loader = new THREE.TextureLoader();
  const materials = {};
  await Promise.all(manifest.materials.map(async entry => {
    const [map, normalMap, orm] = await Promise.all([entry.albedo, entry.normal, entry.orm].map(file => loader.loadAsync(`${ROOT}${file}`)));
    for (const texture of [map, normalMap, orm]) {
      texture.flipY = false;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    map.colorSpace = THREE.SRGBColorSpace;
    normalMap.colorSpace = orm.colorSpace = THREE.NoColorSpace;
    materials[entry.name] = new THREE.MeshStandardMaterial({
      map, normalMap, roughnessMap: orm, aoMap: orm, metalnessMap: orm,
      roughness: 1, metalness: entry.name === 'metal' ? 1 : 0,
      normalScale: new THREE.Vector2(0.65, 0.65), aoMapIntensity: 0.65,
    });
  }));
  return materials;
}

function signage() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#28332d'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#b7ad8a'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, 496, 112);
  ctx.textAlign = 'center'; ctx.fillStyle = '#e1d8b9'; ctx.font = 'bold 47px monospace'; ctx.fillText('OPERATIONS', 256, 64);
  ctx.font = '19px monospace'; ctx.fillText('01  /  AUTHORIZED PERSONNEL', 256, 99);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

function weathering() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // Original localized rain streaks and damp course, not substitute asset maps.
  for (let i = 0; i < 42; i++) {
    const x = (i * 127.3) % 1024, width = 2 + (i % 5);
    const gradient = ctx.createLinearGradient(0, 0, 0, 90 + (i % 7) * 14);
    gradient.addColorStop(0, '#292e252c'); gradient.addColorStop(1, '#292e2500');
    ctx.fillStyle = gradient; ctx.fillRect(x, 0, width, 190);
  }
  const damp = ctx.createLinearGradient(0, 450, 0, 512);
  damp.addColorStop(0, '#3e403100'); damp.addColorStop(1, '#3e403147');
  ctx.fillStyle = damp; ctx.fillRect(0, 450, 1024, 62);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false,
    roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}

export function createOperationsProof(parent, obstacle, fallback, renderer) {
  const proof = new THREE.Group(); proof.name = 'OperationsProof';
  proof.position.set(obstacle.x, 0, obstacle.z);
  proof.userData.status = 'loading'; parent.add(proof);
  // The existing building remains visible until the local model and PBR maps load.
  proof.userData.ready = Promise.all([
    import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(`${ROOT}operations.glb`)),
    pbrMaterials(renderer),
  ]).then(([gltf, materials]) => {
    gltf.scene.name = 'OperationsGLB';
    const reflectionTarget = daylightReflections(renderer);
    proof.userData.reflectionTarget = reflectionTarget;
    gltf.scene.traverse(object => {
      if (!object.isMesh) return;
      const name = object.material.name;
      if (name === 'Concrete') object.material = materials.concrete;
      if (name === 'PaintedMetal' || name === 'RoofMetal') {
        object.material = materials.metal.clone();
        object.material.color.set(name === 'PaintedMetal' ? 0xa4ae96 : 0xc2c4b8);
      }
      object.material.envMap = reflectionTarget.texture;
      object.material.envMapIntensity = 0.8;
      object.castShadow = object.receiveShadow = true;
    });
    proof.add(gltf.scene);
    const signMaterial = signage(), dirtMaterial = weathering();
    for (const side of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.34), signMaterial);
      sign.position.set(0, 2.14, side * 1.495); sign.rotation.y = side === 1 ? 0 : Math.PI;
      proof.add(sign);
      const stains = new THREE.Mesh(new THREE.PlaneGeometry(7.82, 4.35), dirtMaterial);
      stains.position.set(0, 2.65, side * 1.495); stains.rotation.y = side === 1 ? 0 : Math.PI;
      proof.add(stains);
    }
    const mask = edgeMask();
    for (const [name, w, d, x, z, height] of [
      ['ground', 11, 11, 0, 1.5, 0.002],
      ['asphalt', 8, 4, 0, 3.5, 0.004],
    ]) {
      const mat = materials[name].clone();
      for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap']) {
        // One ORM texture serves three map slots; preserve matching coordinates.
        mat[key] = materials[name][key].clone(); const tile = name === 'asphalt' ? 3 : 2;
        mat[key].repeat.set(w / tile, d / tile);
      }
      if (name === 'ground') mat.color.set(0x989d89);
      mat.alphaMap = mask; mat.transparent = true; mat.depthWrite = false;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      plane.name = `Operations-${name}`; plane.rotation.x = -Math.PI / 2;
      plane.position.set(x, height, z); plane.receiveShadow = true; plane.renderOrder = name === 'asphalt' ? 2 : 1;
      proof.add(plane);
    }
    fallback.visible = false;
    proof.userData.status = 'ready';
  }).catch(error => {
    proof.userData.status = 'unavailable'; proof.userData.error = error.message;
    console.warn('Operations proof unavailable; retaining existing building:', error.message);
  });
  return proof;
}
