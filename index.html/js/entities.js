/* ============================================================
   Entities: Balloon, Shield, Obstacle, PowerUp, Coin
   ============================================================ */

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/* ---------------- Balloon ---------------- */
class Balloon {
  constructor(x, y, skin) {
    this.x = x; this.y = y;
    this.baseX = x; this.baseY = y;
    this.targetX = x; this.targetY = y;
    this.radius = 27;
    this.skin = skin;
    this.bob = 0;
    this.tilt = 0;
    this.squash = 1;
    this.invuln = 0;
    this.hitFlash = 0;
    this.followSpeed = 13; // how eagerly the balloon chases the drag target
  }

  // Called by the game whenever the pointer/finger moves; the balloon eases
  // toward this point rather than snapping instantly, so it still feels
  // light and "floaty" while being fully free to go anywhere on screen.
  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  update(dt) {
    this.bob += dt;

    const prevBaseX = this.baseX;
    const followT = 1 - Math.exp(-this.followSpeed * dt); // frame-rate independent ease
    this.baseX += (this.targetX - this.baseX) * followT;
    this.baseY += (this.targetY - this.baseY) * followT;

    // gentle idle float layered on top of the controlled position
    this.x = this.baseX;
    this.y = this.baseY + Math.sin(this.bob * 2.1) * 4;

    // lean in the direction of travel for a bit of juice
    const vx = (this.baseX - prevBaseX) / Math.max(dt, 1 / 240);
    const targetTilt = Math.max(-0.45, Math.min(0.45, -vx * 0.012));
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 6);

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
  }

  render(ctx, skinDef) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    const r = this.radius;

    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4;

    // string
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, r * 1.05);
    ctx.quadraticCurveTo(6, r * 1.6, 0, r * 2.1);
    ctx.stroke();

    // knot
    ctx.fillStyle = skinDef.colors[skinDef.colors.length - 1];
    ctx.beginPath();
    ctx.moveTo(-4, r * 0.95); ctx.lineTo(4, r * 0.95); ctx.lineTo(0, r * 1.1);
    ctx.fill();

    // body gradient
    let grad;
    if (skinDef.special === 'rainbow') {
      grad = ctx.createLinearGradient(-r, -r, r, r);
      skinDef.colors.forEach((c, i) => grad.addColorStop(i / (skinDef.colors.length - 1), c));
    } else {
      grad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.3);
      grad.addColorStop(0, lighten(skinDef.colors[0], 25));
      grad.addColorStop(0.55, skinDef.colors[0]);
      grad.addColorStop(1, skinDef.colors[1] || skinDef.colors[0]);
    }

    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.18, 0, 0, TWO_PI);
    ctx.fillStyle = this.hitFlash > 0 ? '#ff5b5b' : grad;
    ctx.fill();

    if (skinDef.special === 'gold') {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
    }

    // highlight
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.4, r * 0.32, r * 0.44, -0.4, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function lighten(hex, pct) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + Math.round(255 * pct / 100);
  let g = ((num >> 8) & 0xff) + Math.round(255 * pct / 100);
  let b = (num & 0xff) + Math.round(255 * pct / 100);
  r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
  return `rgb(${r},${g},${b})`;
}

/* ---------------- Shield ---------------- */
class Shield {
  constructor() {
    this.angle = -Math.PI / 2;
    this.targetAngle = -Math.PI / 2;
    this.baseArc = 1.05; // ~60deg
    this.arc = this.baseArc;
    this.baseRadius = 54;
    this.radius = this.baseRadius;
    this.thickness = 20;
    this.boostTimer = 0;
    this.glow = 0;
    this.pulseHits = [];
  }

  setTargetAngle(a) { this.targetAngle = a; }

  activateBoost(duration) {
    this.boostTimer = duration;
  }

  update(dt) {
    this.angle += angleDiff(this.targetAngle, this.angle) * Math.min(1, dt * 14);
    if (this.boostTimer > 0) {
      this.boostTimer = Math.max(0, this.boostTimer - dt);
    }
    const boosted = this.boostTimer > 0;
    const targetArc = boosted ? this.baseArc * 1.55 : this.baseArc;
    const targetRadius = boosted ? this.baseRadius * 1.08 : this.baseRadius;
    this.arc += (targetArc - this.arc) * Math.min(1, dt * 6);
    this.radius += (targetRadius - this.radius) * Math.min(1, dt * 6);
    this.glow = boosted ? 0.6 + 0.3 * Math.sin(performance.now() / 90) : 0;
    for (let i = this.pulseHits.length - 1; i >= 0; i--) {
      this.pulseHits[i].t -= dt;
      if (this.pulseHits[i].t <= 0) this.pulseHits.splice(i, 1);
    }
  }

  addHitPulse(angle) { this.pulseHits.push({ angle, t: 0.3 }); }

  isAngleCovered(targetAngle) {
    return Math.abs(angleDiff(targetAngle, this.angle)) <= this.arc / 2;
  }

  render(ctx, bx, by, colors) {
    ctx.save();
    ctx.translate(bx, by);
    const start = this.angle - this.arc / 2;
    const end = this.angle + this.arc / 2;

    const grad = ctx.createLinearGradient(
      Math.cos(this.angle) * this.radius, Math.sin(this.angle) * this.radius,
      Math.cos(this.angle) * (this.radius - this.thickness), Math.sin(this.angle) * (this.radius - this.thickness)
    );
    grad.addColorStop(0, colors[1] || colors[0]);
    grad.addColorStop(1, colors[0]);

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, start, end);
    ctx.arc(0, 0, this.radius - this.thickness, end, start, true);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.88;
    ctx.shadowColor = colors[1] || colors[0];
    ctx.shadowBlur = 14 + this.glow * 22;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, start, end);
    ctx.stroke();

    for (const hit of this.pulseHits) {
      const t = 1 - hit.t / 0.3;
      ctx.save();
      ctx.rotate(hit.angle);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.radius - this.thickness / 2, 0, 6 + t * 14, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

/* ---------------- Obstacle ---------------- */
let obstacleUid = 1;
class Obstacle {
  constructor(type, worldY, x, opts = {}) {
    this.id = obstacleUid++;
    this.type = type;
    this.worldY = worldY;
    this.x = x;
    this.vx = opts.vx || 0;
    this.rotation = Math.random() * TWO_PI;
    this.vrot = opts.vrot != null ? opts.vrot : (Math.random() - 0.5) * 2.4;
    this.size = opts.size || 24;
    this.deflected = false;
    this.alive = true;
    this.color = opts.color || '#ff6b9d';
    this.color2 = opts.color2 || '#ff4785';
    this.bladeCount = opts.bladeCount || 3;
    this.screenX = x; this.screenY = -9999;
    this.deflectFlashT = 0;
  }

  get collisionRadius() {
    switch (this.type) {
      case 'circle': return this.size * 0.5;
      case 'block': return this.size * 0.62;
      case 'triangle': return this.size * 0.58;
      case 'bar': return this.size * 0.22;
      case 'spinner': return this.size * 0.95;
      default: return this.size * 0.5;
    }
  }

  updateScreenPos(balloonScreenY, worldDistance, canvasWidth) {
    this.screenY = balloonScreenY - (this.worldY - worldDistance);
    this.x += this.vx * (1 / 60);
    if (this.x < 30) { this.x = 30; this.vx *= -1; }
    if (this.x > canvasWidth - 30) { this.x = canvasWidth - 30; this.vx *= -1; }
    this.screenX = this.x;
  }

  update(dt) {
    this.rotation += this.vrot * dt;
    if (this.deflectFlashT > 0) this.deflectFlashT -= dt;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.screenX, this.screenY);
    ctx.rotate(this.rotation);
    const flashing = this.deflectFlashT > 0;
    const c1 = flashing ? '#ffffff' : this.color;
    const c2 = flashing ? '#ffffff' : this.color2;

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;

    if (this.type === 'circle') {
      const g = ctx.createRadialGradient(-this.size * 0.15, -this.size * 0.15, 2, 0, 0, this.size * 0.5);
      g.addColorStop(0, lighten(c1, 20)); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, this.size * 0.5, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(i * Math.PI / 2) * this.size * 0.5, Math.sin(i * Math.PI / 2) * this.size * 0.5);
        ctx.stroke();
      }
    } else if (this.type === 'block') {
      const g = ctx.createLinearGradient(-this.size / 2, -this.size / 2, this.size / 2, this.size / 2);
      g.addColorStop(0, lighten(c1, 15)); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      roundRect(ctx, -this.size / 2, -this.size / 2, this.size, this.size, 6);
      ctx.fill();
    } else if (this.type === 'triangle') {
      const g = ctx.createLinearGradient(0, -this.size / 2, 0, this.size / 2);
      g.addColorStop(0, lighten(c1, 15)); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      const r = this.size * 0.58;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * (TWO_PI / 3);
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    } else if (this.type === 'bar') {
      const g = ctx.createLinearGradient(-this.size / 2, 0, this.size / 2, 0);
      g.addColorStop(0, c2); g.addColorStop(0.5, lighten(c1, 15)); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      roundRect(ctx, -this.size / 2, -this.size * 0.11, this.size, this.size * 0.22, 5);
      ctx.fill();
    } else if (this.type === 'spinner') {
      for (let i = 0; i < this.bladeCount; i++) {
        ctx.save();
        ctx.rotate((TWO_PI / this.bladeCount) * i);
        const g = ctx.createLinearGradient(0, 0, this.size * 0.9, 0);
        g.addColorStop(0, c2); g.addColorStop(1, lighten(c1, 10));
        ctx.fillStyle = g;
        roundRect(ctx, 0, -this.size * 0.1, this.size * 0.9, this.size * 0.2, 4);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(0, 0, this.size * 0.16, 0, TWO_PI); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- PowerUp ---------------- */
const POWERUP_DEFS = {
  shield_boost: { icon: '🛡️', color: '#4fc3f7', label: 'โล่ขยาย', duration: 6 },
  slow_motion: { icon: '🐢', color: '#5be0c3', label: 'ชะลอเวลา', duration: 5 },
  push_power: { icon: '💥', color: '#ff9f43', label: 'พลังผลัก', duration: 0 },
  extra_life: { icon: '❤️', color: '#ff6b9d', label: 'ชีวิตเสริม', duration: 0 },
};

class PowerUp {
  constructor(kind, worldY, x) {
    this.kind = kind;
    this.worldY = worldY;
    this.x = x;
    this.screenX = x; this.screenY = -9999;
    this.alive = true;
    this.bob = Math.random() * TWO_PI;
    this.size = 30;
  }
  updateScreenPos(balloonScreenY, worldDistance) {
    this.screenY = balloonScreenY - (this.worldY - worldDistance);
    this.screenX = this.x + Math.sin(this.bob) * 14;
  }
  update(dt) { this.bob += dt * 2; }
  render(ctx) {
    const def = POWERUP_DEFS[this.kind];
    ctx.save();
    ctx.translate(this.screenX, this.screenY);
    ctx.shadowColor = def.color; ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, this.size / 2, 0, TWO_PI);
    const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, this.size / 2);
    g.addColorStop(0, lighten(def.color, 25)); g.addColorStop(1, def.color);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, 0, 1);
    ctx.restore();
  }
}

/* ---------------- Coin ---------------- */
class Coin {
  constructor(worldY, x) {
    this.worldY = worldY;
    this.x = x;
    this.screenX = x; this.screenY = -9999;
    this.alive = true;
    this.spin = Math.random() * TWO_PI;
    this.size = 18;
  }
  updateScreenPos(balloonScreenY, worldDistance) {
    this.screenY = balloonScreenY - (this.worldY - worldDistance);
    this.screenX = this.x;
  }
  update(dt) { this.spin += dt * 4; }
  render(ctx) {
    ctx.save();
    ctx.translate(this.screenX, this.screenY);
    const sx = Math.max(0.15, Math.abs(Math.cos(this.spin)));
    ctx.scale(sx, 1);
    ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 10;
    const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, this.size / 2);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffab00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, this.size / 2, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

window.Balloon = Balloon;
window.Shield = Shield;
window.Obstacle = Obstacle;
window.PowerUp = PowerUp;
window.Coin = Coin;
window.POWERUP_DEFS = POWERUP_DEFS;
window.angleDiff = angleDiff;
window.lighten = lighten;
window.roundRect = roundRect;
