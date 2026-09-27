/* ============================================================
   ParticleSystem - light-weight pooled particles for
   deflect sparks, coin pickups, explosions, trails.
   ============================================================ */
class Particle {
  constructor() { this.reset(); }
  reset() {
    this.active = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.size = 4; this.color = '#fff';
    this.gravity = 0; this.friction = 1; this.shape = 'circle';
    this.rotation = 0; this.vrot = 0; this.fade = true;
  }
}

class ParticleSystem {
  constructor(maxParticles = 400) {
    this.pool = Array.from({ length: maxParticles }, () => new Particle());
  }

  _spawn(opts) {
    const p = this.pool.find(p => !p.active);
    if (!p) return;
    p.active = true;
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.life = 0; p.maxLife = opts.maxLife || 0.6;
    p.size = opts.size || 4;
    p.color = opts.color || '#ffffff';
    p.gravity = opts.gravity != null ? opts.gravity : 250;
    p.friction = opts.friction != null ? opts.friction : 0.98;
    p.shape = opts.shape || 'circle';
    p.rotation = opts.rotation || 0;
    p.vrot = opts.vrot || 0;
    p.fade = opts.fade != null ? opts.fade : true;
  }

  burst(x, y, { count = 14, color = '#ffffff', speed = 220, size = 4, spread = Math.PI * 2, baseAngle = 0, gravity = 250, maxLife = 0.6, shape = 'circle' } = {}) {
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this._spawn({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color, size: size * (0.6 + Math.random() * 0.8),
        gravity, maxLife: maxLife * (0.7 + Math.random() * 0.6),
        shape, rotation: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 8
      });
    }
  }

  confetti(x, y, colors, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const spd = 180 + Math.random() * 220;
      this._spawn({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: colors[i % colors.length],
        size: 4 + Math.random() * 4,
        gravity: 320, friction: 0.985,
        maxLife: 1 + Math.random() * 0.6,
        shape: 'rect', rotation: Math.random() * 7, vrot: (Math.random() - 0.5) * 10
      });
    }
  }

  trail(x, y, color, size = 3) {
    this._spawn({ x, y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, color, size, gravity: 0, friction: 0.9, maxLife: 0.35, shape: 'circle' });
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.vx *= p.friction; p.vy *= p.friction;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rotation += p.vrot * dt;
    }
  }

  render(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      const alpha = p.fade ? (1 - t) : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 - t * 0.3), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else if (p.shape === 'star') {
        drawStarPath(ctx, 0, 0, p.size, p.size * 0.45, 4);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  clear() { for (const p of this.pool) p.active = false; }
}

function drawStarPath(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

window.ParticleSystem = ParticleSystem;
window.drawStarPath = drawStarPath;
