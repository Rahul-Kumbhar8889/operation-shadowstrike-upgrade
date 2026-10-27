import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = new URL('../public/assets/operations/', import.meta.url);

test('original GLB stays inside the authoritative operations collision volume', async () => {
  const data = await readFile(new URL('operations.glb', root));
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  const bounds = new Box3().setFromObject(gltf.scene);
  const epsilon = 0.00001;
  assert.ok(bounds.min.x >= -4 - epsilon && bounds.max.x <= 4 + epsilon);
  assert.ok(bounds.min.y >= -epsilon && bounds.max.y <= 5 + epsilon);
  assert.ok(bounds.min.z >= -1.5 - epsilon && bounds.max.z <= 1.5 + epsilon);
  // Preserve the visible collision footprint, not merely an arbitrarily small asset.
  assert.ok(bounds.max.x - bounds.min.x >= 7.99);
  assert.ok(bounds.max.z - bounds.min.z >= 2.99);
  let meshes = 0;
  gltf.scene.traverse(object => { if (object.isMesh) { meshes++; assert.ok(object.geometry.attributes.uv); } });
  assert.ok(meshes <= 6, `Building should batch by material, got ${meshes} meshes`);
});

test('self-hosted PBR map files match the verified optimized asset manifest', async () => {
  const manifest = JSON.parse(await readFile(new URL('materials.json', root), 'utf8'));
  assert.equal(manifest.available, true);
  assert.equal(manifest.materials.length, 4);
  for (const material of manifest.materials) {
    assert.equal(material.license, 'CC0-1.0');
    assert.equal(new URL(material.source).hostname, 'polyhaven.com');
    for (const channel of ['diff', 'nor_gl', 'rough', 'ao']) {
      assert.ok(material.sources.some(source => source.channel === channel && source.source_md5 && source.sha256));
    }
    for (const key of ['albedo', 'normal', 'orm']) {
      const file = await readFile(new URL(material[key], root));
      assert.equal(createHash('sha256').update(file).digest('hex'), material.optimized_files[key].sha256);
    }
  }
});
