// Loaded only by the DEV guard in main.js. This is a static local-player art
// preview, not a replacement controller, hit model, rig or multiplayer character.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function enableSoldierPreview(soldier, renderer) {
  if (!import.meta.env.DEV) return;
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}dev-assets/soldier-prototype/soldier-static.glb`);
  const rifle = soldier.userData.rifle;
  // Preserve the original weapon models and their visibility, attachment,
  // recoil and aiming updates. Only the procedural body is hidden.
  const originals = [];
  soldier.traverse(object => {
    if (!object.isMesh) return;
    for (let parent = object; parent; parent = parent.parent) if (parent === rifle) return;
    originals.push([object, object.visible]);
  });
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const reflection = generator.fromScene(room, 0.04);
  generator.dispose(); room.dispose();
  gltf.scene.name = 'DevelopmentSoldierPreview';
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    object.material.envMap = reflection.texture;
    object.material.envMapIntensity = 0.5;
    // No preview geometry may become a gameplay raycast target.
    object.raycast = () => {};
  });
  soldier.add(gltf.scene);
  originals.forEach(([object]) => { object.visible = false; });
  const panel = document.createElement('aside');
  panel.style.cssText = 'position:fixed;z-index:110;top:12px;left:50%;transform:translateX(-50%);padding:10px;background:#222d25ee;color:#e8e5d3;font:12px Arial;max-width:350px;text-align:center;border:1px solid #a7ac8c;border-radius:4px';
  panel.textContent = 'DEV SOLDIER STUDY — static, unrigged; hands do not track aim or reload. ';
  const restore = document.createElement('button');
  restore.textContent = 'Restore original soldier';
  restore.style.cssText = 'margin-top:6px;padding:5px;cursor:pointer';
  panel.appendChild(restore); document.body.appendChild(panel);
  restore.onclick = () => {
    originals.forEach(([object, visible]) => { object.visible = visible; });
    soldier.remove(gltf.scene);
    gltf.scene.traverse(object => {
      if (object.isMesh) object.geometry.dispose();
    });
    // Materials/textures belong only to this one static preview.
    const materials = new Set();
    gltf.scene.traverse(object => { if (object.isMesh) materials.add(object.material); });
    const textures = new Set();
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture && value !== reflection.texture) textures.add(value);
      material.dispose();
    }
    textures.forEach(texture => texture.dispose()); reflection.dispose(); panel.remove();
  };
}
