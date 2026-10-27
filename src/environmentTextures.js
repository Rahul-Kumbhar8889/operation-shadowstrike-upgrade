import * as THREE from 'three';

// Original, deterministic canvas artwork. No downloads or third-party assets.
function random(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function createEnvironmentTextures() {
  const concrete = canvasTexture(256, (ctx, size) => {
    const rnd = random(32);
    ctx.fillStyle = '#a2a091'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 6500; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#ffffff12' : '#1c211b18';
      ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, rnd() * 3);
    }
    for (let y = 0; y < size; y += 64) {
      ctx.fillStyle = '#33382e42'; ctx.fillRect(0, y, size, 2);
      ctx.fillStyle = '#ffffff16'; ctx.fillRect(0, y + 2, size, 1);
    }
    for (let i = 0; i < 35; i++) {
      const x = rnd() * size;
      const gradient = ctx.createLinearGradient(x, 0, x, 100);
      gradient.addColorStop(0, '#33372826'); gradient.addColorStop(1, '#33372800');
      ctx.fillStyle = gradient; ctx.fillRect(x, 0, 1 + rnd() * 5, 100);
    }
  });
  const metal = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#657064'; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = '#18261b55'; ctx.fillRect(x, 0, 3, size);
      ctx.fillStyle = '#b3b5a333'; ctx.fillRect(x + 3, 0, 2, size);
      ctx.fillStyle = '#242d22';
      for (const y of [12, 244]) { ctx.beginPath(); ctx.arc(x + 8, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
    }
  });
  const ground = canvasTexture(2048, (ctx, size) => {
    const rnd = random(847);
    ctx.fillStyle = '#77715a'; ctx.fillRect(0, 0, size, size);
    // Broad vegetation/dirt variation followed by fine aggregate.
    for (let i = 0; i < 600; i++) {
      const x = rnd() * size, y = rnd() * size, r = 12 + rnd() * 80;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, i % 2 ? '#3d502b55' : '#b0a17a44');
      gradient.addColorStop(1, '#77715a00');
      ctx.fillStyle = gradient; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 100000; i++) {
      ctx.fillStyle = ['#282e201c', '#e1d4a326', '#35442b25'][i % 3];
      ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    const unit = size / 100, coord = value => (value + 50) * unit;
    // Existing road alignment remains x=20 and z=19. All surfacing is flat.
    ctx.fillStyle = '#938971';
    ctx.fillRect(0, coord(14.8), size, 8.4 * unit);
    ctx.fillRect(coord(15.8), 0, 8.4 * unit, size);
    ctx.fillStyle = '#414840';
    ctx.fillRect(0, coord(15.5), size, 7 * unit);
    ctx.fillRect(coord(16.5), 0, 7 * unit, size);
    for (let i = 0; i < 28000; i++) {
      const x = rnd() * 100 - 50, z = rnd() * 100 - 50;
      if (Math.abs(x - 20) > 3.5 && Math.abs(z - 19) > 3.5) continue;
      ctx.fillStyle = i % 2 ? '#d3c8a21c' : '#111b171e';
      ctx.fillRect(coord(x), coord(z), 1 + rnd() * 2, 1 + rnd() * 2);
    }
    ctx.strokeStyle = '#c0b17a'; ctx.lineWidth = 0.11 * unit; ctx.setLineDash([2.6 * unit, 4 * unit]);
    ctx.beginPath(); ctx.moveTo(0, coord(19)); ctx.lineTo(coord(16), coord(19));
    ctx.moveTo(coord(24), coord(19)); ctx.lineTo(size, coord(19)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(coord(20), 0); ctx.lineTo(coord(20), coord(15));
    ctx.moveTo(coord(20), coord(23)); ctx.lineTo(coord(20), size); ctx.stroke();
    ctx.setLineDash([]);
    // Tire wear and sparse asphalt fractures.
    ctx.strokeStyle = '#151d171f'; ctx.lineWidth = 0.22 * unit;
    for (const offset of [-1.2, 1.2]) {
      ctx.beginPath(); ctx.moveTo(0, coord(19 + offset)); ctx.lineTo(size, coord(19 + offset)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(coord(20 + offset), 0); ctx.lineTo(coord(20 + offset), size); ctx.stroke();
    }
    ctx.strokeStyle = '#20291e66'; ctx.lineWidth = 0.65;
    for (let i = 0; i < 45; i++) {
      const x = coord(17 + rnd() * 6), y = rnd() * size;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rnd() * 7, y + 6); ctx.lineTo(x - 3, y + 12); ctx.stroke();
    }
    // Flush service pads: no steps or additional collision geometry.
    ctx.fillStyle = '#8d8b79';
    for (const [x, z, w, d] of [[-8, -7, 9, 4], [9, -10, 6, 8], [-12, 8, 7, 7], [10, 9, 10, 4]]) {
      ctx.fillRect(coord(x - w / 2), coord(z - d / 2), w * unit, d * unit);
    }
  });
  return { concrete, metal, ground };
}
