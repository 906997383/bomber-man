/*
 * BOMBER MAN - mobile web edition.
 * The 8 KB CHR graphics of the original Famicom ROM are embedded in js/chr.js
 * and decoded at runtime, so all tiles (title logo, walls, bricks, player,
 * enemies, HUD font) are the original artwork. Game logic, touch controls and
 * audio are new.
 *
 * Logical resolution: 256x240 (NES). Playfield: 16x13 cells of 16px, drawn at
 * y=40, exactly like the original screen (bottom wall is clipped by 8px).
 */
(function () {
  'use strict';

  var W = 256, H = 240, CELL = 16, COLS = 16, ROWS = 13, FIELD_Y = 40;
  var FIELD_W = COLS * CELL, FIELD_H = ROWS * CELL;

  /* ------------------------------------------------------------------ *
   * NES palette (2C02, RGB approximation)
   * ------------------------------------------------------------------ */
  var NES_PAL = [
    [84, 84, 84], [0, 30, 116], [8, 16, 144], [48, 0, 136], [68, 0, 100], [92, 0, 48], [84, 4, 0], [60, 24, 0],
    [32, 42, 0], [8, 58, 0], [0, 64, 0], [0, 60, 0], [0, 50, 60], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [152, 150, 152], [8, 76, 196], [48, 50, 236], [92, 30, 228], [136, 20, 176], [160, 20, 100], [152, 34, 32], [120, 60, 0],
    [84, 90, 0], [40, 114, 0], [8, 124, 0], [0, 118, 40], [0, 102, 120], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    [236, 238, 236], [76, 154, 236], [120, 124, 236], [176, 98, 236], [228, 84, 236], [236, 88, 180], [236, 106, 100], [212, 136, 32],
    [160, 170, 0], [116, 196, 0], [76, 208, 32], [56, 204, 108], [56, 180, 204], [60, 60, 60], [0, 0, 0], [0, 0, 0],
    [236, 238, 236], [168, 204, 236], [188, 188, 236], [212, 178, 236], [236, 174, 236], [236, 174, 212], [236, 182, 176], [228, 196, 144],
    [204, 210, 120], [180, 222, 120], [168, 226, 144], [152, 226, 180], [160, 214, 228], [160, 162, 160], [0, 0, 0], [0, 0, 0]
  ];

  var COL_WHITE = '#eceeec';
  var COL_RED = '#ec6a64';
  var COL_BLUE = '#4c9aec';
  var COL_GREY = '#98989a';

  /* ------------------------------------------------------------------ *
   * CHR -> canvases
   * ------------------------------------------------------------------ */
  var CHR = (function () {
    var s = atob(window.CHR_B64);
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  })();

  function makeSheet(offset, pal, transparent) {
    var cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    var g = cv.getContext('2d');
    var img = g.createImageData(128, 128);
    var px = img.data;
    for (var t = 0; t < 256; t++) {
      var bx = (t & 15) * 8;
      var by = (t >> 4) * 8;
      var base = offset + t * 16;
      for (var y = 0; y < 8; y++) {
        var lo = CHR[base + y];
        var hi = CHR[base + 8 + y];
        for (var x = 0; x < 8; x++) {
          var bit = 7 - x;
          var c = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
          var o = ((by + y) * 128 + (bx + x)) * 4;
          if (c === 0 && transparent) {
            px[o + 3] = 0;
            continue;
          }
          var col = NES_PAL[pal[c]];
          px[o] = col[0];
          px[o + 1] = col[1];
          px[o + 2] = col[2];
          px[o + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  var BG_SHEET = makeSheet(4096, [0x19, 0x0F, 0x10, 0x30], false);
  var TITLE_SHEET = makeSheet(4096, [0x0F, 0x05, 0x30, 0x28], false);
  var PLAYER_SHEET = makeSheet(0, [0x0F, 0x30, 0x21, 0x26], true);
  var ENEMY_SHEET = makeSheet(0, [0x0F, 0x0F, 0x26, 0x30], true);

  /* ------------------------------------------------------------------ *
   * Canvas / helpers
   * ------------------------------------------------------------------ */
  var cv = document.getElementById('screen');
  var ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function tile(sheet, t, x, y) {
    ctx.drawImage(sheet, (t & 15) << 3, (t >> 4) << 3, 8, 8, x, y, 8, 8);
  }

  function drawText(str, x, y, sheet) {
    sheet = sheet || BG_SHEET;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      var t = -1;
      if (ch === ' ') t = 0x3A;
      else {
        var u = ch.toUpperCase().charCodeAt(0);
        if (u >= 0x30 && u <= 0x5A) t = u;
      }
      if (t >= 0) tile(sheet, t, x + i * 8, y);
    }
  }

  function pad(n, len) {
    var s = String(Math.max(0, n | 0));
    while (s.length < len) s = '0' + s;
    return s;
  }

  // keep text on the 8px tile grid so glyphs never land on half pixels
  function centerX(str) {
    return Math.floor((W - str.length * 8) / 2 / 8) * 8;
  }

  function drawSprite(sheet, tiles, x, y, flip) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.save();
    if (flip) {
      ctx.translate(x + 16, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }
    tile(sheet, tiles[0], x, y);
    tile(sheet, tiles[1], x + 8, y);
    tile(sheet, tiles[2], x, y + 8);
    tile(sheet, tiles[3], x + 8, y + 8);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * Procedural pixel art (bombs, fire, items, door)
   * ------------------------------------------------------------------ */
  function pcircle(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (var y = -r; y <= r; y++) {
      var w = Math.round(Math.sqrt(r * r - y * y));
      g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  }

  function buildBombFrames() {
    var frames = [];
    var sparks = [[10, 1], [11, 0], [12, 1], [11, 0]];
    for (var f = 0; f < 4; f++) {
      var c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      var g = c.getContext('2d');
      // fuse
      g.fillStyle = '#000';
      g.fillRect(9, 4, 1, 2);
      g.fillRect(10, 2, 1, 2);
      g.fillRect(11, 1, 1, 2);
      // body: black outline, grey shadow, white highlight
      pcircle(g, 8, 10, 6, '#000');
      pcircle(g, 8, 10, 5, COL_GREY);
      pcircle(g, 7, 9, 4, COL_WHITE);
      pcircle(g, 6, 8, 1, COL_WHITE);
      // spark
      var sp = sparks[f];
      g.fillStyle = COL_RED;
      g.fillRect(sp[0], sp[1], 2, 2);
      g.fillStyle = COL_WHITE;
      g.fillRect(sp[0], sp[1], 1, 1);
      frames.push(c);
    }
    return frames;
  }

  function buildFlameFrames() {
    var frames = [];
    var cfg = [[2, 4], [3, 6], [5, 8], [7, 9]];
    for (var f = 0; f < 4; f++) {
      var c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      var g = c.getContext('2d');
      var img = g.createImageData(16, 16);
      for (var y = 0; y < 16; y++) {
        for (var x = 0; x < 16; x++) {
          var d = Math.abs(x - 8) + Math.abs(y - 8);
          var j = ((x * 7 + y * 13 + f * 31) % 5 === 0) ? 1 : 0;
          var col = null;
          if (d <= cfg[f][0]) col = [236, 238, 236];
          else if (d <= cfg[f][1] + j) col = [236, 106, 100];
          else if (f >= 2 && d <= cfg[f][1] + j + 1) col = [152, 34, 32];
          if (col) {
            var o = (y * 16 + x) * 4;
            img.data[o] = col[0];
            img.data[o + 1] = col[1];
            img.data[o + 2] = col[2];
            img.data[o + 3] = 255;
          }
        }
      }
      g.putImageData(img, 0, 0);
      frames.push(c);
    }
    return frames;
  }

  var BOMB_FRAMES = buildBombFrames();
  var FLAME_FRAMES = buildFlameFrames();

  function drawDoor(x, y) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 3, y + 4, 10, 12);
    ctx.fillStyle = COL_WHITE;
    ctx.fillRect(x + 4, y + 2, 8, 1);
    ctx.fillRect(x + 3, y + 3, 10, 1);
    ctx.fillRect(x + 2, y + 4, 1, 11);
    ctx.fillRect(x + 13, y + 4, 1, 11);
    ctx.fillRect(x + 2, y + 15, 12, 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 4, y + 6, 8, 9);
    ctx.fillStyle = COL_BLUE;
    ctx.fillRect(x + 4, y + 5, 8, 1);
    ctx.fillStyle = COL_GREY;
    ctx.fillRect(x + 11, y + 10, 1, 1);
  }

  function drawItem(x, y, type) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2, y + 2, 12, 12);
    ctx.fillStyle = COL_WHITE;
    ctx.fillRect(x + 3, y + 3, 10, 10);
    if (type === 'fire') {
      ctx.fillStyle = COL_RED;
      ctx.fillRect(x + 7, y + 4, 2, 2);
      ctx.fillRect(x + 6, y + 6, 4, 2);
      ctx.fillRect(x + 5, y + 8, 6, 4);
      ctx.fillStyle = COL_WHITE;
      ctx.fillRect(x + 7, y + 8, 2, 3);
    } else if (type === 'bomb') {
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 6, y + 7, 4, 1);
      ctx.fillRect(x + 5, y + 8, 6, 4);
      ctx.fillRect(x + 6, y + 12, 4, 1);
      ctx.fillStyle = COL_GREY;
      ctx.fillRect(x + 6, y + 9, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 10, y + 6, 1, 1);
      ctx.fillRect(x + 11, y + 5, 1, 1);
    } else {
      ctx.fillStyle = COL_BLUE;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 5);
      ctx.lineTo(x + 7, y + 8);
      ctx.lineTo(x + 4, y + 11);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 5);
      ctx.lineTo(x + 11, y + 8);
      ctx.lineTo(x + 8, y + 11);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------------ *
   * Audio
   * ------------------------------------------------------------------ */
  var ac = null, master = null;

  function audioInit() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.22;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    lockLandscape();
  }

  // 尝试锁定横屏（原生清单已强制横屏，这里是 Web/PWA 的兜底，失败忽略）
  function lockLandscape() {
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(function () {});
      }
    } catch (e) {}
  }

  function tone(f0, f1, dur, type, vol, delay) {
    if (!ac) return;
    var t0 = ac.currentTime + (delay || 0);
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noiseBurst(dur, vol, f0, f1) {
    if (!ac) return;
    var n = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ac.createBufferSource();
    src.buffer = buf;
    var flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(f0, ac.currentTime);
    flt.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.5, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(master);
    src.start();
  }

  var sfxBudget = 0;
  function sfx(name) {
    if (!ac) return;
    if (name === 'place') {
      tone(660, 220, 0.1, 'square', 0.16);
    } else if (name === 'explode') {
      if (sfxBudget > 3) return;
      sfxBudget++;
      noiseBurst(0.38, 0.5, 1600, 100);
      tone(120, 40, 0.32, 'triangle', 0.25);
      if (navigator.vibrate) navigator.vibrate(18);
    } else if (name === 'brick') {
      tone(320, 120, 0.07, 'square', 0.1);
    } else if (name === 'kill') {
      tone(880, 440, 0.16, 'square', 0.16);
    } else if (name === 'item') {
      tone(660, 660, 0.07, 'square', 0.15);
      tone(880, 880, 0.07, 'square', 0.15, 0.07);
      tone(1320, 1320, 0.12, 'square', 0.15, 0.14);
    } else if (name === 'die') {
      tone(440, 110, 0.7, 'sawtooth', 0.2);
      noiseBurst(0.5, 0.25, 900, 80);
    } else if (name === 'door') {
      tone(523, 523, 0.1, 'square', 0.12);
      tone(784, 784, 0.18, 'square', 0.12, 0.1);
    } else if (name === 'clear') {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) tone(notes[i], notes[i], 0.16, 'square', 0.16, i * 0.13);
    } else if (name === 'start') {
      var n2 = [392, 523, 659];
      for (var j = 0; j < n2.length; j++) tone(n2[j], n2[j], 0.12, 'square', 0.14, j * 0.09);
    }
  }

  /* ------------------------------------------------------------------ *
   * Level data
   * ------------------------------------------------------------------ */
  var STAGE1 = [
    '################',
    '#.....BBBBB.BBB.',
    '#.#.#.#.#.#.#.#.',
    '#.........B..BBB',
    '#.#.#.#.#.#B#.#.',
    '#..........B....',
    '#.#.#.#.#.#.#.#.',
    '#B...B........B.',
    '#.#.#.#.#B#.#.#.',
    '#......BB.......',
    '#.#B#.#.#.#.#.#.',
    '#........B......',
    '################'
  ];

  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  var P = {
    x: 16, y: 16, dir: 'down', speed: 1.1, power: 1, maxBombs: 1,
    alive: true, invuln: 0, anim: 0, moving: false
  };

  var G = {
    state: 'title', tick: 0, stage: 1, score: 0, best: 0, lives: 3,
    time: 200, timeFrames: 0, introT: 0, clearT: 0, deathT: 0, shake: 0,
    cells: [], under: {}, bombs: [], flames: [], enemies: [], items: [],
    door: { c: 0, r: 0, appeared: false, visible: false },
    notice: '', noticeT: 0
  };

  var input = { up: false, down: false, left: false, right: false, bomb: false };
  var startReq = false;
  var prevBomb = false;

  /* ------------------------------------------------------------------ *
   * Input
   * ------------------------------------------------------------------ */
  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    Space: 'bomb', KeyZ: 'bomb', KeyK: 'bomb', KeyJ: 'bomb', Enter: 'start'
  };

  window.addEventListener('keydown', function (e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (k === 'start') startReq = true;
    else input[k] = true;
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (k !== 'start') input[k] = false;
  }, { passive: false });

  Array.prototype.forEach.call(document.querySelectorAll('[data-key]'), function (btn) {
    var k = btn.getAttribute('data-key');
    function set(v) {
      if (k === 'bomb') {
        input.bomb = v;
      } else {
        input[k] = v;
      }
      btn.classList.toggle('on', v);
    }
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      audioInit();
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      set(true);
    }, { passive: false });
    btn.addEventListener('pointerup', function (e) { e.preventDefault(); set(false); }, { passive: false });
    btn.addEventListener('pointercancel', function () { set(false); });
    btn.addEventListener('lostpointercapture', function () { set(false); });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });

  /* ------------------------------------------------------------------ *
   * 浮动摇杆（王者荣耀式：左侧触控区隐形，按下在指尖浮现底座 + 摇杆头）
   * ------------------------------------------------------------------ */
  var joyZone = document.getElementById('joystickZone');
  var joyBase = document.getElementById('joyBase');
  var joyKnob = document.getElementById('joyKnob');
  var joy = { active: false, id: null, ox: 0, oy: 0, R: 60 };

  function joyClearDir() {
    input.left = input.right = input.up = input.down = false;
  }

  function joyApply(x, y) {
    var dx = x - joy.ox, dy = y - joy.oy;
    var d = Math.hypot(dx, dy);
    var R = joy.R;
    if (d > R && d > 0) { dx = dx / d * R; dy = dy / d * R; }
    joyKnob.style.left = (joy.ox + dx) + 'px';
    joyKnob.style.top = (joy.oy + dy) + 'px';
    joyClearDir();
    var dead = R * 0.15;
    if (d >= dead) {
      if (Math.abs(dx) > Math.abs(dy)) { input.left = dx < 0; input.right = dx > 0; }
      else { input.up = dy < 0; input.down = dy > 0; }
    }
  }

  function joyStart(e) {
    audioInit();
    tapScreen(); // 标题/结束界面下触摸左侧也能开始游戏
    joy.active = true;
    joy.id = e.pointerId;
    joy.ox = e.clientX;
    joy.oy = e.clientY;
    joyBase.style.left = joy.ox + 'px';
    joyBase.style.top = joy.oy + 'px';
    joyBase.classList.add('show');
    joyKnob.classList.add('show');
    joyApply(e.clientX, e.clientY);
    try { joyZone.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function joyEnd() {
    joy.active = false;
    joy.id = null;
    joyClearDir();
    joyBase.classList.remove('show');
    joyKnob.classList.remove('show');
  }

  joyZone.addEventListener('pointerdown', function (e) { e.preventDefault(); joyStart(e); }, { passive: false });
  joyZone.addEventListener('pointermove', function (e) {
    if (!joy.active || e.pointerId !== joy.id) return;
    e.preventDefault();
    joyApply(e.clientX, e.clientY);
  }, { passive: false });
  joyZone.addEventListener('pointerup', function (e) { if (e.pointerId === joy.id) { e.preventDefault(); joyEnd(); } }, { passive: false });
  joyZone.addEventListener('pointercancel', function () { joyEnd(); });
  joyZone.addEventListener('lostpointercapture', function () { joyEnd(); });
  joyZone.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function tapScreen() {
    audioInit();
    if (G.state === 'title' || G.state === 'gameover') startReq = true;
  }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); tapScreen(); }, { passive: false });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ------------------------------------------------------------------ *
   * Collision helpers
   * ------------------------------------------------------------------ */
  function bombAt(c, r) {
    for (var i = 0; i < G.bombs.length; i++) {
      var b = G.bombs[i];
      if (!b.dead && b.c === c && b.r === r) return b;
    }
    return null;
  }

  // 玩家当前的收缩碰撞盒是否仍与炸弹所在格重叠——身体完全离开前都可以穿过自己放的炸弹
  function playerOnBomb(b) {
    return P.x + 3 < (b.c + 1) * 16 && P.x + 12 > b.c * 16 &&
           P.y + 3 < (b.r + 1) * 16 && P.y + 12 > b.r * 16;
  }

  function canStand(x, y) {
    if (x < 0 || y < 0 || x > FIELD_W - 16 || y > FIELD_H - 16) return false;
    var x0 = Math.floor((x + 3) / 16), x1 = Math.floor((x + 12) / 16);
    var y0 = Math.floor((y + 3) / 16), y1 = Math.floor((y + 12) / 16);
    for (var r = y0; r <= y1; r++) {
      for (var c = x0; c <= x1; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
        if (G.cells[r][c] !== 0) return false;
        var b = bombAt(c, r);
        if (b && !(b.owner === 'p' && playerOnBomb(b))) return false;
      }
    }
    return true;
  }

  function enemyCanStand(x, y) {
    if (x < 0 || y < 0 || x > FIELD_W - 16 || y > FIELD_H - 16) return false;
    var x0 = Math.floor((x + 4) / 16), x1 = Math.floor((x + 11) / 16);
    var y0 = Math.floor((y + 4) / 16), y1 = Math.floor((y + 11) / 16);
    for (var r = y0; r <= y1; r++) {
      for (var c = x0; c <= x1; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
        if (G.cells[r][c] !== 0) return false;
        if (bombAt(c, r)) return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Stage building
   * ------------------------------------------------------------------ */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function makeEnemy(c, r) {
    return {
      x: c * 16, y: r * 16, dir: 1,
      speed: 0.55 + Math.min(0.3, (G.stage - 1) * 0.035),
      think: 30 + Math.floor(Math.random() * 60),
      seed: Math.floor(Math.random() * 97)
    };
  }

  function resetPlayer() {
    P.x = 16;
    P.y = 16;
    P.dir = 'down';
    P.alive = true;
    P.invuln = 100;
    P.anim = 0;
    P.moving = false;
  }

  function buildStage(n) {
    G.stage = n;
    var cells = [], r, c;
    for (r = 0; r < ROWS; r++) {
      var row = [];
      for (c = 0; c < COLS; c++) row.push(0);
      cells.push(row);
    }

    if (n === 1) {
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          var ch = STAGE1[r].charAt(c);
          cells[r][c] = ch === '#' ? 1 : ch === 'B' ? 2 : 0;
        }
      }
    } else {
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          var border = (r === 0 || r === ROWS - 1 || c === 0);
          var pillar = (c % 2 === 0 && r % 2 === 0 && c < COLS - 1 && r > 0 && r < ROWS - 1);
          cells[r][c] = (border || pillar) ? 1 : 0;
        }
      }
      for (r = 1; r < ROWS - 1; r++) {
        for (c = 1; c < COLS; c++) {
          if (cells[r][c] !== 0) continue;
          if (c <= 2 && r <= 2) continue;
          if (c === COLS - 1) {
            if (Math.random() < 0.3) cells[r][c] = 2;
          } else if (Math.random() < 0.44) {
            cells[r][c] = 2;
          }
        }
      }
    }

    G.cells = cells;
    G.under = {};
    G.items = [];
    G.bombs = [];
    G.flames = [];
    G.enemies = [];
    G.door = { c: 8, r: 8, appeared: false, visible: false };
    G.shake = 0;
    P.power = Math.max(1, P.power);
    P.maxBombs = Math.max(1, P.maxBombs);
    P.speed = Math.max(1.1, P.speed);

    var bricks = [];
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) if (cells[r][c] === 2) bricks.push([c, r]);
    }
    shuffle(bricks);

    if (bricks.length) {
      var d = bricks.pop();
      G.door = { c: d[0], r: d[1], appeared: false, visible: false };
      G.under[d[0] + ',' + d[1]] = { type: 'door' };
    } else {
      G.door = { c: 1, r: 1, appeared: true, visible: false };
    }

    var types = ['fire', 'bomb', 'speed'];
    var nItems = 2 + (n > 3 ? 1 : 0);
    for (var i = 0; i < nItems && bricks.length; i++) {
      var b = bricks.pop();
      G.under[b[0] + ',' + b[1]] = { type: types[i % types.length] };
    }

    var count = n === 1 ? 2 : Math.min(7, 2 + Math.floor((n + 1) / 3));
    var spots = [];
    if (n === 1) {
      spots = [[14, 11], [13, 5]];
    } else {
      var tries = 0;
      while (spots.length < count && tries < 800) {
        tries++;
        var ec = 1 + Math.floor(Math.random() * (COLS - 1));
        var er = 1 + Math.floor(Math.random() * (ROWS - 2));
        if (cells[er][ec] !== 0) continue;
        if (Math.abs(ec - 1) + Math.abs(er - 1) < 6) continue;
        if (ec === G.door.c && er === G.door.r) continue;
        var dup = false;
        for (var s = 0; s < spots.length; s++) {
          if (spots[s][0] === ec && spots[s][1] === er) dup = true;
        }
        if (!dup) spots.push([ec, er]);
      }
    }
    for (var k = 0; k < spots.length; k++) G.enemies.push(makeEnemy(spots[k][0], spots[k][1]));

    resetPlayer();
    G.time = 200;
    G.timeFrames = 0;
    G.state = 'intro';
    G.introT = 85;
    G.notice = '';
    G.noticeT = 0;
    prevBomb = false;
    redrawBg();
  }

  function notice(text, frames) {
    G.notice = text;
    G.noticeT = frames || 60;
  }

  function startGame() {
    G.score = 0;
    G.lives = 3;
    P.power = 1;
    P.maxBombs = 1;
    P.speed = 1.1;
    startReq = false;
    buildStage(1);
    sfx('start');
  }

  /* ------------------------------------------------------------------ *
   * Background rendering (cached)
   * ------------------------------------------------------------------ */
  var bgCv = document.createElement('canvas');
  bgCv.width = W;
  bgCv.height = H;
  var bgx = bgCv.getContext('2d');
  bgx.imageSmoothingEnabled = false;

  var WALL_TILES = [0x64, 0x65, 0x66, 0x67];
  var BRICK_TILES = [0x68, 0x69, 0x6A, 0x6B];

  function drawBgTile(t, x, y) {
    bgx.drawImage(BG_SHEET, (t & 15) << 3, (t >> 4) << 3, 8, 8, x, y, 8, 8);
  }

  function redrawBg() {
    bgx.clearRect(0, 0, W, H);
    var r, c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var x = c * 16, y = FIELD_Y + r * 16;
        drawBgTile(0x5F, x, y);
        drawBgTile(0x5F, x + 8, y);
        drawBgTile(0x5F, x, y + 8);
        drawBgTile(0x5F, x + 8, y + 8);
        if (G.cells[r][c] === 1) {
          drawBgTile(WALL_TILES[0], x, y);
          drawBgTile(WALL_TILES[1], x + 8, y);
          drawBgTile(WALL_TILES[2], x, y + 8);
          drawBgTile(WALL_TILES[3], x + 8, y + 8);
        } else if (G.cells[r][c] === 2) {
          drawBgTile(BRICK_TILES[0], x, y);
          drawBgTile(BRICK_TILES[1], x + 8, y);
          drawBgTile(BRICK_TILES[2], x, y + 8);
          drawBgTile(BRICK_TILES[3], x + 8, y + 8);
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Title screen (original nametable)
   * ------------------------------------------------------------------ */
  var titleCv = (function () {
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    var rows = window.TITLE_ROWS || [];
    for (var r = 0; r < rows.length; r++) {
      for (var col = 0; col < 32; col++) {
        var t = parseInt(rows[r].substr(col * 2, 2), 16);
        g.drawImage(TITLE_SHEET, (t & 15) << 3, (t >> 4) << 3, 8, 8, col * 8, r * 8, 8, 8);
      }
    }
    return c;
  })();

  function drawTitle() {
    ctx.drawImage(titleCv, 0, 0);
    if (Math.floor(G.tick / 28) % 2 === 0) {
      var msg = 'TAP TO START';
      drawText(msg, centerX(msg), 208, TITLE_SHEET);
    }
  }

  /* ------------------------------------------------------------------ *
   * Gameplay
   * ------------------------------------------------------------------ */
  function tileFree(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && G.cells[r][c] === 0;
  }

  function placeBomb() {
    var c = (P.x + 8) >> 4, r = (P.y + 8) >> 4;
    var mine = 0;
    for (var i = 0; i < G.bombs.length; i++) if (!G.bombs[i].dead && G.bombs[i].owner === 'p') mine++;
    if (mine >= P.maxBombs) return;
    if (!tileFree(c, r)) return;
    var b = bombAt(c, r);
    if (b) return;
    G.bombs.push({ c: c, r: r, fuse: 130, power: P.power, owner: 'p', dead: false });
    sfx('place');
  }

  function addFlame(c, r) {
    G.flames.push({ c: c, r: r, life: 30 });
  }

  function destroyBrick(c, r) {
    if (G.cells[r][c] !== 2) return;
    G.cells[r][c] = 0;
    G.score += 10;
    redrawBg();
    var key = c + ',' + r;
    var u = G.under[key];
    if (u) {
      delete G.under[key];
      if (u.type === 'door') {
        G.door.appeared = true;
      } else {
        G.items.push({ c: c, r: r, type: u.type, t: 0 });
      }
    }
  }

  function explode(b) {
    if (b.dead) return;
    b.dead = true;
    addFlame(b.c, b.r);
    for (var d = 0; d < 4; d++) {
      for (var i = 1; i <= b.power; i++) {
        var c = b.c + DIRS[d][0] * i;
        var r = b.r + DIRS[d][1] * i;
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
        if (G.cells[r][c] === 1) break;
        if (G.cells[r][c] === 2) {
          destroyBrick(c, r);
          addFlame(c, r);
          break;
        }
        addFlame(c, r);
        var other = bombAt(c, r);
        if (other) {
          other.fuse = Math.min(other.fuse, 3);
          break;
        }
      }
    }
    G.shake = 7;
    sfx('explode');
  }

  function flameAt(c, r) {
    for (var i = 0; i < G.flames.length; i++) {
      if (G.flames[i].c === c && G.flames[i].r === r) return true;
    }
    return false;
  }

  function updatePlayer() {
    var dx = 0, dy = 0;
    if (input.left) dx = -1;
    else if (input.right) dx = 1;
    else if (input.up) dy = -1;
    else if (input.down) dy = 1;

    if (dx !== 0) P.dir = dx < 0 ? 'left' : 'right';
    else if (dy !== 0) P.dir = dy < 0 ? 'up' : 'down';

    // gently snap to the grid on the axis we are not moving along
    if (dx !== 0) {
      var ty = Math.round(P.y / 16) * 16;
      if (P.y !== ty) {
        var sy = ty > P.y ? 1 : -1;
        if (canStand(P.x, P.y + sy)) P.y += sy;
      }
    } else if (dy !== 0) {
      var tx = Math.round(P.x / 16) * 16;
      if (P.x !== tx) {
        var sx = tx > P.x ? 1 : -1;
        if (canStand(P.x + sx, P.y)) P.x += sx;
      }
    }

    P.moving = false;
    if (dx !== 0 || dy !== 0) {
      var steps = Math.max(1, Math.ceil(P.speed / 2));
      var step = P.speed / steps;
      for (var s = 0; s < steps; s++) {
        if (!stepPlayer(dx * step, dy * step)) break;
        P.moving = true;
      }
    }

    if (input.bomb && !prevBomb) placeBomb();
    prevBomb = input.bomb;
    if (P.invuln > 0) P.invuln--;
  }

  function stepPlayer(mx, my) {
    var nx = P.x + mx, ny = P.y + my;
    if (canStand(nx, ny)) {
      P.x = nx;
      P.y = ny;
      return true;
    }
    // corner assist: slide up to 5px sideways to enter a corridor
    if (mx !== 0) {
      var ty = Math.round(P.y / 16) * 16;
      var d = ty - P.y;
      if (d !== 0 && Math.abs(d) <= 5) {
        var sy = (d > 0 ? 1 : -1) * Math.min(Math.abs(d), Math.abs(mx));
        if (canStand(nx, P.y + sy)) {
          P.y += sy;
          P.x = nx;
          return true;
        }
      }
    } else if (my !== 0) {
      var tx = Math.round(P.x / 16) * 16;
      var d2 = tx - P.x;
      if (d2 !== 0 && Math.abs(d2) <= 5) {
        var sx = (d2 > 0 ? 1 : -1) * Math.min(Math.abs(d2), Math.abs(my));
        if (canStand(P.x + sx, ny)) {
          P.x += sx;
          P.y = ny;
          return true;
        }
      }
    }
    return false;
  }

  function updateEnemy(e) {
    e.think--;
    var cx = e.x + 8, cy = e.y + 8;
    var c = Math.floor(cx / 16), r = Math.floor(cy / 16);
    var dir = DIRS[e.dir];
    var centered = Math.abs(cx - (c * 16 + 8)) < 3 && Math.abs(cy - (r * 16 + 8)) < 3;
    var nextOpen = enemyCanStand(e.x + dir[0] * 4, e.y + dir[1] * 4);

    if (centered && (!nextOpen || e.think <= 0)) {
      e.x = c * 16;
      e.y = r * 16;
      var opts = [];
      for (var d = 0; d < 4; d++) {
        if (enemyCanStand((c + DIRS[d][0]) * 16, (r + DIRS[d][1]) * 16)) opts.push(d);
      }
      if (opts.length) {
        var pick = -1;
        if (Math.random() < 0.55) {
          var pc = (P.x + 8) >> 4, pr = (P.y + 8) >> 4;
          var best = 1e9;
          for (var i = 0; i < opts.length; i++) {
            var nc = c + DIRS[opts[i]][0], nr = r + DIRS[opts[i]][1];
            var dist = Math.abs(nc - pc) + Math.abs(nr - pr);
            if (opts[i] === ((e.dir + 2) % 4)) dist += 2;
            if (dist < best) { best = dist; pick = opts[i]; }
          }
        } else {
          var noRev = [];
          for (var j = 0; j < opts.length; j++) if (opts[j] !== ((e.dir + 2) % 4)) noRev.push(opts[j]);
          var list = noRev.length ? noRev : opts;
          pick = list[Math.floor(Math.random() * list.length)];
        }
        e.dir = pick;
        e.think = 60 + Math.floor(Math.random() * 70);
      }
    }

    var m = DIRS[e.dir];
    if (enemyCanStand(e.x + m[0] * e.speed, e.y + m[1] * e.speed)) {
      e.x += m[0] * e.speed;
      e.y += m[1] * e.speed;
    } else {
      e.x = Math.round(e.x / 16) * 16;
      e.y = Math.round(e.y / 16) * 16;
      e.think = 0;
    }
  }

  function killPlayer() {
    if (G.state !== 'playing') return;
    G.state = 'dying';
    G.deathT = 95;
    P.alive = false;
    G.shake = 9;
    sfx('die');
  }

  function stageClear() {
    G.state = 'clear';
    G.clearT = 160;
    G.score += 500 + G.time * 10;
    sfx('clear');
  }

  function update() {
    G.tick++;
    if (sfxBudget > 0 && (G.tick & 3) === 0) sfxBudget--;
    if (G.shake > 0) G.shake--;
    if (G.noticeT > 0) G.noticeT--;

    if (G.state === 'title') {
      if (startReq) {
        startReq = false;
        startGame();
      }
      return;
    }

    if (G.state === 'intro') {
      G.introT--;
      if (G.introT <= 0) G.state = 'playing';
      return;
    }

    if (G.state === 'gameover') {
      if (startReq) {
        startReq = false;
        startGame();
      }
      return;
    }

    if (G.state === 'dying') {
      for (var f = G.flames.length - 1; f >= 0; f--) {
        if (--G.flames[f].life <= 0) G.flames.splice(f, 1);
      }
      G.deathT--;
      if (G.deathT <= 0) {
        G.lives--;
        if (G.lives < 0) {
          G.state = 'gameover';
          if (G.score > G.best) {
            G.best = G.score;
            try { localStorage.setItem('bm_best', String(G.best)); } catch (err) {}
          }
        } else {
          resetPlayer();
          for (var bi = G.bombs.length - 1; bi >= 0; bi--) if (G.bombs[bi].owner === 'p') G.bombs.splice(bi, 1);
          G.flames.length = 0;
          notice('LIVES ' + G.lives, 70);
          G.state = 'playing';
          prevBomb = input.bomb;
        }
      }
      return;
    }

    if (G.state === 'clear') {
      G.clearT--;
      if (G.clearT <= 0) buildStage(G.stage + 1);
      return;
    }

    if (G.state !== 'playing') return;

    // countdown: 36 frames per TIME unit
    G.timeFrames++;
    if (G.timeFrames >= 36) {
      G.timeFrames = 0;
      G.time--;
      if (G.time <= 0) {
        G.time = 0;
        killPlayer();
        return;
      }
    }

    updatePlayer();

    // bombs
    for (var i = 0; i < G.bombs.length; i++) {
      var b = G.bombs[i];
      if (b.dead) continue;
      b.fuse--;
      if (b.fuse <= 0) explode(b);
    }
    for (var i2 = G.bombs.length - 1; i2 >= 0; i2--) if (G.bombs[i2].dead) G.bombs.splice(i2, 1);

    // flames
    for (var i3 = G.flames.length - 1; i3 >= 0; i3--) {
      if (--G.flames[i3].life <= 0) G.flames.splice(i3, 1);
    }

    // enemies
    for (var e = 0; e < G.enemies.length; e++) updateEnemy(G.enemies[e]);

    // items
    var pcc = (P.x + 8) >> 4, prr = (P.y + 8) >> 4;
    for (var it = G.items.length - 1; it >= 0; it--) {
      var item = G.items[it];
      item.t++;
      if (item.c === pcc && item.r === prr) {
        if (item.type === 'fire') { P.power = Math.min(8, P.power + 1); notice('FIRE UP', 50); }
        else if (item.type === 'bomb') { P.maxBombs = Math.min(5, P.maxBombs + 1); notice('BOMB UP', 50); }
        else { P.speed = Math.min(1.9, P.speed + 0.22); notice('SPEED UP', 50); }
        G.score += 100;
        G.items.splice(it, 1);
        sfx('item');
      }
    }

    // flame damage to enemies
    for (var ei = G.enemies.length - 1; ei >= 0; ei--) {
      var en = G.enemies[ei];
      var ec = Math.floor((en.x + 8) / 16), er = Math.floor((en.y + 8) / 16);
      if (flameAt(ec, er)) {
        G.enemies.splice(ei, 1);
        G.score += 200;
        sfx('kill');
      }
    }

    // unlocking the exit
    if (G.enemies.length === 0 && !G.door.visible) {
      G.door.visible = true;
      G.door.appeared = true;
      if (G.cells[G.door.r][G.door.c] === 2) {
        G.cells[G.door.r][G.door.c] = 0;
        delete G.under[G.door.c + ',' + G.door.r];
        redrawBg();
      }
      sfx('door');
    }

    // player in flame
    if (P.invuln <= 0 && flameAt(pcc, prr)) {
      killPlayer();
      return;
    }

    // enemy touching player
    for (var ej = 0; ej < G.enemies.length; ej++) {
      var en2 = G.enemies[ej];
      if (Math.abs(en2.x - P.x) < 12 && Math.abs(en2.y - P.y) < 12 && P.invuln <= 0) {
        killPlayer();
        return;
      }
    }

    // exit reached
    if (G.door.visible && pcc === G.door.c && prr === G.door.r) {
      stageClear();
    }
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  var P_STAND = [0x00, 0x01, 0x10, 0x11];
  var P_WALK1 = [0x02, 0x03, 0x12, 0x13];
  var P_WALK2 = [0x04, 0x05, 0x14, 0x15];
  var E_TILES = [0x62, 0x63, 0x72, 0x73];

  function drawHud() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, FIELD_Y);
    drawText('TIME', 8, 16);
    drawText(pad(G.time, 3), 48, 16);
    var sc = pad(G.score, 5);
    drawText(sc, centerX(sc), 16);
    var left = 'LEFT ' + G.enemies.length;
    drawText(left, 248 - left.length * 8, 16);
  }

  function drawPlayer() {
    if (G.state === 'dying') {
      var t = 95 - G.deathT;
      if ((t >> 2) % 2 === 0) {
        drawSprite(PLAYER_SHEET, P_STAND, P.x, FIELD_Y + P.y - (t >> 4), false);
      }
      return;
    }
    if (!P.alive) return;
    if (P.invuln > 0 && (G.tick >> 2) % 2 === 0) return;
    var frames = P_STAND;
    if (P.moving) {
      P.anim++;
      var idx = [0, 1, 0, 2][Math.floor(P.anim / 6) % 4];
      frames = idx === 1 ? P_WALK1 : idx === 2 ? P_WALK2 : P_STAND;
    } else {
      P.anim = 0;
    }
    drawSprite(PLAYER_SHEET, frames, P.x, FIELD_Y + P.y, P.dir === 'left');
  }

  function render() {
    ctx.setTransform(BACK_SCALE, 0, 0, BACK_SCALE, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    var sx = 0, sy = 0;
    if (G.shake > 0) {
      sx = (Math.random() * 3 | 0) - 1;
      sy = (Math.random() * 3 | 0) - 1;
    }
    ctx.save();
    ctx.translate(sx, sy);

    if (G.state === 'title') {
      drawTitle();
    } else {
      ctx.drawImage(bgCv, 0, 0);
      if (G.door.visible) {
        drawDoor(G.door.c * 16, FIELD_Y + G.door.r * 16);
      }

      var i;
      for (i = 0; i < G.items.length; i++) {
        var it = G.items[i];
        drawItem(it.c * 16, FIELD_Y + it.r * 16, it.type);
      }

      for (i = 0; i < G.bombs.length; i++) {
        var b = G.bombs[i];
        if (b.dead) continue;
        var bf = (G.tick >> 3) % 4;
        if (b.fuse < 30) bf = (G.tick >> 1) % 4;
        ctx.drawImage(BOMB_FRAMES[bf], b.c * 16, FIELD_Y + b.r * 16);
      }

      for (i = 0; i < G.flames.length; i++) {
        var fl = G.flames[i];
        var elapsed = 30 - fl.life;
        var fi = elapsed < 4 ? 0 : elapsed < 10 ? 1 : elapsed < 19 ? 2 : 3;
        ctx.drawImage(FLAME_FRAMES[fi], fl.c * 16, FIELD_Y + fl.r * 16);
      }

      for (i = 0; i < G.enemies.length; i++) {
        var en = G.enemies[i];
        var bob = ((G.tick >> 4) + en.seed) & 1;
        drawSprite(ENEMY_SHEET, E_TILES, en.x, FIELD_Y + en.y + bob, DIRS[en.dir][0] < 0);
      }

      drawPlayer();
      drawHud();

      if (G.noticeT > 0 && G.notice && G.state === 'playing') {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 88, W, 20);
        drawText(G.notice, centerX(G.notice), 96);
      }

      if (G.state === 'intro') {
        var msg = 'STAGE ' + G.stage;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(0, 96, W, 48);
        drawText(msg, centerX(msg), 104);
        var sub = 'LEFT ' + G.enemies.length;
        drawText(sub, centerX(sub), 120);
      } else if (G.state === 'clear') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 88, W, 64);
        var m1 = 'STAGE CLEAR';
        drawText(m1, centerX(m1), 104);
        var m2 = 'BONUS ' + pad(500 + G.time * 10, 5);
        drawText(m2, centerX(m2), 120);
      } else if (G.state === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.86)';
        ctx.fillRect(0, 72, W, 104);
        var g1 = 'GAME OVER';
        drawText(g1, centerX(g1), 88);
        var g2 = 'SCORE ' + pad(G.score, 5);
        drawText(g2, centerX(g2), 104);
        var g3 = 'BEST ' + pad(Math.max(G.best, G.score), 5);
        drawText(g3, centerX(g3), 120);
        if (Math.floor(G.tick / 28) % 2 === 0) {
          var g4 = 'TAP TO PLAY';
          drawText(g4, centerX(g4), 144);
        }
      }
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * Resize / boot
   * ------------------------------------------------------------------ */
  var wrap = document.getElementById('screenWrap');
  var BACK_SCALE = 1;

  function fitScreen() {
    var availW = wrap.clientWidth - 12;
    var availH = wrap.clientHeight - 12;
    if (availW <= 0 || availH <= 0) return;
    var s = Math.min(availW / W, availH / H);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
    // Render into a backing store that matches the physical pixel size so the
    // 8x8 tile art stays crisp on high-DPI phones.
    var dpr = window.devicePixelRatio || 1;
    var backing = Math.max(2, Math.min(5, Math.ceil(s * dpr)));
    if (cv.width !== W * backing || cv.height !== H * backing) {
      cv.width = W * backing;
      cv.height = H * backing;
      ctx.imageSmoothingEnabled = false;
    }
    BACK_SCALE = backing;
  }

  window.addEventListener('resize', fitScreen);
  window.addEventListener('orientationchange', function () { setTimeout(fitScreen, 150); });
  if (window.ResizeObserver) {
    new ResizeObserver(fitScreen).observe(wrap);
  }

  try {
    G.best = parseInt(localStorage.getItem('bm_best') || '0', 10) || 0;
  } catch (err) {
    G.best = 0;
  }

  // an empty map so the cached background exists before the first stage
  G.cells = [];
  for (var rr = 0; rr < ROWS; rr++) {
    var row = [];
    for (var cc = 0; cc < COLS; cc++) row.push(0);
    G.cells.push(row);
  }
  redrawBg();
  fitScreen();

  var last = performance.now();
  var acc = 0;
  var STEP = 1000 / 60;

  function loop(now) {
    var dt = now - last;
    last = now;
    if (dt > 200) dt = 200;
    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard++ < 8) {
      update();
      acc -= STEP;
    }
    render();
    requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', function () {
    last = performance.now();
    acc = 0;
  });

  requestAnimationFrame(loop);
})();
