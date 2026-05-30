import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';

const size = 1024;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Background: deep dark navy/indigo gradient
const bg = ctx.createLinearGradient(0, 0, size, size);
bg.addColorStop(0, '#0a0e1a');
bg.addColorStop(1, '#0d1b3e');
ctx.fillStyle = bg;

// Rounded rect (iOS icon shape) - full square, let the OS clip
ctx.fillRect(0, 0, size, size);

// Draw neural network nodes and connections
const nodes = [
  // Input layer
  { x: 200, y: 300 }, { x: 200, y: 512 }, { x: 200, y: 724 },
  // Hidden layer
  { x: 512, y: 200 }, { x: 512, y: 400 }, { x: 512, y: 624 }, { x: 512, y: 824 },
  // Output layer
  { x: 824, y: 360 }, { x: 824, y: 664 },
];

// Draw connections
ctx.strokeStyle = 'rgba(99, 179, 237, 0.18)';
ctx.lineWidth = 2;

const inputNodes = nodes.slice(0, 3);
const hiddenNodes = nodes.slice(3, 7);
const outputNodes = nodes.slice(7, 9);

for (const a of inputNodes) {
  for (const b of hiddenNodes) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
for (const a of hiddenNodes) {
  for (const b of outputNodes) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

// Draw glowing connections (accent)
const accentPairs = [
  [inputNodes[1], hiddenNodes[1]],
  [inputNodes[1], hiddenNodes[2]],
  [hiddenNodes[1], outputNodes[0]],
  [hiddenNodes[2], outputNodes[1]],
];

for (const [a, b] of accentPairs) {
  const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  grad.addColorStop(0, 'rgba(99, 179, 237, 0.7)');
  grad.addColorStop(1, 'rgba(167, 139, 250, 0.7)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

// Draw nodes
function drawNode(x, y, radius, color, glowColor) {
  // Glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  glow.addColorStop(0, glowColor.replace('1)', '0.4)'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  ctx.fill();

  // Node
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Inner highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

for (const n of inputNodes) {
  drawNode(n.x, n.y, 22, '#63b3ed', 'rgba(99,179,237,1)');
}
for (const n of hiddenNodes) {
  drawNode(n.x, n.y, 26, '#a78bfa', 'rgba(167,139,250,1)');
}
for (const n of outputNodes) {
  drawNode(n.x, n.y, 30, '#f0abfc', 'rgba(240,171,252,1)');
}

// "N" lettermark overlay — subtle, large, centered
ctx.font = 'bold 320px -apple-system, BlinkMacSystemFont, sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = 'rgba(255,255,255,0.04)';
ctx.fillText('N', size / 2, size / 2);

// App name "NA" monogram centered
ctx.font = 'bold 110px -apple-system, BlinkMacSystemFont, sans-serif';
ctx.fillStyle = 'rgba(255,255,255,0.9)';
ctx.fillText('NA', size / 2, size / 2 + 12);

// Subtle bottom label
ctx.font = '38px -apple-system, BlinkMacSystemFont, sans-serif';
ctx.fillStyle = 'rgba(167,139,250,0.6)';
ctx.fillText('NativeAgent', size / 2, size * 0.72);

// Save
mkdirSync('./assets/images', { recursive: true });
const buf = canvas.toBuffer('image/png');
writeFileSync('./assets/images/icon.png', buf);
writeFileSync('./assets/images/adaptive-icon.png', buf);

// Splash screen (same but bigger padding feel)
const splashCanvas = createCanvas(1284, 2778);
const sCtx = splashCanvas.getContext('2d');
const sbg = sCtx.createLinearGradient(0, 0, 1284, 2778);
sbg.addColorStop(0, '#0a0e1a');
sbg.addColorStop(1, '#0d1b3e');
sCtx.fillStyle = sbg;
sCtx.fillRect(0, 0, 1284, 2778);

// Draw center icon scaled
const scale = 0.55;
const ox = (1284 - size * scale) / 2;
const oy = (2778 - size * scale) / 2;
sCtx.drawImage(canvas, ox, oy, size * scale, size * scale);

writeFileSync('./assets/images/splash-icon.png', splashCanvas.toBuffer('image/png'));

console.log('Icons generated: assets/images/icon.png, adaptive-icon.png, splash-icon.png');
