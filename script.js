(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const startEl = document.getElementById('start');
  const gameoverEl = document.getElementById('gameover');
  const muteBtn = document.getElementById('mute');

  const STORAGE_KEY = 'fallpyBest';
  let best = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  bestEl.textContent = 'Best: ' + best;

  const WIDTH = canvas.width; const HEIGHT = canvas.height;

  let state = 'idle'; // idle, playing, over
  let frame = 0;

  // Audio (WebAudio) for jump SFX
  let audioCtx = null;
  const MUTE_KEY = 'fallpyMute';
  let muted = localStorage.getItem(MUTE_KEY) === '1';
  updateMuteButton();

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
  }

  function sfxFlap() {
    if (muted || !audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(920, t);
    o.frequency.exponentialRampToValueAtTime(540, t + 0.12);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.14);
  }

  function updateMuteButton() {
    if (!muteBtn) return;
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.textContent = muted ? '🔈' : '🔊';
    muteBtn.title = muted ? 'Unmute' : 'Mute';
  }

  // Bird
  const bird = { x: WIDTH / 3, y: HEIGHT / 2, r: 12, vy: 0 };
  const GRAVITY = 0.45; const FLAP = -8.5;

  // Pipes
  let pipes = []; // each: {x, gapY, passed:false}
  const PIPE_W = 52; const GAP = 120; const SPAWN_INTERVAL = 110; // frames
  let spawnTimer = 0;
  let speed = 2.4;

  // Coins (chicken legs) — collected by bird for extra points
  let coins = []; // each: {x,y,r, collected}
  const COIN_R = 9;
  let legsCollected = 0;

  let score = 0;

  function reset() {
    bird.y = HEIGHT / 2; bird.vy = 0;
    pipes = []; spawnTimer = 40; score = 0; frame = 0; speed = 2.4;
    state = 'idle'; startEl.classList.remove('hidden'); gameoverEl.classList.add('hidden');
    scoreEl.textContent = '0';
    // reset coins HUD
    legsCollected = 0; const coinsEl = document.getElementById('coins'); if (coinsEl) coinsEl.textContent = 'Legs: 0';
  }

  function spawnPipe() {
    const margin = 40; const top = margin + Math.random() * (HEIGHT - GAP - margin * 2);
    pipes.push({ x: WIDTH + 20, gapY: top, passed: false });
  }

  function maybeAttachCoinToPipe(pipe) {
    // 60% chance to attach a collectible inside the gap
    if (Math.random() < 0.6) {
      const cx = pipe.x + PIPE_W + 30; // place just after the pipe's front
      const cy = pipe.gapY + GAP / 2 + (Math.random() * 30 - 15);
      coins.push({ x: cx, y: cy, r: COIN_R, collected: false });
    }
  }

  function update() {
    frame++;
    if (state === 'playing') {
      // bird physics
      bird.vy += GRAVITY;
      bird.y += bird.vy;

      // spawn pipes
      spawnTimer--;
      if (spawnTimer <= 0) { spawnTimer = SPAWN_INTERVAL - Math.floor(Math.min(50, score / 5)); const p = { x: WIDTH + 20, gapY: (40 + Math.random() * (HEIGHT - GAP - 80)), passed: false }; pipes.push(p); maybeAttachCoinToPipe(p); }

      // move pipes
      for (let p of pipes) p.x -= speed;
      // remove offscreen
      pipes = pipes.filter(p => p.x + PIPE_W > -10);

      // scoring
      for (let p of pipes) {
        if (!p.passed && p.x + PIPE_W < bird.x - bird.r) { p.passed = true; score++; scoreEl.textContent = score; speed += 0.02; }
      }

      // move coins (they share the same forward speed as pipes)
      for (let c of coins) c.x -= speed;
      coins = coins.filter(c => !c.collected && c.x + c.r > -10);

      // collisions
      if (bird.y + bird.r > HEIGHT) { gameOver(); }
      if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }

      for (let p of pipes) {
        const bx = bird.x; const by = bird.y; const r = bird.r;
        // pipe rects
        const topRect = { x: p.x, y: 0, w: PIPE_W, h: p.gapY };
        const botRect = { x: p.x, y: p.gapY + GAP, w: PIPE_W, h: HEIGHT - (p.gapY + GAP) };
        if (circleRectCollision(bx, by, r, topRect) || circleRectCollision(bx, by, r, botRect)) { gameOver(); }
      }

      // coin collisions
      for (let c of coins) {
        const dx = bird.x - c.x; const dy = bird.y - c.y; const dist2 = dx * dx + dy * dy;
        if (dist2 < (bird.r + c.r) * (bird.r + c.r)) {
          c.collected = true; legsCollected++; document.getElementById('coins').textContent = 'Legs: ' + legsCollected; score += 2; scoreEl.textContent = score; // reward extra score
        }
      }
    }
    draw();
    if (state !== 'over') requestAnimationFrame(update);
  }

  function gameOver() {
    state = 'over';
    gameoverEl.classList.remove('hidden');

    // Populate game over stats
    const finalScoreEl = document.getElementById('final-score');
    const finalLegsEl = document.getElementById('final-legs');
    const finalBestEl = document.getElementById('final-best');
    const newRecordEl = document.getElementById('new-record');

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (finalLegsEl) finalLegsEl.textContent = legsCollected;

    // Check for new record
    const isNewRecord = score > best;
    if (isNewRecord) {
      best = score;
      localStorage.setItem(STORAGE_KEY, best);
      bestEl.textContent = 'Best: ' + best;
      if (newRecordEl) newRecordEl.classList.remove('hidden');
    } else {
      if (newRecordEl) newRecordEl.classList.add('hidden');
    }

    if (finalBestEl) finalBestEl.textContent = best;
  }

  function draw() {
    // clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // sky gradient (cooler, layered)
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#6ec1ff'); g.addColorStop(0.5, '#bfe9ff'); g.addColorStop(1, '#dff6ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // parallax hills (two layers)
    const hillOffset = (frame * 0.2) % WIDTH;
    ctx.fillStyle = '#88c27a';
    ctx.beginPath();
    ctx.moveTo(-WIDTH + hillOffset, HEIGHT - 60);
    for (let x = -WIDTH; x <= WIDTH * 2; x += 60) {
      const y = HEIGHT - 60 - Math.sin((x + frame * 0.6) * 0.01) * 18 - 6 * Math.sin(x * 0.02);
      ctx.lineTo(x + hillOffset, y);
    }
    ctx.lineTo(WIDTH, HEIGHT); ctx.lineTo(0, HEIGHT); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#6aa85f';
    ctx.beginPath();
    ctx.moveTo(-WIDTH + hillOffset * 0.6, HEIGHT - 40);
    for (let x = -WIDTH; x <= WIDTH * 2; x += 80) {
      const y = HEIGHT - 40 - Math.sin((x + frame * 0.3) * 0.008) * 12;
      ctx.lineTo(x + hillOffset * 0.6, y);
    }
    ctx.lineTo(WIDTH, HEIGHT); ctx.lineTo(0, HEIGHT); ctx.closePath(); ctx.fill();

    // pipes
    for (let p of pipes) {
      ctx.fillStyle = '#1b6';
      roundRect(ctx, p.x, 0, PIPE_W, p.gapY, 6, true, false);
      roundRect(ctx, p.x, p.gapY + GAP, PIPE_W, HEIGHT - (p.gapY + GAP), 6, true, false);
      // rim
      ctx.fillStyle = '#0a4'; ctx.fillRect(p.x + PIPE_W - 6, 0, 6, p.gapY);
      ctx.fillRect(p.x + PIPE_W - 6, p.gapY + GAP, 6, HEIGHT - (p.gapY + GAP));
    }

    // coins (chicken legs)
    for (let c of coins) {
      if (c.collected) continue;
      drawChickenLeg(ctx, c.x, c.y, c.r);
    }

    // ground
    ctx.fillStyle = '#c48'; ctx.fillRect(0, HEIGHT - 32, WIDTH, 32);

    // bird (black)
    ctx.save();
    ctx.translate(bird.x, bird.y);
    const angle = Math.max(-0.6, Math.min(0.8, bird.vy * 0.06));
    ctx.rotate(angle);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI * 2); ctx.fill();
    // eye (white small)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // overlay texts
    if (state === 'idle') {
      startEl.classList.remove('hidden');
    } else {
      startEl.classList.add('hidden');
    }
  }

  function circleRectCollision(cx, cy, r, rect) {
    const rx = rect.x; const ry = rect.y; const rw = rect.w; const rh = rect.h;
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX; const dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) { if (typeof r === 'undefined') r = 5; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) ctx.fill(); if (stroke) ctx.stroke(); }

  // Draw a stylized chicken leg (meat + bone)
  function drawChickenLeg(ctx, x, y, r) {
    // meat (brown circle)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin((x + y + frame) * 0.02) * 0.25);
    ctx.fillStyle = '#c05318fb';
    ctx.beginPath(); ctx.ellipse(-r * 0.15, 0, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    // highlight
    ctx.fillStyle = '#e58a53'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.15, r * 0.35, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    // bone
    ctx.fillStyle = '#f5efe6'; ctx.fillRect(r * 0.4, -r * 0.15, r * 0.6, r * 0.3);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 1.05, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // input
  function flap() {
    ensureAudio();
    if (state === 'idle') { state = 'playing'; startEl.classList.add('hidden'); requestAnimationFrame(update); }
    if (state === 'playing') { bird.vy = FLAP; sfxFlap(); }
    if (state === 'over') { reset(); }
  }

  window.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); } if (e.code === 'Enter' && state === 'over') { reset(); } });
  canvas.addEventListener('click', e => { if (state === 'over') { reset(); } else flap(); });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); if (state === 'over') { reset(); } else flap(); }, { passive: false });

  // Play Again button handler
  const playAgainBtn = document.getElementById('play-again');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event from bubbling to canvas
      reset();
    });
  }

  // Prevent game over modal clicks from bubbling to canvas
  if (gameoverEl) {
    gameoverEl.addEventListener('click', (e) => {
      // Only prevent if clicking directly on the overlay (not the modal content)
      if (e.target === gameoverEl) {
        e.stopPropagation();
      }
    });
  }

  // Mute toggle
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      updateMuteButton();
      ensureAudio();
    });
  }

  // init
  reset();
})();
