/* ============================================================
   main.js - bootstraps the app: menu, shop, achievements,
   missions, settings, and wires the Game engine to the DOM.
   ============================================================ */
(() => {
  const $ = sel => document.querySelector(sel);
  const $all = sel => Array.from(document.querySelectorAll(sel));

  const gd = new GameData();
  window.audioManager.setSfx(gd.data.settings.sfx);
  window.audioManager.setMusic(gd.data.settings.music);

  const canvas = $('#game-canvas');
  let game = null;
  let currentDifficulty = 'normal';
  let toastTimer = null;

  const sessionStats = () => ({
    sessionCoins: 0, sessionDistance: 0, sessionDeflects: 0, sessionGames: 0,
    sessionPowerups: 0, sessionBestCombo: 0,
  });
  let session = sessionStats();

  /* ---------------- Screen navigation ---------------- */
  function showScreen(id) {
    $all('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  $all('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.audioManager.click();
      showScreen(btn.dataset.back);
    });
  });

  function refreshMenu() {
    $('#menu-coins').textContent = gd.data.coins;
    const bestOverall = Math.max(...Object.values(gd.data.highScores));
    $('#menu-best').textContent = bestOverall;
    $('#mission-dot').classList.toggle('hidden', !gd.anyMissionClaimable());
  }

  /* ---------------- Toast ---------------- */
  function showToast(html) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.remove('hidden');
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.classList.add('hidden'), 300);
    }, 2600);
  }

  /* ================= MENU BUTTONS ================= */
  $('#btn-play').addEventListener('click', () => {
    window.audioManager.unlock();
    window.audioManager.click();
    renderDifficultyList();
    showScreen('screen-difficulty');
  });
  $('#btn-shop').addEventListener('click', () => { window.audioManager.click(); renderShop('balloons'); showScreen('screen-shop'); });
  $('#btn-achievements').addEventListener('click', () => { window.audioManager.click(); renderAchievements(); showScreen('screen-achievements'); });
  $('#btn-missions').addEventListener('click', () => { window.audioManager.click(); renderMissions(); showScreen('screen-missions'); });
  $('#btn-settings').addEventListener('click', () => { window.audioManager.click(); showScreen('screen-settings'); });
  $('#btn-history').addEventListener('click', () => { window.audioManager.click(); renderHistoryScreen(); showScreen('screen-history'); });

  /* ================= DIFFICULTY ================= */
  function renderDifficultyList() {
    const wrap = $('#difficulty-list');
    wrap.innerHTML = '';
    for (const d of DIFFICULTIES) {
      const best = gd.data.highScores[d.id] || 0;
      const card = document.createElement('div');
      card.className = 'diff-card';
      card.innerHTML = `
        <div class="diff-icon">${d.icon}</div>
        <div class="diff-info">
          <b>${d.name}</b>
          <span>${d.desc}</span>
          <span class="diff-best">สถิติ: ${best}</span>
        </div>
        <button class="diff-go" style="background:${d.color}">เล่น</button>
      `;
      card.querySelector('.diff-go').addEventListener('click', () => startGame(d.id));
      wrap.appendChild(card);
    }
  }

  function startGame(diffId) {
    window.audioManager.unlock();
    window.audioManager.click();
    currentDifficulty = diffId;
    session = sessionStats();
    if (!game) {
      game = new Game(canvas, gd, {
        onHudUpdate: updateHud,
        onDeflect: onDeflect,
        onComboMilestone: onComboMilestone,
        onPowerupCollected: onPowerupCollected,
        onGameOver: onGameOver,
        onExtraLifeUsed: onExtraLifeUsed,
        onFirstInput: onFirstInput,
      });
    }
    game.start(diffId);
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $('#hud').classList.remove('hidden');
    resetHud();
    if (!gd.data.settings.firstPlayDone) {
      $('#aim-hint').classList.remove('hidden');
    }
  }

  function onFirstInput() {
    if (!gd.data.settings.firstPlayDone) {
      gd.data.settings.firstPlayDone = true;
      gd.save();
    }
    $('#aim-hint').classList.add('hidden');
  }

  function resetHud() {
    $('#hud-score').textContent = '0';
    $('#hud-distance').textContent = '0';
    $('#hud-coins').textContent = '0';
    $('#combo-badge').classList.add('hidden');
    $('#powerup-bar').innerHTML = '';
  }

  function updateHud(data) {
    $('#hud-score').textContent = data.score;
    $('#hud-distance').textContent = data.distance;
    $('#hud-coins').textContent = data.coins;
    session.sessionDistance = data.distance;
    session.sessionCoins = data.coins;

    const comboBadge = $('#combo-badge');
    if (data.combo > 1) {
      comboBadge.classList.remove('hidden');
      $('#hud-combo').textContent = 'x' + data.combo;
    } else {
      comboBadge.classList.add('hidden');
    }

    renderPowerupBar(data.activePowerups);
  }

  function renderPowerupBar(active) {
    const bar = $('#powerup-bar');
    bar.innerHTML = '';
    for (const kind in active) {
      if (active[kind] > 0) {
        const def = POWERUP_DEFS[kind];
        const pct = Math.round((active[kind] / def.duration) * 100);
        const chip = document.createElement('div');
        chip.className = 'powerup-chip';
        chip.innerHTML = `<span class="pu-icon">${def.icon}</span><span>${Math.ceil(active[kind])}s</span>`;
        bar.appendChild(chip);
      }
    }
  }

  function onDeflect(combo) {
    session.sessionDeflects += 1;
    session.sessionBestCombo = Math.max(session.sessionBestCombo, combo);
    const badge = $('#combo-badge');
    badge.classList.remove('pulse');
    void badge.offsetWidth;
    badge.classList.add('pulse');
  }

  function onComboMilestone(combo) {
    showToast(`⚡ คอมโบ x${combo}!`);
  }

  function onPowerupCollected(kind) {
    session.sessionPowerups += 1;
    const def = POWERUP_DEFS[kind];
    showToast(`${def.icon} ${def.label}!`);
  }

  function onExtraLifeUsed() {
    showToast('❤️ รอดแล้ว! ใช้ชีวิตเสริม');
  }

  function onGameOver(result) {
    session.sessionGames = 1;
    gd.updateMissionProgress(session);
    const earnedCoins = result.coins;
    gd.addCoins(earnedCoins);
    const isNewBest = gd.recordGameEnd(result);

    $('#hud').classList.add('hidden');
    $('#aim-hint').classList.add('hidden');
    $('#go-score').textContent = result.score;
    $('#go-distance').textContent = result.distance + 'm';
    $('#go-combo').textContent = 'x' + result.bestCombo;
    $('#go-coins').textContent = '+' + earnedCoins;
    $('#go-best-badge').classList.toggle('hidden', !isNewBest);

    const unlocked = gd.checkAchievements();
    setTimeout(() => {
      showScreen('screen-gameover');
      if (unlocked.length) {
        setTimeout(() => {
          unlocked.forEach((a, i) => {
            setTimeout(() => {
              showToast(`🏅 ปลดล็อก: ${a.name} (+${a.reward}🪙)`);
              window.audioManager.unlockJingle();
            }, i * 1400);
          });
        }, 600);
      }
    }, 550);
  }

  $('#btn-retry').addEventListener('click', () => { window.audioManager.click(); startGame(currentDifficulty); });
  $('#btn-gameover-menu').addEventListener('click', () => {
    window.audioManager.click();
    $('#screen-gameover').classList.add('hidden');
    refreshMenu();
    showScreen('screen-menu');
  });

  /* ================= PAUSE ================= */
  $('#btn-pause').addEventListener('click', () => {
    if (!game || game.state !== 'playing') return;
    window.audioManager.click();
    game.pause();
    showScreen('screen-pause');
  });
  $('#btn-resume').addEventListener('click', () => {
    window.audioManager.click();
    game.resume();
    $('#screen-pause').classList.add('hidden');
  });
  $('#btn-restart').addEventListener('click', () => {
    window.audioManager.click();
    $('#screen-pause').classList.add('hidden');
    startGame(currentDifficulty);
  });
  $('#btn-quit').addEventListener('click', () => {
    window.audioManager.click();
    game.stop();
    $('#hud').classList.add('hidden');
    $('#screen-pause').classList.add('hidden');
    refreshMenu();
    showScreen('screen-menu');
  });

  /* ================= SHOP ================= */
  let currentShopTab = 'balloons';
  $all('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      window.audioManager.click();
      $all('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentShopTab = tab.dataset.tab;
      renderShop(currentShopTab);
    });
  });

  function renderShop(tab) {
    $('#shop-coins').textContent = gd.data.coins;
    const grid = $('#shop-grid');
    grid.innerHTML = '';
    let items, type, selectedId;
    if (tab === 'balloons') { items = BALLOON_SKINS; type = 'balloon'; selectedId = gd.data.selectedBalloon; }
    else if (tab === 'shields') { items = SHIELD_SKINS; type = 'shield'; selectedId = gd.data.selectedShield; }
    else { items = SCENES; type = 'scene'; selectedId = gd.data.selectedScene; }

    for (const item of items) {
      const owned = gd.isUnlocked(type, item.id) || item.cost === 0;
      const equipped = selectedId === item.id;
      const card = document.createElement('div');
      card.className = 'shop-item' + (equipped ? ' equipped' : '');

      let previewHtml;
      if (type === 'balloon') previewHtml = `<span style="filter:drop-shadow(0 0 6px ${item.colors[0]})">🎈</span>`;
      else if (type === 'shield') previewHtml = `<div style="width:38px;height:38px;border-radius:50%;background:conic-gradient(${item.colors[1] || item.colors[0]},${item.colors[0]});box-shadow:0 0 12px ${item.colors[0]}"></div>`;
      else previewHtml = `<span>${item.icon}</span>`;

      card.innerHTML = `
        <div class="shop-preview">${previewHtml}</div>
        <div class="shop-name">${item.name}</div>
        <button class="shop-btn ${owned ? (equipped ? 'equipped-btn' : 'owned') : ''}">
          ${equipped ? '✓ ใช้งานอยู่' : owned ? 'สวมใส่' : '🪙 ' + item.cost}
        </button>
      `;
      const btn = card.querySelector('.shop-btn');
      btn.addEventListener('click', () => {
        window.audioManager.click();
        if (equipped) return;
        if (owned) {
          gd.select(type, item.id);
          renderShop(tab);
          return;
        }
        if (gd.spendCoins(item.cost)) {
          gd.unlock(type, item.id);
          gd.select(type, item.id);
          window.audioManager.unlockJingle();
          showToast(`✨ ปลดล็อก: ${item.name}!`);
          renderShop(tab);
        } else {
          showToast('🪙 เหรียญไม่พอ!');
        }
      });
      grid.appendChild(card);
    }
  }

  /* ================= ACHIEVEMENTS ================= */
  function renderAchievements() {
    const list = $('#achievements-list');
    list.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const done = !!gd.data.achievements[a.id]?.unlocked;
      const progress = gd.achievementProgress(a);
      const val = gd.data.stats[a.stat] || 0;
      const card = document.createElement('div');
      card.className = 'ach-card' + (done ? ' done' : '');
      card.innerHTML = `
        <div class="ach-icon">${done ? a.icon : '🔒'}</div>
        <div class="ach-body">
          <b>${a.name}</b>
          <p>${a.desc}</p>
          <div class="bar-track"><div class="bar-fill" style="width:${progress * 100}%"></div></div>
        </div>
        <div class="ach-reward">${done ? '✓' : Math.min(val, a.target) + '/' + a.target}</div>
      `;
      list.appendChild(card);
    }
  }

  /* ================= STATS & HISTORY ================= */
  function renderHistoryScreen() {
    renderStatsSummary();
    renderHistoryList();
  }

  // These "best ever" numbers come only from highScores/bestDistance/stats,
  // which recordGameEnd() updates but deleteHistoryEntry()/clearHistory()
  // never touch — so clearing history below can't change these.
  function renderStatsSummary() {
    const wrap = $('#stats-summary');
    const s = gd.data.stats;
    const bestScoreOverall = Math.max(0, ...Object.values(gd.data.highScores));
    const bestDistanceOverall = Math.max(0, ...Object.values(gd.data.bestDistance));
    const items = [
      { icon: '🏆', value: bestScoreOverall, label: 'คะแนนสูงสุด' },
      { icon: '📏', value: bestDistanceOverall + 'm', label: 'ระยะทางไกลสุด' },
      { icon: '⚡', value: 'x' + s.bestCombo, label: 'คอมโบสูงสุด' },
      { icon: '🎮', value: s.gamesPlayed, label: 'เล่นทั้งหมด' },
      { icon: '🪙', value: s.totalCoinsEarned, label: 'เหรียญสะสม' },
      { icon: '🛡️', value: s.totalDeflects, label: 'ปัดป้องทั้งหมด' },
    ];
    wrap.innerHTML = items.map(it => `
      <div class="stat-card">
        <div class="stat-icon">${it.icon}</div>
        <span class="stat-value">${it.value}</span>
        <span class="stat-label">${it.label}</span>
      </div>
    `).join('');
  }

  function formatHistoryDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function renderHistoryList() {
    const list = $('#history-list');
    list.innerHTML = '';
    const history = gd.data.history;
    if (!history.length) {
      list.innerHTML = '<p class="history-empty">ยังไม่มีประวัติการเล่น ลองเล่นสักตาดูสิ! 🎈</p>';
      return;
    }
    for (const h of history) {
      const diff = DIFFICULTIES.find(d => d.id === h.difficulty);
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-icon">${diff ? diff.icon : '🎈'}</div>
        <div class="history-body">
          <b>${diff ? diff.name : h.difficulty} · คะแนน ${h.score}</b>
          <p>📏 ${h.distance}m · 🪙 +${h.coins} · คอมโบ x${h.bestCombo} · ${formatHistoryDate(h.ts)}</p>
        </div>
        <button class="history-delete" aria-label="ลบรายการนี้">🗑️</button>
      `;
      card.querySelector('.history-delete').addEventListener('click', () => {
        window.audioManager.click();
        gd.deleteHistoryEntry(h.id);
        renderHistoryList();
      });
      list.appendChild(card);
    }
  }

  $('#btn-clear-history').addEventListener('click', () => {
    if (!gd.data.history.length) { showToast('ไม่มีประวัติให้ล้าง'); return; }
    if (confirm('ต้องการล้างประวัติการเล่นทั้งหมดหรือไม่? (จะไม่กระทบสถิติสูงสุด)')) {
      window.audioManager.click();
      gd.clearHistory();
      renderHistoryList();
      showToast('🗑️ ล้างประวัติเรียบร้อย');
    }
  });

  /* ================= DAILY MISSIONS ================= */
  function renderMissions() {
    gd.ensureDailyMissions();
    const list = $('#missions-list');
    list.innerHTML = '';
    for (const m of gd.data.dailyMissions.missions) {
      const def = MISSION_POOL.find(d => d.id === m.id);
      const desc = def.desc.replace('{t}', def.target);
      const done = m.progress >= m.target;
      const card = document.createElement('div');
      card.className = 'mission-card' + (m.claimed ? ' done' : '');
      card.innerHTML = `
        <div class="mission-icon">${def.icon}</div>
        <div class="mission-body">
          <b>${def.name}</b>
          <p>${desc} (${Math.min(m.progress, m.target)}/${m.target})</p>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(1, m.progress / m.target) * 100}%"></div></div>
        </div>
        <button class="mission-claim" ${m.claimed ? 'disabled' : done ? '' : 'disabled'}>
          ${m.claimed ? '✓' : '🪙' + def.reward}
        </button>
      `;
      if (!m.claimed && done) {
        card.querySelector('.mission-claim').addEventListener('click', () => {
          window.audioManager.click();
          const claimed = gd.claimMission(m.id);
          if (claimed) {
            window.audioManager.unlockJingle();
            showToast(`🎉 รับรางวัล +${claimed.reward}🪙`);
            renderMissions();
          }
        });
      }
      list.appendChild(card);
    }
    updateMissionTimer();
  }

  function updateMissionTimer() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = $('#missions-reset-timer');
    if (el) el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  setInterval(() => {
    if (!$('#screen-missions').classList.contains('hidden')) updateMissionTimer();
  }, 1000);

  /* ================= SETTINGS ================= */
  $('#toggle-sfx').checked = gd.data.settings.sfx;
  $('#toggle-music').checked = gd.data.settings.music;
  $('#toggle-vibrate').checked = gd.data.settings.vibrate;

  $('#toggle-sfx').addEventListener('change', e => {
    gd.data.settings.sfx = e.target.checked; gd.save();
    window.audioManager.setSfx(e.target.checked);
  });
  $('#toggle-music').addEventListener('change', e => {
    gd.data.settings.music = e.target.checked; gd.save();
    window.audioManager.setMusic(e.target.checked);
  });
  $('#toggle-vibrate').addEventListener('change', e => {
    gd.data.settings.vibrate = e.target.checked; gd.save();
  });
  $('#btn-fullscreen').addEventListener('click', () => {
    window.audioManager.click();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      $('#btn-fullscreen').textContent = 'ปิด';
    } else {
      document.exitFullscreen?.();
      $('#btn-fullscreen').textContent = 'เปิด';
    }
  });
  $('#btn-reset-save').addEventListener('click', () => {
    if (confirm('ต้องการรีเซ็ตข้อมูลเกมทั้งหมดหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
      gd.resetAll();
      window.audioManager.click();
      refreshMenu();
      showToast('🔄 รีเซ็ตข้อมูลเรียบร้อย');
    }
  });

  /* ================= Init ================= */
  refreshMenu();
  showScreen('screen-menu');

  // Prevent iOS bounce / gesture zoom
  document.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  /* ================= PWA Service Worker ================= */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
