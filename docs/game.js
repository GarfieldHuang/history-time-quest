/* 時空闖關 — 國中歷史（三）第 1～2 章段考複習遊戲（純前端，無需建置） */
(() => {
  "use strict";

  const LEVELS = window.LEVELS;
  const QUESTIONS = window.QUESTIONS.map((q, id) => ({ ...q, id }));
  const app = document.getElementById("app");

  // ── 存檔（localStorage，失敗時改用記憶體）────────────────────────────
  const KEY = "time-quest-v1";
  const blank = { stars: {}, wrong: [], badges: [], sound: true, bestExam: 0, bestCombo: 0 };
  let save = blank;
  try { save = { ...blank, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch (e) { /* private mode */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

  // ── 小工具 ────────────────────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; };
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KEYS = ["A", "B", "C", "D"];

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ── 音效（WebAudio 合成，不用外部檔案）──────────────────────────────
  let ctx = null;
  function beep(notes) {
    if (!save.sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      let t = ctx.currentTime;
      for (const [freq, dur, type = "square"] of notes) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + dur);
        t += dur * 0.8;
      }
    } catch (e) { /* no audio */ }
  }
  const sfx = {
    right: () => beep([[660, .09], [880, .09], [1320, .16]]),
    wrong: () => beep([[220, .18, "sawtooth"], [160, .25, "sawtooth"]]),
    click: () => beep([[520, .05]]),
    win: () => beep([[523, .12], [659, .12], [784, .12], [1047, .3]]),
    tick: () => beep([[900, .03, "sine"]]),
  };

  // ── 彩帶 ──────────────────────────────────────────────────────────────
  const cv = $("#confetti"), cx = cv.getContext("2d");
  let bits = [], raf = 0;
  function confetti(n = 120) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ["#FE90E8", "#C0F7FE", "#99E885", "#F7CB46", "#FFDC8B", "#000"];
    for (let i = 0; i < n; i++) {
      bits.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .3, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, s: 6 + Math.random() * 8, c: colors[i % colors.length] });
    }
    if (!raf) loop();
  }
  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    bits = bits.filter((b) => b.y < cv.height + 20);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.vy += .05; b.r += b.vr;
      cx.save(); cx.translate(b.x, b.y); cx.rotate(b.r); cx.fillStyle = b.c; cx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); cx.restore();
    }
    raf = bits.length ? requestAnimationFrame(loop) : 0;
  }

  // ── 徽章 ──────────────────────────────────────────────────────────────
  const BADGES = [
    { id: "first", em: "🚪", name: "穿越成功", desc: "通過第 1 關" },
    { id: "zhou", em: "🔔", name: "封建達人", desc: "西周、東周都拿到星星" },
    { id: "qin", em: "🐯", name: "始皇認證", desc: "秦朝關卡 3 顆星" },
    { id: "silk", em: "🐫", name: "絲路商人", desc: "漢朝關卡 3 顆星" },
    { id: "allclear", em: "👑", name: "天可汗", desc: "7 關全部通過" },
    { id: "allstar", em: "🌟", name: "完美穿越", desc: "7 關全部 3 顆星" },
    { id: "combo5", em: "🔥", name: "連擊 5", desc: "連續答對 5 題" },
    { id: "combo10", em: "⚡", name: "連擊 10", desc: "連續答對 10 題" },
    { id: "timeline", em: "📅", name: "時間管理大師", desc: "時間軸排序全對" },
    { id: "match", em: "🔗", name: "配對高手", desc: "連連看零失誤" },
    { id: "exam80", em: "📝", name: "段考穩了", desc: "模擬考 80 分以上" },
    { id: "exam100", em: "💯", name: "歷史小博士", desc: "模擬考 100 分" },
    { id: "clean", em: "📕", name: "錯題清空", desc: "把錯題本清到 0 題" },
  ];
  function award(id) {
    if (save.badges.includes(id)) return;
    save.badges.push(id); persist(); refreshTop();
    const b = BADGES.find((x) => x.id === id);
    setTimeout(() => { toast(`🏅 獲得徽章：${b.em} ${b.name}`); sfx.win(); }, 600);
  }

  function refreshTop() {
    const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
    $("#starCount").textContent = total;
    $("#badgeCount").textContent = save.badges.length;
    $("#soundBtn").textContent = save.sound ? "🔊" : "🔇";
  }
  $("#soundBtn").addEventListener("click", () => { save.sound = !save.sound; persist(); refreshTop(); });
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { sfx.click(); route(go.dataset.go); }
  });

  let timer = null;
  function stopTimer() { clearInterval(timer); timer = null; }

  // ── 路由 ──────────────────────────────────────────────────────────────
  function route(name, arg) {
    stopTimer();
    app.innerHTML = "";
    window.scrollTo(0, 0);
    ({ home, map, timeline, match, exam, review, badges }[name] || home)(arg);
  }

  function home() {
    app.append($("#tpl-home").content.cloneNode(true));
    $("#wrongCount").textContent = `${save.wrong.length} 題待複習`;
  }

  // ── 世界地圖 ──────────────────────────────────────────────────────────
  function unlocked(lv) { return lv === 1 || (save.stars[lv - 1] || 0) > 0; }
  function map() {
    const nodes = LEVELS.map((L) => {
      const st = save.stars[L.id] || 0, open = unlocked(L.id);
      const n = QUESTIONS.filter((q) => q.lv === L.id).length;
      return `<button class="node ${open ? "" : "locked"}" ${open ? `data-lv="${L.id}"` : "disabled"} aria-label="第 ${L.id} 關 ${L.name}">
        <span class="num" style="background:${L.color}">${open ? L.icon : "🔒"}</span>
        <span><b>第 ${L.id} 關・${L.name}</b><small>${L.era}・題庫 ${n} 題・關主「${L.boss}」</small></span>
        <span class="stars">${"⭐".repeat(st)}${"☆".repeat(3 - st)}</span></button>`;
    }).join("");
    app.append(h(`<section class="screen">
      <div class="row" style="justify-content:space-between"><h2>🗺️ 時空地圖</h2><button class="btn ghost" data-go="home">← 首頁</button></div>
      <p>每關隨機 5 題、3 顆愛心、每題 20 秒。答對 3 題以上就能穿越到下一關！</p>
      <div class="path">${nodes}</div></section>`));
    app.querySelectorAll("[data-lv]").forEach((b) => b.addEventListener("click", () => { sfx.click(); quiz({ mode: "level", lv: +b.dataset.lv }); }));
  }

  // ── 通用答題引擎（關卡／模擬考／錯題本共用）─────────────────────────
  function quiz(cfg) {
    let pool;
    if (cfg.mode === "level") pool = pick(QUESTIONS.filter((q) => q.lv === cfg.lv), 5);
    else if (cfg.mode === "exam") pool = shuffle(LEVELS.flatMap((L) => pick(QUESTIONS.filter((q) => q.lv === L.id), L.id === 1 ? 3 : 4)).slice(0, 25));
    else pool = shuffle(QUESTIONS.filter((q) => save.wrong.includes(q.id))).slice(0, 10);
    if (!pool.length) { toast("錯題本是空的，太強了！"); return route("home"); }

    const L = cfg.lv ? LEVELS[cfg.lv - 1] : null;
    const title = cfg.mode === "level" ? `第 ${L.id} 關・${L.name}` : cfg.mode === "exam" ? "📝 段考模擬" : "📕 錯題複習";
    let i = 0, right = 0, hearts = 3, combo = 0;
    const useHearts = cfg.mode === "level", useTimer = cfg.mode !== "review";

    function show() {
      stopTimer();
      const q = pool[i];
      const order = shuffle([0, 1, 2, 3]);
      app.innerHTML = "";
      app.append(h(`<section class="screen">
        <div class="qhead">
          <span class="label" style="font-size:.95rem">${title}</span>
          <span class="row">
            ${useHearts ? `<span class="hearts" aria-label="剩 ${hearts} 顆愛心">${"❤️".repeat(hearts)}${"🤍".repeat(3 - hearts)}</span>` : ""}
            <span class="pill combo ${combo >= 3 ? "hot" : ""}">🔥 ${combo}</span>
            <span class="pill">${i + 1} / ${pool.length}</span>
          </span>
        </div>
        <div class="bar"><i style="width:${(i / pool.length) * 100}%"></i></div>
        ${useTimer ? `<div class="bar timer"><i id="tbar" style="width:100%"></i></div>` : ""}
        <div class="qcard card ${L ? "" : "white"}" ${L ? `style="background:${L.color}"` : ""}>
          <span class="label">${LEVELS[q.lv - 1].icon} ${LEVELS[q.lv - 1].name}</span>
          <p class="q">${esc(q.q)}</p>
        </div>
        <div class="opts">${order.map((oi, k) => `<button class="opt" data-oi="${oi}"><span class="k">${KEYS[k]}</span><span>${esc(q.o[oi])}</span></button>`).join("")}</div>
        <div id="after"></div>
      </section>`));
      app.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => answer(+b.dataset.oi)));
      if (useTimer) {
        let left = 20;
        requestAnimationFrame(() => { const t = $("#tbar"); if (t) t.style.width = "95%"; });
        timer = setInterval(() => {
          left--;
          const t = $("#tbar"); if (t) t.style.width = `${(left / 20) * 100}%`;
          if (left <= 5 && left > 0) sfx.tick();
          if (left <= 0) answer(-1);
        }, 1000);
      }
    }

    function answer(oi) {
      stopTimer();
      const q = pool[i];
      const ok = oi === q.a;
      app.querySelectorAll(".opt").forEach((b) => {
        b.disabled = true;
        const v = +b.dataset.oi;
        if (v === q.a) b.classList.add("right");
        else if (v === oi) b.classList.add("wrong");
      });
      if (ok) {
        right++; combo++; sfx.right();
        save.bestCombo = Math.max(save.bestCombo, combo);
        if (combo >= 5) award("combo5");
        if (combo >= 10) award("combo10");
        if (cfg.mode === "review") save.wrong = save.wrong.filter((x) => x !== q.id);
        if (combo === 3 || combo === 6) confetti(50);
      } else {
        combo = 0; sfx.wrong();
        if (useHearts) {
          hearts--;
          const hs = $(".hearts");
          if (hs) hs.textContent = "❤️".repeat(hearts) + "🤍".repeat(3 - hearts);
        }
        if (!save.wrong.includes(q.id)) save.wrong.push(q.id);
      }
      persist();
      const last = i === pool.length - 1 || (useHearts && hearts <= 0);
      const msg = oi === -1 ? "⏰ 時間到！" : ok ? ["答對了！", "太神啦！", "穩穩的！", "歷史魂上身！"][right % 4] : "差一點點！";
      $("#after").append(h(`<div class="explain card ${ok ? "green" : "cream"}">
        <b>${msg}</b> 正確答案：<b>${esc(q.o[q.a])}</b><br />💡 ${esc(q.e)}
      </div>
      <div class="row center" style="margin-top:16px"><button class="btn" id="next">${last ? "看結果 →" : "下一題 →"}</button></div>`));
      $("#next").addEventListener("click", () => { sfx.click(); if (last) finish(); else { i++; show(); } });
      $("#next").focus({ preventScroll: true });
      $("#after").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function finish() {
      if (cfg.mode === "level") {
        const failed = hearts <= 0 && right < 3;
        const st = failed ? 0 : right >= 5 ? 3 : right >= 4 ? 2 : right >= 3 ? 1 : 0;
        save.stars[L.id] = Math.max(save.stars[L.id] || 0, st); persist(); refreshTop();
        if (st > 0) { sfx.win(); confetti(); }
        if (st > 0 && L.id === 1) award("first");
        if ((save.stars[2] || 0) > 0 && (save.stars[3] || 0) > 0) award("zhou");
        if (save.stars[4] === 3) award("qin");
        if (save.stars[5] === 3) award("silk");
        if (LEVELS.every((x) => (save.stars[x.id] || 0) > 0)) award("allclear");
        if (LEVELS.every((x) => save.stars[x.id] === 3)) award("allstar");
        const nextOpen = st > 0 && L.id < 7;
        app.innerHTML = "";
        app.append(h(`<section class="screen"><div class="result card" style="background:${st ? L.color : "#fff"}">
          <span class="label">第 ${L.id} 關・${L.name}</span>
          <div class="big">${st ? (L.id === 7 ? "全部通關！" : "穿越成功！") : "被困住了…"}</div>
          <div class="bigstars">${"⭐".repeat(st)}${"☆".repeat(3 - st)}</div>
          <p>答對 ${right} / ${pool.length} 題${st ? "" : "，答對 3 題才能穿越喔！"}</p>
          <div class="row center">
            <button class="btn ghost" id="again">再玩一次</button>
            ${nextOpen ? `<button class="btn" id="nextLv">下一關：${LEVELS[L.id].name} →</button>` : ""}
            <button class="btn ghost" data-go="map">回地圖</button>
          </div></div></section>`));
        $("#again").addEventListener("click", () => quiz(cfg));
        if (nextOpen) $("#nextLv").addEventListener("click", () => quiz({ mode: "level", lv: L.id + 1 }));
      } else if (cfg.mode === "exam") {
        const score = right * 4;
        save.bestExam = Math.max(save.bestExam, score); persist();
        if (score >= 80) award("exam80");
        if (score === 100) award("exam100");
        if (score >= 80) { sfx.win(); confetti(); }
        const word = score === 100 ? "滿分！歷史小博士！" : score >= 80 ? "段考穩了！" : score >= 60 ? "及格！再衝一下！" : "先去錯題本練練！";
        app.innerHTML = "";
        app.append(h(`<section class="screen"><div class="result card ${score >= 80 ? "green" : "yellow"}">
          <span class="label">段考模擬</span><div class="big">${score} 分</div>
          <p>${word}（答對 ${right} / 25，最佳 ${save.bestExam} 分）</p>
          <div class="row center"><button class="btn" id="again">再考一次</button><button class="btn ghost" data-go="review">去錯題本</button><button class="btn ghost" data-go="home">首頁</button></div>
        </div></section>`));
        $("#again").addEventListener("click", () => quiz(cfg));
      } else {
        if (!save.wrong.length) award("clean");
        app.innerHTML = "";
        app.append(h(`<section class="screen"><div class="result card cream">
          <span class="label">錯題複習</span><div class="big">${right} / ${pool.length}</div>
          <p>錯題本還剩 <b>${save.wrong.length}</b> 題。答對的題目會自動移出錯題本。</p>
          <div class="row center">${save.wrong.length ? `<button class="btn" data-go="review">繼續複習</button>` : ""}<button class="btn ghost" data-go="home">首頁</button></div>
        </div></section>`));
      }
    }
    show();
  }

  function exam() { quiz({ mode: "exam" }); }
  function review() {
    if (!save.wrong.length) {
      app.append(h(`<section class="screen"><div class="result card green"><div class="big">📕 0 題</div><p>錯題本是空的！去闖關或考模擬考吧。</p>
        <div class="row center"><button class="btn" data-go="map">去闖關</button><button class="btn ghost" data-go="home">首頁</button></div></div></section>`));
      return;
    }
    quiz({ mode: "review" });
  }

  // ── 時間軸排序 ────────────────────────────────────────────────────────
  function timeline() {
    const picked = pick(window.TIMELINE_EVENTS, 6);
    let order = shuffle(picked);
    let checked = false;
    app.append(h(`<section class="screen">
      <div class="row" style="justify-content:space-between"><h2>📅 時間軸排序</h2><button class="btn ghost" data-go="home">← 首頁</button></div>
      <p>用 ▲▼ 把事件從<b>最早</b>（上）排到<b>最晚</b>（下），排好按「檢查」。</p>
      <div class="tl-list" id="tl"></div>
      <div class="row center"><button class="btn" id="check">檢查順序</button><button class="btn ghost" id="new">換一組</button></div>
    </section>`));
    function draw() {
      const sorted = picked.slice().sort((a, b) => a.year - b.year);
      $("#tl").innerHTML = order.map((ev, k) => {
        const cls = checked ? (sorted[k] === ev ? "ok" : "bad") : "";
        return `<div class="tl-item ${cls}"><span class="idx">${k + 1}</span>
          <span>${esc(ev.t)}${checked ? `<br><span class="yr">${ev.label}</span>` : ""}</span>
          <span class="mv"><button data-up="${k}" aria-label="上移" ${k === 0 || checked ? "disabled" : ""}>▲</button><button data-down="${k}" aria-label="下移" ${k === order.length - 1 || checked ? "disabled" : ""}>▼</button></span></div>`;
      }).join("");
      $("#tl").querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => { const k = +b.dataset.up; [order[k - 1], order[k]] = [order[k], order[k - 1]]; sfx.click(); draw(); }));
      $("#tl").querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => { const k = +b.dataset.down; [order[k + 1], order[k]] = [order[k], order[k + 1]]; sfx.click(); draw(); }));
    }
    $("#check").addEventListener("click", () => {
      if (checked) return;
      checked = true;
      const sorted = picked.slice().sort((a, b) => a.year - b.year);
      const n = order.filter((ev, k) => sorted[k] === ev).length;
      draw();
      if (n === order.length) { sfx.win(); confetti(); toast("全部正確！時間感超強！"); award("timeline"); }
      else { sfx.wrong(); toast(`對了 ${n} / ${order.length} 個，紅色的位置不對，看看年份再試一次！`); }
      $("#check").textContent = "再來一組";
      $("#check").onclick = () => route("timeline");
    });
    $("#new").addEventListener("click", () => route("timeline"));
    draw();
  }

  // ── 連連看 ────────────────────────────────────────────────────────────
  function match() {
    const pairs = pick(window.MATCH_PAIRS, 6);
    const left = shuffle(pairs.map((p, i) => ({ i, t: p[0] })));
    const right = shuffle(pairs.map((p, i) => ({ i, t: p[1] })));
    let sel = null, done = 0, miss = 0;
    app.append(h(`<section class="screen">
      <div class="row" style="justify-content:space-between"><h2>🔗 連連看</h2><button class="btn ghost" data-go="home">← 首頁</button></div>
      <p>先點左邊的人物／名詞，再點右邊對應的事蹟。失誤：<b id="miss">0</b></p>
      <div class="match"><div class="col" id="L"></div><div class="col" id="R"></div></div>
      <div class="row center"><button class="btn ghost" id="new">換一組</button></div>
    </section>`));
    $("#L").innerHTML = left.map((x) => `<button class="tile l" data-i="${x.i}">${esc(x.t)}</button>`).join("");
    $("#R").innerHTML = right.map((x) => `<button class="tile" data-i="${x.i}">${esc(x.t)}</button>`).join("");
    $("#L").querySelectorAll(".tile").forEach((b) => b.addEventListener("click", () => {
      if (b.classList.contains("done")) return;
      $("#L").querySelectorAll(".sel").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel"); sel = b; sfx.click();
    }));
    $("#R").querySelectorAll(".tile").forEach((b) => b.addEventListener("click", () => {
      if (b.classList.contains("done")) return;
      if (!sel) { toast("先點左邊的人物喔！"); return; }
      if (sel.dataset.i === b.dataset.i) {
        sel.classList.remove("sel"); sel.classList.add("done"); b.classList.add("done");
        sel.disabled = b.disabled = true; sel = null; done++; sfx.right();
        if (done === pairs.length) {
          sfx.win(); confetti();
          toast(miss ? `完成！失誤 ${miss} 次` : "零失誤！配對高手！");
          if (!miss) award("match");
          $("#new").textContent = "再來一組";
        }
      } else {
        miss++; $("#miss").textContent = miss; sfx.wrong();
        b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 400);
      }
    }));
    $("#new").addEventListener("click", () => route("match"));
  }

  // ── 徽章牆 ────────────────────────────────────────────────────────────
  function badges() {
    app.append(h(`<section class="screen">
      <div class="row" style="justify-content:space-between"><h2>🏅 徽章牆（${save.badges.length} / ${BADGES.length}）</h2><button class="btn ghost" data-go="home">← 首頁</button></div>
      <div class="badges">${BADGES.map((b) => `<div class="badge card ${save.badges.includes(b.id) ? "yellow" : "off"}"><span class="em">${b.em}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join("")}</div>
      <p class="foot">最佳模擬考：${save.bestExam} 分・最高連擊：${save.bestCombo}</p>
      <div class="row center"><button class="btn ghost" id="reset">清除進度</button></div>
    </section>`));
    $("#reset").addEventListener("click", () => {
      if (confirm("確定要清除所有星星、徽章和錯題本嗎？")) { save = { ...blank }; persist(); refreshTop(); route("badges"); }
    });
  }

  refreshTop();
  route("home");
})();
