// This separate HTML entry is served by Vite dev and is not a build input.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

if (!import.meta.env.DEV) throw new Error('Soldier studio is development-only.');
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x454b4c);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 30);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);
const generator = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = generator.fromScene(room, 0.04).texture;
generator.dispose(); room.dispose();
scene.add(new THREE.HemisphereLight(0xd0e2ec, 0x67654e, 1.4));
const sun = new THREE.DirectionalLight(0xffe8cb, 3.2); sun.position.set(-3, 6, -4);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: 0.1, far: 15 });
sun.shadow.normalBias = 0.015; scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x565b54, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.003; floor.receiveShadow = true; scene.add(floor);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.3, 0); controls.maxDistance = 8; controls.minDistance = 1.2;
function view(x, y, z, target = 1.3) { camera.position.set(x, y, z); controls.target.set(0, target, 0); controls.update(); }
document.querySelector('#front').onclick = () => view(0, 1.4, -4);
document.querySelector('#back').onclick = () => view(0, 1.4, 4);
document.querySelector('#detail').onclick = () => view(0.65, 2, -2.4, 1.85);
view(0, 1.4, -4);
const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}dev-assets/soldier-prototype/soldier-static.glb`);
gltf.scene.traverse(object => { if (object.isMesh) { object.castShadow = object.receiveShadow = true; if (object.material.normalMap) object.material.normalScale.set(0.35, 0.35); } });
scene.add(gltf.scene);
const metrics = await fetch(`${import.meta.env.BASE_URL}dev-assets/soldier-prototype/metrics.json`).then(response => response.json());
document.querySelector('#status').textContent = `${metrics.triangles.toLocaleString()} triangles · ${(metrics.bytes / 1048576).toFixed(2)} MiB · no rig`;
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
