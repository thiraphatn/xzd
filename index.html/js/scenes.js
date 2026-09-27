/* ============================================================
   SceneRenderer - procedural parallax backgrounds.
   Each scene owns a small set of generated layers (clouds,
   buildings, stars, nebula blobs) that scroll based on the
   world's rise distance, giving depth without any image assets.
   ============================================================ */
class SceneRenderer {
  constructor(w, h) {
    this.resize(w, h);
    this.sceneId = 'sky';
    this._layers = {};
    this._buildLayers();
    this.twinkle = 0;
  }

  resize(w, h) {
    this.w = w; this.h = h;
  }

  setScene(id) {
    if (this.sceneId === id) return;
    this.sceneId = id;
  }

  _rand(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  _buildLayers() {
    const rand = this._rand(42);
    // Sky clouds
    this._layers.clouds = Array.from({ length: 14 }, (_, i) => ({
      x: rand() * 1000, y: rand() * 3000, s: 0.5 + rand() * 1.3, speed: 0.15 + rand() * 0.25,
    }));
    // City buildings (two rows for parallax)
    this._layers.buildingsFar = this._genBuildings(rand, 18, 0.35, 1);
    this._layers.buildingsNear = this._genBuildings(rand, 12, 0.55, 2);
    // Stars for space/galaxy
    this._layers.stars = Array.from({ length: 120 }, () => ({
      x: rand() * 1000, y: rand() * 4000, s: 0.6 + rand() * 1.8, tw: rand() * Math.PI * 2,
    }));
    this._layers.planets = [
      { x: 150, y: 600, r: 46, color: '#ff9f7a' },
      { x: 820, y: 1800, r: 70, color: '#8bd9ff' },
      { x: 300, y: 3200, r: 34, color: '#c9a0ff' },
      { x: 700, y: 4600, r: 55, color: '#ffd54f' },
    ];
    // Galaxy nebula blobs
    this._layers.nebula = Array.from({ length: 10 }, (_, i) => ({
      x: rand() * 1000, y: rand() * 4000, r: 140 + rand() * 220,
      hue: [ '#a06bff', '#ff6b9d', '#4fc3f7', '#5be0c3' ][i % 4],
    }));
  }

  _genBuildings(rand, count, heightRatio, layer) {
    const arr = [];
    let x = -40;
    for (let i = 0; i < count; i++) {
      const w = 60 + rand() * 70;
      arr.push({
        x, w, h: (0.3 + rand() * heightRatio),
        windows: Math.floor(3 + rand() * 4),
        rows: Math.floor(4 + rand() * 6),
      });
      x += w + 14 + rand() * 20;
    }
    arr._totalWidth = x + 40;
    return arr;
  }

  update(dt) { this.twinkle += dt; }

  render(ctx, scrollY, sceneId) {
    this.setScene(sceneId);
    const w = this.w, h = this.h;
    switch (this.sceneId) {
      case 'sky': this._renderSky(ctx, scrollY, w, h); break;
      case 'city': this._renderCity(ctx, scrollY, w, h); break;
      case 'space': this._renderSpace(ctx, scrollY, w, h); break;
      case 'galaxy': this._renderGalaxy(ctx, scrollY, w, h); break;
      default: this._renderSky(ctx, scrollY, w, h);
    }
  }

  _renderSky(ctx, scrollY, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7fd6fb');
    g.addColorStop(0.55, '#4fc3f7');
    g.addColorStop(1, '#1e9be0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // sun glow
    ctx.save();
    ctx.globalAlpha = 0.5;
    const rg = ctx.createRadialGradient(w * 0.78, h * 0.16, 10, w * 0.78, h * 0.16, 160);
    rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,.92)';
    for (const c of this._layers.clouds) {
      const px = (c.x / 1000) * w;
      const py = (((c.y - scrollY * c.speed) % 3200) + 3200) % 3200 - 200;
      if (py > h + 100 || py < -150) continue;
      this._drawCloud(ctx, px, py, 40 * c.s);
    }
  }

  _drawCloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(x + s * 0.7, y + s * 0.1, s * 0.7, s * 0.45, 0, 0, Math.PI * 2);
    ctx.ellipse(x - s * 0.7, y + s * 0.15, s * 0.6, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderCity(ctx, scrollY, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2b1955');
    g.addColorStop(0.5, '#6b3a8a');
    g.addColorStop(1, '#ff8a5c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // stars faint
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 30; i++) {
      const s = this._layers.stars[i];
      const px = (s.x / 1000) * w;
      const py = (((s.y - scrollY * 0.25) % 2000) + 2000) % 2000;
      if (py > h * 0.6) continue;
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(this.twinkle * 2 + s.tw);
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;

    this._renderBuildingRow(ctx, this._layers.buildingsFar, scrollY, 0.3, w, h, 'rgba(30,15,55,.55)', false);
    this._renderBuildingRow(ctx, this._layers.buildingsNear, scrollY, 0.55, w, h, 'rgba(20,10,40,.85)', true);
  }

  _renderBuildingRow(ctx, buildings, scrollY, speed, w, h, color, lit) {
    const totalW = buildings._totalWidth;
    const offsetX = -((scrollY * speed * 0.15) % totalW);
    for (let rep = -1; rep <= Math.ceil(w / totalW) + 1; rep++) {
      for (const b of buildings) {
        const bx = b.x + offsetX + rep * totalW;
        if (bx > w + 100 || bx + b.w < -100) continue;
        const bh = h * b.h;
        const by = h - bh;
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, b.w, bh + 40);
        if (lit) {
          ctx.fillStyle = 'rgba(255,214,140,.85)';
          const winW = b.w / b.windows;
          for (let r = 0; r < b.rows; r++) {
            for (let c = 0; c < b.windows; c++) {
              if ((r + c) % 3 === 0) continue;
              const wx = bx + c * winW + winW * 0.25;
              const wy = by + 14 + r * (bh / b.rows);
              if (wy > h) continue;
              ctx.fillRect(wx, wy, winW * 0.3, 6);
            }
          }
        }
      }
    }
  }

  _renderSpace(ctx, scrollY, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#050818');
    g.addColorStop(1, '#141b3d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    this._drawStars(ctx, scrollY, w, h, 0.4, 1);
    this._drawPlanets(ctx, scrollY, w, h);
  }

  _renderGalaxy(ctx, scrollY, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#180a2e');
    g.addColorStop(0.5, '#2a0f4a');
    g.addColorStop(1, '#0d0620');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    for (const n of this._layers.nebula) {
      const px = (n.x / 1000) * w;
      const py = (((n.y - scrollY * 0.2) % 4200) + 4200) % 4200 - 300;
      if (py > h + 300 || py < -300) continue;
      ctx.save();
      ctx.globalAlpha = 0.16;
      const rg = ctx.createRadialGradient(px, py, 0, px, py, n.r);
      rg.addColorStop(0, n.hue); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(px, py, n.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    this._drawStars(ctx, scrollY, w, h, 0.45, 1.3);
  }

  _drawStars(ctx, scrollY, w, h, speed, brightMul) {
    for (const s of this._layers.stars) {
      const px = (s.x / 1000) * w;
      const py = (((s.y - scrollY * speed) % 4200) + 4200) % 4200;
      if (py > h || py < 0) continue;
      const tw = 0.5 + 0.5 * Math.sin(this.twinkle * 2.2 + s.tw);
      ctx.globalAlpha = Math.min(1, tw * brightMul);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, s.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawPlanets(ctx, scrollY, w, h) {
    for (const p of this._layers.planets) {
      const px = (p.x / 1000) * w;
      const py = (((p.y - scrollY * 0.5) % 4800) + 4800) % 4800 - 200;
      if (py > h + 200 || py < -200) continue;
      const rg = ctx.createRadialGradient(px - p.r * 0.3, py - p.r * 0.3, p.r * 0.1, px, py, p.r);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.25, p.color);
      rg.addColorStop(1, 'rgba(0,0,0,.6)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

window.SceneRenderer = SceneRenderer;
