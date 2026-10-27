import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../dev-assets/soldier-prototype/', import.meta.url);
test('soldier study metrics describe the actual embedded, unrigged GLB', async () => {
  const bytes = await readFile(new URL('soldier-static.glb', root));
  const metrics = JSON.parse(await readFile(new URL('metrics.json', root), 'utf8'));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const triangles = gltf.meshes.flatMap(mesh => mesh.primitives)
    .reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0);
  assert.equal(triangles, metrics.triangles);
  assert.equal(bytes.length, metrics.bytes);
  assert.equal(gltf.skins?.length || 0, 0, 'Do not describe this static study as rigged');
  assert.equal(gltf.animations?.length || 0, 0);
  assert.equal(metrics.rigged, false);
  assert.equal(metrics.animations, 0);
  assert.ok(gltf.meshes.length <= 10, 'Keep the static study batched by material');
  assert.ok(gltf.images.length > 0);
  assert.ok(gltf.images.every(image => Number.isInteger(image.bufferView) && !image.uri), 'All original texture images must be embedded');
});
