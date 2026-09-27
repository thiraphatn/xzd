/* ============================================================
   Game data: persistent save (localStorage), catalog of
   balloons / shields / scenes, achievements & daily missions.
   ============================================================ */

const SAVE_KEY = 'balloonRise_save_v1';
const HISTORY_MAX = 200; // cap so the save file doesn't grow forever

const DIFFICULTIES = [
  { id: 'easy', name: 'ง่าย', icon: '🌤️', color: '#5be0c3', riseSpeed: 90, spawnInterval: 1.35, speedMul: 0.85, desc: 'สำหรับผู้เริ่มต้น สบาย ๆ' },
  { id: 'normal', name: 'ปกติ', icon: '⛅', color: '#4fc3f7', riseSpeed: 115, spawnInterval: 1.05, speedMul: 1.0, desc: 'ความท้าทายมาตรฐาน' },
  { id: 'hard', name: 'ยาก', icon: '🌩️', color: '#ff9f43', riseSpeed: 145, spawnInterval: 0.82, speedMul: 1.25, desc: 'สิ่งกีดขวางถี่และไวขึ้น' },
  { id: 'extreme', name: 'สุดขีด', icon: '🔥', color: '#ff6b9d', riseSpeed: 175, spawnInterval: 0.62, speedMul: 1.55, desc: 'สำหรับมือโปรเท่านั้น' },
  { id: 'endless', name: 'ไม่รู้จบ', icon: '♾️', color: '#a06bff', riseSpeed: 110, spawnInterval: 1.1, speedMul: 1.0, desc: 'ความยากเพิ่มขึ้นเรื่อย ๆ ไม่มีที่สิ้นสุด', endless: true },
];

const BALLOON_SKINS = [
  { id: 'classic_red', name: 'แดงคลาสสิก', cost: 0, colors: ['#ff6b9d', '#ff4785'], emoji: '🎈' },
  { id: 'sky_blue', name: 'ฟ้าใส', cost: 150, colors: ['#7fd6fb', '#29b6f6'], emoji: '🎈' },
  { id: 'lime', name: 'เขียวมะนาว', cost: 150, colors: ['#c6f26c', '#8bc93f'], emoji: '🎈' },
  { id: 'violet', name: 'ม่วงมายา', cost: 250, colors: ['#c9a0ff', '#a06bff'], emoji: '🎈' },
  { id: 'sunset', name: 'ตะวันลับฟ้า', cost: 350, colors: ['#ffb56b', '#ff6b6b'], emoji: '🎈' },
  { id: 'galaxy', name: 'จักรวาล', cost: 500, colors: ['#7c4dff', '#00e5ff'], emoji: '🎈', special: 'galaxy' },
  { id: 'gold', name: 'ทองคำ', cost: 800, colors: ['#ffe082', '#ffab00'], emoji: '🎈', special: 'gold' },
  { id: 'rainbow', name: 'สายรุ้ง', cost: 1200, colors: ['#ff6b9d', '#ffd54f', '#5be0c3', '#4fc3f7', '#a06bff'], emoji: '🎈', special: 'rainbow' },
];

const SHIELD_SKINS = [
  { id: 'aqua', name: 'อควา', cost: 0, colors: ['#4fc3f7', '#29b6f6'] },
  { id: 'ember', name: 'เพลิงไหม้', cost: 150, colors: ['#ff9f43', '#ff5b5b'] },
  { id: 'electric', name: 'ไฟฟ้า', cost: 200, colors: ['#c9a0ff', '#7c4dff'] },
  { id: 'toxic', name: 'พิษเขียว', cost: 200, colors: ['#c6f26c', '#5be0c3'] },
  { id: 'ice', name: 'น้ำแข็ง', cost: 300, colors: ['#e0f7ff', '#7fd6fb'] },
  { id: 'royal', name: 'ทองคำหลวง', cost: 600, colors: ['#ffe082', '#ffab00'] },
];

const SCENES = [
  { id: 'sky', name: 'ท้องฟ้า', cost: 0, icon: '☁️' },
  { id: 'city', name: 'เมือง', cost: 200, icon: '🏙️' },
  { id: 'space', name: 'อวกาศ', cost: 400, icon: '🌌' },
  { id: 'galaxy', name: 'กาแล็กซี', cost: 700, icon: '🌠' },
];

const ACHIEVEMENTS = [
  { id: 'first_flight', name: 'เที่ยวบินแรก', desc: 'เล่นเกม 1 ครั้ง', icon: '🎈', target: 1, stat: 'gamesPlayed', reward: 50 },
  { id: 'rising_star', name: 'ดาวรุ่ง', desc: 'ลอยสูงรวม 1,000 เมตร', icon: '⭐', target: 1000, stat: 'totalDistance', reward: 80 },
  { id: 'high_flyer', name: 'นักบินระดับสูง', desc: 'ทำระยะทางเดี่ยว 500 เมตรในเกมเดียว', icon: '🚀', target: 500, stat: 'bestSingleDistance', reward: 120 },
  { id: 'coin_collector', name: 'นักสะสมเหรียญ', desc: 'เก็บเหรียญรวม 500 เหรียญ', icon: '🪙', target: 500, stat: 'totalCoinsEarned', reward: 100 },
  { id: 'shield_master', name: 'เจ้าแห่งโล่', desc: 'ปัดป้องสิ่งกีดขวางรวม 200 ครั้ง', icon: '🛡️', target: 200, stat: 'totalDeflects', reward: 150 },
  { id: 'combo_king', name: 'ราชาคอมโบ', desc: 'ทำคอมโบสูงสุด x20 ในเกมเดียว', icon: '⚡', target: 20, stat: 'bestCombo', reward: 150 },
  { id: 'powerup_fan', name: 'สาวกไอเทม', desc: 'ใช้ไอเทมพาวเวอร์อัพรวม 30 ครั้ง', icon: '✨', target: 30, stat: 'totalPowerups', reward: 100 },
  { id: 'survivor', name: 'ผู้รอดชีวิต', desc: 'เล่นเกมรวม 25 ครั้ง', icon: '🏅', target: 25, stat: 'gamesPlayed', reward: 200 },
  { id: 'collector_deluxe', name: 'นักสะสมตัวยง', desc: 'ปลดล็อกลูกโป่ง 4 แบบ', icon: '🎨', target: 4, stat: 'balloonsUnlocked', reward: 180 },
  { id: 'endless_legend', name: 'ตำนานไม่รู้จบ', desc: 'ทำคะแนน 2,000 ในโหมดไม่รู้จบ', icon: '♾️', target: 2000, stat: 'bestEndlessScore', reward: 300 },
];

const MISSION_POOL = [
  { id: 'm_coins', name: 'นักล่าเหรียญ', desc: 'เก็บเหรียญ {t} เหรียญ', icon: '🪙', target: 25, stat: 'sessionCoins', reward: 40 },
  { id: 'm_distance', name: 'นักบิน', desc: 'ลอยสูงรวม {t} เมตร', icon: '📏', target: 300, stat: 'sessionDistance', reward: 45 },
  { id: 'm_deflect', name: 'ผู้พิทักษ์', desc: 'ปัดป้องสิ่งกีดขวาง {t} ครั้ง', icon: '🛡️', target: 20, stat: 'sessionDeflects', reward: 45 },
  { id: 'm_games', name: 'ขยันเล่น', desc: 'เล่นเกม {t} ครั้ง', icon: '🎮', target: 3, stat: 'sessionGames', reward: 35 },
  { id: 'm_powerup', name: 'นักล่าไอเทม', desc: 'เก็บพาวเวอร์อัพ {t} ชิ้น', icon: '✨', target: 5, stat: 'sessionPowerups', reward: 40 },
  { id: 'm_combo', name: 'สายคอมโบ', desc: 'ทำคอมโบให้ถึง x{t}', icon: '⚡', target: 10, stat: 'sessionBestCombo', reward: 50 },
];

function defaultSave() {
  return {
    coins: 0,
    highScores: { easy: 0, normal: 0, hard: 0, extreme: 0, endless: 0 },
    bestDistance: { easy: 0, normal: 0, hard: 0, extreme: 0, endless: 0 },
    unlockedBalloons: ['classic_red'],
    unlockedShields: ['aqua'],
    unlockedScenes: ['sky'],
    selectedBalloon: 'classic_red',
    selectedShield: 'aqua',
    selectedScene: 'sky',
    achievements: {},
    dailyMissions: { date: '', missions: [] },
    // Per-game play history — purely a log for the player to review/clear.
    // It is NEVER read by highScores/bestDistance/stats, so deleting
    // entries here can't affect best-ever records.
    history: [],
    stats: {
      gamesPlayed: 0,
      totalDistance: 0,
      bestSingleDistance: 0,
      totalCoinsEarned: 0,
      totalDeflects: 0,
      bestCombo: 0,
      totalPowerups: 0,
      balloonsUnlocked: 1,
      bestEndlessScore: 0,
    },
    settings: { sfx: true, music: true, vibrate: true, firstPlayDone: false },
  };
}

class GameData {
  constructor() {
    this.data = this.load();
    this.ensureDailyMissions();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultSave(), parsed, {
        highScores: Object.assign(defaultSave().highScores, parsed.highScores),
        bestDistance: Object.assign(defaultSave().bestDistance, parsed.bestDistance),
        stats: Object.assign(defaultSave().stats, parsed.stats),
        settings: Object.assign(defaultSave().settings, parsed.settings),
        history: Array.isArray(parsed.history) ? parsed.history : [],
      });
    } catch (e) {
      return defaultSave();
    }
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  }

  resetAll() {
    this.data = defaultSave();
    this.ensureDailyMissions();
    this.save();
  }

  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  ensureDailyMissions() {
    const today = this.todayStr();
    if (this.data.dailyMissions.date === today && this.data.dailyMissions.missions.length) return;
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i) * (i + 1);
    const rand = this.seededRandom(seed);
    const pool = [...MISSION_POOL];
    const picked = [];
    while (picked.length < 3 && pool.length) {
      const idx = Math.floor(rand() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    this.data.dailyMissions = {
      date: today,
      missions: picked.map(m => ({ id: m.id, progress: 0, target: m.target, claimed: false })),
    };
    this.save();
  }

  addCoins(n) {
    this.data.coins += n;
    this.data.stats.totalCoinsEarned += n;
    this.save();
  }

  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.save();
    return true;
  }

  isUnlocked(type, id) {
    if (type === 'balloon') return this.data.unlockedBalloons.includes(id);
    if (type === 'shield') return this.data.unlockedShields.includes(id);
    if (type === 'scene') return this.data.unlockedScenes.includes(id);
    return false;
  }

  unlock(type, id) {
    const key = type === 'balloon' ? 'unlockedBalloons' : type === 'shield' ? 'unlockedShields' : 'unlockedScenes';
    if (!this.data[key].includes(id)) {
      this.data[key].push(id);
      if (type === 'balloon') this.data.stats.balloonsUnlocked = this.data.unlockedBalloons.length;
    }
    this.save();
  }

  select(type, id) {
    if (type === 'balloon') this.data.selectedBalloon = id;
    if (type === 'shield') this.data.selectedShield = id;
    if (type === 'scene') this.data.selectedScene = id;
    this.save();
  }

  recordGameEnd({ difficulty, score, distance, coins, deflects, bestCombo, powerupsUsed }) {
    const s = this.data.stats;
    s.gamesPlayed += 1;
    s.totalDistance += distance;
    s.bestSingleDistance = Math.max(s.bestSingleDistance, distance);
    s.totalDeflects += deflects;
    s.bestCombo = Math.max(s.bestCombo, bestCombo);
    s.totalPowerups += powerupsUsed;
    if (difficulty === 'endless') s.bestEndlessScore = Math.max(s.bestEndlessScore, score);

    let isNewBest = false;
    if (score > this.data.highScores[difficulty]) { this.data.highScores[difficulty] = score; isNewBest = true; }
    this.data.bestDistance[difficulty] = Math.max(this.data.bestDistance[difficulty], distance);

    // Log this play as a history entry. This list is independent from the
    // best-score stats above — clearing/deleting entries from it never
    // touches highScores, bestDistance, or stats.
    this.data.history.unshift({
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      difficulty, score, distance, coins, deflects, bestCombo,
    });
    if (this.data.history.length > HISTORY_MAX) this.data.history.length = HISTORY_MAX;

    this.save();
    return isNewBest;
  }

  // Removes a single play-history entry by id. Best-score stats are untouched.
  deleteHistoryEntry(id) {
    this.data.history = this.data.history.filter(h => h.id !== id);
    this.save();
  }

  // Clears the whole play-history log. Best-score stats are untouched.
  clearHistory() {
    this.data.history = [];
    this.save();
  }

  checkAchievements() {
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.achievements[a.id]?.unlocked) continue;
      const val = this.data.stats[a.stat] || 0;
      if (val >= a.target) {
        this.data.achievements[a.id] = { unlocked: true };
        this.addCoins(a.reward);
        unlocked.push(a);
      }
    }
    if (unlocked.length) this.save();
    return unlocked;
  }

  achievementProgress(a) {
    const val = this.data.stats[a.stat] || 0;
    return Math.min(1, val / a.target);
  }

  updateMissionProgress(sessionStats) {
    const claimed = [];
    for (const m of this.data.dailyMissions.missions) {
      if (m.claimed) continue;
      const def = MISSION_POOL.find(d => d.id === m.id);
      const val = sessionStats[def.stat] || 0;
      m.progress = Math.max(m.progress, val);
    }
    this.save();
  }

  claimMission(id) {
    const m = this.data.dailyMissions.missions.find(m => m.id === id);
    if (!m || m.claimed || m.progress < m.target) return null;
    const def = MISSION_POOL.find(d => d.id === id);
    m.claimed = true;
    this.addCoins(def.reward);
    this.save();
    return def;
  }

  anyMissionClaimable() {
    return this.data.dailyMissions.missions.some(m => !m.claimed && m.progress >= m.target);
  }
}

window.GameData = GameData;
window.DIFFICULTIES = DIFFICULTIES;
window.BALLOON_SKINS = BALLOON_SKINS;
window.SHIELD_SKINS = SHIELD_SKINS;
window.SCENES = SCENES;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.MISSION_POOL = MISSION_POOL;
