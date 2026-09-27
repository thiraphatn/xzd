/* ============================================================
   Game - the core engine: run loop, spawning, collisions,
   scoring, power-up effects, rendering.
   ============================================================ */
class Game {
  constructor(canvas, gameData, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gd = gameData;
    this.cb = callbacks || {};
    this.particles = new ParticleSystem(500);
    this.scene = null;
    this.state = 'idle'; // idle | playing | paused | gameover
    this.pointerActive = false;
    this.shieldAutoAngle = -Math.PI / 2;
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this.resize();
    this._bindInput();
    this._raf = null;
    this._lastT = 0;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w; this.height = h;
    if (!this.scene) this.scene = new SceneRenderer(w, h);
    else this.scene.resize(w, h);
    this.balloonHomeX = w / 2;
    this.balloonHomeY = h * 0.6;
    if (this.balloon) {
      this.balloon.x = this.balloon.baseX = this.balloonHomeX;
      this.balloon.y = this.balloon.baseY = this.balloonHomeY;
      this.balloon.targetX = this.balloonHomeX;
      this.balloon.targetY = this.balloonHomeY;
    }
  }

  // Free-drag movement: wherever the finger/mouse goes on screen, that's
  // where the balloon wants to be. The shield no longer needs manual
  // aiming — see _updateShieldAutoAim() — so the whole screen is now just
  // one big steering surface for the balloon.
  _bindInput() {
    const clampToCanvas = (x, y) => {
      const r = this.balloon ? this.balloon.radius : 27;
      const margin = r + 8;
      return {
        x: Math.max(margin, Math.min(this.width - margin, x)),
        y: Math.max(margin, Math.min(this.height - margin, y)),
      };
    };
    const getPosFromEvent = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      return clampToCanvas(clientX - rect.left, clientY - rect.top);
    };
    const onDown = (x, y) => {
      if (this.state !== 'playing') return;
      this.pointerActive = true;
      const p = getPosFromEvent(x, y);
      if (this.balloon) this.balloon.setTarget(p.x, p.y);
      if (this.cb.onFirstInput) this.cb.onFirstInput();
    };
    const onMove = (x, y) => {
      if (!this.pointerActive || this.state !== 'playing') return;
      const p = getPosFromEvent(x, y);
      if (this.balloon) this.balloon.setTarget(p.x, p.y);
    };
    const onUp = () => { this.pointerActive = false; };

    this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); onDown(e.clientX, e.clientY); });
    this.canvas.addEventListener('pointermove', e => { e.preventDefault(); onMove(e.clientX, e.clientY); });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  start(difficultyId) {
    const diff = DIFFICULTIES.find(d => d.id === difficultyId) || DIFFICULTIES[1];
    this.difficulty = diff;
    this.worldDistance = 0;
    this.elapsed = 0;
    this.score = 0;
    this.coins = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTimer = 0;
    this.deflectCount = 0;
    this.powerupsUsed = 0;
    this.extraLives = 0;
    this.gameOver = false;
    this.screenShake = 0;

    this.obstacles = [];
    this.powerups = [];
    this.coinItems = [];
    this.activePowerups = {}; // kind -> remaining time (for display)

    this.obstacleTimer = 1.1;
    this.coinTimer = 1.6;
    this.powerupTimer = 9;

    const balloonSkin = BALLOON_SKINS.find(b => b.id === this.gd.data.selectedBalloon) || BALLOON_SKINS[0];
    const shieldSkin = SHIELD_SKINS.find(s => s.id === this.gd.data.selectedShield) || SHIELD_SKINS[0];
    this.balloonSkin = balloonSkin;
    this.shieldSkin = shieldSkin;

    this.balloon = new Balloon(this.balloonHomeX, this.balloonHomeY, balloonSkin);
    this.shield = new Shield();
    this.particles.clear();
    this.pointerActive = false;

    this.state = 'playing';
    this._lastT = performance.now();
    if (this._raf) cancelAnimationFrame(this._raf);
    this._loop(this._lastT);
  }

  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this._lastT = performance.now(); } }

  stop() {
    this.state = 'idle';
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _loop(t) {
    this._raf = requestAnimationFrame(ts => this._loop(ts));
    let dt = (t - this._lastT) / 1000;
    this._lastT = t;
    dt = Math.min(dt, 0.05);

    if (this.state === 'playing') this._update(dt);
    this._render(dt);
  }

  endlessScale() {
    if (!this.difficulty.endless) return 1;
    return 1 + Math.min(this.elapsed / 45, 2.6);
  }

  _update(dt) {
    this.elapsed += dt;
    const scale = this.endlessScale();
    const slowActive = this.activePowerups.slow_motion > 0;
    const worldTimeScale = slowActive ? 0.45 : 1;

    const riseSpeed = this.difficulty.riseSpeed * scale * worldTimeScale;
    this.worldDistance += riseSpeed * dt;

    this.balloon.update(dt);
    this._updateShieldAutoAim();
    this.shield.update(dt);
    this.scene.update(dt);

    // power-up timers
    for (const k in this.activePowerups) {
      if (this.activePowerups[k] > 0) {
        this.activePowerups[k] = Math.max(0, this.activePowerups[k] - dt);
      }
    }

    // combo timer
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // spawn timers
    const speedMul = this.difficulty.speedMul * scale;
    this.obstacleTimer -= dt;
    if (this.obstacleTimer <= 0) {
      this._spawnObstacle(speedMul);
      const base = this.difficulty.spawnInterval / Math.max(1, scale * 0.85);
      this.obstacleTimer = base * (0.75 + Math.random() * 0.5);
    }
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      this._spawnCoinCluster();
      this.coinTimer = 2.2 + Math.random() * 1.6;
    }
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0) {
      this._spawnPowerup();
      this.powerupTimer = 8 + Math.random() * 6;
    }

    this._updateObstacles(dt, worldTimeScale);
    this._updatePowerups(dt);
    this._updateCoins(dt);
    this.particles.update(dt);

    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 3);

    // continuous score from distance
    this.score = Math.floor(this.worldDistance / 12) + this.deflectCount * 4 + this.coins * 3;

    if (this.cb.onHudUpdate) {
      this.cb.onHudUpdate({
        score: this.score,
        distance: Math.floor(this.worldDistance / 30),
        coins: this.coins,
        combo: this.combo,
        activePowerups: this.activePowerups,
      });
    }
  }

  // Since the drag input now steers the balloon instead of the shield, the
  // shield auto-aims at whatever obstacle is closest and heading toward the
  // balloon, so it still has something to deflect with. With nothing nearby
  // it settles back to guarding upward, where new obstacles rise in from.
  _updateShieldAutoAim() {
    const bx = this.balloon.x, by = this.balloon.y;
    const detectRadius = 240;
    let best = null, bestDist = detectRadius;
    for (const o of this.obstacles) {
      if (!o.alive || o.deflected) continue;
      const dist = Math.hypot(o.screenX - bx, o.screenY - by);
      if (dist < bestDist) { bestDist = dist; best = o; }
    }
    this.shieldAutoAngle = best
      ? Math.atan2(best.screenY - by, best.screenX - bx)
      : (this.shieldAutoAngle + angleDiff(-Math.PI / 2, this.shieldAutoAngle) * 0.02);
    this.shield.setTargetAngle(this.shieldAutoAngle);
  }

  _spawnObstacle(speedMul) {
    const w = this.width;
    const margin = 40;
    const x = margin + Math.random() * (w - margin * 2);
    const aheadPx = this.height + 100;
    const worldY = this.worldDistance + aheadPx;

    let pool = ['circle', 'block', 'triangle', 'bar'];
    if (this.difficulty.id === 'hard' || this.difficulty.id === 'extreme' || this.difficulty.id === 'endless') {
      pool = pool.concat(['spinner', 'spinner']);
    }
    if (this.difficulty.id === 'extreme') pool = pool.concat(['spinner']);
    const type = pool[Math.floor(Math.random() * pool.length)];

    const palette = {
      circle: ['#ff6b9d', '#ff4785'],
      block: ['#7fb8ff', '#3f7fe0'],
      triangle: ['#ffb56b', '#ff8a3d'],
      bar: ['#c9a0ff', '#8a5cf0'],
      spinner: ['#ff5b5b', '#c22f2f'],
    }[type];

    const baseSize = { circle: 34, block: 32, triangle: 36, bar: 90, spinner: 30 }[type];
    const size = baseSize * (0.85 + Math.random() * 0.4) * (1 + (speedMul - 1) * 0.12);
    const extraSpeed = (30 + Math.random() * 40) * speedMul;
    const vx = (Math.random() - 0.5) * 60 * speedMul;
    const vrot = (Math.random() - 0.5) * (type === 'spinner' ? 3.5 : 2.2) * speedMul;

    const obs = new Obstacle(type, worldY, x, {
      vx, vrot, size, color: palette[0], color2: palette[1],
      bladeCount: 3 + Math.floor(Math.random() * 2),
    });
    obs.extraSpeed = extraSpeed;
    this.obstacles.push(obs);
  }

  _spawnCoinCluster() {
    const count = 3 + Math.floor(Math.random() * 4);
    const w = this.width;
    const startX = 60 + Math.random() * (w - 120);
    const aheadPx = this.height + 60;
    const arcSpread = Math.random() > 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const x = Math.min(w - 30, Math.max(30, startX + i * 26 * arcSpread));
      const worldY = this.worldDistance + aheadPx + i * 40;
      this.coinItems.push(new Coin(worldY, x));
    }
  }

  _spawnPowerup() {
    const kinds = Object.keys(POWERUP_DEFS);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const w = this.width;
    const x = 50 + Math.random() * (w - 100);
    const worldY = this.worldDistance + this.height + 80;
    this.powerups.push(new PowerUp(kind, worldY, x));
  }

  _updateObstacles(dt, worldTimeScale) {
    // Obstacles scroll relative to a fixed anchor line, NOT the balloon's
    // actual (freely-dragged) position — otherwise dragging the balloon up
    // or down would drag the whole obstacle stream with it. The balloon's
    // real x/y is only used below for collision/deflection checks.
    const anchorY = this.balloonHomeY;
    const by = this.balloon.y;
    const bx = this.balloon.x;
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      o.worldY -= o.extraSpeed * dt * worldTimeScale;
      o.update(dt);
      o.updateScreenPos(anchorY, this.worldDistance, this.width);

      if (o.screenY > this.height + 120) { o.alive = false; continue; }
      if (o.screenY < -200) continue;

      const dx = o.screenX - bx, dy = o.screenY - by;
      const dist = Math.hypot(dx, dy);
      const angleToObs = Math.atan2(dy, dx);
      const cr = o.collisionRadius;

      if (this.balloon.invuln > 0) continue;

      const ringInner = this.shield.radius - this.shield.thickness / 2 - cr;
      const ringOuter = this.shield.radius + this.shield.thickness / 2 + cr;

      if (!o.deflected && dist <= ringOuter && dist >= ringInner && this.shield.isAngleCovered(angleToObs)) {
        this._deflectObstacle(o, angleToObs, dist);
        continue;
      }

      if (dist <= this.balloon.radius + cr) {
        this._onBalloonHit(o);
      }
    }
    this.obstacles = this.obstacles.filter(o => o.alive);
  }

  _deflectObstacle(o, angleToObs, dist) {
    o.deflected = true;
    o.deflectFlashT = 0.15;
    const pushSpeed = 260;
    o.vx = Math.cos(angleToObs) * pushSpeed;
    o.extraSpeed = -pushSpeed * 1.4; // sends it back upward away fast
    this.shield.addHitPulse(angleToObs);

    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = 2.1;
    this.deflectCount += 1;
    this.score += 8 * this.combo;

    this.particles.burst(o.screenX, o.screenY, {
      count: 12, color: o.color, speed: 180, size: 3.5, gravity: 0, maxLife: 0.4,
    });

    if (window.audioManager) window.audioManager.deflect();
    if (this.combo > 0 && this.combo % 5 === 0) {
      if (window.audioManager) window.audioManager.comboMilestone();
      if (this.cb.onComboMilestone) this.cb.onComboMilestone(this.combo);
    }
    if (this.cb.onDeflect) this.cb.onDeflect(this.combo);
  }

  _onBalloonHit(o) {
    if (this.extraLives > 0) {
      this.extraLives -= 1;
      this.balloon.invuln = 1.4;
      this.balloon.hitFlash = 1;
      this.screenShake = 1;
      o.alive = false;
      this.particles.burst(o.screenX, o.screenY, { count: 18, color: '#ff5b5b', speed: 220, size: 4, maxLife: 0.5 });
      if (window.audioManager) window.audioManager.hit();
      if (navigator.vibrate && this.gd.data.settings.vibrate) navigator.vibrate(60);
      if (this.cb.onExtraLifeUsed) this.cb.onExtraLifeUsed(this.extraLives);
      return;
    }
    this._triggerGameOver(o);
  }

  _triggerGameOver(o) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.screenShake = 1.4;
    this.particles.burst(this.balloon.x, this.balloon.y, { count: 34, color: '#ff6b9d', speed: 260, size: 5, maxLife: 0.7 });
    this.particles.burst(this.balloon.x, this.balloon.y, { count: 20, color: '#ffffff', speed: 180, size: 3, maxLife: 0.5 });
    if (window.audioManager) window.audioManager.hit();
    if (navigator.vibrate && this.gd.data.settings.vibrate) navigator.vibrate([40, 40, 80]);
    this.state = 'gameover';
    if (this.cb.onGameOver) {
      this.cb.onGameOver({
        score: this.score,
        distance: Math.floor(this.worldDistance / 30),
        coins: this.coins,
        bestCombo: this.bestCombo,
        deflects: this.deflectCount,
        powerupsUsed: this.powerupsUsed,
        difficulty: this.difficulty.id,
      });
    }
  }

  _updatePowerups(dt) {
    const anchorY = this.balloonHomeY;
    const by = this.balloon.y, bx = this.balloon.x;
    for (const p of this.powerups) {
      if (!p.alive) continue;
      p.update(dt);
      p.updateScreenPos(anchorY, this.worldDistance);
      if (p.screenY > this.height + 100) { p.alive = false; continue; }
      const dist = Math.hypot(p.screenX - bx, p.screenY - by);
      if (dist <= this.balloon.radius + p.size / 2 + 6) {
        this._collectPowerup(p);
      }
    }
    this.powerups = this.powerups.filter(p => p.alive);
  }

  _collectPowerup(p) {
    p.alive = false;
    this.powerupsUsed += 1;
    const def = POWERUP_DEFS[p.kind];
    this.particles.burst(p.screenX, p.screenY, { count: 16, color: def.color, speed: 200, size: 4, maxLife: 0.45 });
    if (window.audioManager) window.audioManager.powerup();
    if (navigator.vibrate && this.gd.data.settings.vibrate) navigator.vibrate(25);

    if (p.kind === 'shield_boost') {
      this.shield.activateBoost(def.duration);
      this.activePowerups.shield_boost = def.duration;
    } else if (p.kind === 'slow_motion') {
      this.activePowerups.slow_motion = def.duration;
    } else if (p.kind === 'extra_life') {
      this.extraLives = Math.min(3, this.extraLives + 1);
    } else if (p.kind === 'push_power') {
      this._pushPulse();
    }
    if (this.cb.onPowerupCollected) this.cb.onPowerupCollected(p.kind);
  }

  _pushPulse() {
    const bx = this.balloon.x, by = this.balloon.y;
    const radius = 260;
    for (const o of this.obstacles) {
      if (!o.alive || o.deflected) continue;
      const dx = o.screenX - bx, dy = o.screenY - by;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius) {
        const angle = Math.atan2(dy, dx);
        this._deflectObstacle(o, angle, dist);
      }
    }
    this.screenShake = 0.6;
    this.particles.burst(bx, by, { count: 30, color: '#ff9f43', speed: 320, size: 4, maxLife: 0.5 });
  }

  _updateCoins(dt) {
    const anchorY = this.balloonHomeY;
    const by = this.balloon.y, bx = this.balloon.x;
    for (const c of this.coinItems) {
      if (!c.alive) continue;
      c.update(dt);
      c.updateScreenPos(anchorY, this.worldDistance);
      if (c.screenY > this.height + 100) { c.alive = false; continue; }
      const dist = Math.hypot(c.screenX - bx, c.screenY - by);
      if (dist <= this.balloon.radius + c.size / 2 + 4) {
        c.alive = false;
        this.coins += 1;
        this.particles.burst(c.screenX, c.screenY, { count: 8, color: '#ffd54f', speed: 140, size: 3, maxLife: 0.35 });
        if (window.audioManager) window.audioManager.coin();
      }
    }
    this.coinItems = this.coinItems.filter(c => c.alive);
  }

  _render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.screenShake > 0) {
      const s = this.screenShake * 8;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.scene.render(ctx, this.worldDistance, this.gd.data.selectedScene);

    if (this.state !== 'idle') {
      for (const c of this.coinItems) if (c.screenY > -60 && c.screenY < this.height + 60) c.render(ctx);
      for (const p of this.powerups) if (p.screenY > -60 && p.screenY < this.height + 60) p.render(ctx);
      for (const o of this.obstacles) if (o.screenY > -200 && o.screenY < this.height + 120) o.render(ctx);

      this.particles.render(ctx);

      if (this.balloon) {
        this.shield.render(ctx, this.balloon.x, this.balloon.y, this.shieldSkin.colors);
        this.balloon.render(ctx, this.balloonSkin);
      }
    }
    ctx.restore();
  }

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}

window.Game = Game;
