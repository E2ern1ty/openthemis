import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'docs', 'screenshots');

// 设计参数
const PAD = 56;          // 背景留白
const TB = 44;           // 浏览器标题栏高度
const R = 16;            // 圆角半径
const SHADOW_BLUR = 48;
const SHADOW_DY = 26;

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 浏览器标题栏 SVG（顶部圆角 + 三个圆点 + URL 药丸）
function titleBarSvg(w, url) {
  return Buffer.from(`
<svg width="${w}" height="${TB}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="topclip"><path d="M0 ${R} A ${R} ${R} 0 0 1 ${R} 0 H ${w - R} A ${R} ${R} 0 0 1 ${w} ${R} V ${TB} H 0 Z"/></clipPath>
  </defs>
  <g clip-path="url(#topclip)">
    <rect x="0" y="0" width="${w}" height="${TB}" fill="#f1f3f5"/>
    <rect x="0" y="${TB - 1}" width="${w}" height="1" fill="#e2e5e9"/>
    <circle cx="24" cy="${TB / 2}" r="6" fill="#ff5f57"/>
    <circle cx="46" cy="${TB / 2}" r="6" fill="#febc2e"/>
    <circle cx="68" cy="${TB / 2}" r="6" fill="#28c840"/>
    <rect x="${w / 2 - 170}" y="${TB / 2 - 11}" rx="11" ry="11" width="340" height="22" fill="#ffffff" stroke="#e2e5e9" stroke-width="1"/>
    <text x="${w / 2}" y="${TB / 2 + 4}" font-family="-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" fill="#9aa1ab" text-anchor="middle">${esc(url)}</text>
  </g>
</svg>`);
}

// 整窗（标题栏+截图）的圆角遮罩
function roundedMaskSvg(w, h) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${w}" height="${h}" rx="${R}" ry="${R}" fill="#fff"/></svg>`,
  );
}

// 背景渐变 + 阴影（阴影用一块圆角深色 + 高斯模糊）
function backgroundSvg(cw, ch, winW, winH) {
  const sx = PAD, sy = PAD + SHADOW_DY;
  return Buffer.from(`
<svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${cw}" y2="${ch}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#eef2f7"/>
      <stop offset="0.5" stop-color="#eaeef6"/>
      <stop offset="1" stop-color="#e7ecf6"/>
    </linearGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${SHADOW_BLUR / 2}"/>
    </filter>
  </defs>
  <rect width="${cw}" height="${ch}" fill="url(#bg)"/>
  <rect x="${sx}" y="${sy}" width="${winW}" height="${winH}" rx="${R}" ry="${R}" fill="rgba(30,41,59,0.22)" filter="url(#sh)"/>
</svg>`);
}

async function beautify(file, url, maxHeight) {
  const src = path.join(DIR, file);
  let img = sharp(src);
  const meta = await img.metadata();
  let sw = meta.width, sh = meta.height;

  // 过高的图裁剪到 maxHeight（保留顶部主要内容）
  if (maxHeight && sh > maxHeight) {
    img = sharp(src).extract({ left: 0, top: 0, width: sw, height: maxHeight });
    sh = maxHeight;
  }
  const shotBuf = await img.png().toBuffer();

  const winW = sw;
  const winH = TB + sh;

  // 1) 拼接标题栏 + 截图
  const windowFlat = await sharp({
    create: { width: winW, height: winH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: titleBarSvg(winW, url), top: 0, left: 0 },
      { input: shotBuf, top: TB, left: 0 },
    ])
    .png()
    .toBuffer();

  // 2) 整窗圆角
  const windowRounded = await sharp(windowFlat)
    .composite([{ input: roundedMaskSvg(winW, winH), blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 3) 背景（渐变 + 阴影）+ 合成窗口
  const cw = winW + PAD * 2;
  const ch = winH + PAD * 2;
  const out = path.join(DIR, file);
  await sharp(backgroundSvg(cw, ch, winW, winH))
    .composite([{ input: windowRounded, top: PAD, left: PAD }])
    .png()
    .toFile(out + '.tmp');

  fs.renameSync(out + '.tmp', out);
  const m2 = await sharp(out).metadata();
  console.log(`✓ ${file} -> ${m2.width}x${m2.height}`);
}

const TASKS = [
  { file: '01-home.png', url: 'openthemis.app', maxHeight: 1500 },
  { file: '02-dashboard.png', url: 'openthemis.app/dashboard', maxHeight: 1520 },
  { file: '03-radar.png', url: 'openthemis.app/radar', maxHeight: null },
  { file: '04-settings.png', url: 'openthemis.app/settings', maxHeight: null },
];

for (const t of TASKS) {
  await beautify(t.file, t.url, t.maxHeight);
}
console.log('done');
