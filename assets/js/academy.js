/* =========================================================
   p1r3x academy
   library  academy/                       every course as a book on a shelf
   course   academy/?c=<course>            cover · about · syllabus (chapters → lessons)
   lesson   academy/?c=<course>&l=<lesson> book-style reader with syllabus sidebar
   Data:    academy/courses.json (python tools/build_academy.py)
   Lessons: academy/courses/<course>/<lesson>.md
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const toast = (m) => (window.P1R3X ? window.P1R3X.toast(m) : console.log(m));
  const typing = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  const cURL = (c) => `?c=${encodeURIComponent(c)}`;
  const lURL = (c, l) => `?c=${encodeURIComponent(c)}&l=${encodeURIComponent(l)}`;
  // the library page this script runs on (preview.html while the academy is hidden)
  const HOME = location.pathname.split("/").pop() || "./";
  const hours = (min) => (min >= 60 ? `${(min / 60).toFixed(min % 60 ? 1 : 0)} h` : `${min} min`);

  /* ---------- per-student progress (this browser only) ---------- */
  const KEY = "p1r3x-academy";
  const Progress = {
    read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
    write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode etc. */ } },
    course(slug) { const d = this.read(); return d[slug] || { done: {}, last: null }; },
    isDone(c, l) { return !!this.course(c).done[l]; },
    setDone(c, l, on = true) {
      const d = this.read(); d[c] = d[c] || { done: {}, last: null };
      if (on) d[c].done[l] = Date.now(); else delete d[c].done[l];
      this.write(d);
    },
    setLast(c, l) { const d = this.read(); d[c] = d[c] || { done: {}, last: null }; d[c].last = l; this.write(d); },
    count(course) { const done = this.course(course.slug).done; return lessons(course).filter((l) => l.available && done[l.slug]).length; },
  };

  const lessons = (course) => course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, chapter: m })));

  function meter(label, val, max, color, pubVal) {
    const pct = max ? Math.round((val / max) * 100) : 0;
    const pub = pubVal != null && max ? Math.round((pubVal / max) * 100) : null;
    return `<div class="meter-line" style="--c:${color}"><span>${label}</span><span class="bar">${pub != null ? `<i class="pub" style="width:${pub}%"></i>` : ""}<i style="width:${pct}%"></i></span><span>${val}/${max}</span></div>`;
  }

  function cover(c) {
    const s = c.stats;
    return `<div class="book" style="--c:${esc(c.color)}">
      <span class="bk-code">${esc(c.code)}</span>
      <span class="bk-level">${esc(c.level)}</span>
      <span class="bk-glyph">${esc(c.code.split("-")[1] || "01")}</span>
      <span class="bk-title">${esc(c.title)}</span>
      <span class="bk-sub">${esc(c.subtitle)}</span>
      <span class="bk-foot"><span><b>${s.modules}</b> ch · <b>${s.lessons}</b> lessons</span><span>${esc(c.duration || hours(s.minutes))}</span></span>
    </div>`;
  }

  /* ---------- markdown ---------- */
  function headingId(text, used) {
    const base = text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "section";
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id); return id;
  }

  function renderMD(md, course) {
    const all = course ? lessons(course) : [];
    const src = md.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi, (m, s, t) => {
      const l = all.find((x) => x.slug === s);
      const label = esc(t || (l ? l.title : s));
      return l && l.available ? `<a class="wikilink" href="${lURL(course.slug, s)}">${label}</a>` : `<span class="wikilink planned" title="coming soon">${label}</span>`;
    });
    if (!window.marked) return `<pre>${esc(md)}</pre>`;
    const html = window.marked.parse(src, { gfm: true });
    return window.DOMPurify ? window.DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : html;
  }

  function enhance(root, course) {
    $$("h2, h3", root).forEach((h) => h.insertAdjacentHTML("afterbegin", `<span class="hx" aria-hidden="true">${h.tagName === "H2" ? "##" : "###"}</span>`));
    $$("pre > code", root).forEach((code) => {
      const pre = code.parentElement;
      const lang = (code.className.match(/language-([\w+-]+)/) || [])[1] || "text";
      const box = document.createElement("div");
      box.className = "code";
      box.innerHTML = `<div class="code-head"><span class="lng">${esc(lang)}</span><button type="button">[y]ank</button></div>`;
      pre.replaceWith(box); box.appendChild(pre);
      if (window.hljs && lang !== "text") { try { window.hljs.highlightElement(code); } catch { /* unknown */ } }
      box.querySelector("button").addEventListener("click", async (e) => {
        try { await navigator.clipboard.writeText(code.innerText); e.target.textContent = "yanked ✓"; setTimeout(() => { e.target.textContent = "[y]ank"; }, 1400); } catch { toast("copy failed"); }
      });
    });
    const ST = { note: "[ <b>INFO</b> ]", tip: "[  <b>OK</b>  ]", warning: "[ <b>WARN</b> ]", danger: "[<b>FAILED</b>]" };
    $$("blockquote", root).forEach((bq) => {
      const p = bq.querySelector("p");
      const m = p && p.innerHTML.match(/^\s*\[!(NOTE|TIP|WARNING|DANGER|PULL)\]\s*(<br>)?\s*/i);
      if (m) p.innerHTML = p.innerHTML.slice(m[0].length);
      const kind = m ? m[1].toLowerCase() : "pull";
      if (kind === "pull") { bq.classList.add("quote"); return; }
      bq.classList.add("callout", kind);
      const body = document.createElement("div");
      while (bq.firstChild) body.appendChild(bq.firstChild);
      bq.innerHTML = `<span class="st">${ST[kind]}</span>`;
      bq.appendChild(body);
    });
    $$("table", root).forEach((t) => { const w = document.createElement("div"); w.className = "tbl"; t.replaceWith(w); w.appendChild(t); });
    $$("a[href]", root).forEach((a) => { if (/^https?:\/\//.test(a.getAttribute("href")) && !a.href.startsWith(location.origin)) { a.target = "_blank"; a.rel = "noopener"; } });
    // images: "images/x.png" inside a lesson → courses/<course>/images/x.png
    $$("img", root).forEach((img) => {
      const s = img.getAttribute("src") || "";
      if (course && !/^(https?:|data:|\/|courses\/|\.\.\/)/.test(s)) img.src = `courses/${course.slug}/${s}`;
      img.loading = "lazy"; img.decoding = "async";
    });
  }

  /* =====================================================
     LIBRARY
     ===================================================== */
  function renderLibrary(courses) {
    $("#v-library").hidden = false;
    document.title = "Academy · p1r3x";

    const tot = courses.reduce((a, c) => ({ ch: a.ch + c.stats.modules, l: a.l + c.stats.lessons, av: a.av + c.stats.available, min: a.min + c.stats.minutes }), { ch: 0, l: 0, av: 0, min: 0 });
    $("#lib-stats").innerHTML = `
      <div><b>${pad(courses.length)}</b><span>courses</span></div>
      <div><b>${pad(tot.ch)}</b><span>chapters</span></div>
      <div><b>${tot.av}<small style="font-size:.5em;color:var(--text-dim)">/${tot.l}</small></b><span>lessons published</span></div>
      <div><b>${hours(tot.min)}</b><span>of reading so far</span></div>`;

    const levels = [...new Set(courses.map((c) => c.level))];
    let level = "all", q = "";
    $("#lib-levels").innerHTML = `<button class="on" data-lv="all">./all <small>${courses.length}</small></button>` +
      levels.map((l) => `<button data-lv="${esc(l)}">./${esc(l.toLowerCase())} <small>${courses.filter((c) => c.level === l).length}</small></button>`).join("");

    function draw() {
      const qq = q.toLowerCase();
      const list = courses.filter((c) => (level === "all" || c.level === level) &&
        (!qq || [c.title, c.subtitle, c.code, c.summary, ...c.tags, ...lessons(c).map((l) => l.title)].join(" ").toLowerCase().includes(qq)));
      $("#lib-filter-cmd").textContent = [level !== "all" && `| grep -i "${level}"`, q && `| grep -i "${q}"`].filter(Boolean).join(" ");
      $("#shelf").innerHTML = list.map((c) => {
        const s = c.stats, done = Progress.count(c), prog = Progress.course(c.slug);
        const resume = prog.last && lessons(c).find((l) => l.slug === prog.last && l.available);
        const first = lessons(c).find((l) => l.available);
        const href = resume ? lURL(c.slug, resume.slug) : cURL(c.slug);
        const label = resume ? `continue ${resume.n} ▸` : done ? "review course ▸" : first ? "start reading ▸" : "view syllabus ▸";
        return `<a class="shelf-item reveal" href="${href}" style="--c:${esc(c.color)}">
          ${cover(c)}
          <div class="shelf-meta">
            <div class="sm-row"><span><b>${esc(c.code)}</b></span><span>${esc(c.level)}</span><span>${s.modules} chapters</span><span>${esc(c.duration || hours(s.minutes))}</span></div>
            <p class="sm-sum">${esc(c.summary)}</p>
            ${meter("written", s.available, s.lessons, "var(--text-dim)")}
            ${meter("you", done, s.available || 1, c.color)}
            <div class="sm-tags">${c.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>
            <span class="sm-cta">${label}</span>
          </div>
        </a>`;
      }).join("");
      $$("#shelf .reveal").forEach((el) => el.classList.add("in"));
      const empty = $("#lib-empty");
      empty.hidden = list.length > 0;
      empty.textContent = courses.length ? "ls: no course matches that filter." : "No courses yet. The first one is being written.";
    }
    $("#lib-levels").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      level = b.dataset.lv; $$("#lib-levels button").forEach((x) => x.classList.toggle("on", x === b)); draw();
    });
    $("#lib-q").addEventListener("input", (e) => { q = e.target.value.trim(); draw(); });
    draw();
  }

  /* =====================================================
     COURSE
     ===================================================== */
  function renderCourse(c) {
    $("#v-course").hidden = false;
    document.title = `${c.code} · ${c.title} · p1r3x academy`;
    const view = $("#v-course");
    view.style.setProperty("--c", c.color);
    const all = lessons(c), s = c.stats, done = Progress.count(c), prog = Progress.course(c.slug);

    $("#c-book").outerHTML = `<div id="c-book">${cover(c)}</div>`;
    $("#c-code").textContent = `${c.code} · ${c.level}`;
    $("#c-title").textContent = c.title;
    $("#c-sub").textContent = c.subtitle || c.summary;
    $("#c-meta").innerHTML = `
      <span><b>${s.modules}</b> chapters</span><span><b>${s.lessons}</b> lessons</span>
      <span><b>${s.available}</b> published</span><span>~<b>${esc(c.duration || hours(s.minutes))}</b></span>
      <span>updated <b>${esc(c.updated)}</b></span>`;
    $("#c-progress").innerHTML = meter("your progress", done, s.available || 1, c.color) + meter("syllabus written", s.available, s.lessons, "var(--text-dim)");

    const first = all.find((l) => l.available);
    const resume = prog.last && all.find((l) => l.slug === prog.last && l.available);
    const nextUndone = all.find((l) => l.available && !prog.done[l.slug]);
    $("#c-cta").innerHTML = first
      ? `${resume ? `<a class="btn solid" href="${lURL(c.slug, resume.slug)}">Continue <small>${resume.n} ${esc(resume.title)}</small></a>` : `<a class="btn solid" href="${lURL(c.slug, first.slug)}">Start reading ▸</a>`}
         ${resume && nextUndone && nextUndone.slug !== resume.slug ?`<a class="btn" href="${lURL(c.slug, nextUndone.slug)}">Next unread · ${nextUndone.n}</a>` : ""}
         <a class="btn" href="#syllabus" id="to-syl">Syllabus ↓</a>`
      : `<span class="dim">Lessons are being written. The syllabus below shows what's coming.</span>`;

    $("#c-desc").innerHTML = renderMD(c.description || c.summary, c);
    enhance($("#c-desc"), c);
    $("#c-outcomes").innerHTML = c.outcomes.map((o) => `<li>${esc(o)}</li>`).join("") || `<li>Outcomes coming soon.</li>`;
    $("#c-prereq").innerHTML = c.prerequisites.map((o) => `<li>${esc(o)}</li>`).join("") || `<li>None. Start here.</li>`;
    $("#c-instructor").textContent = c.instructor;
    $("#c-syl-title").textContent = `cat ~/academy/${c.slug}/SYLLABUS.md`;

    const syl = $("#c-syllabus");
    syl.id = "c-syllabus";
    syl.closest(".syllabus").id = "syllabus";
    syl.innerHTML = c.modules.map((m) => {
      const av = m.lessons.filter((l) => l.available).length;
      const dn = m.lessons.filter((l) => l.available && prog.done[l.slug]).length;
      return `<details class="chap" open>
        <summary>
          <span class="ch-no"><small>CHAPTER</small>${pad(m.n)}</span>
          <span><span class="ch-title">${esc(m.title)}</span>${m.summary ? `<span class="ch-sum">${esc(m.summary)}</span>` : ""}</span>
          <span class="ch-count"><b>${dn}</b>/${av} read · ${m.lessons.length} lessons</span>
        </summary>
        <ol class="lessons">${m.lessons.map((l) => {
          if (!l.available) return `<li><span class="planned"><b class="st plan">○</b><span class="ls-n">${l.n}</span><span class="ls-t">${esc(l.title)}</span><span class="ls-m">coming soon</span></span></li>`;
          const isDone = !!prog.done[l.slug];
          return `<li class="${isDone ? "done" : ""}"><a href="${lURL(c.slug, l.slug)}"><b class="st ${isDone ? "done" : "ok"}">${isDone ? "✓" : "●"}</b><span class="ls-n">${l.n}</span><span class="ls-t">${esc(l.title)}${l.summary ? `<small>${esc(l.summary)}</small>` : ""}</span><span class="ls-m">${l.minutes} min</span></a></li>`;
        }).join("")}</ol>
      </details>`;
    }).join("");

    const tog = $("#syl-toggle");
    tog.addEventListener("click", () => {
      const open = $$(".chap", syl).some((d) => d.open);
      $$(".chap", syl).forEach((d) => { d.open = !open; });
      tog.textContent = open ? "expand all" : "collapse all";
    });
    if (location.hash === "#syllabus") setTimeout(() => $("#syllabus").scrollIntoView(), 80);
  }

  /* =====================================================
     LESSON
     ===================================================== */
  async function renderLesson(c, slug) {
    const all = lessons(c);
    const i = all.findIndex((l) => l.slug === slug);
    const l = all[i];
    if (!l) return fail(`info ${c.slug} ${slug}`, `info: No lesson '${slug}' in ${c.code}. It may have been renamed.`, cURL(c.slug));
    if (!l.available) return fail(`info ${c.slug} ${slug}`, `info: Lesson ${l.n} "${l.title}" is in the syllabus but hasn't been published yet.`, cURL(c.slug));

    let md;
    try {
      const res = await fetch(`courses/${encodeURIComponent(c.slug)}/${encodeURIComponent(slug)}.md`, { cache: "no-cache" });
      if (!res.ok) throw 0;
      md = (await res.text()).replace(/^﻿?---\s*[\r\n][\s\S]*?[\r\n]---\s*[\r\n]?/, "");
    } catch { return fail(`info ${c.slug} ${slug}`, "info: could not read the lesson file.", cURL(c.slug)); }

    const view = $("#v-lesson");
    view.hidden = false;
    view.style.setProperty("--c", c.color);
    document.title = `${l.n} ${l.title} · ${c.code} · p1r3x academy`;
    Progress.setLast(c.slug, slug);
    const avail = all.filter((x) => x.available);
    const pos = avail.findIndex((x) => x.slug === slug) + 1;

    // sidebar
    $("#ln-course").href = cURL(c.slug);
    $("#ln-course").innerHTML = `<small>${esc(c.code)}</small><span>${esc(c.title)}</span>`;
    const drawSide = () => {
      const prog = Progress.course(c.slug);
      $("#ln-progress").innerHTML = meter("progress", Progress.count(c), c.stats.available || 1, c.color);
      $("#ln-tree").innerHTML = c.modules.map((m) => `<div class="ln-ch"><b>${pad(m.n)}</b> ${esc(m.title)}</div>` + m.lessons.map((x) => x.available
        ? `<a href="${lURL(c.slug, x.slug)}" class="${x.slug === slug ? "cur" : ""}"><span class="st ${prog.done[x.slug] ? "done" : "ok"}">${prog.done[x.slug] ? "✓" : "●"}</span><span class="ln-n">${x.n}</span><span>${esc(x.title)}</span></a>`
        : `<span class="ln-plan"><span class="st plan">○</span><span class="ln-n">${x.n}</span><span>${esc(x.title)}</span></span>`).join("")).join("");
    };
    drawSide();
    const cur = $("#ln-tree a.cur"); if (cur) cur.scrollIntoView({ block: "center" });

    // header
    $("#l-path").textContent = `info ${c.slug} ${l.n} · ${slug}.md`;
    $("#l-crumbs").innerHTML = `<a href="${HOME}">~/academy</a> / <a href="${cURL(c.slug)}">${esc(c.code.toLowerCase())}</a> / <a href="${cURL(c.slug)}#syllabus">ch${pad(l.chapter.n)}</a> / <b>${l.n}</b>`;
    $("#l-kicker").textContent = `Chapter ${l.chapter.n} · ${l.chapter.title} · Lesson ${pos} of ${avail.length}`;
    $("#l-title").textContent = l.title;
    $("#l-summary").textContent = l.summary || "";
    $("#l-meta").innerHTML = `<span>read: <b>${l.minutes} min</b></span><span>words: <b>${(l.words || 0).toLocaleString()}</b></span><span>course: <b>${esc(c.code)}</b></span><span>level: <b>${esc(c.level)}</b></span>`;

    if (l.objectives && l.objectives.length) {
      const o = $("#l-objectives");
      o.hidden = false;
      o.innerHTML = `<h4>// BY THE END OF THIS LESSON</h4><ul>${l.objectives.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    }

    // body
    const prose = $("#l-prose");
    prose.innerHTML = renderMD(md, c);
    enhance(prose, c);

    // on this page
    const hs = $$("h2, h3", prose);
    const used = new Set();
    hs.forEach((h) => { const t = h.textContent.replace(/^#+/, ""); h.id = headingId(t, used); h.dataset.t = t; });
    if (hs.length > 1) {
      const op = $("#l-onpage");
      op.hidden = false;
      op.innerHTML = `<h4>// ON THIS PAGE</h4>` + hs.map((h) => `<a class="${h.tagName.toLowerCase()}" href="#${h.id}">${esc(h.dataset.t)}</a>`).join("");
      const links = $$("a", op);
      addEventListener("scroll", () => {
        let curH = null;
        for (const h of hs) { if (h.getBoundingClientRect().top < 160) curH = h; else break; }
        links.forEach((a) => a.classList.toggle("on", !!curH && a.getAttribute("href") === `#${curH.id}`));
      }, { passive: true });
    }

    // complete
    const btn = $("#l-done"), note = $("#l-done-note");
    const paint = () => {
      const d = Progress.isDone(c.slug, slug);
      btn.classList.toggle("is-done", d);
      btn.textContent = d ? "✓ Completed · click to undo" : "✓ Mark lesson complete";
      note.textContent = d ? `${Progress.count(c)}/${c.stats.available} lessons done in ${c.code}` : "or just scroll to the end";
    };
    const setDone = (on) => { Progress.setDone(c.slug, slug, on); paint(); drawSide(); if (on) toast(`✓ ${l.n} complete · ${Progress.count(c)}/${c.stats.available}`); };
    btn.addEventListener("click", () => setDone(!Progress.isDone(c.slug, slug)));
    paint();
    // auto-complete when the student reaches the end of the lesson
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !Progress.isDone(c.slug, slug) && scrollY > 200) { setDone(true); io.disconnect(); }
    }));
    io.observe($(".l-complete"));

    // prev / next (skips over unpublished lessons, but says so)
    const prev = [...all.slice(0, i)].reverse().find((x) => x.available);
    const nextAny = all[i + 1];
    const next = all.slice(i + 1).find((x) => x.available);
    $("#l-pn").innerHTML =
      (prev ? `<a class="prev" href="${lURL(c.slug, prev.slug)}"><small>← previous · ${prev.n}</small><span>${esc(prev.title)}</span></a>` : `<a class="prev" href="${cURL(c.slug)}"><small>← back to</small><span>${esc(c.code)} overview</span></a>`) +
      (next ? `<a class="next" href="${lURL(c.slug, next.slug)}"><small>next · ${next.n}${nextAny && nextAny.slug !== next.slug ? ` (skips ${nextAny.n}, coming soon)` : ""} →</small><span>${esc(next.title)}</span></a>`
            : nextAny ? `<span class="next pn-plan"><small>next · ${nextAny.n} · coming soon</small><span>${esc(nextAny.title)}</span></span>`
            : `<a class="next" href="${cURL(c.slug)}"><small>end of course 🎓</small><span>Back to ${esc(c.code)}</span></a>`);

    // reading progress bar
    const bar = $("#progress-top");
    const upd = () => { const m = document.documentElement.scrollHeight - innerHeight; bar.style.width = `${m > 0 ? (scrollY / m) * 100 : 0}%`; };
    addEventListener("scroll", upd, { passive: true }); upd();

    // mobile drawer
    const nav = $("#lesson-nav"), db = $("#drawer-btn");
    db.addEventListener("click", () => { const o = nav.classList.toggle("open"); db.setAttribute("aria-expanded", o); db.textContent = o ? "✕ close" : "☰ syllabus"; });
    nav.addEventListener("click", (e) => { if (e.target.closest("a") && nav.classList.contains("open")) db.click(); });

    // keyboard: ← → lessons · m mark · s syllabus
    document.addEventListener("keydown", (e) => {
      if (typing(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "ArrowRight" || e.key === "l") && next) location.href = lURL(c.slug, next.slug);
      else if ((e.key === "ArrowLeft" || e.key === "h") && prev) location.href = lURL(c.slug, prev.slug);
      else if (e.key === "m") setDone(!Progress.isDone(c.slug, slug));
      else if (e.key === "s") db.click();
      else if (e.key === "Escape" && document.body.classList.contains("ac-focus")) focusMode(false);
    });

    if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) setTimeout(() => t.scrollIntoView(), 60); }
  }

  /* focus mode = lesson window's maximize */
  function focusMode(force) {
    const on = document.body.classList.toggle("ac-focus", force);
    const t = $("#l-path"); if (t) t.dataset.state = on ? "focus mode · esc to exit" : "";
  }
  if (window.P1R3X && window.P1R3X.win) {
    const W = window.P1R3X.win;
    W.on(".lesson-win", {
      close: (win) => { W.animate(win, "win-closing", 420).then(() => { location.href = cURL(params.get("c")); }); return true; },
      maximize: () => { focusMode(); return true; },
    });
    W.on("#v-error .panel", { close: () => { location.href = HOME; return true; } });
  }

  function fail(cmd, msg, back = HOME) {
    const el = $("#v-error");
    el.hidden = false;
    el.innerHTML = `<div class="panel corners"><div class="panel-bar"><i></i><i></i><i></i><span class="title">zsh</span></div><div class="pager-body">
<pre><span class="ps">student@academy:~$</span> ${esc(cmd)}
<span class="err">${esc(msg)}</span>
<span class="ps">student@academy:~$</span> <a href="${back}">cd ${back === HOME ? "~/academy" : "back"}</a></pre></div></div>`;
    document.title = "Not found · p1r3x academy";
  }

  /* =====================================================
     boot
     ===================================================== */
  async function init() {
    let courses;
    try {
      const res = await fetch("courses.json", { cache: "no-cache" });
      if (!res.ok) throw 0;
      courses = (await res.json()).courses || [];
    } catch {
      return fail("ls ~/academy/courses", location.protocol === "file:"
        ? "ls: cannot read courses: open this page through a local server (e.g. VS Code Live Server)."
        : "ls: cannot read courses.json: run `python tools/build_academy.py` to generate it.");
    }
    const cs = params.get("c"), ls = params.get("l");
    const course = cs && courses.find((x) => x.slug === cs);
    if (!cs) renderLibrary(courses);
    else if (!course) fail(`cd ~/academy/${cs}`, `cd: no such course: ${cs}`);
    else if (ls) await renderLesson(course, ls);
    else renderCourse(course);
    // views start hidden, so reveal + scramble their headings once shown
    $$("main.ac > section:not([hidden]) .reveal").forEach((el) => el.classList.add("in"));
    $$("main.ac > section:not([hidden]) [data-scramble]").forEach((el) => window.P1R3X && window.P1R3X.scramble(el));
  }
  init();
})();
