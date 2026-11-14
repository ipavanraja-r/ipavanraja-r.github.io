/* =========================================================
   p1r3x // main.js
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => Math.random() * (b - a) + a;
  const GLYPHS = "!<>-_\\/[]{}—=+*^?#01ABCDEFabcdef$%&";

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------------- boot sequence ---------------- */
  const BOOT = [
    ["[    0.000000] p1r3x-kernel 6.9.0-research #1 SMP PREEMPT", ""],
    ["[    0.004112] Initializing cgroup subsys cpuset, memory, net_cls", ""],
    ["[    0.118340] Loading module: 5g_redcap_fuzzer.ko", "ok"],
    ["[    0.201977] Loading module: scada_ids.ko", "ok"],
    ["[    0.263501] Loading module: fedprox_dp_smpc.ko", "ok"],
    ["[    0.310442] Loading module: cvss_bert.ko", "ok"],
    ["[    0.402219] eth0: link up — Amrita Cyber Labs uplink established", ""],
    ["[    0.455010] firewall: 1 inbound probe dropped from 203.0.113.66", "warn"],
    ["[    0.512873] Mounting /research … /publications … /ops", "ok"],
    ["[    0.600118] Verifying operator identity: p1r3x", ""],
    ["[    0.701337] ACCESS GRANTED", "ok"],
  ];

  function boot() {
    const el = $("#boot");
    const log = $("#boot-log");
    const finish = () => {
      el.classList.add("done");
      document.body.classList.remove("booting");
      store.set("p1r3x-booted", "1");
      startTyping();
    };
    $("#boot-skip").addEventListener("click", finish);

    if (reduced || store.get("p1r3x-booted") || /[?&]noboot\b/.test(location.search)) { el.style.display = "none"; finish(); return; }

    let i = 0;
    const next = () => {
      if (el.classList.contains("done")) return;
      if (i >= BOOT.length) { setTimeout(finish, 450); return; }
      const [txt, cls] = BOOT[i++];
      const line = document.createElement("div");
      line.textContent = txt;
      if (cls) {
        const tag = document.createElement("span");
        tag.className = cls;
        tag.textContent = cls === "ok" ? "  [ OK ]" : "  [WARN]";
        line.appendChild(tag);
      }
      log.appendChild(line);
      setTimeout(next, rand(70, 190));
    };
    next();
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { finish(); document.removeEventListener("keydown", esc); }
    });
  }

  /* ---------------- typed roles ---------------- */
  const ROLES = [
    "PhD Researcher @ Amrita Vishwa Vidyapeetham",
    "Security Research Engineer @ Amrita Cyber Labs",
    "5G RedCap & IoT protocol breaker",
    "ICS / SCADA defender",
    "Privacy-preserving FL engineer",
    "CTF author · TryHackMe top 1%",
  ];
  let typingStarted = false;
  function startTyping() {
    if (typingStarted) return;
    typingStarted = true;
    const el = $("#typed");
    if (reduced) { el.textContent = ROLES[0]; return; }
    let r = 0, c = 0, del = false;
    const tick = () => {
      const word = ROLES[r];
      c += del ? -1 : 1;
      el.textContent = word.slice(0, c);
      let d = del ? 28 : 55;
      if (!del && c === word.length) { d = 1800; del = true; }
      else if (del && c === 0) { del = false; r = (r + 1) % ROLES.length; d = 300; }
      setTimeout(tick, d);
    };
    tick();
  }

  /* ---------------- clock ---------------- */
  function clock() {
    const el = $("#clock");
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const upd = () => { el.textContent = fmt.format(new Date()) + " IST"; };
    upd();
    setInterval(upd, 1000);
  }

  /* ---------------- network background ---------------- */
  function network() {
    const cv = $("#net");
    const ctx = cv.getContext("2d");
    let W, H, nodes = [], packets = [], dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -999, y: -999 };
    let matrix = false, drops = [];

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.floor((W * H) / 16000));
      nodes = Array.from({ length: count }, () => ({
        x: rand(0, W), y: rand(0, H),
        vx: rand(-0.25, 0.25), vy: rand(-0.25, 0.25),
        r: rand(1, 2.4), hot: Math.random() < 0.06,
      }));
      drops = Array.from({ length: Math.ceil(W / 16) }, () => rand(-H / 16, 0));
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener("mouseout", () => { mouse.x = mouse.y = -999; });
    window.addEventListener("p1r3x:matrix", () => { matrix = !matrix; ctx.clearRect(0, 0, W, H); });
    resize();

    const LINK = 140;

    function drawNet() {
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 120) { n.x += dx / d * 0.8; n.y += dy / d * 0.8; }
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(0,255,156,${(1 - d / LINK) * 0.16})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            if (packets.length < 22 && Math.random() < 0.0009) packets.push({ a, b, t: 0, red: Math.random() < 0.18 });
          }
        }
        const md = Math.hypot(nodes[i].x - mouse.x, nodes[i].y - mouse.y);
        if (md < 180) {
          ctx.strokeStyle = `rgba(45,226,255,${(1 - md / 180) * 0.35})`;
          ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = n.hot ? "rgba(255,42,74,.9)" : "rgba(0,255,156,.65)";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
        if (n.hot) {
          ctx.strokeStyle = "rgba(255,42,74,.25)";
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 5 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2); ctx.stroke();
        }
      }
      packets = packets.filter((p) => {
        p.t += 0.02;
        if (p.t >= 1) return false;
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        ctx.fillStyle = p.red ? "#ff2a4a" : "#2de2ff";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        ctx.shadowBlur = 0;
        return true;
      });
    }

    function drawMatrix() {
      ctx.fillStyle = "rgba(5,8,10,0.12)";
      ctx.fillRect(0, 0, W, H);
      ctx.font = "14px JetBrains Mono, monospace";
      for (let i = 0; i < drops.length; i++) {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.fillStyle = Math.random() < 0.03 ? "#eefcf6" : "rgba(57,255,20,.75)";
        ctx.fillText(ch, i * 16, drops[i] * 16);
        if (drops[i] * 16 > H && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    }

    if (reduced) { drawNet(); return; }
    let last = 0;
    (function loop(t) {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      if (matrix) { if (t - last > 45) { drawMatrix(); last = t; } }
      else drawNet();
    })(0);
  }

  /* ---------------- text scramble ---------------- */
  function scramble(el) {
    if (reduced || el.dataset.done) return;
    el.dataset.done = "1";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const final = node.nodeValue;
      let frame = 0;
      const total = 22;
      const step = () => {
        frame++;
        const p = frame / total;
        node.nodeValue = [...final].map((ch, i) => {
          if (ch === " ") return " ";
          return i / final.length < p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }).join("");
        if (frame < total) setTimeout(step, 40);
        else node.nodeValue = final;
      };
      step();
    });
  }

  /* ---------------- counters ---------------- */
  function count(el) {
    const end = +el.dataset.count;
    if (reduced) { el.textContent = end; return; }
    const t0 = performance.now(), dur = 1400;
    const f = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  /* ---------------- reveal observer ---------------- */
  function observe() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.classList.add("in");
        $$("[data-scramble]", el).forEach(scramble);
        $$("[data-count]", el).forEach(count);
        io.unobserve(el);
      });
    }, { threshold: 0.12 });

    // stagger siblings in grids
    $$(".reveal").forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      const idx = sibs.indexOf(el);
      if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 6) * 70}ms`;
      io.observe(el);
    });
  }

  /* ---------------- project canvases ---------------- */
  function projectViz() {
    const items = $$("canvas[data-viz]").map((cv) => ({ cv, ctx: cv.getContext("2d"), mode: cv.dataset.viz, vis: false, seed: Math.random() * 1000 }));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const it = items.find((i) => i.cv === e.target);
      if (it) it.vis = e.isIntersecting;
    }));
    items.forEach((it) => io.observe(it.cv));

    function size(it) {
      const r = it.cv.getBoundingClientRect();
      if (it.cv.width !== Math.round(r.width) || it.cv.height !== Math.round(r.height)) {
        it.cv.width = Math.round(r.width); it.cv.height = Math.round(r.height);
        it.pts = null;
      }
      return [it.cv.width, it.cv.height];
    }

    const G = "rgba(0,255,156,", C = "rgba(45,226,255,", R = "rgba(255,42,74,";

    const draw = {
      mesh(it, t, w, h, ctx) {
        // federated: 3 clients -> aggregator
        const cx = w * 0.62, cy = h * 0.52;
        const clients = [[w * 0.2, h * 0.3], [w * 0.22, h * 0.78], [w * 0.92, h * 0.35]];
        ctx.strokeStyle = G + ".25)";
        clients.forEach(([x, y], i) => {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke();
          const p = ((t / 1600) + i / 3) % 1;
          ctx.fillStyle = i === 2 ? C + ".9)" : G + ".9)";
          ctx.fillRect(x + (cx - x) * p - 2, y + (cy - y) * p - 2, 4, 4);
          ctx.strokeStyle = G + ".6)"; ctx.strokeRect(x - 7, y - 7, 14, 14);
          ctx.strokeStyle = G + ".25)";
        });
        ctx.strokeStyle = G + ".8)";
        ctx.beginPath(); ctx.arc(cx, cy, 12 + Math.sin(t / 400) * 2, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 24 + (t / 30) % 30, 0, 7);
        ctx.strokeStyle = G + (0.4 - ((t / 30) % 30) / 75) + ")"; ctx.stroke();
      },
      wave(it, t, w, h, ctx) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.strokeStyle = [G + ".7)", C + ".45)", R + ".55)"][k];
          for (let x = 0; x <= w; x += 3) {
            const burst = k === 2 ? Math.max(0, Math.sin(t / 900)) : 1;
            const y = h / 2 + Math.sin(x / (18 + k * 9) + t / (300 + k * 150)) * (18 + k * 6) * burst * Math.sin(x / w * Math.PI);
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      },
      bars(it, t, w, h, ctx) {
        const labels = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"];
        const bw = w / (labels.length * 1.6);
        labels.forEach((l, i) => {
          const v = 0.25 + 0.65 * Math.abs(Math.sin(t / 1300 + i * 1.7 + it.seed));
          const x = w * 0.06 + i * bw * 1.6, bh = (h - 40) * v;
          ctx.fillStyle = v > 0.75 ? R + ".6)" : G + ".45)";
          ctx.fillRect(x, h - 18 - bh, bw, bh);
          ctx.fillStyle = G + ".7)"; ctx.font = "10px JetBrains Mono, monospace";
          ctx.fillText(l, x, h - 5);
        });
      },
      scope(it, t, w, h, ctx) {
        ctx.strokeStyle = G + ".08)";
        for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        ctx.beginPath(); ctx.strokeStyle = G + ".8)";
        const spike = (t / 3000) % 1;
        for (let x = 0; x <= w; x += 2) {
          const n = x / w;
          let y = h * 0.55 + Math.sin(n * 18 + t / 500) * 10 + Math.sin(n * 53) * 3;
          if (Math.abs(n - spike) < 0.03) y -= 40 * (1 - Math.abs(n - spike) / 0.03);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = R + ".9)"; ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText("ANOMALY", spike * w - 20, h * 0.55 - 50);
      },
      hex(it, t, w, h, ctx) {
        ctx.font = "11px JetBrains Mono, monospace";
        const cols = Math.floor(w / 26), rows = Math.floor(h / 16);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const v = Math.sin(r * 3.1 + c * 7.7 + Math.floor(t / 180) * 0.37 + it.seed);
          const hexv = ((Math.abs(v) * 255) | 0).toString(16).padStart(2, "0");
          ctx.fillStyle = v > 0.92 ? R + ".85)" : G + (0.12 + Math.abs(v) * 0.25) + ")";
          ctx.fillText(hexv, 10 + c * 26, 40 + r * 16);
        }
      },
      radar(it, t, w, h, ctx) {
        const cx = w * 0.5, cy = h * 0.6, R0 = Math.min(w, h) * 0.55;
        ctx.strokeStyle = G + ".2)";
        for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, R0 * k / 3, 0, 7); ctx.stroke(); }
        const a = (t / 1200) % (Math.PI * 2);
        const g = ctx.createConicGradient ? ctx.createConicGradient(a - 0.6, cx, cy) : null;
        if (g) {
          g.addColorStop(0, "rgba(0,255,156,0)"); g.addColorStop(0.095, "rgba(0,255,156,.35)"); g.addColorStop(0.1, "rgba(0,255,156,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = G + ".8)"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); ctx.stroke();
        [[0.3, 1.1], [0.65, 3.8], [0.85, 5.2]].forEach(([d, ang]) => {
          const diff = ((a - ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          ctx.fillStyle = C + Math.max(0.15, 1 - diff / 3) + ")";
          ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * R0 * d, cy + Math.sin(ang) * R0 * d, 3, 0, 7); ctx.fill();
        });
      },
    };

    const frame = (t) => {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      items.forEach((it) => {
        if (!it.vis && t > 0) return;
        const [w, h] = size(it);
        it.ctx.clearRect(0, 0, w, h);
        (draw[it.mode] || draw.wave)(it, t, w, h, it.ctx);
      });
    };
    if (reduced) { items.forEach((it) => { const [w, h] = size(it); (draw[it.mode] || draw.wave)(it, 2000, w, h, it.ctx); }); return; }
    requestAnimationFrame(frame);
  }

  /* ---------------- project filters ---------------- */
  function filters() {
    const btns = $$(".filters button");
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.toggle("on", x === b));
      const f = b.dataset.filter;
      $$(".proj").forEach((p) => {
        const show = f === "all" || p.dataset.cat.split(" ").includes(f);
        p.classList.toggle("hide", !show);
        if (show) p.classList.add("in");
      });
    }));
  }

  /* ---------------- nav ---------------- */
  function nav() {
    const btn = $("#menu-btn"), links = $("#nav-links");
    btn.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
      btn.textContent = open ? "[ close ]" : "[ menu ]";
    });
    $$("a", links).forEach((a) => a.addEventListener("click", () => {
      links.classList.remove("open"); btn.textContent = "[ menu ]"; btn.setAttribute("aria-expanded", false);
    }));

    const map = new Map($$("a", links).filter((a) => a.getAttribute("href").startsWith("#")).map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) {
        map.forEach((a) => a.classList.remove("active"));
        const a = map.get(e.target.id);
        if (a) a.classList.add("active");
      }
    }), { rootMargin: "-45% 0px -50% 0px" });
    if (map.size) $$("main section[id]").forEach((s) => io.observe(s));

    const top = $("#to-top");
    if (top) window.addEventListener("scroll", () => top.classList.toggle("show", window.scrollY > 700), { passive: true });
  }

  /* ---------------- bibtex ---------------- */
  function bibtex() {
    const pre = $("#bibtex");
    $("#bib-toggle").addEventListener("click", () => pre.classList.toggle("show"));
    $("#bib-copy").addEventListener("click", async () => {
      const cite = "Pavan Raja I., Kurunandan Jain, Hari N. N., Sethu Subramanian N., and Prabhakar Krishnan (2026). A Comprehensive Survey on 5G RedCap: Technologies, Security Vulnerabilities, and Attack Vectors. Future Internet, 18(3), 118. https://doi.org/10.3390/fi18030118";
      try { await navigator.clipboard.writeText(cite); toast("✓ citation copied to clipboard"); }
      catch { toast("copy failed — select the text manually"); pre.classList.add("show"); }
    });
  }

  /* ---------------- contact form ---------------- */
  function contact() {
    const form = $("#contact-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", form);
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = "Encrypting…";
      try {
        const res = await fetch(form.action.replace("formsubmit.co/", "formsubmit.co/ajax/"), {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        toast("✓ transmission received — I'll reply soon");
      } catch {
        toast("✗ transmission failed — use email instead");
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    });
  }

  /* ---------------- fingerprint (fun, local only) ---------------- */
  function fingerprint() {
    const s = [navigator.userAgent, screen.width, screen.height, navigator.language, new Date().getTimezoneOffset()].join("|");
    let h1 = 0x811c9dc5, h2 = 0x1234567;
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
      h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519);
    }
    const hex = ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padEnd(16, "0").toUpperCase();
    if ($("#fp")) $("#fp").textContent = hex.match(/.{1,4}/g).join(":") + "  (computed in your browser, never sent)";
    if ($("#year")) $("#year").textContent = new Date().getFullYear();
  }

  /* ---------------- ticker duplicate ---------------- */
  function ticker() {
    const t = $("#ticker");
    t.innerHTML += t.innerHTML;
  }

  /* ---------------- interactive terminal ---------------- */
  function terminal() {
    const out = $("#term-out"), input = $("#term-input"), body = $("#term-body");
    const hist = []; let hi = 0;

    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const print = (html, cls = "") => {
      const d = document.createElement("div");
      d.className = "term-line " + cls;
      d.innerHTML = html;
      out.appendChild(d);
      body.scrollTop = body.scrollHeight;
    };
    const ps = '<span class="p-user">p1r3x</span><span class="dim">@</span><span class="p-host">lab</span><span class="dim">:</span><span class="p-path">~</span><span class="dim">$</span> ';
    const g = (s) => `<span class="mono-green">${s}</span>`;
    const c = (s) => `<span class="cyan">${s}</span>`;
    const d = (s) => `<span class="dim">${s}</span>`;
    const r = (s) => `<span class="red">${s}</span>`;
    const jump = (id) => setTimeout(() => document.getElementById(id).scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 350);

    const CMDS = {
      help: () => [
        g("available commands:"),
        `  ${c("whoami")}      who is p1r3x`,
        `  ${c("roles")}       current positions`,
        `  ${c("research")}    research focus areas`,
        `  ${c("projects")}    list operations`,
        `  ${c("papers")}      publications`,
        `  ${c("skills")}      loaded modules`,
        `  ${c("certs")}       certifications`,
        `  ${c("vault")}       open the credential vault page`,
        `  ${c("academy")}     courses for students (coming soon)`,
        `  ${c("blog")}        read my latest writing`,
        `  ${c("contact")}     open a channel`,
        `  ${c("resume")}      open resume.pdf`,
        `  ${c("goto")} &lt;sec&gt;  jump to a section`,
        `  ${c("matrix")}      toggle background mode`,
        `  ${c("clear")}       clear screen`,
        d("  …and maybe a few hidden ones."),
      ].join("\n"),
      whoami: () => `${g("I Pavanraja")} ${d("(p1r3x)")}\nPhD scholar in cybersecurity: IoT security, ICS protection and cyber-physical systems.\nI find protocol-level vulnerabilities and build defenses for smart cities and critical infrastructure.`,
      roles: () => `${g("[PID 0001]")} PhD Researcher            ${d("@")} ${c("Amrita Vishwa Vidyapeetham")}\n${g("[PID 0002]")} Security Research Engineer ${d("@")} ${c("Amrita Cyber Labs")}`,
      research: () => `${g("[01]")} 5G RedCap &amp; cellular IoT protocol attacks\n${g("[02]")} ICS / SCADA anomaly detection\n${g("[03]")} Privacy-preserving federated learning (DP + SMPC + blockchain)\n${g("[04]")} AI for vulnerability intelligence (CVSS prediction)`,
      projects: () => { jump("projects"); return `drwxr-x  ${c("smartcity-fl/")}       FedProx · Opacus · Hyperledger\ndrwxr-x  ${c("5g-redcap-testbed/")}  Open5GS · UERANSIM · Grafana\ndrwxr-x  ${c("cvss-bert/")}          BERT · DistilBERT\ndrwxr-x  ${c("water-scada-ids/")}    DHALSIM · EPANET · MiniCPS\ndrwxr-x  ${c("ctf-exam/")}           7 web exploit scenarios\ndrwxr-x  ${c("iot-bus-ticketing/")}  RFID · IoT\n${d("→ scrolling to #projects")}`; },
      papers: () => { jump("publications"); return `${g("[J.1]")} A Comprehensive Survey on 5G RedCap: Technologies, Security\n      Vulnerabilities, and Attack Vectors — ${c("Future Internet")} 18(3):118, 2026\n      doi: <a href="https://doi.org/10.3390/fi18030118" target="_blank" rel="noopener">10.3390/fi18030118</a>`; },
      skills: () => { jump("arsenal"); return `Module                  Status\noffensive_redteam       ${g("loaded")}\nmobile_api_sec          ${g("loaded")}\nresearch_5g_iot_ics     ${g("loaded")}\ndefense_forensics       ${g("loaded")}\nreverse_engineering     ${g("loaded")}\nsystems_compliance      ${g("loaded")}`; },
      certs: () => (window.CERTS || []).map((c) => `${g("✓")} ${esc(c.title)} — ${esc(c.issuer)} (${c.date.slice(0, 4)})`).join("\n") + `\n${d("→ run 'vault' to open the credential vault")}`,
      contact: () => { jump("contact"); return `mail     <a href="mailto:ipavanraja02@gmail.com">ipavanraja02@gmail.com</a>\nlinkedin <a href="https://www.linkedin.com/in/p1r3x" target="_blank" rel="noopener">/in/p1r3x</a>\ngithub   <a href="https://github.com/ipavanraja-r" target="_blank" rel="noopener">ipavanraja-r</a>\nthm      <a href="https://tryhackme.com/p/p1r3x" target="_blank" rel="noopener">p1r3x</a>`; },
      resume: () => { window.open("PavanRaja_resume.pdf", "_blank", "noopener"); return d("opening PavanRaja_resume.pdf …"); },
      cv: () => CMDS.resume(),
      blog: () => { setTimeout(() => { location.href = "blog/"; }, 500); return d("opening /blog — transmissions …"); },
      academy: () => { setTimeout(() => { location.href = "academy/"; }, 500); return d("cd ~/academy · loading courses …"); },
      courses: () => CMDS.academy(),
      learn: () => CMDS.academy(),
      vault: () => { setTimeout(() => { location.href = "certifications.html"; }, 500); return d("unsealing credential vault …"); },
      ls: () => `${c("research/")}  ${c("projects/")}  ${c("papers/")}  ${c("certs/")}  PavanRaja_resume.pdf  .secrets`,
      "cat .secrets": () => r("Permission denied. Nice try though ;)"),
      "ls -la": () => CMDS.ls(),
      pwd: () => "/home/p1r3x",
      date: () => new Date().toString(),
      uname: () => "p1r3x-kernel 6.9.0-research x86_64 GNU/Linux",
      "uname -a": () => CMDS.uname(),
      id: () => "uid=1337(p1r3x) gid=1337(researchers) groups=1337(researchers),27(sudo),42(amrita-cyber-labs)",
      history: () => hist.map((h, i) => `  ${String(i + 1).padStart(3)}  ${esc(h)}`).join("\n") || d("(empty)"),
      echo: (a) => esc(a.join(" ")),
      goto: (a) => {
        const map = { about: "about", whoami: "about", research: "research", experience: "experience", exp: "experience", projects: "projects", papers: "publications", publications: "publications", skills: "arsenal", arsenal: "arsenal", certs: "arsenal", contact: "contact" };
        const id = map[(a[0] || "").toLowerCase()];
        if (!id) return r("usage: goto [about|research|experience|projects|papers|skills|contact]");
        jump(id); return d(`→ scrolling to #${id}`);
      },
      cd: (a) => CMDS.goto(a),
      matrix: () => { window.dispatchEvent(new Event("p1r3x:matrix")); document.body.classList.toggle("matrix-mode"); return g("Wake up, Neo… (run again to exit)"); },
      sudo: (a) => a.join(" ").startsWith("rm") ? r("Absolutely not. This incident will be reported. 🚨") : r("p1r3x is not in the sudoers file. This incident will be reported."),
      nmap: () => `Starting Nmap 7.95\nNmap scan report for p1r3x.lab\nPORT     STATE SERVICE\n22/tcp   ${g("open")}  ssh\n443/tcp  ${g("open")}  research\n1337/tcp ${g("open")}  collaboration\n${d("Hint: port 1337 → run 'contact'")}`,
      hack: () => r("ACCESS DENIED — ethical hacking only. Try 'nmap' instead."),
      exit: () => d("there is no escape. (but you can scroll down)"),
      clear: () => { out.innerHTML = ""; return null; },
    };

    function run(raw) {
      const line = raw.trim();
      print(ps + esc(raw));
      if (!line) return;
      hist.push(line); hi = hist.length;
      const lower = line.toLowerCase();
      let res;
      if (CMDS[lower]) res = CMDS[lower]([]);
      else {
        const [cmd, ...args] = line.split(/\s+/);
        const fn = CMDS[cmd.toLowerCase()];
        res = fn ? fn(args) : `${r("command not found:")} ${esc(cmd)} ${d("— type 'help'")}`;
      }
      if (res != null) print(res);
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { run(input.value); input.value = ""; }
      else if (e.key === "ArrowUp") { if (hi > 0) { hi--; input.value = hist[hi]; } e.preventDefault(); }
      else if (e.key === "ArrowDown") { if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ""; } e.preventDefault(); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const v = input.value.toLowerCase();
        const m = Object.keys(CMDS).filter((k) => k.startsWith(v) && !k.includes(" "));
        if (m.length === 1) input.value = m[0];
        else if (m.length > 1) print(d(m.join("  ")));
      } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
    });
    body.addEventListener("click", (e) => { if (!e.target.closest("a") && !window.getSelection().toString()) input.focus({ preventScroll: true }); });
    $$(".term-hint button").forEach((b) => b.addEventListener("click", () => { run(b.dataset.cmd); input.focus({ preventScroll: true }); }));

    // intro
    const banner = [
      g("p1r3x-shell v2.6") + d("  ·  connected to amrita-cyber-labs"),
      d("Last login: ") + new Date().toDateString() + d(" from 10.13.37.1"),
      "",
      "Type " + c("help") + " to list commands, or click a suggestion below.",
      "",
    ];
    banner.forEach((l) => print(l || "&nbsp;"));
    print(ps + "whoami");
    print(CMDS.whoami());
  }

  /* ---------------- console easter egg ---------------- */
  function consoleEgg() {
    console.log("%cp1r3x", "font: 800 42px monospace; color:#00ff9c; text-shadow:0 0 10px #00ff9c");
    console.log("%cPoking around devtools? Respect. → ipavanraja02@gmail.com", "color:#2de2ff; font: 13px monospace");
  }

  /* ---------------- holographic portrait ----------------
     Keys out the orange disc + white ring of the source photo,
     renders the subject as live ASCII, and glitches to the real
     colour cut-out on hover / tap.                             */
  function portrait() {
    const wrap = $("#portrait");
    const cv = $("#portrait-canvas");
    const img = $("#portrait-src");
    if (!wrap || !cv || !img) return;
    const ctx = cv.getContext("2d");

    const CROP = { sx: 190, sy: 0, sw: 700, sh: 700 }; // head + shoulders in the 1024² source
    const GLYPH_SET = "0123456789ABCDEF#$%&*+=<>";
    let cut, cells, cols = 64, rows = 64, W = 0, H = 0, mode = "ascii", modeT = 0, visible = true, failed = false;

    function buildCutout() {
      const S = 640;
      cut = document.createElement("canvas");
      cut.width = cut.height = S;
      const c = cut.getContext("2d", { willReadFrequently: true });
      c.drawImage(img, CROP.sx, CROP.sy, CROP.sw, CROP.sh, 0, 0, S, S);
      const d = c.getImageData(0, 0, S, S);
      const p = d.data, N = S * S;

      // 1. background candidates: transparent, white ring, orange disc, orange/dark fringe
      const cand = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        const i = k * 4, r = p[i], g = p[i + 1], b = p[i + 2], a = p[i + 3];
        cand[k] = a < 40 ||
          (r > 200 && g > 200 && b > 190) ||                       // white ring
          (r > 170 && b < 110 && r - b > 110 && g > 60 && g < 220) || // orange disc
          (b < 50 && r > 70 && r > g * 1.3) ||                      // orange→hair blend
          (r > 225 && g > 150 && b > 100 && r - b > 40 && r - b < 130 && g - b > 30) ? 1 : 0; // orange→white blend
      }
      // 2. flood fill from the borders: only candidates connected to the edge are background,
      //    so eye whites, shadows and the tilak inside the face are never removed
      const bg = new Uint8Array(N);
      const stack = [];
      for (let x = 0; x < S; x++) { stack.push(x, (S - 1) * S + x); }
      for (let y = 0; y < S; y++) { stack.push(y * S, y * S + S - 1); }
      while (stack.length) {
        const k = stack.pop();
        if (bg[k] || !cand[k]) continue;
        bg[k] = 1;
        const x = k % S, y = (k / S) | 0;
        if (x > 0) stack.push(k - 1);
        if (x < S - 1) stack.push(k + 1);
        if (y > 0) stack.push(k - S);
        if (y < S - 1) stack.push(k + S);
      }
      // 3. erode: eat thin lines (anti-aliased ring) and ragged edges
      for (let pass = 0; pass < 2; pass++) {
        const nb = bg.slice();
        for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
          const k = y * S + x;
          if (bg[k]) continue;
          const n = bg[k - 1] + bg[k + 1] + bg[k - S] + bg[k + S] + bg[k - S - 1] + bg[k - S + 1] + bg[k + S - 1] + bg[k + S + 1];
          if (n >= 4) nb[k] = 1;
        }
        bg.set(nb);
      }
      // 4. alpha: feather edges, then vignette the shoulders so the circular crop never shows
      const cx = S * 0.5, cy = S * 0.4, R = S * 0.52, F = S * 0.14;
      for (let k = 0; k < N; k++) {
        const x = k % S, y = (k / S) | 0;
        let a = bg[k] ? 0 : 255;
        if (a && x > 0 && x < S - 1 && y > 0 && y < S - 1 && (bg[k - 1] || bg[k + 1] || bg[k - S] || bg[k + S])) a = 140;
        const dist = Math.hypot((x - cx) * 0.85, y - cy);
        if (dist > R) a *= Math.max(0, 1 - (dist - R) / F);
        if (y > S * 0.8) a *= Math.max(0, 1 - (y - S * 0.8) / (S * 0.2));
        p[k * 4 + 3] = a;
      }
      c.putImageData(d, 0, 0);
    }

    function sample() {
      const s = document.createElement("canvas");
      s.width = cols; s.height = rows;
      const c = s.getContext("2d", { willReadFrequently: true });
      c.drawImage(cut, 0, 0, cols, rows);
      const p = c.getImageData(0, 0, cols, rows).data;
      cells = [];
      for (let i = 0; i < cols * rows; i++) {
        const a = p[i * 4 + 3] / 255;
        const l = (0.2126 * p[i * 4] + 0.7152 * p[i * 4 + 1] + 0.0722 * p[i * 4 + 2]) / 255;
        cells.push({ a, l, g: GLYPH_SET[(Math.random() * GLYPH_SET.length) | 0] });
      }
      // histogram equalisation over the subject's cells → maximum facial contrast
      const fg = cells.filter((c) => c.a > 0.45).sort((x, y) => x.l - y.l);
      fg.forEach((c, i) => { c.n = i / Math.max(1, fg.length - 1); });
      cells.forEach((c) => { if (c.n === undefined) c.n = 0; });
    }

    function resize() {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = rows = Math.max(48, Math.min(84, Math.round(W / 4.6)));
      if (cut) sample();
      if (reduced && cut) drawStill();
    }

    // reduced motion: a single static frame, redrawn whenever the canvas is resized
    function drawStill() {
      ctx.clearRect(0, 0, W, H);
      if (mode === "photo") ctx.drawImage(cut, 0, 0, W, H);
      else drawAscii(0, 1);
    }

    function drawAscii(t, alphaMul) {
      const cw = W / cols, ch = H / rows;
      ctx.font = `700 ${Math.ceil(ch * 1.08)}px "JetBrains Mono", monospace`;
      ctx.textBaseline = "top";
      const scanY = ((t / 2600) % 1.3 - 0.15) * rows;
      for (let y = 0; y < rows; y++) {
        const boost = Math.max(0, 1 - Math.abs(y - scanY) / 3);
        for (let x = 0; x < cols; x++) {
          const cell = cells[y * cols + x];
          if (cell.a < 0.45) continue;
          // every cell gets a glyph; brightness carries the facial detail
          if (Math.random() < 0.015) cell.g = GLYPH_SET[(Math.random() * GLYPH_SET.length) | 0];
          const chr = cell.n > 0.86 ? "@" : cell.g;
          const o = (0.1 + Math.pow(cell.n, 1.15) * 0.9) * alphaMul * Math.min(1, cell.a * 1.2);
          ctx.fillStyle = boost > 0.05
            ? `rgba(200,255,232,${Math.min(1, o + boost * 0.35)})`
            : cell.n > 0.82 ? `rgba(190,255,225,${o})` : `rgba(0,255,156,${o})`;
          ctx.fillText(chr, x * cw, y * ch);
        }
      }
    }

    function drawPhoto(t, alphaMul) {
      const glitch = Math.max(0, 1 - (t - modeT) / 450);
      ctx.save();
      ctx.globalAlpha = alphaMul;
      if (glitch > 0) {
        const slices = 14;
        for (let i = 0; i < slices; i++) {
          const sy = (cut.height / slices) * i, sh = cut.height / slices;
          const dx = (Math.random() - 0.5) * 30 * glitch;
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = alphaMul * 0.55;
          ctx.drawImage(cut, 0, sy, cut.width, sh, dx - 4 * glitch, (sy / cut.height) * H, W, H / slices);
          ctx.drawImage(cut, 0, sy, cut.width, sh, dx + 4 * glitch, (sy / cut.height) * H, W, H / slices);
        }
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.drawImage(cut, 0, 0, W, H);
      }
      ctx.restore();
    }

    function frame() {
      if (!failed) requestAnimationFrame(frame);
      if (!visible || document.hidden || !cells) return;
      const t = performance.now();
      ctx.clearRect(0, 0, W, H);
      const k = Math.min(1, (t - modeT) / 350);
      if (mode === "ascii") {
        if (k < 1) drawPhoto(t, 1 - k);
        drawAscii(t, k);
      } else {
        if (k < 1) drawAscii(t, 1 - k);
        drawPhoto(t, k);
      }
    }

    function setMode(m) {
      if (m === mode) return;
      mode = m; modeT = performance.now();
      wrap.dataset.mode = m;
      if (reduced && cut) drawStill();
      $$(".portrait-modes button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
    }

    function start() {
      try {
        buildCutout();
      } catch (e) {
        // canvas tainted (e.g. opened via file://): fall back to the styled <img>
        failed = true; wrap.classList.add("no-canvas"); return;
      }
      resize();
      wrap.classList.add("ready");
      if (reduced) { setMode("photo"); drawStill(); return; }
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", () => { if (cut) resize(); });
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(wrap);

    const hoverable = window.matchMedia("(hover: hover)").matches;
    if (hoverable) {
      wrap.addEventListener("mouseenter", () => setMode("photo"));
      wrap.addEventListener("mouseleave", () => setMode(wrap.dataset.pin || "ascii"));
    }
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest(".portrait-modes button");
      const m = b ? b.dataset.mode : (mode === "ascii" ? "photo" : "ascii");
      wrap.dataset.pin = m;
      setMode(m);
    });

    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  /* ---------------- certs strip on the home page ---------------- */
  function certStrip() {
    const el = $("#cert-strip");
    if (!el || !window.CERTS) return;
    const cats = window.CERT_CATEGORIES || {};
    const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    el.innerHTML = window.CERTS.slice().sort((a, b) => b.date.localeCompare(a.date)).map((c) => {
      const [y, m] = c.date.split("-");
      return `<a class="cert panel reveal" href="certifications.html#${encodeURIComponent(c.id)}" style="--accent:${(cats[c.category] || {}).color || "#00ff9c"}">
        <div class="hex">${esc(c.code)}</div><h4>${esc(c.title)}</h4><p>${esc(c.issuer)}</p><span class="d">${M[+m - 1]} ${y}</span></a>`;
    }).join("");
  }

  /* ---------------- latest blog posts on the home page ---------------- */
  async function blogTeaser() {
    const sec = $("#latest");
    const list = $("#latest-list");
    if (!sec || !list) return;
    try {
      const res = await fetch("blog/posts.json", { cache: "no-cache" });
      if (!res.ok) throw 0;
      const posts = (await res.json()).posts || [];
      if (!posts.length) throw 0;
      const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const fmt = (s) => { const d = new Date(s + "T00:00:00"); return `${M[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} ${d.getFullYear()}`; };
      list.innerHTML = posts.slice(0, 3).map((p) => `
        <li><a href="blog/?p=${encodeURIComponent(p.slug)}">
          <span class="tl-ts">${fmt(p.date)}</span>
          <span class="tl-unit">journal[${String(posts.length - posts.indexOf(p)).padStart(2, "0")}]:</span>
          <span class="tl-msg"><b>[${esc(((p.tags || [])[0] || "notes").toUpperCase())}]</b> <span class="tl-ttl">${esc(p.title)}</span><span class="tl-sum">${esc(p.summary)}</span></span>
          <span class="tl-rt">${p.readingTime}m ▸</span>
        </a></li>`).join("");
      sec.hidden = false;
    } catch {
      sec.hidden = true;
    }
  }

  /* ---------------- academy courses on the home page ---------------- */
  async function academyTeaser() {
    const sec = $("#academy"), list = $("#academy-list");
    if (!sec || !list) return;
    try {
      const res = await fetch("academy/courses.json", { cache: "no-cache" });
      if (!res.ok) throw 0;
      const courses = (await res.json()).courses || [];
      if (!courses.length) throw 0;
      let prog = {};
      try { prog = JSON.parse(localStorage.getItem("p1r3x-academy")) || {}; } catch { /* ignore */ }
      const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      list.innerHTML = courses.map((c) => {
        const done = Object.keys((prog[c.slug] || {}).done || {}).length;
        return `<li><a href="academy/?c=${encodeURIComponent(c.slug)}">
          <span class="tl-ts" style="color:${esc(c.color)}">${esc(c.code.toLowerCase())}/academy</span>
          <span class="tl-unit">[${esc(c.level.toLowerCase())}]</span>
          <span class="tl-msg"><span class="tl-ttl">${esc(c.title)}</span><span class="tl-sum">${c.stats.modules} chapters · ${c.stats.available}/${c.stats.lessons} lessons published${done ? ` · you've read ${done}` : ""} · ${esc(c.subtitle || c.summary)}</span></span>
          <span class="tl-rt">open ▸</span>
        </a></li>`;
      }).join("");
      sec.hidden = false;
    } catch {
      sec.hidden = true;
    }
  }

  /* ---------------- window manager ----------------
     The ● ● ● in every .panel-bar are real controls:
       red → close · amber → minimize · green → maximize
     Defaults work on any window; pages register overrides with
     P1R3X.win.on(selector, { close, minimize, maximize }).
     A handler returns true when it fully handled the action.      */
  const WM = (() => {
    const hooks = [];
    const ACTIONS = ["close", "minimize", "maximize"];
    const LABEL = { close: "Close window", minimize: "Minimize window", maximize: "Maximize window" };
    let jobs = 0;

    const winOf = (bar) => bar.closest(".panel, .tmux, .pager-win, .modal-card, .fzf-win") || bar.parentElement;
    const titleOf = (win) => (($(".panel-bar .title", win) || {}).textContent || "window").trim();
    const hookFor = (win, action) => hooks.find((h) => h[action] && win.matches(h.match));

    // make the dots real, accessible buttons
    function upgrade(root = document) {
      $$(".panel-bar", root).forEach((bar) => {
        if (bar.dataset.wm) return;
        bar.dataset.wm = "1";
        $$(":scope > i", bar).slice(0, 3).forEach((dot, k) => {
          dot.dataset.act = ACTIONS[k];
          dot.setAttribute("role", "button");
          dot.setAttribute("tabindex", "0");
          dot.setAttribute("aria-label", LABEL[ACTIONS[k]]);
          dot.title = ACTIONS[k];
        });
      });
    }

    function animate(win, cls, ms) {
      return new Promise((res) => {
        if (reduced) return res();
        win.classList.add(cls);
        setTimeout(() => { win.classList.remove(cls); res(); }, ms);
      });
    }

    /* ---- defaults ---- */
    async function close(win, opts = {}) {
      if (win.classList.contains("win-max")) restoreMax(win);
      await animate(win, "win-closing", 420);
      win.classList.add("win-closed");
      const id = ++jobs;
      const stub = document.createElement("div");
      stub.className = "win-stub";
      stub.innerHTML = `<span class="ws-job">[${id}]+</span><span class="ws-state">${opts.state || win.dataset.stubState || "Done"}</span>
        <span class="ws-cmd">${opts.text || win.dataset.stub || titleOf(win)}</span>
        <button type="button" class="ws-open">↻ ${opts.reopen || win.dataset.reopen || "reopen"}</button>`;
      win.after(stub);
      stub.querySelector(".ws-open").addEventListener("click", () => reopen(win, stub));
      win._stub = stub;
      if (opts.onClose) opts.onClose();
    }

    async function reopen(win, stub = win._stub) {
      if (stub) stub.remove();
      win._stub = null;
      win.classList.remove("win-closed");
      await animate(win, "win-opening", 420);
      const hook = hookFor(win, "reopen");
      if (hook) hook.reopen(win);
    }

    function minimize(win) {
      if (win.classList.contains("win-max")) restoreMax(win);
      const on = win.classList.toggle("win-min");
      const t = $(".panel-bar .title", win);
      if (t) t.dataset.state = on ? (win.dataset.minLabel || "minimized · click to restore") : "";
    }

    function maximize(win) {
      if (win.classList.contains("win-max")) { restoreMax(win); return; }
      win.classList.remove("win-min");
      const ph = document.createElement("div");
      ph.className = "win-placeholder";
      ph.style.height = `${win.offsetHeight}px`;
      win.before(ph);
      win._ph = ph;
      win.classList.add("win-max");
      document.body.classList.add("win-locked");
      const f = $("input, textarea", win);
      if (f && !("ontouchstart" in window)) setTimeout(() => f.focus({ preventScroll: true }), 50);
    }

    function restoreMax(win) {
      win.classList.remove("win-max");
      if (win._ph) { win._ph.remove(); win._ph = null; }
      if (!$(".win-max")) document.body.classList.remove("win-locked");
    }

    function act(win, action) {
      const hook = hookFor(win, action);
      if (hook && hook[action](win, api) === true) return;
      ({ close, minimize, maximize })[action](win);
    }

    // delegated: works for windows rendered later (modal, fzf, error pages…)
    document.addEventListener("click", (e) => {
      const dot = e.target.closest(".panel-bar > i[data-act]");
      if (dot) { e.preventDefault(); e.stopPropagation(); act(winOf(dot), dot.dataset.act); return; }
      const title = e.target.closest(".panel-bar .title");
      if (title) { const win = winOf(title); if (win.classList.contains("win-min")) act(win, "minimize"); }
    });
    document.addEventListener("dblclick", (e) => {
      const bar = e.target.closest(".panel-bar");
      if (bar && !e.target.closest("button, a, input, i")) act(winOf(bar), "maximize");
    });
    document.addEventListener("keydown", (e) => {
      const dot = e.target.closest && e.target.closest(".panel-bar > i[data-act]");
      if (dot && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); act(winOf(dot), dot.dataset.act); return; }
      if (e.key === "Escape") {
        const maxed = $$(".win-max").pop();
        if (maxed) { e.preventDefault(); e.stopImmediatePropagation(); act(maxed, "maximize"); }
      }
    }, true);

    const start = () => {
      upgrade();
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) upgrade(n.parentElement || n); })))
        .observe(document.body, { childList: true, subtree: true });
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();

    const api = {
      on(match, handlers) { hooks.unshift({ match, ...handlers }); },
      close, reopen, minimize, maximize, restoreMax, animate, act,
    };
    return api;
  })();

  /* ---------------- public API for page scripts ---------------- */
  window.P1R3X = { toast, scramble, win: WM };

  /* home-page windows */
  WM.on(".terminal", {
    close(win, wm) {
      const out = $("#term-out");
      if (out) {
        out.insertAdjacentHTML("beforeend", `<div class="term-line"><span class="p-user">p1r3x</span><span class="dim">@</span><span class="p-host">lab</span><span class="dim">:</span><span class="p-path">~</span><span class="dim">$</span> exit</div><div class="term-line dim">logout\nConnection to p1r3x@lab closed.</div>`);
        $("#term-body").scrollTop = 1e6;
      }
      setTimeout(() => wm.close(win, { state: "Exit 0", text: "ssh p1r3x@lab: connection closed", reopen: "ssh p1r3x@lab" }), reduced ? 0 : 650);
      return true;
    },
    reopen() {
      const out = $("#term-out");
      if (out) out.insertAdjacentHTML("beforeend", `<div class="term-line dim">Last login: ${new Date().toDateString()} from 10.13.37.1\nWelcome back. Type <span class="cyan">help</span>.</div>`);
      const b = $("#term-body"); if (b) b.scrollTop = 1e6;
      const i = $("#term-input"); if (i) i.focus({ preventScroll: true });
    },
  });

  /* ---------------- init ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const has = (s) => !!document.querySelector(s);
    if (has("#ticker")) ticker();
    if (has("#boot")) boot();
    if (has("#clock")) clock();
    if (has("#net")) network();
    certStrip();
    observe();
    projectViz();
    if (has(".filters button[data-filter]")) filters();
    if (has("#menu-btn")) nav();
    if (has("#bibtex")) bibtex();
    if (has("#contact-form")) contact();
    if (has("#fp") || has("#year")) fingerprint();
    if (has("#term-out")) terminal();
    portrait();
    blogTeaser();
    // academyTeaser();   // academy is hidden for now (full version: academy/preview.html)
    consoleEgg();
  });
})();
