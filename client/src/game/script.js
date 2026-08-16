// Style reminder: "حديقة الأصباغ الزجاجية" — سائل مشبع داخل زجاج نظيف، وتفاعل قصير يشبه سكب قطرة دقيقة.

const PALETTE = {
  coral: { fill: "#F26A63", edge: "#D95754", glow: "rgba(242,106,99,.28)" },
  amber: { fill: "#F3B545", edge: "#D58D22", glow: "rgba(243,181,69,.28)" },
  mint: { fill: "#46BD9B", edge: "#269978", glow: "rgba(70,189,155,.26)" },
  sky: { fill: "#58A8E5", edge: "#3585C5", glow: "rgba(88,168,229,.26)" },
  violet: { fill: "#9A78D2", edge: "#7853B5", glow: "rgba(154,120,210,.26)" },
  rose: { fill: "#EA81A7", edge: "#C85C83", glow: "rgba(234,129,167,.25)" },
};

const STORAGE = { current: "color-pour-current-level", highest: "color-pour-highest-unlocked" };
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const cloneTubes = (tubes) => tubes.map((tube) => [...tube]);
const topRun = (tube) => {
  if (!tube.length) return { color: null, count: 0 };
  const color = tube[tube.length - 1];
  let count = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i -= 1) count += 1;
  return { color, count };
};

export class ColorPourGame {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks;
    this.levels = [];
    this.currentLevel = null;
    this.tubes = [];
    this.capacity = 4;
    this.history = [];
    this.selected = null;
    this.moveCount = 0;
    this.layouts = [];
    this.particles = [];
    this.feedback = null;
    this.completed = false;
    this.locked = false;
    this.frame = 0;
    this.demoTimers = [];
    this.boundPointer = this.handlePointer.bind(this);
    this.boundResize = this.resize.bind(this);
    canvas.addEventListener("pointerdown", this.boundPointer);
    window.addEventListener("resize", this.boundResize);
  }

  async init() {
    const response = await fetch("/levels.json");
    const data = await response.json();
    this.levels = data.levels;
    const storedHighest = Number(localStorage.getItem(STORAGE.highest) || 1);
    this.highestUnlocked = Math.max(1, Math.min(storedHighest, this.levels.length));
    const storedLevel = Number(localStorage.getItem(STORAGE.current) || 1);
    this.loadLevel(Math.min(storedLevel, this.highestUnlocked), false);
    this.resize();
    this.emitLevels();
    this.animate();
    if (new URLSearchParams(window.location.search).has("demo")) this.startDemo();
    return this;
  }

  startDemo() {
    this.loadLevel(1, false);
    const moves = [[0, 3], [2, 3]];
    moves.forEach(([from, to], index) => {
      const timer = window.setTimeout(() => {
        if (this.completed) return;
        const move = this.canPour(from, to);
        if (move) this.commitMove(from, to, move);
      }, 520 + index * 570);
      this.demoTimers.push(timer);
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssWidth = Math.max(rect.width, 1);
    this.cssHeight = Math.max(rect.height, 1);
    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  emitStats() {
    this.callbacks.onStats?.({
      levelId: this.currentLevel?.id ?? 1,
      levelName: this.currentLevel?.name ?? "Bloom 01",
      moveCount: this.moveCount,
      canUndo: this.history.length > 0,
    });
  }

  emitLevels() {
    this.callbacks.onLevels?.(this.levels, this.highestUnlocked);
  }

  loadLevel(id, shouldSave = true) {
    const level = this.levels.find((item) => item.id === id) || this.levels[0];
    if (!level) return;
    this.currentLevel = level;
    this.capacity = level.capacity;
    this.tubes = cloneTubes(level.tubes);
    this.history = [];
    this.selected = null;
    this.moveCount = 0;
    this.completed = false;
    this.locked = false;
    this.feedback = null;
    this.particles = [];
    if (shouldSave) localStorage.setItem(STORAGE.current, String(level.id));
    this.emitStats();
    this.draw();
  }

  restart() {
    if (this.currentLevel) this.loadLevel(this.currentLevel.id);
  }

  undo() {
    const previous = this.history.pop();
    if (!previous || this.completed) return;
    this.tubes = cloneTubes(previous.tubes);
    this.moveCount = previous.moveCount;
    this.selected = null;
    this.feedback = { kind: "undo", until: performance.now() + 260 };
    this.emitStats();
    this.draw();
  }

  canPour(from, to) {
    if (from === to || !this.tubes[from] || !this.tubes[to] || !this.tubes[from].length || this.tubes[to].length >= this.capacity) return null;
    const source = this.tubes[from];
    const target = this.tubes[to];
    const { color, count } = topRun(source);
    if (target.length && target[target.length - 1] !== color) return null;
    return { color, amount: Math.min(count, this.capacity - target.length) };
  }

  anyLegalMove() {
    return this.tubes.some((_, from) => this.tubes.some((__, to) => this.canPour(from, to)));
  }

  isWon() {
    return this.tubes.every((tube) => !tube.length || (tube.length === this.capacity && tube.every((color) => color === tube[0])));
  }

  isCompleteTube(tube) {
    return tube.length === this.capacity && tube.every((color) => color === tube[0]);
  }

  handlePointer(event) {
    event.preventDefault();
    if (this.locked || this.completed) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const index = this.layouts.findIndex((layout) => x >= layout.x - 10 && x <= layout.x + layout.w + 10 && y >= layout.y - 18 && y <= layout.y + layout.h + 16);
    if (index === -1) {
      this.selected = null;
      this.draw();
      return;
    }
    this.chooseTube(index);
  }

  chooseTube(index) {
    if (this.selected === null) {
      if (this.tubes[index].length) {
        this.selected = index;
        this.feedback = { kind: "select", until: performance.now() + 250 };
      } else this.invalid(index);
      this.draw();
      return;
    }
    if (this.selected === index) {
      this.selected = null;
      this.draw();
      return;
    }
    const move = this.canPour(this.selected, index);
    if (!move) {
      if (this.tubes[index].length) this.selected = index;
      this.invalid(index);
      this.draw();
      return;
    }
    this.commitMove(this.selected, index, move);
  }

  commitMove(from, to, move) {
    this.history.push({ tubes: cloneTubes(this.tubes), moveCount: this.moveCount });
    for (let i = 0; i < move.amount; i += 1) this.tubes[to].push(this.tubes[from].pop());
    this.moveCount += 1;
    this.selected = null;
    this.feedback = { kind: "pour", from, to, color: move.color, until: performance.now() + 340 };
    this.emitStats();
    if (this.isWon()) {
      this.completed = true;
      this.highestUnlocked = Math.min(this.levels.length, Math.max(this.highestUnlocked, this.currentLevel.id + 1));
      localStorage.setItem(STORAGE.highest, String(this.highestUnlocked));
      localStorage.setItem(STORAGE.current, String(Math.min(this.currentLevel.id + 1, this.levels.length)));
      this.emitLevels();
      this.bloom();
      window.setTimeout(() => this.callbacks.onWin?.(this.currentLevel.id, this.highestUnlocked), prefersReducedMotion ? 80 : 430);
    } else if (!this.anyLegalMove()) {
      this.locked = true;
      this.feedback = { kind: "stuck", until: performance.now() + 700 };
      window.setTimeout(() => this.restart(), 720);
    }
    this.draw();
  }

  invalid(index) {
    this.feedback = { kind: "invalid", index, until: performance.now() + 240 };
  }

  bloom() {
    if (prefersReducedMotion) return;
    const colors = ["#F26A63", "#F3B545", "#46BD9B", "#58A8E5", "#9A78D2"];
    const centerX = this.cssWidth / 2;
    const centerY = this.cssHeight * 0.46;
    for (let i = 0; i < 34; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 2.4;
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 60,
        y: centerY + (Math.random() - 0.5) * 48,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 1,
        rotation: Math.random() * Math.PI,
        color: colors[i % colors.length],
        size: 4 + Math.random() * 5,
      });
    }
  }

  getLayouts() {
    const total = this.tubes.length;
    const columns = total <= 4 ? total : total <= 6 ? 3 : 4;
    const rows = Math.ceil(total / columns);
    const marginX = Math.max(18, this.cssWidth * 0.065);
    const gapX = Math.max(12, this.cssWidth * 0.04);
    const gapY = rows > 1 ? 30 : 0;
    const availableW = this.cssWidth - marginX * 2 - gapX * (columns - 1);
    const w = Math.min(68, availableW / columns);
    const h = Math.min(230, Math.max(150, (this.cssHeight - 58 - gapY * (rows - 1)) / rows));
    const gridW = columns * w + (columns - 1) * gapX;
    const startX = (this.cssWidth - gridW) / 2;
    const gridH = rows * h + (rows - 1) * gapY;
    const startY = Math.max(22, (this.cssHeight - gridH) / 2 - 4);
    return this.tubes.map((_, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const items = Math.min(columns, total - row * columns);
      const rowOffset = (columns - items) * (w + gapX) / 2;
      return { x: startX + rowOffset + col * (w + gapX), y: startY + row * (h + gapY), w, h };
    });
  }

  drawTube(layout, tube, index, now) {
    const ctx = this.ctx;
    const selected = index === this.selected;
    const invalid = this.feedback?.kind === "invalid" && this.feedback.index === index && this.feedback.until > now;
    const yShift = selected ? -10 : invalid ? Math.sin(now / 23) * 4 : 0;
    const { x, y, w, h } = layout;
    const top = y + yShift;
    const bottom = top + h;
    const radius = Math.min(16, w * 0.25);
    const wall = Math.max(4, w * 0.075);
    ctx.save();
    ctx.translate(0, yShift);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 8, w * .42, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(48,73,59,.18)";
    ctx.filter = "blur(3px)";
    ctx.fill();
    ctx.restore();
    ctx.shadowColor = selected ? "rgba(54,185,146,.38)" : "rgba(69,75,60,.16)";
    ctx.shadowBlur = selected ? 20 : 12;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.moveTo(x + radius, y + 4);
    ctx.lineTo(x + w - radius, y + 4);
    ctx.lineTo(x + w - wall, y + h - radius);
    ctx.quadraticCurveTo(x + w - wall, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x + wall, y + h, x + wall, y + h - radius);
    ctx.lineTo(x + wall, y + 4);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,.32)";
    ctx.fill();
    ctx.shadowColor = "transparent";

    const innerX = x + wall + 2;
    const innerW = w - (wall + 2) * 2;
    const innerBottom = y + h - wall - 2;
    const slotH = (h - 16) / this.capacity;
    tube.forEach((color, layer) => {
      const paint = PALETTE[color] || PALETTE.mint;
      const layerY = innerBottom - (layer + 1) * slotH;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(innerX, layerY + 1, innerW, slotH - 1, Math.min(7, innerW * .13));
      ctx.fillStyle = paint.fill;
      ctx.fill();
      ctx.globalAlpha = .18;
      ctx.fillStyle = "#fff";
      ctx.fillRect(innerX + 5, layerY + 4, innerW - 10, 3);
      ctx.globalAlpha = 1;
      ctx.restore();
    });

    ctx.beginPath();
    ctx.moveTo(x + radius, y + 3);
    ctx.lineTo(x + w - radius, y + 3);
    ctx.lineTo(x + w - wall, y + h - radius);
    ctx.quadraticCurveTo(x + w - wall, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x + wall, y + h, x + wall, y + h - radius);
    ctx.lineTo(x + wall, y + 3);
    ctx.strokeStyle = selected ? "#36B992" : "rgba(87,99,86,.52)";
    ctx.lineWidth = selected ? 3.2 : 2;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + wall + 4, y + 9);
    ctx.lineTo(x + wall + 4, y + h - radius - 6);
    ctx.quadraticCurveTo(x + wall + 4, y + h - 4, x + radius + 7, y + h - 4);
    ctx.strokeStyle = "rgba(255,255,255,.82)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 4, w / 2 - wall, 5.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.97)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 6.5, w / 2 - wall - 3, 3.4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(65,83,72,.24)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = .54;
    ctx.beginPath();
    ctx.moveTo(x + wall + 7, y + 19);
    ctx.lineTo(x + wall + 7, y + h * .44);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
    if (this.isCompleteTube(tube)) this.drawBloomTrace(layout, tube, yShift);
    if (selected) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + w / 2, bottom + 11, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = "#36B992";
      ctx.fill();
      ctx.restore();
    }
  }

  drawBloomTrace(layout, tube, yShift) {
    const ctx = this.ctx;
    const { x, y, w, h } = layout;
    const paint = PALETTE[tube[0]] || PALETTE.mint;
    const baseX = x + w / 2;
    const baseY = y + yShift + h + 2;
    ctx.save();
    ctx.strokeStyle = "#4AAE86";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(baseX, baseY + 5);
    ctx.quadraticCurveTo(baseX + 1, baseY - 5, baseX - 3, baseY - 12);
    ctx.stroke();
    ctx.fillStyle = "#42B890";
    [[-7, -4, -0.55], [5, -8, .45]].forEach(([dx, dy, rotation]) => {
      ctx.save();
      ctx.translate(baseX + dx, baseY + dy);
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = paint.fill;
    ctx.shadowColor = paint.glow;
    ctx.shadowBlur = 7;
    for (let petal = 0; petal < 4; petal += 1) {
      const angle = petal * Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(baseX - 3 + Math.cos(angle) * 3, baseY - 14 + Math.sin(angle) * 3, 3.1, 1.8, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(baseX - 3, baseY - 14, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#FFF4B7";
    ctx.fill();
    ctx.restore();
  }

  drawPour(now) {
    if (this.feedback?.kind !== "pour" || this.feedback.until < now) return;
    const from = this.layouts[this.feedback.from];
    const to = this.layouts[this.feedback.to];
    if (!from || !to) return;
    const progress = 1 - (this.feedback.until - now) / 340;
    const startX = from.x + from.w / 2;
    const startY = from.y + 12;
    const endX = to.x + to.w / 2;
    const endY = to.y + 26;
    const controlY = Math.min(startY, endY) - 35 - Math.sin(progress * Math.PI) * 20;
    const color = PALETTE[this.feedback.color]?.fill || "#36B992";
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 6;
    this.ctx.lineCap = "round";
    this.ctx.globalAlpha = .88;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.quadraticCurveTo((startX + endX) / 2, controlY, endX, endY);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    this.particles = this.particles.filter((particle) => particle.life > 0.015);
    this.particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += .026;
      particle.life *= .972;
      particle.rotation += .06;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size, particle.size * .55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  draw() {
    if (!this.ctx || !this.cssWidth) return;
    const now = performance.now();
    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.layouts = this.getLayouts();
    this.layouts.forEach((layout, index) => this.drawTube(layout, this.tubes[index], index, now));
    this.drawPour(now);
    this.drawParticles();
    if (this.feedback?.kind === "stuck" && this.feedback.until > now) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255,248,232,.87)";
      this.ctx.font = "700 16px Nunito Sans, sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText("انسدت المسارات — نعيد الإزهار…", this.cssWidth / 2, this.cssHeight - 18);
      this.ctx.restore();
    }
  }

  animate() {
    this.draw();
    this.frame = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.demoTimers.forEach((timer) => window.clearTimeout(timer));
    this.canvas.removeEventListener("pointerdown", this.boundPointer);
    window.removeEventListener("resize", this.boundResize);
  }
}

export async function mountColorPourGame(canvas, callbacks) {
  const game = new ColorPourGame(canvas, callbacks);
  return game.init();
}
