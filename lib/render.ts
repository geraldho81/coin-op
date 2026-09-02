import type { Enemy, Game, Pickup } from "./engine";
import { FB_H, FB_W, PLANE } from "./engine";
import { castWall } from "./map";

function wallRgb(type: number): [number, number, number] {
  if (type === 2) return [184, 255, 42];
  if (type === 3) return [255, 43, 214];
  if (type === 4) return [220, 170, 36];
  return [78, 86, 72];
}

function enemyPalette(kind: Enemy["kind"]): {
  body: [number, number, number];
  visor: [number, number, number];
  scale: number;
} {
  if (kind === "runner") {
    return { body: [255, 43, 214], visor: [184, 255, 42], scale: 0.72 };
  }
  if (kind === "tank") {
    return { body: [210, 220, 70], visor: [255, 43, 214], scale: 1.25 };
  }
  return { body: [90, 170, 40], visor: [255, 43, 214], scale: 1 };
}

function pickupColor(kind: Pickup["kind"]): [number, number, number] {
  if (kind === "health") return [255, 50, 70];
  if (kind === "credit") return [255, 210, 40];
  return [80, 180, 255];
}

function setPx(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
) {
  if (x < 0 || y < 0 || x >= FB_W || y >= FB_H) return;
  const i = (y * FB_W + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
}

export function renderWorld(g: Game, img: ImageData) {
  const data = img.data;
  const half = (FB_H / 2) | 0;
  for (let y = 0; y < FB_H; y++) {
    const ceiling = y < half;
    const t = ceiling ? y / half : (y - half) / half;
    let r: number;
    let gb: number;
    let b: number;
    if (ceiling) {
      r = 10 + t * 28;
      gb = 8 + t * 6;
      b = 12 + t * 36;
    } else {
      r = 8 + t * 16;
      gb = 14 + t * 32;
      b = 8 + t * 8;
    }
    for (let x = 0; x < FB_W; x++) {
      const n = ((x * 13 + y * 7 + ((g.time * 20) | 0)) & 7) === 0 ? 6 : 0;
      const i = (y * FB_W + x) * 4;
      data[i] = r + n;
      data[i + 1] = gb + n;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  const dirX = Math.cos(g.pa);
  const dirY = Math.sin(g.pa);
  const planeX = -dirY * PLANE;
  const planeY = dirX * PLANE;

  for (let x = 0; x < FB_W; x++) {
    const camX = (2 * x) / FB_W - 1;
    const rdx = dirX + planeX * camX;
    const rdy = dirY + planeY * camX;
    const hit = castWall(g.px, g.py, rdx, rdy);
    g.zbuf[x] = hit.dist;
    const lineH = Math.min(FB_H * 3, (FB_H / hit.dist) | 0);
    const y0 = ((FB_H - lineH) / 2) | 0;
    const y1 = y0 + lineH;
    const fog = Math.max(0.07, 1 / (1 + hit.dist * 0.17));
    const sideDim = hit.side ? 0.62 : 1;
    const [wr, wg, wb] = wallRgb(hit.type);
    const u = hit.texX;
    for (let y = Math.max(0, y0); y < Math.min(FB_H, y1); y++) {
      const v = (y - y0) / lineH;
      const mortar = u * 8 - ((u * 8) | 0) < 0.09 || v * 10 - ((v * 10) | 0) < 0.11;
      let r: number;
      let gb: number;
      let b: number;
      if (mortar) {
        r = 10 * fog;
        gb = 12 * fog;
        b = 10 * fog;
      } else {
        const pulse = (((u * 8) | 0) + ((v * 10) | 0)) & 1 ? 1 : 0.82;
        r = wr * fog * sideDim * pulse;
        gb = wg * fog * sideDim * pulse;
        b = wb * fog * sideDim * pulse;
        if (hit.type === 3 && v > 0.42 && v < 0.5) {
          r = 255 * fog;
          gb = 43 * fog;
          b = 214 * fog;
        }
        if (hit.type === 2 && ((u * 16) | 0) % 4 === 0) {
          r = Math.min(255, r + 40);
          gb = Math.min(255, gb + 40);
        }
      }
      setPx(data, x, y, r, gb, b);
    }
  }

  type Sprite = {
    x: number;
    y: number;
    dist: number;
    enemy?: Enemy;
    pickup?: Pickup;
    particle?: { r: number; g: number; b: number; life: number };
  };
  const sprites: Sprite[] = [];
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const dist = (e.x - g.px) * dirX + (e.y - g.py) * dirY;
    sprites.push({ x: e.x, y: e.y, dist, enemy: e });
  }
  for (const p of g.pickups) {
    sprites.push({
      x: p.x,
      y: p.y,
      dist: (p.x - g.px) * dirX + (p.y - g.py) * dirY,
      pickup: p,
    });
  }
  for (const p of g.particles) {
    sprites.push({
      x: p.x,
      y: p.y,
      dist: (p.x - g.px) * dirX + (p.y - g.py) * dirY,
      particle: p,
    });
  }
  sprites.sort((a, b) => b.dist - a.dist);

  const invDet = 1 / (planeX * dirY - dirX * planeY);

  for (const s of sprites) {
    const sprX = s.x - g.px;
    const sprY = s.y - g.py;
    const transX = invDet * (dirY * sprX - dirX * sprY);
    const transY = invDet * (-planeY * sprX + planeX * sprY);
    if (transY <= 0.08) continue;
    const screenX = ((FB_W / 2) * (1 + transX / transY)) | 0;
    if (s.particle) {
      const sz = Math.max(1, (4 / transY) | 0);
      const fade = Math.max(0.2, s.particle.life * 3);
      const x0 = screenX - sz;
      const x1 = screenX + sz;
      const y0 = (FB_H / 2) | 0;
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= FB_W) continue;
        if (transY >= g.zbuf[x]) continue;
        for (let y = y0 - sz; y < y0 + sz; y++) {
          setPx(
            data,
            x,
            y,
            s.particle.r * fade,
            s.particle.g * fade,
            s.particle.b * fade,
          );
        }
      }
      continue;
    }
    if (s.pickup) {
      const bob = Math.sin(s.pickup.t * 5) * 6;
      const w = Math.max(4, ((FB_H * 0.18) / transY) | 0);
      const h = w;
      const spin = 0.55 + 0.45 * Math.abs(Math.sin(s.pickup.t * 3));
      const dw = Math.max(2, (w * spin) | 0);
      const x0 = screenX - (dw / 2) | 0;
      const x1 = screenX + (dw / 2) | 0;
      const y0 = ((FB_H - h) / 2 + bob) | 0;
      const y1 = y0 + h;
      const [cr, cg, cb] = pickupColor(s.pickup.kind);
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= FB_W) continue;
        if (transY >= g.zbuf[x]) continue;
        const u = (x - x0) / Math.max(1, x1 - x0);
        for (let y = Math.max(0, y0); y < Math.min(FB_H, y1); y++) {
          const v = (y - y0) / Math.max(1, y1 - y0);
          const edge = u < 0.12 || u > 0.88 || v < 0.12 || v > 0.88;
          if (s.pickup.kind === "health" && !(Math.abs(u - 0.5) < 0.18 || Math.abs(v - 0.5) < 0.18)) {
            if (!edge) continue;
          }
          if (s.pickup.kind === "credit") {
            const dx = u - 0.5;
            const dy = v - 0.5;
            if (dx * dx + dy * dy * 0.7 > 0.22) continue;
          }
          setPx(data, x, y, edge ? cr * 0.4 : cr, edge ? cg * 0.4 : cg, edge ? cb * 0.4 : cb);
        }
      }
      continue;
    }
    if (!s.enemy) continue;
    const pal = enemyPalette(s.enemy.kind);
    const h = Math.max(8, ((FB_H * pal.scale) / transY) | 0);
    const w = Math.max(4, (h * (s.enemy.kind === "runner" ? 0.42 : 0.58)) | 0);
    const x0 = screenX - (w / 2) | 0;
    const x1 = screenX + (w / 2) | 0;
    const y0 = ((FB_H - h) / 2) | 0;
    const y1 = y0 + h;
    const flash = s.enemy.hitFlash > 0;
    for (let x = x0; x < x1; x++) {
      if (x < 0 || x >= FB_W) continue;
      if (transY >= g.zbuf[x]) continue;
      const u = (x - x0) / Math.max(1, x1 - x0);
      for (let y = Math.max(0, y0); y < Math.min(FB_H, y1); y++) {
        const v = (y - y0) / Math.max(1, y1 - y0);
        if (u < 0.08 || u > 0.92) continue;
        let r: number;
        let gb: number;
        let b: number;
        if (v < 0.18) {
          r = pal.body[0] * 0.35;
          gb = pal.body[1] * 0.35;
          b = pal.body[2] * 0.35;
        } else if (v < 0.32) {
          r = pal.visor[0];
          gb = pal.visor[1];
          b = pal.visor[2];
        } else if (v < 0.78) {
          const stripe = s.enemy.kind === "tank" && ((v * 12) | 0) % 2 === 0;
          r = pal.body[0] * (stripe ? 0.6 : 1);
          gb = pal.body[1] * (stripe ? 0.6 : 1);
          b = pal.body[2] * (stripe ? 0.6 : 1);
        } else {
          r = pal.body[0] * 0.45;
          gb = pal.body[1] * 0.45;
          b = pal.body[2] * 0.45;
        }
        if (flash) {
          r = 255;
          gb = 255;
          b = 220;
        }
        const fog = Math.max(0.15, 1 / (1 + transY * 0.12));
        setPx(data, x, y, r * fog, gb * fog, b * fog);
      }
    }
    const hpW = Math.max(2, (w * (s.enemy.hp / s.enemy.maxHp)) | 0);
    const barY = Math.max(0, y0 - 3);
    for (let x = x0; x < x0 + hpW; x++) {
      if (x < 0 || x >= FB_W) continue;
      if (transY >= g.zbuf[x]) continue;
      setPx(data, x, barY, 184, 255, 42);
    }
  }
}

export function drawGun(ctx: CanvasRenderingContext2D, g: Game) {
  const kick = g.weaponKick * 22;
  const gx = FB_W * 0.62;
  const gy = FB_H + 4 + kick - 6;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.scale(1 - g.weaponKick * 0.08, 1 - g.weaponKick * 0.08);
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  };
  box(-6, -52, 14, 38, "#2a2c28");
  box(-4, -70, 8, 22, "#6a6e64");
  box(-3, -78, 5, 10, "#111");
  box(6, -48, 8, 14, "#b8ff2a");
  box(-18, -28, 16, 22, "#3a2018");
  box(-10, -18, 10, 16, "#1a1a16");
  box(-22, -8, 28, 10, "#ff2bd6");
  if (g.muzzle > 0) {
    box(-8, -92, 18, 16, "#fff6a0");
    box(-14, -86, 30, 8, "#b8ff2a");
  }
  ctx.restore();
  if (g.mode === "play") {
    ctx.fillStyle = "#b8ff2a";
    const cx = (FB_W / 2) | 0;
    const cy = (FB_H / 2) | 0;
    ctx.fillRect(cx, cy - 3, 1, 7);
    ctx.fillRect(cx - 3, cy, 7, 1);
  }
}
