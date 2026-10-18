/**
 * ProceduralTextures.js
 * Every non-character texture in the game, generated at boot with Phaser
 * Graphics (`scene.make.graphics` + `generateTexture`) or the Canvas 2D API.
 * Nothing is loaded from disk, so there are no broken image links - ever.
 */
import { WIDTH, HEIGHT } from '../config/GameConfig.js';

/** Creates a canvas texture, runs `draw(ctx, w, h)` and uploads it. */
export function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  tex.refresh();
  return tex;
}

/** Draws with a Phaser Graphics object and bakes it to a texture. */
export function graphicsTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const OUTLINE = '#3a2430';

// ---------------------------------------------------------------------------- pickups

function makePickups(scene) {
  // Pop Coin: gold disc with an embossed "P"
  canvasTexture(scene, 'coin', 44, 44, (ctx) => {
    const g = ctx.createRadialGradient(16, 14, 4, 22, 22, 22);
    g.addColorStop(0, '#fff6c2');
    g.addColorStop(0.5, '#ffcf3a');
    g.addColorStop(1, '#d48a00');
    ctx.beginPath();
    ctx.arc(22, 22, 19, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#9a5f00';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(22, 22, 14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(154,95,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 20px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b06d00';
    ctx.fillText('P', 23, 24);
    ctx.fillStyle = '#fff3b0';
    ctx.fillText('P', 22, 23);
  });

  // Blind Box Ticket
  canvasTexture(scene, 'ticket', 64, 42, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(60, 4);
    ctx.lineTo(60, 15);
    ctx.arc(60, 21, 6, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(60, 38);
    ctx.lineTo(4, 38);
    ctx.lineTo(4, 27);
    ctx.arc(4, 21, 6, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 4, 0, 38);
    g.addColorStop(0, '#ffb3cb');
    g.addColorStop(1, '#ff6f9c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#a3264f';
    ctx.stroke();
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(44, 7);
    ctx.lineTo(44, 35);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('?', 25, 22);
  });

  // Golden Key
  canvasTexture(scene, 'key', 48, 48, (ctx) => {
    ctx.translate(24, 24);
    ctx.rotate(-0.7);
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = '#a06a00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-10, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-10, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#a06a00';
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    rr(ctx, -2, -3, 22, 6, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(12, 2, 4, 7);
    ctx.strokeRect(12, 2, 4, 7);
    ctx.fillRect(17, 2, 3, 5);
    ctx.strokeRect(17, 2, 3, 5);
  });

  // Super Magnet power-up
  canvasTexture(scene, 'magnet', 56, 56, (ctx) => {
    ctx.beginPath();
    ctx.arc(28, 28, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,200,255,0.35)';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#e8324b';
    ctx.beginPath();
    ctx.arc(28, 26, 13, Math.PI, 0, false);
    ctx.stroke();
    ctx.fillStyle = '#e8324b';
    ctx.fillRect(9, 25, 12, 10);
    ctx.fillRect(35, 25, 12, 10);
    ctx.fillStyle = '#e9eef5';
    ctx.fillRect(9, 35, 12, 8);
    ctx.fillRect(35, 35, 12, 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeRect(9, 25, 12, 18);
    ctx.strokeRect(35, 25, 12, 18);
  });
}

// ---------------------------------------------------------------------------- obstacles

function makeObstacles(scene) {
  // Tree stump
  canvasTexture(scene, 'obs_stump', 76, 68, (ctx) => {
    ctx.fillStyle = '#7b4a2b';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(10, 66);
    ctx.lineTo(14, 16);
    ctx.lineTo(62, 16);
    ctx.lineTo(66, 66);
    ctx.quadraticCurveTo(72, 66, 74, 66);
    ctx.lineTo(2, 66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,10,0.5)';
    ctx.lineWidth = 1.5;
    for (const x of [24, 38, 52]) {
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x + 2, 62);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(38, 16, 25, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e2b77c';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = '#b5844a';
    ctx.lineWidth = 1.2;
    for (const r of [6, 12, 18]) {
      ctx.beginPath();
      ctx.ellipse(38, 16, r, r * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // Mossy rock
  canvasTexture(scene, 'obs_rock', 70, 52, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(4, 50);
    ctx.quadraticCurveTo(2, 22, 22, 10);
    ctx.quadraticCurveTo(40, 0, 56, 14);
    ctx.quadraticCurveTo(70, 28, 66, 50);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, 52);
    g.addColorStop(0, '#a8a29a');
    g.addColorStop(1, '#6d6760');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#6fae4f';
    ctx.beginPath();
    ctx.ellipse(30, 12, 16, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(20, 24, 6, 3, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Fallen log
  canvasTexture(scene, 'obs_log', 128, 50, (ctx) => {
    rr(ctx, 8, 6, 112, 40, 18);
    ctx.fillStyle = '#8a5531';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,10,0.4)';
    ctx.lineWidth = 1.5;
    for (const y of [16, 26, 36]) {
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.lineTo(108, y + 1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(106, 26, 13, 19, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e2b77c';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = '#b5844a';
    ctx.lineWidth = 1.2;
    for (const r of [4, 8]) {
      ctx.beginPath();
      ctx.ellipse(106, 26, r * 0.7, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#7cc35d';
    ctx.beginPath();
    ctx.ellipse(50, 7, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Bramble bush with thorns and berries
  canvasTexture(scene, 'obs_bramble', 116, 60, (ctx) => {
    const blobs = [
      [24, 40, 20],
      [48, 30, 24],
      [74, 32, 22],
      [94, 42, 18]
    ];
    ctx.fillStyle = '#2f6b3a';
    ctx.strokeStyle = '#1b3d22';
    ctx.lineWidth = 2.5;
    for (const [x, y, r] of blobs) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillRect(6, 40, 104, 20);
    ctx.strokeStyle = '#d9c9a0';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const [x, y, r] = blobs[i % blobs.length];
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
      ctx.lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6));
      ctx.stroke();
    }
    ctx.fillStyle = '#7a2a8c';
    for (const [x, y] of [
      [40, 26],
      [60, 38],
      [80, 24],
      [28, 44],
      [92, 36]
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Gnarly root hurdle (low)
  canvasTexture(scene, 'obs_root', 96, 30, (ctx) => {
    ctx.strokeStyle = '#5a3418';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(2, 28);
    ctx.bezierCurveTo(20, 2, 40, 2, 50, 18);
    ctx.bezierCurveTo(60, 4, 80, 4, 94, 28);
    ctx.stroke();
    ctx.strokeStyle = '#8a5531';
    ctx.lineWidth = 5;
    ctx.stroke();
  });

  // Low branch hanging from the canopy - slide under it. The vine reaches the
  // top of the screen so it cannot be jumped over.
  const BH = 560;
  canvasTexture(scene, 'obs_branch', 160, BH, (ctx) => {
    ctx.fillStyle = '#6b4226';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    rr(ctx, 68, -10, 24, BH - 40, 8);
    ctx.fill();
    ctx.stroke();
    // heavy horizontal branch at the bottom
    rr(ctx, 6, BH - 54, 148, 34, 16);
    ctx.fillStyle = '#7b4a2b';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,10,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(18, BH - 42);
    ctx.lineTo(140, BH - 40);
    ctx.moveTo(22, BH - 30);
    ctx.lineTo(136, BH - 30);
    ctx.stroke();
    const leaf = (x, y, rot, c) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = '#1b3d22';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };
    for (let i = 0; i < 12; i++) leaf(14 + i * 12, BH - 14 + (i % 2) * 5, 1.2 + (i % 3) * 0.3, i % 2 ? '#4f9a4a' : '#3d7f3a');
    for (let i = 0; i < 13; i++) leaf(66 + (i % 2) * 28, 20 + i * 38, i % 2 ? 0.6 : -0.6, '#4f9a4a');
  });

  // Pit trap: a dark hole cut into the running surface
  canvasTexture(scene, 'obs_pit', 180, 120, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, '#1d1220');
    g.addColorStop(1, '#050306');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(176, 0);
    ctx.lineTo(166, 120);
    ctx.lineTo(14, 120);
    ctx.closePath();
    ctx.fill();
    // grass lip
    ctx.fillStyle = '#5fae4b';
    ctx.fillRect(0, 0, 180, 6);
    ctx.fillStyle = '#3f8034';
    for (let x = 0; x < 180; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x + 5, 16);
      ctx.lineTo(x + 10, 6);
      ctx.fill();
    }
    // dangling roots
    ctx.strokeStyle = '#4a2c16';
    ctx.lineWidth = 3;
    for (const x of [24, 60, 110, 150]) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.quadraticCurveTo(x + 8, 30, x - 2, 50);
      ctx.stroke();
    }
  });
}

// ---------------------------------------------------------------------------- particles & fx

function makeParticles(scene) {
  graphicsTexture(scene, 'p_dust', 16, 16, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(8, 8, 5);
  });
  graphicsTexture(scene, 'p_circle', 10, 10, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(5, 5, 5);
  });
  graphicsTexture(scene, 'p_confetti', 10, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 10, 6);
  });
  // 4-point sparkle star (gold burst)
  canvasTexture(scene, 'p_spark', 24, 24, (ctx) => {
    ctx.translate(12, 12);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 12 : 2.5;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  graphicsTexture(scene, 'p_leaf', 14, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7, 4, 14, 8);
  });

  // Soft radial glow - tinted per rarity for the reveal lighting
  canvasTexture(scene, 'fx_glow', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });

  // God rays
  canvasTexture(scene, 'fx_rays', 512, 512, (ctx) => {
    ctx.translate(256, 256);
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      const g = ctx.createLinearGradient(0, 0, 0, -256);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -256);
      ctx.lineTo(18, -256);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Shield bubble
  canvasTexture(scene, 'fx_shield', 150, 160, (ctx) => {
    const g = ctx.createRadialGradient(75, 80, 40, 75, 80, 74);
    g.addColorStop(0, 'rgba(255,220,120,0)');
    g.addColorStop(0.8, 'rgba(255,220,120,0.25)');
    g.addColorStop(1, 'rgba(255,240,180,0.85)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(75, 80, 72, 78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(52, 46, 22, 14, -0.6, Math.PI, Math.PI * 1.6);
    ctx.stroke();
  });

  // Magnet aura ring
  canvasTexture(scene, 'fx_ring', 128, 128, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------------------- blind box

/** Draws the isometric Pop Mart-style blind box (front + side + top faces). */
function drawBox(ctx, { lid = true } = {}) {
  const fx = 20;
  const fy = 60;
  const fw = 150;
  const fh = 180;
  const depth = 46;

  // Side face
  ctx.beginPath();
  ctx.moveTo(fx + fw, fy);
  ctx.lineTo(fx + fw + depth, fy - depth * 0.6);
  ctx.lineTo(fx + fw + depth, fy + fh - depth * 0.6);
  ctx.lineTo(fx + fw, fy + fh);
  ctx.closePath();
  const sg = ctx.createLinearGradient(fx + fw, 0, fx + fw + depth, 0);
  sg.addColorStop(0, '#e05b86');
  sg.addColorStop(1, '#b8406a');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Side face polka dots
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(fx + fw + 14 + (i % 2) * 18, fy + 20 + i * 26 - (i % 2) * 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Front face
  const fg = ctx.createLinearGradient(0, fy, 0, fy + fh);
  fg.addColorStop(0, '#ffd0de');
  fg.addColorStop(1, '#ff8fb1');
  ctx.fillStyle = fg;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.strokeRect(fx, fy, fw, fh);

  // Big question mark badge
  ctx.beginPath();
  ctx.arc(fx + fw / 2, fy + 84, 46, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = 'bold 68px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e0567f';
  ctx.fillText('?', fx + fw / 2, fy + 88);

  // Brand label
  rr(ctx, fx + 14, fy + 140, fw - 28, 28, 10);
  ctx.fillStyle = '#3d2a52';
  ctx.fill();
  ctx.font = 'bold 18px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#ffe9c7';
  ctx.fillText('LABUBU', fx + fw / 2, fy + 155);
  ctx.font = 'bold 11px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#3d2a52';
  ctx.fillText('THE MONSTERS', fx + fw / 2, fy + 30);

  // Top face
  if (lid) {
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + depth, fy - depth * 0.6);
    ctx.lineTo(fx + fw + depth, fy - depth * 0.6);
    ctx.lineTo(fx + fw, fy);
    ctx.closePath();
    ctx.fillStyle = '#ffe3ec';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  } else {
    // Open box: dark interior
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + depth, fy - depth * 0.6);
    ctx.lineTo(fx + fw + depth, fy - depth * 0.6);
    ctx.lineTo(fx + fw, fy);
    ctx.closePath();
    ctx.fillStyle = '#5a2a40';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

function makeBlindBox(scene) {
  canvasTexture(scene, 'box_closed', 220, 250, (ctx) => drawBox(ctx, { lid: true }));
  canvasTexture(scene, 'box_open', 220, 250, (ctx) => drawBox(ctx, { lid: false }));

  // Loose lid for the "pop" animation
  canvasTexture(scene, 'box_lid', 220, 70, (ctx) => {
    ctx.translate(0, 10);
    ctx.beginPath();
    ctx.moveTo(20, 50);
    ctx.lineTo(66, 22);
    ctx.lineTo(216, 22);
    ctx.lineTo(170, 50);
    ctx.closePath();
    ctx.fillStyle = '#ffe3ec';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  });

  // Foil tear strip
  canvasTexture(scene, 'foil_strip', 196, 26, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 196, 26);
    g.addColorStop(0, '#d9dde3');
    g.addColorStop(0.3, '#ffffff');
    g.addColorStop(0.5, '#aeb6c2');
    g.addColorStop(0.75, '#f5f7fa');
    g.addColorStop(1, '#c2c8d1');
    ctx.fillStyle = g;
    rr(ctx, 0, 2, 196, 22, 4);
    ctx.fill();
    ctx.strokeStyle = '#7d8592';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e0567f';
    ctx.font = 'bold 11px Trebuchet MS, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEAR HERE ▸▸▸', 52, 14);
  });

  // Small box icon for the menu
  canvasTexture(scene, 'box_icon', 110, 125, (ctx) => {
    ctx.scale(0.5, 0.5);
    drawBox(ctx, { lid: true });
  });
}

// ---------------------------------------------------------------------------- backgrounds

function makeBackgrounds(scene) {
  // Sky (static, layer 1): saturated cartoon gradient, sun glow and rays.
  canvasTexture(scene, 'bg_sky', WIDTH, HEIGHT, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3fa7ff');
    g.addColorStop(0.45, '#8fd8ff');
    g.addColorStop(0.75, '#ffe1f0');
    g.addColorStop(1, '#ffd29a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const sx = w * 0.78;
    const sy = 150;
    ctx.save();
    ctx.translate(sx, sy);
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      const rg = ctx.createLinearGradient(0, 0, 0, -520);
      rg.addColorStop(0, 'rgba(255,250,220,0.35)');
      rg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-40, -520);
      ctx.lineTo(40, -520);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const sun = ctx.createRadialGradient(sx, sy, 10, sx, sy, 190);
    sun.addColorStop(0, 'rgba(255,255,235,1)');
    sun.addColorStop(0.22, 'rgba(255,244,190,0.95)');
    sun.addColorStop(0.5, 'rgba(255,230,170,0.35)');
    sun.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  });

  // Big puffy clouds with shaded undersides (tileable).
  canvasTexture(scene, 'bg_clouds', 1024, 260, (ctx) => {
    const cloud = (x, y, s) => {
      const puffs = [
        [0, 0, 30],
        [32, -18, 38],
        [70, -6, 32],
        [100, 6, 24],
        [44, 12, 30],
        [-24, 10, 22]
      ];
      ctx.fillStyle = 'rgba(160,180,230,0.55)';
      for (const [dx, dy, r] of puffs) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s + 8 * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      for (const [dx, dy, r] of puffs) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    cloud(90, 90, 1.15);
    cloud(420, 160, 0.8);
    cloud(660, 80, 1.35);
    cloud(920, 175, 0.7);
  });

  // Distant mountains with snow caps and sun-lit faces (tileable, layer 2).
  canvasTexture(scene, 'bg_mountains', 1024, 300, (ctx, w, h) => {
    const peaks = [
      [80, 70, 180],
      [300, 30, 220],
      [520, 90, 170],
      [720, 20, 240],
      [930, 80, 190]
    ];
    for (const off of [-w, 0, w]) {
      for (const [px, py, half] of peaks) {
        const x = px + off;
        ctx.fillStyle = '#8a7bd1';
        ctx.beginPath();
        ctx.moveTo(x - half, h);
        ctx.lineTo(x, py);
        ctx.lineTo(x + half, h);
        ctx.closePath();
        ctx.fill();
        // shadow face
        ctx.fillStyle = '#6d5fb8';
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + half, h);
        ctx.lineTo(x + half * 0.2, h);
        ctx.closePath();
        ctx.fill();
        // snow cap
        ctx.fillStyle = '#f4f2ff';
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x - half * 0.28, py + 60);
        ctx.lineTo(x - half * 0.1, py + 50);
        ctx.lineTo(x + half * 0.02, py + 64);
        ctx.lineTo(x + half * 0.16, py + 48);
        ctx.lineTo(x + half * 0.28, py + 60);
        ctx.closePath();
        ctx.fill();
      }
    }
    // atmospheric haze at the base
    const haze = ctx.createLinearGradient(0, h - 120, 0, h);
    haze.addColorStop(0, 'rgba(255,225,240,0)');
    haze.addColorStop(1, 'rgba(255,225,240,0.75)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
  });

  // Rolling hills with lollipop trees and mushroom houses (tileable, layer 3).
  canvasTexture(scene, 'bg_hills', 1024, 260, (ctx, w, h) => {
    const wrap = (fn) => [-w, 0, w].forEach(fn);
    wrap((off) => {
      ctx.fillStyle = '#7fd36b';
      ctx.beginPath();
      ctx.moveTo(off, h);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(off + x, 130 + Math.sin((x / w) * Math.PI * 4) * 34 + Math.sin((x / w) * Math.PI * 10) * 8);
      ctx.lineTo(off + w, h);
      ctx.closePath();
      ctx.fill();
    });
    // sunlit ridge highlight
    ctx.strokeStyle = 'rgba(255,255,210,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, 132 + Math.sin((x / w) * Math.PI * 4) * 34 + Math.sin((x / w) * Math.PI * 10) * 8);
    ctx.stroke();
    const lolli = (x, y, r, c) =>
      wrap((off) => {
        ctx.fillStyle = '#6b4a2e';
        ctx.fillRect(x + off - 3, y, 6, r * 1.6);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + off, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x + off - r * 0.35, y - r * 0.35, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
    const shroom = (x, y) =>
      wrap((off) => {
        ctx.fillStyle = '#fff4e6';
        ctx.fillRect(x + off - 10, y - 16, 20, 18);
        ctx.fillStyle = '#7a4a2a';
        ctx.fillRect(x + off - 3, y - 10, 6, 12);
        ctx.fillStyle = '#ff5a6e';
        ctx.beginPath();
        ctx.ellipse(x + off, y - 18, 22, 14, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        for (const [dx, dy] of [
          [-10, -24],
          [4, -28],
          [12, -21]
        ]) {
          ctx.beginPath();
          ctx.arc(x + off + dx, y + dy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    lolli(120, 120, 22, '#4fbf5a');
    lolli(170, 130, 16, '#ff9ec4');
    lolli(470, 108, 26, '#4fbf5a');
    lolli(780, 140, 20, '#ffd166');
    lolli(830, 128, 14, '#4fbf5a');
    shroom(330, 150);
    shroom(640, 168);
    shroom(960, 150);
  });

  // Forest canopy (tileable, layer 4): shaded pines and round oaks.
  canvasTexture(scene, 'bg_canopy', 1024, 400, (ctx, w, h) => {
    const wrap = (drawAt) => [-w, 0, w].forEach((off) => drawAt(off));
    const pine = (x, height) =>
      wrap((off) => {
        ctx.fillStyle = '#4a3324';
        ctx.fillRect(x + off - 6, h - height * 0.3, 12, height * 0.3);
        for (let i = 0; i < 3; i++) {
          const y = h - height * 0.26 - i * height * 0.22;
          const r = height * (0.3 - i * 0.065);
          ctx.fillStyle = '#2f8a57';
          ctx.beginPath();
          ctx.moveTo(x + off - r, y);
          ctx.lineTo(x + off, y - r * 1.3);
          ctx.lineTo(x + off + r, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#3fae6a';
          ctx.beginPath();
          ctx.moveTo(x + off - r, y);
          ctx.lineTo(x + off, y - r * 1.3);
          ctx.lineTo(x + off - r * 0.1, y);
          ctx.closePath();
          ctx.fill();
        }
      });
    const oak = (x, ht) =>
      wrap((off) => {
        ctx.fillStyle = '#5a3a24';
        ctx.fillRect(x + off - 9, h - ht * 0.45, 18, ht * 0.45);
        const blobs = [
          [0, -ht * 0.55, 54],
          [-36, -ht * 0.45, 40],
          [36, -ht * 0.45, 42],
          [0, -ht * 0.8, 38]
        ];
        ctx.fillStyle = '#2c7f4c';
        for (const [dx, dy, r] of blobs) {
          ctx.beginPath();
          ctx.arc(x + off + dx, h + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#45b06a';
        for (const [dx, dy, r] of blobs) {
          ctx.beginPath();
          ctx.arc(x + off + dx - r * 0.18, h + dy - r * 0.2, r * 0.72, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,220,0.35)';
        ctx.beginPath();
        ctx.arc(x + off - 20, h - ht * 0.82, 14, 0, Math.PI * 2);
        ctx.fill();
      });
    for (let x = 20; x < w; x += 73) pine(x, 200 + ((x * 37) % 90)); // back row
    for (let x = 40; x < w; x += 128) oak(x, 230 + ((x * 13) % 60)); // front row
  });

  // Running surface (tileable, layer 5): grass lip with flowers, layered dirt.
  canvasTexture(scene, 'ground', 256, 130, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, '#b97a45');
    g.addColorStop(0.5, '#93592f');
    g.addColorStop(1, '#5c3519');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 130);
    // strata
    ctx.fillStyle = 'rgba(255,220,170,0.18)';
    ctx.fillRect(0, 48, 256, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 86, 256, 8);
    // pebbles
    for (const [x, y, r] of [
      [30, 66, 6],
      [92, 100, 5],
      [160, 60, 7],
      [214, 108, 8],
      [126, 118, 4],
      [60, 112, 4]
    ]) {
      ctx.fillStyle = '#c9a27a';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.4, y - r * 0.35, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // grass lip
    ctx.fillStyle = '#3f9b3a';
    ctx.fillRect(0, 0, 256, 22);
    ctx.fillStyle = '#6ad04f';
    ctx.fillRect(0, 0, 256, 15);
    ctx.fillStyle = '#9cf27a';
    ctx.fillRect(0, 0, 256, 4);
    ctx.fillStyle = '#3f9b3a';
    for (let x = 0; x < 256; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 21);
      ctx.lineTo(x + 4, 31);
      ctx.lineTo(x + 8, 21);
      ctx.fill();
    }
    // tiny flowers on the lip
    for (const [x, c] of [
      [20, '#ffffff'],
      [74, '#ffd166'],
      [140, '#ff8fb1'],
      [200, '#ffffff']
    ]) {
      ctx.fillStyle = c;
      for (const [dx, dy] of [
        [-3, 0],
        [3, 0],
        [0, -3],
        [0, 3]
      ]) {
        ctx.beginPath();
        ctx.arc(x + dx, 7 + dy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb000';
      ctx.beginPath();
      ctx.arc(x, 7, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Foreground tufts that rush past in front of everything (depth cue).
  canvasTexture(scene, 'fg_grass', 1024, 90, (ctx, w, h) => {
    const tuft = (x, s, c) => {
      ctx.fillStyle = c;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 6 * s, h);
        ctx.quadraticCurveTo(x + i * 9 * s, h - 40 * s, x + i * 12 * s + 6, h - (60 - Math.abs(i) * 9) * s);
        ctx.lineTo(x + i * 6 * s + 6 * s, h);
        ctx.fill();
      }
    };
    for (const [x, s, c] of [
      [60, 1, '#2f8a3a'],
      [300, 0.8, '#3fa64a'],
      [520, 1.2, '#2f8a3a'],
      [760, 0.9, '#3fa64a'],
      [940, 1.05, '#2f8a3a']
    ]) {
      tuft(x, s, c);
    }
    for (const x of [180, 640, 860]) {
      ctx.fillStyle = '#ff6f9c';
      ctx.beginPath();
      ctx.arc(x, h - 34, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(x, h - 34, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2f8a3a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, h - 27);
      ctx.lineTo(x + 2, h);
      ctx.stroke();
    }
  });

  // Menu pedestal for the character preview
  canvasTexture(scene, 'pedestal', 260, 70, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(130, 26, 120, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff4e6';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffb3cb';
    ctx.fillRect(10, 26, 240, 24);
    ctx.beginPath();
    ctx.ellipse(130, 50, 120, 18, 0, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 26);
    ctx.lineTo(10, 50);
    ctx.moveTo(250, 26);
    ctx.lineTo(250, 50);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------------------- kart-style extras

function makeKartExtras(scene) {
  // Rainbow "?" item box (Mario Kart style), glossy and slightly translucent.
  canvasTexture(scene, 'item_box', 72, 72, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 72, 72);
    g.addColorStop(0, '#ff6b9a');
    g.addColorStop(0.25, '#ffd166');
    g.addColorStop(0.5, '#6ee7a8');
    g.addColorStop(0.75, '#59b8ff');
    g.addColorStop(1, '#b07cff');
    rr(ctx, 6, 6, 60, 60, 14);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    rr(ctx, 12, 11, 48, 16, 8);
    ctx.fill();
    ctx.font = 'bold 40px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#3d2a52';
    ctx.strokeText('?', 36, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('?', 36, 40);
  });

  // Boost pad: glowing chevrons set into the path.
  canvasTexture(scene, 'boost_pad', 170, 26, (ctx) => {
    rr(ctx, 2, 4, 166, 20, 8);
    const g = ctx.createLinearGradient(0, 0, 170, 0);
    g.addColorStop(0, '#ff7a1a');
    g.addColorStop(1, '#ffd23f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#7a3300';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let x = 14; x < 160; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x + 14, 14);
      ctx.lineTo(x, 20);
      ctx.lineTo(x + 6, 14);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Speed line streak
  canvasTexture(scene, 'fx_speedline', 160, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 160, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g;
    rr(ctx, 0, 1, 160, 4, 2);
    ctx.fill();
  });

  // Touch ripple ring
  canvasTexture(scene, 'fx_touch', 96, 96, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(48, 48, 40, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ---- item icons (48 x 48)
  canvasTexture(scene, 'item_mushroom', 56, 56, (ctx) => {
    ctx.fillStyle = '#fff4e6';
    rr(ctx, 18, 26, 20, 22, 8);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.fillStyle = '#2b1a24';
    ctx.fillRect(22, 33, 3, 7);
    ctx.fillRect(31, 33, 3, 7);
    ctx.beginPath();
    ctx.ellipse(28, 26, 24, 18, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#e8324b';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of [
      [28, 15, 6],
      [14, 22, 4],
      [42, 22, 4]
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  canvasTexture(scene, 'item_star', 56, 56, (ctx) => {
    ctx.translate(28, 29);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 25 : 11;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 26);
    g.addColorStop(0, '#fff8c4');
    g.addColorStop(1, '#ffb800');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#a06a00';
    ctx.stroke();
    ctx.fillStyle = '#2b1a24';
    ctx.fillRect(-6, -6, 3, 8);
    ctx.fillRect(3, -6, 3, 8);
  });
  canvasTexture(scene, 'item_shield', 56, 56, (ctx) => {
    const g = ctx.createRadialGradient(22, 20, 4, 28, 28, 26);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(140,210,255,0.6)');
    g.addColorStop(1, 'rgba(80,160,255,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(28, 28, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2b6fd6';
    ctx.stroke();
  });
  canvasTexture(scene, 'item_coins', 56, 56, (ctx) => {
    for (const [x, y] of [
      [20, 36],
      [36, 36],
      [28, 22]
    ]) {
      const g = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, 13);
      g.addColorStop(0, '#fff6c2');
      g.addColorStop(1, '#e09a00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#9a5f00';
      ctx.stroke();
    }
  });
}

/** Generates every non-character texture. Called once from BootScene. */
export function generateAllTextures(scene) {
  makePickups(scene);
  makeObstacles(scene);
  makeParticles(scene);
  makeBlindBox(scene);
  makeBackgrounds(scene);
  makeKartExtras(scene);
}
