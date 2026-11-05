/* The hero's loss landscape: a loss surface drawn as an ink mesh, turning slowly,
   with its contour map on the floor below. Lines shade from graphite on the peaks to
   ballpoint blue in the valleys, where a pale blue wash pools.
   A dot runs gradient descent on it, step by step, leaving a trail. When it settles
   (sometimes in a shallow valley, a local minimum) it starts again from a new high
   point; clicking drops it where you click.
   The surface and the starting points come from a fixed seed.
   With reduced motion it's drawn once, with one finished descent. */
(() => {
  const canvas = document.getElementById('landscape');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const INK = color('--ink', '#2f4fd6');
  const GRAPHITE = color('--graphite', '#1f2533');
  const SHEET = color('--sheet', '#ffffff');

  // seeded random (mulberry32)
  let seed = 20261107;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ---------- the loss: a gentle bowl, one deep valley, two shallow ones, a ridge ---------- */
  const g = (x, y, cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s);
  const loss = (x, y) =>
    0.07 * (x * x + y * y)
    - 1.25 * g(x, y, 1.15, -0.75, 1.0)      // the global minimum
    - 0.62 * g(x, y, -1.55, 1.25, 0.45)     // a local minimum
    - 0.48 * g(x, y, -0.35, -1.85, 0.35)    // another
    + 0.42 * g(x, y, 0.2, 0.55, 0.55)       // a ridge between them
    + 0.05 * Math.sin(2.1 * x) * Math.cos(1.7 * y);
  const SPAN = 3;     // the loss is drawn over -3..3 in both directions
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 120; i++) for (let j = 0; j <= 120; j++) {
    const v = loss(-SPAN + (2 * SPAN * i) / 120, -SPAN + (2 * SPAN * j) / 120);
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  const height = (x, y) => ((loss(x, y) - lo) / (hi - lo)) ** 0.85;   // 0 at the bottom, 1 at the top

  /* ---------- world: loss x, y on the ground plane, height upwards ---------- */
  const S = 14, H = 26, FLOOR = 9;          // units per loss unit, surface height, floor below the lowest point
  const wx = (x) => x * S, wz = (y) => y * S, wy = (t) => -t * H;

  // the mesh
  const N = 34;
  const mesh = [];  // [i][j] = { x, y, t }
  for (let i = 0; i <= N; i++) {
    mesh.push([]);
    for (let j = 0; j <= N; j++) {
      const x = -SPAN + (2 * SPAN * i) / N, y = -SPAN + (2 * SPAN * j) / N;
      mesh[i].push({ x, y, t: height(x, y) });
    }
  }

  // contour lines on a finer grid (marching squares), drawn on the floor
  const contours = [];  // { level, segs: [[x1, y1, x2, y2], ...] }
  {
    const M = 70, f = [];
    for (let i = 0; i <= M; i++) { f.push([]); for (let j = 0; j <= M; j++) f[i].push(height(-SPAN + (2 * SPAN * i) / M, -SPAN + (2 * SPAN * j) / M)); }
    const at = (i, j) => [-SPAN + (2 * SPAN * i) / M, -SPAN + (2 * SPAN * j) / M];
    // only the lower levels: the high ones are cut off by the edge of the map
    for (let k = 1; k <= 9; k++) {
      const level = k / 15, segs = [];
      for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const v = c.map(([a, b]) => f[a][b]);
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const a = e, b = (e + 1) % 4;
          if ((v[a] < level) !== (v[b] < level)) {
            const u = (level - v[a]) / (v[b] - v[a]);
            const [x1, y1] = at(...c[a]), [x2, y2] = at(...c[b]);
            pts.push([x1 + (x2 - x1) * u, y1 + (y2 - y1) * u]);
          }
        }
        if (pts.length >= 2) segs.push([...pts[0], ...pts[1]]);
        if (pts.length === 4) segs.push([...pts[2], ...pts[3]]);
      }
      contours.push({ level, segs });
    }
  }

  /* ---------- gradient descent ---------- */
  const LR = 0.035, STEP_EVERY = 0.03;     // learning rate; seconds between steps
  const gradAt = (x, y) => {
    const h = 1e-3;
    return [(loss(x + h, y) - loss(x - h, y)) / (2 * h), (loss(x, y + h) - loss(x, y - h)) / (2 * h)];
  };
  let path = [], still = 0, restartIn = 0;
  const highStart = () => {
    for (let k = 0; k < 200; k++) {
      const x = (rand() * 2 - 1) * 2.6, y = (rand() * 2 - 1) * 2.6;
      if (height(x, y) > 0.55) return [x, y];
    }
    return [-2.4, 2.4];
  };
  const begin = (x, y) => { path = [[x, y]]; still = 0; restartIn = 0; };
  const step = () => {
    const [x, y] = path[path.length - 1];
    const [gx, gy] = gradAt(x, y);
    const nx = Math.max(-SPAN, Math.min(SPAN, x - LR * gx + (rand() - 0.5) * 0.004));
    const ny = Math.max(-SPAN, Math.min(SPAN, y - LR * gy + (rand() - 0.5) * 0.004));
    path.push([nx, ny]);
    still = Math.hypot(nx - x, ny - y) < 0.0015 ? still + 1 : 0;
    return still > 25;                       // settled
  };
  begin(...highStart());

  /* ---------- view ---------- */
  let yaw = 0.6;
  const pitch = 0.62;                       // looking down on it
  const CENTER = [0, -H / 2 + FLOOR / 2, 0];
  let width = 0, height2 = 0, dpr = 1, scale = 1;
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = box.width; height2 = box.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height2 * dpr);
    scale = Math.min(width / 128, height2 / 108);
  };
  const CAMERA = 260;
  let cyw = 1, syw = 0;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const project = (X, Y, Z, out) => {
    const dx = X - CENTER[0], dy = Y - CENTER[1], dz = Z - CENTER[2];
    const X1 = dx * cyw - dz * syw;
    const Z1 = dx * syw + dz * cyw;
    const Y2 = dy * cp - Z1 * sp;
    const Z2 = dy * sp + Z1 * cp;
    const s = CAMERA / (CAMERA + Z2);
    out[0] = width / 2 + X1 * scale * s;
    out[1] = height2 / 2 + Y2 * scale * s;
    out[2] = Z2;
    return out;
  };
  const P = mesh.map((row) => row.map(() => [0, 0, 0]));

  /* ---------- drawing ---------- */
  const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
  const BINS = [  // mesh line shades by height: [up to t, colour, alpha]
    [0.1, INK, 0.62], [0.22, INK, 0.42], [0.36, INK, 0.26],
    [0.55, GRAPHITE, 0.22], [0.75, GRAPHITE, 0.17], [1.01, GRAPHITE, 0.13],
  ];
  const binOf = (t) => BINS.findIndex(([top]) => t < top);
  const draw = () => {
    cyw = Math.cos(yaw); syw = Math.sin(yaw);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height2);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // contours on the floor; the low ones in ink
    ctx.lineWidth = 0.8;
    for (const { level, segs } of contours) {
      ctx.strokeStyle = level < 0.3 ? INK : GRAPHITE;
      ctx.globalAlpha = level < 0.3 ? 0.3 : 0.12;
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of segs) {
        project(wx(x1), FLOOR, wz(y1), tmp); project(wx(x2), FLOOR, wz(y2), tmp2);
        ctx.moveTo(tmp[0], tmp[1]); ctx.lineTo(tmp2[0], tmp2[1]);
      }
      ctx.stroke();
    }
    // the descent's shadow on the floor
    if (path.length > 1) {
      ctx.strokeStyle = INK; ctx.globalAlpha = 0.3; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath();
      path.forEach(([x, y], k) => { project(wx(x), FLOOR, wz(y), tmp); k ? ctx.lineTo(tmp[0], tmp[1]) : ctx.moveTo(tmp[0], tmp[1]); });
      ctx.stroke(); ctx.setLineDash([]);
    }

    // the surface
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const m = mesh[i][j];
      project(wx(m.x), wy(m.t), wz(m.y), P[i][j]);
    }
    // a pale blue wash pooled in the valleys
    ctx.fillStyle = INK;
    for (const [top, alpha] of [[0.12, 0.13], [0.24, 0.08], [0.34, 0.04]]) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const t = (mesh[i][j].t + mesh[i + 1][j].t + mesh[i + 1][j + 1].t + mesh[i][j + 1].t) / 4;
        if (t >= top) continue;
        const a = P[i][j], b = P[i + 1][j], c = P[i + 1][j + 1], d = P[i][j + 1];
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      }
      ctx.fill();
    }
    // mesh lines, grouped by height so each shade is one stroke
    ctx.lineWidth = 0.75;
    const paths = BINS.map(() => new Path2D());
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const a = P[i][j];
      if (i < N) {
        const b = P[i + 1][j];
        const p = paths[binOf((mesh[i][j].t + mesh[i + 1][j].t) / 2)];
        p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]);
      }
      if (j < N) {
        const b = P[i][j + 1];
        const p = paths[binOf((mesh[i][j].t + mesh[i][j + 1].t) / 2)];
        p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]);
      }
    }
    BINS.forEach(([, col, alpha], k) => { ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.stroke(paths[k]); });

    // the descent on the surface, and the dot
    if (path.length > 1) {
      ctx.strokeStyle = INK; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.6;
      ctx.beginPath();
      path.forEach(([x, y], k) => { project(wx(x), wy(height(x, y)) - 0.6, wz(y), tmp); k ? ctx.lineTo(tmp[0], tmp[1]) : ctx.moveTo(tmp[0], tmp[1]); });
      ctx.stroke();
    }
    const [x, y] = path[path.length - 1];
    project(wx(x), wy(height(x, y)) - 0.6, wz(y), tmp);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(tmp[0], tmp[1], 3.8, 0, Math.PI * 2);
    ctx.fillStyle = INK; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = SHEET; ctx.stroke();
  };

  /* ---------- clicking drops a new dot at the nearest point of the surface ---------- */
  canvas.addEventListener('pointerdown', (e) => {
    const box = canvas.getBoundingClientRect();
    const cx = e.clientX - box.left, cy = e.clientY - box.top;
    let best = null, bestD = 40 * 40;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const d = (P[i][j][0] - cx) ** 2 + (P[i][j][1] - cy) ** 2;
      if (d < bestD) { bestD = d; best = mesh[i][j]; }
    }
    if (best) { begin(best.x, best.y); if (reduceMotion) { while (!step() && path.length < 900); draw(); } }
  });

  /* ---------- animation: only while on screen and the tab is visible ---------- */
  const SPIN = 0.07;   // radians per second
  let running = false, last = 0, raf = 0, sinceStep = 0;
  const frame = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    yaw += SPIN * dt;
    if (restartIn > 0) {
      restartIn -= dt;
      if (restartIn <= 0) begin(...highStart());
    } else {
      sinceStep += dt;
      while (sinceStep >= STEP_EVERY) {
        sinceStep -= STEP_EVERY;
        if (step() || path.length > 900) { restartIn = 1.8; break; }
      }
    }
    draw();
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (running || reduceMotion) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  if (reduceMotion) { while (!step() && path.length < 900); }
  resize(); draw();
  addEventListener('resize', () => { resize(); draw(); });
  if (!reduceMotion) {
    let visible = true;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (visible) start();
    });
  }
})();
