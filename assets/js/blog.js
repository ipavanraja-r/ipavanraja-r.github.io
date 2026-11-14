/* =========================================================
   p1r3x journal: terminal blog engine + full-text search
   index    blog/                    tmux: search bar + journalctl log + panes + shell
   article  blog/?p=<slug>           man page in `less`  (?q=<terms> highlights, #L12 jumps to line 12)
   filter   blog/?tag=<t>  ·  blog/?q=<terms>
   search   Ctrl+K anywhere on the blog → fzf overlay over every line of every post
   Posts link to each other with [[slug]] or [[slug|text]].
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const d8 = (s) => new Date(s + "T00:00:00");
  const logDate = (s) => { const d = d8(s); return `${MON[d.getMonth()]} ${pad(d.getDate())} ${d.getFullYear()}`; };
  const longDate = (s) => { const d = d8(s); return `${DOW[d.getDay()]} ${s}`; };
  const toast = (m) => (window.P1R3X ? window.P1R3X.toast(m) : console.log(m));
  const typing = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const postURL = (slug, q, line) => `?p=${encodeURIComponent(slug)}${q ? `&q=${encodeURIComponent(q)}` : ""}${line ? `#L${line}` : ""}`;

  /* tag → colour */
  const TAGC = { "5g": "var(--green)", iot: "var(--amber)", ics: "var(--amber)", scada: "var(--amber)", research: "var(--cyan)",
    ai: "var(--cyan)", ml: "var(--cyan)", meta: "var(--text-dim)", ctf: "var(--red)", offsec: "var(--red)", web: "var(--red)", writeup: "var(--red)" };
  const PAL = ["var(--green)", "var(--cyan)", "var(--amber)", "var(--red)"];
  const tagColor = (t = "") => TAGC[t] || PAL[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];

  /* ---------- shared rendering ---------- */
  const stripFM = (md) => md.replace(/^﻿?---\s*[\r\n][\s\S]*?[\r\n]---\s*[\r\n]?/, "");

  function renderMarkdown(md, posts) {
    const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
    const src = md.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi, (m, s, t) =>
      `<a class="wikilink" href="?p=${encodeURIComponent(s)}">${esc(t || (bySlug[s] ? bySlug[s].title : s))}</a>`);
    if (!window.marked) return `<pre>${esc(md)}</pre>`;
    const html = window.marked.parse(src, { gfm: true });
    return window.DOMPurify ? window.DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : html;
  }

  // same id for a heading everywhere (article TOC + search index)
  function headingId(text, used) {
    const base = text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "section";
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  }

  async function loadPosts() {
    const res = await fetch("posts.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    return ((await res.json()).posts || []).sort((a, b) => b.date.localeCompare(a.date));
  }

  /* =====================================================
     SEARCH ENGINE
     Indexes the rendered text of every post, block by block, so
     line numbers match the `cat -n` gutter in the article view.
     ===================================================== */
  const Search = (() => {
    let idx = null, building = null;

    function build(posts, onProgress) {
      if (idx) return Promise.resolve(idx);
      if (building) return building;
      const sig = posts.map((p) => `${p.slug}@${p.date}:${p.words}`).join("|");
      try {
        const cached = JSON.parse(sessionStorage.getItem("p1r3x-search") || "null");
        if (cached && cached.sig === sig && cached.v === 3) { idx = cached.docs; return Promise.resolve(idx); }
      } catch { /* storage unavailable */ }

      let done = 0;
      building = Promise.all(posts.map(async (p) => {
        let md = "";
        try { const r = await fetch(`posts/${encodeURIComponent(p.slug)}.md`, { cache: "no-cache" }); if (r.ok) md = stripFM(await r.text()); } catch { /* skip */ }
        const div = document.createElement("div");
        div.innerHTML = renderMarkdown(md, posts);
        const used = new Set();
        let sec = "", secId = "";
        const blocks = [...div.children].map((el, i) => {
          const text = el.textContent.replace(/\s+/g, " ").trim().replace(/^\[!(NOTE|TIP|WARNING|DANGER|PULL)\]\s*/i, "");
          if (/^H[23]$/.test(el.tagName)) { sec = text; secId = headingId(text, used); }
          return { n: i + 1, t: text, h: /^H[1-6]$/.test(el.tagName) ? 1 : 0, sec, secId };
        }).filter((b) => b.t);
        onProgress && onProgress(++done, posts.length);
        return {
          slug: p.slug, title: p.title, summary: p.summary || "", tags: p.tags || [], date: p.date, readingTime: p.readingTime,
          heads: blocks.filter((b) => b.h).map((b) => b.t), blocks,
        };
      })).then((docs) => {
        idx = docs; building = null;
        try { sessionStorage.setItem("p1r3x-search", JSON.stringify({ v: 3, sig, docs })); } catch { /* quota */ }
        return idx;
      });
      return building;
    }

    // "exact phrase" stays together; everything else splits on whitespace
    function parse(q) {
      const terms = [];
      String(q || "").toLowerCase().replace(/"([^"]+)"|(\S+)/g, (m, ph, w) => { const t = (ph || w || "").trim(); if (t) terms.push(t); return ""; });
      return [...new Set(terms)];
    }

    const count = (hay, t) => { let n = 0, i = hay.indexOf(t); while (i !== -1 && n < 50) { n++; i = hay.indexOf(t, i + t.length); } return n; };
    const wordStart = (hay, t) => new RegExp(`(^|[^a-z0-9])${reEsc(t)}`).test(hay);

    function scoreDoc(doc, terms, mode) {
      const title = doc.title.toLowerCase(), sum = doc.summary.toLowerCase();
      const tags = doc.tags.map((t) => t.toLowerCase()), heads = doc.heads.join(" \n ").toLowerCase();
      let score = 0, matched = 0;
      const hits = [];
      for (const t of terms) {
        let s = 0;
        if (title.includes(t)) s += 14 + (wordStart(title, t) ? 6 : 0);
        if (tags.includes(t)) s += 10; else if (tags.some((g) => g.includes(t))) s += 4;
        if (heads.includes(t)) s += 6;
        if (sum.includes(t)) s += 4;
        let body = 0;
        for (const b of doc.blocks) { const c = count(b.t.toLowerCase(), t); if (c) body += c; }
        s += Math.min(12, body) + (body && wordStart(doc.blocks.map((b) => b.t).join(" ").toLowerCase(), t) ? 2 : 0);
        if (s > 0) matched++;
        score += s;
      }
      if (mode === "and" && matched < terms.length) return null;
      if (!matched) return null;

      // matching lines, best first (most distinct terms, then document order)
      for (const b of doc.blocks) {
        const low = b.t.toLowerCase();
        const k = terms.filter((t) => low.includes(t)).length;
        if (k) hits.push({ ...b, k });
      }
      hits.sort((a, b) => b.k - a.k || a.n - b.n);
      return { doc, score: score + matched * 5, matched, hits };
    }

    function query(q, { tag = null } = {}) {
      if (!idx) return { results: [], mode: "none", terms: [] };
      const terms = parse(q);
      const pool = tag ? idx.filter((d) => d.tags.includes(tag)) : idx;
      if (!terms.length) return { results: pool.map((doc) => ({ doc, score: 0, hits: [] })), mode: "all", terms };
      let mode = "and";
      let res = pool.map((d) => scoreDoc(d, terms, "and")).filter(Boolean);
      if (!res.length && terms.length > 1) { mode = "or"; res = pool.map((d) => scoreDoc(d, terms, "or")).filter(Boolean); }
      if (!res.length) { // typo-tolerant fallback: match on word stems
        const stems = terms.map((t) => (t.length > 4 ? t.slice(0, Math.max(4, Math.ceil(t.length * 0.6))) : t));
        if (stems.join() !== terms.join()) { mode = "fuzzy"; res = pool.map((d) => scoreDoc(d, stems, "or")).filter(Boolean); return { results: res.sort((a, b) => b.score - a.score), mode, terms: stems }; }
      }
      return { results: res.sort((a, b) => b.score - a.score || b.doc.date.localeCompare(a.doc.date)), mode, terms };
    }

    // highlight terms inside an escaped snippet window around the first match
    function snippet(text, terms, width = 160) {
      const low = text.toLowerCase();
      let pos = -1;
      for (const t of terms) { const i = low.indexOf(t); if (i !== -1 && (pos === -1 || i < pos)) pos = i; }
      let start = Math.max(0, pos - Math.floor(width * 0.35));
      if (start > 0) { const sp = text.indexOf(" ", start); if (sp !== -1 && sp - start < 20) start = sp + 1; }
      let end = Math.min(text.length, start + width);
      if (end < text.length) { const sp = text.lastIndexOf(" ", end); if (sp > start + width * 0.6) end = sp; }
      const cut = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
      return mark(cut, terms);
    }
    function mark(text, terms) {
      const safe = esc(text);
      if (!terms.length) return safe;
      const re = new RegExp(`(${terms.map((t) => reEsc(esc(t))).sort((a, b) => b.length - a.length).join("|")})`, "gi");
      return safe.replace(re, '<mark class="hit">$1</mark>');
    }

    return { build, query, parse, snippet, mark, get ready() { return !!idx; } };
  })();

  /* =====================================================
     FZF OVERLAY (Ctrl+K on every blog view)
     ===================================================== */
  function setupFzf(posts) {
    const box = $("#fzf"), input = $("#fzf-input"), list = $("#fzf-list"), pv = $("#fzf-preview");
    let items = [], sel = 0, terms = [], lastFocus = null;

    function open(prefill) {
      lastFocus = document.activeElement;
      box.hidden = false;
      document.body.classList.add("fzf-open");
      input.value = prefill != null ? prefill : input.value;
      input.focus(); input.select();
      if (!Search.ready) {
        list.innerHTML = `<li class="fzf-msg">indexing ~/journal …</li>`;
        Search.build(posts, (d, n) => { $("#fzf-count").textContent = `indexing ${d}/${n}`; }).then(run);
      } else run();
    }
    function close() {
      box.hidden = true;
      document.body.classList.remove("fzf-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function run() {
      const q = input.value.trim();
      const { results, mode, terms: t } = Search.query(q);
      terms = t;
      items = [];
      results.forEach((r) => {
        if (!q || !r.hits.length) items.push({ r, hit: null });
        r.hits.slice(0, q ? 6 : 0).forEach((h) => items.push({ r, hit: h }));
      });
      const totalLines = Search.ready ? posts.reduce((a, p) => a + 1, 0) : 0;
      sel = 0;
      $("#fzf-count").textContent = q
        ? `${items.length}/${results.length} post${results.length === 1 ? "" : "s"}${mode === "or" ? " · any word" : mode === "fuzzy" ? " · fuzzy" : ""}`
        : `${results.length}/${totalLines}`;
      list.innerHTML = items.length ? items.map((it, i) => {
        const d = it.r.doc;
        if (!it.hit) return `<li class="fi ${i === sel ? "sel" : ""}" data-i="${i}"><span class="fi-file">${esc(d.slug)}.md</span> <span class="fi-txt">${Search.mark(d.title, terms)}</span></li>`;
        const short = d.slug.length > 22 ? d.slug.slice(0, 21) + "…" : d.slug;
        return `<li class="fi ${i === sel ? "sel" : ""}" data-i="${i}" title="${esc(d.slug)}.md"><span class="fi-file">${esc(short)}</span><span class="fi-ln">:${it.hit.n}:</span> <span class="fi-txt">${Search.snippet(it.hit.t, terms, 90)}</span></li>`;
      }).join("") : `<li class="fzf-msg">no matches for “${esc(q)}”: try fewer or shorter words</li>`;
      preview();
    }

    function preview() {
      const it = items[sel];
      $$(".fi", list).forEach((li) => li.classList.toggle("sel", +li.dataset.i === sel));
      const li = $(`.fi[data-i="${sel}"]`, list);
      if (li) li.scrollIntoView({ block: "nearest" });
      if (!it) { pv.innerHTML = ""; return; }
      const d = it.r.doc;
      let ctx = "";
      if (it.hit) {
        const bi = d.blocks.findIndex((b) => b.n === it.hit.n);
        ctx = d.blocks.slice(Math.max(0, bi - 1), bi + 2).map((b) =>
          `<div class="pv-line ${b.n === it.hit.n ? "cur" : ""}"><span class="pv-n">${pad(b.n)}</span><span>${b.n === it.hit.n ? Search.mark(b.t, terms) : esc(b.t.length > 220 ? b.t.slice(0, 220) + "…" : b.t)}</span></div>`).join("");
      } else {
        ctx = `<div class="pv-line cur"><span class="pv-n">--</span><span>${Search.mark(d.summary, terms)}</span></div>`;
      }
      pv.innerHTML = `
        <div class="pv-head"><span class="ps">$</span> less +${it.hit ? it.hit.n : 1} ${esc(d.slug)}.md</div>
        <div class="pv-title">${Search.mark(d.title, terms)}</div>
        <div class="pv-meta">${esc(d.date)} · ${d.readingTime} min · ${d.tags.map((t) => "#" + esc(t)).join(" ")}</div>
        ${it.hit && it.hit.sec ? `<div class="pv-sec">§ ${esc(it.hit.sec)}</div>` : ""}
        <div class="pv-ctx">${ctx}</div>
        <div class="pv-more">${it.r.hits.length ? `${it.r.hits.length} matching line${it.r.hits.length === 1 ? "" : "s"} in this post` : ""}</div>`;
    }

    function go(i = sel) {
      const it = items[i];
      if (!it) return;
      const url = postURL(it.r.doc.slug, input.value.trim(), it.hit ? it.hit.n : null);
      const here = params.get("p") === it.r.doc.slug;
      location.href = url;
      if (here) location.reload();
    }

    let t;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => Search.ready && run(), 60); });
    $("#fzf-form").addEventListener("submit", (e) => { e.preventDefault(); go(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "j") || (e.ctrlKey && e.key === "n")) { e.preventDefault(); if (items.length) { sel = (sel + 1) % items.length; preview(); } }
      else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "k") || (e.ctrlKey && e.key === "p")) { e.preventDefault(); if (items.length) { sel = (sel - 1 + items.length) % items.length; preview(); } }
      else if (e.key === "Tab") { // jump to next post group
        e.preventDefault();
        const cur = items[sel] && items[sel].r;
        const nx = items.findIndex((it, i) => i > sel && it.r !== cur);
        sel = nx === -1 ? 0 : nx; preview();
      }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    });
    list.addEventListener("mousemove", (e) => { const li = e.target.closest(".fi"); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; preview(); } });
    list.addEventListener("click", (e) => { const li = e.target.closest(".fi"); if (li) go(+li.dataset.i); });
    box.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); box.hidden ? open() : close(); }
    });
    document.addEventListener("click", (e) => { if (e.target.closest("[data-fzf]")) open(); });

    // window controls: red/amber close (query is kept), green toggles full-screen
    if (window.P1R3X && window.P1R3X.win) {
      window.P1R3X.win.on(".fzf-win", {
        close: () => { close(); return true; },
        minimize: () => { close(); toast("fzf hidden: ctrl+k brings it back with your query"); return true; },
        maximize: (win) => { win.classList.toggle("fzf-max"); input.focus(); return true; },
      });
    }
    const sbf = $("#sb-fzf");
    if (sbf) sbf.addEventListener("click", () => open($("#search") ? $("#search").value : ""));
    return { open, close, get isOpen() { return !box.hidden; } };
  }

  /* =====================================================
     INDEX: tmux session
     ===================================================== */
  function renderIndex(posts, fzf) {
    $("#v-index").hidden = false;
    document.title = "Journal · p1r3x";

    const tags = {};
    posts.forEach((p) => (p.tags || []).forEach((t) => { tags[t] = (tags[t] || 0) + 1; }));
    const tagList = Object.keys(tags).sort((a, b) => tags[b] - tags[a] || a.localeCompare(b));
    const num = (p) => pad(posts.length - posts.indexOf(p));
    const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

    const state = { tag: tagList.includes(params.get("tag")) ? params.get("tag") : null, q: params.get("q") || "", sel: 0, items: [], res: null };

    /* ---------- neofetch ---------- */
    const first = posts.length ? d8(posts[posts.length - 1].date) : new Date();
    const uptimeDays = Math.max(0, Math.round((Date.now() - first) / 864e5));
    const words = posts.reduce((a, p) => a + (p.words || 0), 0);
    $("#fetch").innerHTML = `
      <div class="who">p1r3x<b>@</b>lab</div>
      <div class="rule">-----------------------------</div>
      <div><dt>OS</dt>: <dd>PhD Researcher · Amrita</dd></div>
      <div><dt>Host</dt>: <dd>Amrita Cyber Labs</dd></div>
      <div><dt>Kernel</dt>: <dd>5g-redcap · iot · ics</dd></div>
      <div><dt>Uptime</dt>: <dd>${uptimeDays} day${uptimeDays === 1 ? "" : "s"}</dd></div>
      <div><dt>Packages</dt>: <dd>${posts.length} (journal)</dd></div>
      <div><dt>Words</dt>: <dd>${words.toLocaleString()}</dd></div>
      <div><dt>Shell</dt>: <dd>zsh 5.9 · python 3.12</dd></div>
      <div class="swatches">${["#05080a", "#ff2a4a", "#00ff9c", "#ffc857", "#2de2ff", "#00b36d", "#7c8f88", "#eefcf6"].map((c) => `<i style="background:${c}"></i>`).join("")}</div>`;

    /* ---------- htop meters ---------- */
    const max = Math.max(1, ...Object.values(tags));
    function drawMeters() {
      const W = 22;
      $("#meters").innerHTML = tagList.map((t) => {
        const n = Math.max(1, Math.round((tags[t] / max) * W));
        return `<button type="button" class="meter ${state.tag === t ? "on" : ""}" data-tag="${esc(t)}" style="--c:${tagColor(t)}">
          <span class="mk">${esc(t)}</span>
          <span class="bar">[<span class="fill">${"|".repeat(n)}</span>${"&nbsp;".repeat(W - n)}<span class="cnt">${tags[t]}</span>]</span>
        </button>`;
      }).join("") || `<div class="dim">no tags yet</div>`;
    }
    const now = Date.now();
    const within = (days) => posts.filter((p) => now - d8(p.date) <= days * 864e5).length;
    $("#loadavg").innerHTML = `Tasks: <b>${posts.length}</b> posts, <b>${tagList.length}</b> tags<br>Load average: <b>${(within(7) / 7 * 3).toFixed(2)}</b> ${(within(30) / 30 * 3).toFixed(2)} ${(within(90) / 90 * 3).toFixed(2)}`;

    /* ---------- log ---------- */
    const logEl = $("#log"), sInput = $("#search"), sCount = $("#sb-count");
    sInput.value = state.q;

    function cmdString() {
      if (state.q) return `grep -rni ${JSON.stringify(state.q)} ~/journal${state.tag ? ` --include="#${state.tag}"` : ""} | sort -k score -r`;
      return `journalctl -u journal.service --reverse${state.tag ? ` --grep="#${state.tag}"` : ""}`;
    }

    function compute() {
      if (state.q && Search.ready) {
        const r = Search.query(state.q, { tag: state.tag });
        state.res = r;
        state.items = r.results.map((x) => ({ post: bySlug[x.doc.slug], hits: x.hits }));
      } else {
        state.res = null;
        state.items = posts.filter((p) => !state.tag || (p.tags || []).includes(state.tag)).map((post) => ({ post, hits: [] }));
      }
      state.sel = Math.min(state.sel, Math.max(0, state.items.length - 1));
    }

    async function drawLog(animate) {
      compute();
      const terms = state.res ? state.res.terms : [];
      const mk = (s) => (terms.length ? Search.mark(s, terms) : esc(s));
      const dates = posts.map((p) => p.date);

      const lines = state.items.reduce((a, it) => a + it.hits.length, 0);
      if (state.q && state.res) {
        const label = { and: "", or: " (matching any word)", fuzzy: " (fuzzy: closest matches)" }[state.res.mode] || "";
        $("#log-head").textContent = `-- grep: ${state.items.length} entr${state.items.length === 1 ? "y" : "ies"}, ${lines} matching line${lines === 1 ? "" : "s"}${label} --`;
        sCount.textContent = `${state.items.length} post${state.items.length === 1 ? "" : "s"} · ${lines} line${lines === 1 ? "" : "s"}`;
      } else {
        $("#log-head").textContent = posts.length ? `-- Logs begin at ${longDate(dates[dates.length - 1])}, end at ${longDate(dates[0])}. --` : "-- No entries --";
        sCount.textContent = state.q ? "indexing…" : `${posts.length} post${posts.length === 1 ? "" : "s"} indexed`;
      }

      logEl.innerHTML = state.items.map(({ post: p, hits }, i) => {
        const t = (p.tags || [])[0] || "notes";
        const hitLines = hits.slice(0, 3).map((h) => `
          <a class="gl" href="${postURL(p.slug, state.q, h.n)}"><span class="gl-n">L${pad(h.n)}</span><span class="gl-b">${h.sec && h.sec !== h.t ? `<span class="gl-s">§ ${esc(h.sec)}</span>` : ""}<span class="gl-t">${Search.snippet(h.t, terms, 170)}</span></span></a>`).join("");
        const more = hits.length > 3 ? `<a class="gl more" href="${postURL(p.slug, state.q, hits[3].n)}">… ${hits.length - 3} more matching line${hits.length - 3 === 1 ? "" : "s"}</a>` : "";
        return `<li class="${i === state.sel ? "sel" : ""}" data-i="${i}" role="option" aria-selected="${i === state.sel}">
          <a class="entry" href="${postURL(p.slug, state.q, hits[0] && hits[0].n)}">
            <span class="ts">${logDate(p.date)}</span>
            <span class="unit">journal<b>[${num(p)}]</b>:</span>
            <span class="msg"><span class="lvl" style="--c:${tagColor(t)}">[${esc(t.toUpperCase())}]</span><span class="ttl">${mk(p.title)}</span><span class="sum">${mk(p.summary)}</span></span>
            <span class="rt">${p.readingTime}m</span>
          </a>${hitLines || more ? `<div class="greps">${hitLines}${more}</div>` : ""}</li>`;
      }).join("");

      const empty = $("#log-empty");
      empty.hidden = state.items.length > 0;
      empty.innerHTML = !posts.length ? "journal is empty. The first entry is being written…"
        : state.q ? `grep: no match for <b>"${esc(state.q)}"</b>${state.tag ? ` in #${esc(state.tag)}` : ""}. Try fewer words, a shorter stem, or press <kbd>esc</kbd>.`
        : "no entries for this filter. Press esc.";

      const lis = $$("li", logEl);
      if (animate && !reduced) { for (const li of lis) { li.classList.add("in"); await sleep(70); } }
      else lis.forEach((li) => li.classList.add("in"));
      $("#log-tail").hidden = false;

      drawMeters();
      $("#ts-filter").textContent = `filter: ${[state.tag && "#" + state.tag, state.q && `"${state.q}"`].filter(Boolean).join(" + ") || "none"}`;
      $("#log-cmd").textContent = cmdString();
      preview();
    }

    function syncURL() {
      const u = new URL(location.href);
      state.tag ? u.searchParams.set("tag", state.tag) : u.searchParams.delete("tag");
      state.q ? u.searchParams.set("q", state.q) : u.searchParams.delete("q");
      history.replaceState(null, "", u);
    }

    async function setFilter(patch) {
      Object.assign(state, patch, { sel: 0 });
      if ("q" in patch && sInput.value !== state.q) sInput.value = state.q;
      syncURL();
      if (state.q && !Search.ready) {
        sCount.textContent = "indexing…";
        await Search.build(posts, (d, n) => { sCount.textContent = `indexing ${d}/${n}…`; });
      }
      drawLog(false);
    }

    /* ---------- preview pane ---------- */
    function preview() {
      const it = state.items[state.sel];
      const el = $("#preview");
      if (!it) { el.innerHTML = `<div class="dim">nothing selected</div>`; return; }
      const p = it.post;
      const terms = state.res ? state.res.terms : [];
      const top = it.hits[0];
      el.innerHTML = `
        <div class="pv-cmd"><span class="ps">$</span>${top ? `grep -n ${esc(JSON.stringify(state.q))} ` : "head -n 7 "}~/journal/${esc(p.slug)}.md</div>
<pre class="pv-yaml"><span class="sep">---</span>
<span class="k">title</span>: <span class="s">"${esc(p.title)}"</span>
<span class="k">date</span>: <span class="n">${esc(p.date)}</span>
<span class="k">tags</span>: [${(p.tags || []).map((t) => `<span class="s">${esc(t)}</span>`).join(", ")}]
<span class="k">read</span>: <span class="n">${p.readingTime} min</span> (${(p.words || 0).toLocaleString()} words)
<span class="sep">---</span></pre>
        ${top ? `<div class="pv-hits">${it.hits.slice(0, 4).map((h) => `<a href="${postURL(p.slug, state.q, h.n)}"><b>${pad(h.n)}</b> ${Search.snippet(h.t, terms, 120)}</a>`).join("")}</div>`
              : `<div class="pv-sum">${esc(p.summary)}</div>`}
        <a class="pv-open" href="${postURL(p.slug, state.q, top && top.n)}">less ${top ? `+${top.n} ` : ""}${esc(p.slug)}.md ↵</a>`;
    }

    function select(i, scroll = true) {
      if (!state.items.length) return;
      state.sel = (i + state.items.length) % state.items.length;
      $$("li", logEl).forEach((li, k) => { li.classList.toggle("sel", k === state.sel); li.setAttribute("aria-selected", k === state.sel); });
      if (scroll) {
        const li = $$("li", logEl)[state.sel];
        const r = li.getBoundingClientRect();
        if (r.top < 90 || r.bottom > innerHeight - 20) li.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      }
      preview();
    }
    const openSel = () => { const it = state.items[state.sel]; if (it) location.href = postURL(it.post.slug, state.q, it.hits[0] && it.hits[0].n); };

    logEl.addEventListener("mousemove", (e) => {
      const li = e.target.closest("li");
      if (li && +li.dataset.i !== state.sel) select(+li.dataset.i, false);
    });
    $("#meters").addEventListener("click", (e) => {
      const b = e.target.closest(".meter");
      if (b) setFilter({ tag: state.tag === b.dataset.tag ? null : b.dataset.tag });
    });

    /* ---------- search bar: live ---------- */
    let st;
    sInput.addEventListener("input", () => { clearTimeout(st); st = setTimeout(() => setFilter({ q: sInput.value.trim() }), 120); });
    $("#searchbar").addEventListener("submit", (e) => { e.preventDefault(); if (state.items.length) openSel(); });
    sInput.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); select(state.sel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); select(state.sel - 1); }
      else if (e.key === "Escape") { e.stopPropagation(); if (sInput.value) { sInput.value = ""; setFilter({ q: "" }); } else sInput.blur(); }
    });

    /* ---------- shell ---------- */
    const out = $("#shell-out"), input = $("#shell");
    const hist = []; let hi = 0;
    const print = (html) => { out.insertAdjacentHTML("beforeend", html + "\n"); out.scrollTop = out.scrollHeight; };
    const find = (arg) => {
      if (!arg) return null;
      const n = parseInt(arg, 10);
      if (!isNaN(n) && String(n) === arg.replace(/^0+(?=\d)/, "")) return posts[posts.length - n] || null;
      return posts.find((p) => p.slug === arg.replace(/\.md$/, "")) || posts.find((p) => p.slug.startsWith(arg)) || null;
    };

    const CMDS = {
      help: () => [
        `<span class="ok">journal shell, available commands</span>`,
        `  grep &lt;words&gt;       full-text search every post (same as the search bar)`,
        `  fzf [words]        open the fuzzy finder over every line (ctrl+k)`,
        `  tag &lt;name&gt;         filter by tag   (tags: ${tagList.map(esc).join(", ") || "none"})`,
        `  ls                 list every entry`,
        `  cat &lt;n|slug&gt;       open an entry   (also: less, vim, open)`,
        `  reset              clear search + filters (or press esc)`,
        `  neofetch · whoami · uname · date · clear · history`,
        `  cd ~               back to the portfolio · certs  → credential vault`,
        `<span class="dim">keys: / search · ctrl+k fzf · j/k move · ↵ open · t tag · g/G first/last</span>`,
      ].join("\n"),
      ls: () => { setFilter({ tag: null, q: "" }); return posts.map((p) => `-rw-r--r-- 1 p1r3x journal ${pad(p.words || 0, 5)} ${logDate(p.date)} <a href="?p=${encodeURIComponent(p.slug)}">${esc(p.slug)}.md</a>`).join("\n") || "total 0"; },
      "ls -la": () => CMDS.ls(), "ls -l": () => CMDS.ls(), ll: () => CMDS.ls(),
      grep: (a) => {
        const q = a.filter((x) => !/^-[a-z]+$/i.test(x)).join(" ").replace(/^["']|["']$/g, "");
        if (!q) return `<span class="err">usage: grep &lt;words&gt;</span>`;
        setFilter({ q }).then(() => print(`<span class="dim">${state.items.length} post(s), ${state.items.reduce((s, it) => s + it.hits.length, 0)} matching line(s) for "${esc(q)}"</span>`));
        return null;
      },
      search: (a) => CMDS.grep(a), find: (a) => CMDS.grep(a), rg: (a) => CMDS.grep(a), ag: (a) => CMDS.grep(a),
      fzf: (a) => { fzf.open(a.join(" ")); return null; },
      tag: (a) => { const t = (a[0] || "").replace(/^#/, "").toLowerCase(); if (!t) return `tags: ${tagList.map((x) => `${esc(x)}(${tags[x]})`).join("  ")}`; if (!tags[t]) return `<span class="err">tag: '${esc(t)}' not found</span>`; setFilter({ tag: t }); return `<span class="dim">filtered by #${esc(t)}</span>`; },
      tags: () => CMDS.tag([]),
      reset: () => { setFilter({ tag: null, q: "" }); return `<span class="dim">search and filters cleared</span>`; },
      cat: (a) => { const p = find(a[0]); if (!p) return `<span class="err">cat: ${esc(a[0] || "")}: No such file or directory</span>`; setTimeout(() => { location.href = postURL(p.slug); }, 250); return `<span class="dim">opening ${esc(p.slug)}.md …</span>`; },
      less: (a) => CMDS.cat(a), vim: (a) => CMDS.cat(a), nano: (a) => CMDS.cat(a), open: (a) => CMDS.cat(a), more: (a) => CMDS.cat(a),
      cd: (a) => {
        const t = (a[0] || "~").replace(/\/$/, "");
        if (["~", "..", "/", "~/"].includes(t)) { setTimeout(() => { location.href = "../index.html"; }, 250); return `<span class="dim">cd ~ → portfolio</span>`; }
        if (tags[t]) return CMDS.tag([t]);
        return `<span class="err">cd: ${esc(t)}: No such directory</span>`;
      },
      certs: () => { setTimeout(() => { location.href = "../certifications.html"; }, 250); return `<span class="dim">unsealing credential vault …</span>`; },
      whoami: () => `p1r3x: I Pavanraja, PhD Researcher @ Amrita Vishwa Vidyapeetham, Security Research Engineer @ Amrita Cyber Labs`,
      neofetch: () => { const f = $(".pane-fetch"); f.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); f.animate?.([{ background: "rgba(0,255,156,.15)" }, { background: "transparent" }], 900); return `<span class="dim">→ pane 1:neofetch</span>`; },
      uname: () => "p1r3x-kernel 6.9.0-research x86_64 GNU/Linux", "uname -a": () => CMDS.uname(),
      date: () => new Date().toString(),
      pwd: () => "/home/p1r3x/journal",
      clear: () => { out.innerHTML = ""; return null; },
      history: () => hist.map((h, i) => `${pad(i + 1, 4)}  ${esc(h)}`).join("\n") || "",
      sudo: (a) => a.join(" ").includes("rm") ? `<span class="err">nice try. this incident will be reported.</span>` : `<span class="err">p1r3x is not in the sudoers file.</span>`,
      rm: () => `<span class="err">rm: cannot remove: Read-only file system (the journal is append-only)</span>`,
      exit: () => CMDS.cd(["~"]), q: () => CMDS.cd(["~"]),
    };

    function run(raw) {
      const line = raw.trim();
      print(`<span class="ok">p1r3x@lab:~/journal$</span> ${esc(raw)}`);
      if (!line) return;
      hist.push(line); hi = hist.length;
      const lower = line.toLowerCase();
      let res;
      if (CMDS[lower]) res = CMDS[lower]([]);
      else {
        const [c, ...args] = line.split(/\s+/);
        const fn = CMDS[c.toLowerCase()];
        res = fn ? fn(args) : `<span class="err">zsh: command not found: ${esc(c)}</span> <span class="dim">(try 'help', or 'grep ${esc(line)}')</span>`;
      }
      if (res) print(res);
    }

    $("#shell-form").addEventListener("submit", (e) => { e.preventDefault(); run(input.value); input.value = ""; });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") { if (hi > 0) input.value = hist[--hi]; e.preventDefault(); }
      else if (e.key === "ArrowDown") { if (hi < hist.length - 1) input.value = hist[++hi]; else { hi = hist.length; input.value = ""; } e.preventDefault(); }
      else if (e.key === "Escape") { input.blur(); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const [c, ...rest] = input.value.split(" ");
        if (!rest.length) { const m = Object.keys(CMDS).filter((k) => k.startsWith(c) && !k.includes(" ")); if (m.length === 1) input.value = m[0] + " "; else if (m.length) print(`<span class="dim">${m.join("  ")}</span>`); }
        else if (["tag", "cd"].includes(c)) { const m = tagList.filter((t) => t.startsWith(rest.join(" "))); if (m.length === 1) input.value = `${c} ${m[0]}`; }
        else if (["cat", "less", "vim", "open"].includes(c)) { const m = posts.filter((p) => p.slug.startsWith(rest.join(" "))); if (m.length === 1) input.value = `${c} ${m[0].slug}`; }
      }
    });

    /* ---------- keyboard ---------- */
    document.addEventListener("keydown", (e) => {
      if (fzf.isOpen || typing(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "j" || k === "ArrowDown") { e.preventDefault(); select(state.sel + 1); }
      else if (k === "k" || k === "ArrowUp") { e.preventDefault(); select(state.sel - 1); }
      else if (k === "g") select(0);
      else if (k === "G") select(state.items.length - 1);
      else if (k === "Enter") { if (document.activeElement === document.body || !document.activeElement) { e.preventDefault(); openSel(); } }
      else if (k === "/" || k === "s") { e.preventDefault(); sInput.focus(); sInput.select(); }
      else if (k === "t") { e.preventDefault(); input.focus(); input.value = "tag "; }
      else if (k === "Escape") { if (state.tag || state.q) setFilter({ tag: null, q: "" }); }
    });

    /* ---------- boot ---------- */
    (async () => {
      const cmd = $("#log-cmd");
      const text = cmdString();
      if (!reduced) { for (let i = 1; i <= text.length; i++) { cmd.textContent = text.slice(0, i); await sleep(i < 10 ? 45 : 14); } }
      else cmd.textContent = text;
      $("#log-caret").remove();
      if (state.q) await Search.build(posts, (d, n) => { sCount.textContent = `indexing ${d}/${n}…`; });
      await drawLog(true);
      if (!posts.length) print(`<span class="dim">tip: copy blog/posts/_template.md, then run python tools/build_blog.py</span>`);
      // warm the index in the background so the first keystroke is instant
      const warm = () => Search.build(posts).then(() => { if (!state.q) sCount.textContent = `${posts.length} post${posts.length === 1 ? "" : "s"} indexed`; });
      "requestIdleCallback" in window ? requestIdleCallback(warm, { timeout: 2000 }) : setTimeout(warm, 800);
    })();
  }

  /* =====================================================
     ARTICLE: man page in less
     ===================================================== */
  async function renderArticle(slug, posts) {
    const i = posts.findIndex((p) => p.slug === slug);
    const post = posts[i];
    if (!post) return fail(`less ~/journal/${slug}.md`, `less: ${slug}.md: No such file or directory`);

    let md;
    try {
      const res = await fetch(`posts/${encodeURIComponent(slug)}.md`, { cache: "no-cache" });
      if (!res.ok) throw 0;
      md = stripFM(await res.text());
    } catch { return fail(`less ~/journal/${slug}.md`, `less: ${slug}.md: Permission denied (could not fetch file)`); }

    $("#v-post").hidden = false;
    document.body.classList.add("reading");
    document.title = `${post.title} · p1r3x journal`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", post.summary);

    $("#pager-title").textContent = `less ~/journal/${post.slug}.md`;
    $("#m-slug").textContent = post.slug;
    $("#m-title").textContent = post.title;
    $("#m-syn").textContent = post.summary;
    $("#m-meta").innerHTML = `
      <span>date: <b>${esc(post.date)}</b></span>
      <span>read: <b>${post.readingTime} min</b></span>
      <span>words: <b>${(post.words || 0).toLocaleString()}</b></span>
      <span>author: <b>p1r3x</b></span>
      <span>tags: ${(post.tags || []).map((t) => `<a href="./?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join(" ") || "none"}</span>`;

    if (post.cover) {
      const fig = $("#m-cover");
      fig.hidden = false;
      fig.innerHTML = `<img src="${esc(post.cover)}" alt="">${post.coverCaption ? `<figcaption>${esc(post.coverCaption)}</figcaption>` : ""}`;
    }

    const prose = $("#prose");
    prose.innerHTML = renderMarkdown(md, posts);
    [...prose.children].forEach((el, k) => { el.dataset.ln = k + 1; });   // line numbers for #L<n> links
    enhance(prose);
    tree(prose, post);
    share(post);

    const newer = posts[i - 1], older = posts[i + 1];
    $("#pn").innerHTML =
      (older ? `<a class="prev" href="?p=${encodeURIComponent(older.slug)}"><small><b>$</b> cd ../older</small><span>← ${esc(older.title)}</span></a>` : "") +
      (newer ? `<a class="next" href="?p=${encodeURIComponent(newer.slug)}"><small><b>$</b> cd ../newer</small><span>${esc(newer.title)} →</span></a>` : "");

    const finder = inPostFind(prose);
    lessStatus(post, prose);
    pagerKeys(prose, finder);

    // arrived from a search: highlight + jump
    const q = params.get("q");
    const lm = location.hash.match(/^#L(\d+)$/);
    if (q) finder.find(q, { scroll: !lm });
    if (lm) {
      const el = prose.querySelector(`[data-ln="${lm[1]}"]`);
      if (el) setTimeout(() => { el.scrollIntoView({ block: "center", behavior: "instant" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2200); }, 80);
    } else if (location.hash) {
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) setTimeout(() => t.scrollIntoView(), 60);
    }
  }

  function enhance(root) {
    $$("h2, h3", root).forEach((h) => h.insertAdjacentHTML("afterbegin", `<span class="hx" aria-hidden="true">${h.tagName === "H2" ? "##" : "###"}</span>`));

    $$("pre > code", root).forEach((code) => {
      const pre = code.parentElement;
      const lang = (code.className.match(/language-([\w+-]+)/) || [])[1] || "text";
      const box = document.createElement("div");
      box.className = "code";
      box.dataset.ln = pre.dataset.ln || "";
      box.innerHTML = `<div class="code-head"><span class="lng">${esc(lang)}</span><button type="button" title="Copy">[y]ank</button></div>`;
      pre.replaceWith(box);
      pre.removeAttribute("data-ln");
      box.appendChild(pre);
      if (window.hljs && lang !== "text") { try { window.hljs.highlightElement(code); } catch { /* unknown */ } }
      box.querySelector("button").addEventListener("click", async (e) => {
        try { await navigator.clipboard.writeText(code.innerText); e.target.textContent = "yanked ✓"; setTimeout(() => { e.target.textContent = "[y]ank"; }, 1400); }
        catch { toast("copy failed"); }
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

    $$("table", root).forEach((t) => { const w = document.createElement("div"); w.className = "tbl"; w.dataset.ln = t.dataset.ln || ""; t.removeAttribute("data-ln"); t.replaceWith(w); w.appendChild(t); });
    $$("a[href]", root).forEach((a) => {
      if (/^https?:\/\//.test(a.getAttribute("href")) && !a.href.startsWith(location.origin)) { a.target = "_blank"; a.rel = "noopener"; }
    });
    $$("img", root).forEach((img) => { img.loading = "lazy"; img.decoding = "async"; });
  }

  function tree(root, post) {
    const hs = $$("h2, h3", root);
    const used = new Set();
    hs.forEach((h) => {
      const txt = h.textContent.replace(/^#+/, "");
      h.id = headingId(txt, used); h.dataset.t = txt;
    });
    const el = $("#tree");
    if (hs.length < 2) { el.innerHTML = ""; return; }
    const lastAt = (from, level) => { for (let j = from + 1; j < hs.length; j++) { const l = hs[j].tagName === "H2" ? 0 : 1; if (l < level) return true; if (l === level) return false; } return true; };
    const rows = hs.map((h, k) => {
      let prefix;
      if (h.tagName === "H2") prefix = lastAt(k, 0) ? "└── " : "├── ";
      else {
        let parent = k; while (parent >= 0 && hs[parent].tagName !== "H2") parent--;
        prefix = (parent < 0 || lastAt(parent, 0) ? "    " : "│   ") + (lastAt(k, 1) ? "└── " : "├── ");
      }
      return `<a href="#${h.id}" data-id="${h.id}" title="${esc(h.dataset.t)}"><span class="br">${prefix}</span>${esc(h.dataset.t)}</a>`;
    });
    const n2 = hs.filter((h) => h.tagName === "H2").length;
    el.innerHTML = `<div class="tr-cmd"><span class="ps">$</span>tree ${esc(post.slug)}.md</div><a href="#" data-id="" class="root"><span class="br">.</span></a>${rows.join("")}<div class="tr-sum">${n2} sections, ${hs.length - n2} subsections</div>`;
    el.querySelector(".root").addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); });
    const links = $$("a[data-id]", el).filter((a) => a.dataset.id);
    const upd = () => {
      let cur = null;
      for (const h of hs) { if (h.getBoundingClientRect().top < 150) cur = h; else break; }
      links.forEach((a) => a.classList.toggle("on", !!cur && a.dataset.id === cur.id));
    };
    addEventListener("scroll", upd, { passive: true });
    upd();
  }

  function share(post) {
    const url = location.href.split("#")[0].replace(/[?&]q=[^&#]*/, "").replace(/\?&/, "?");
    $("#sh-x").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(url)}`;
    $("#sh-in").href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    $("#sh-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(url); toast("✓ link copied to clipboard"); } catch { toast("copy failed: use the address bar"); }
    });
  }

  /* less-style find inside the post: "/" opens, n/N cycle, esc clears */
  function inPostFind(prose) {
    let marks = [], cur = -1, lastQ = "";
    const mEl = $("#ls-match");

    function clear() {
      $$("mark.hit", prose).forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
      prose.normalize();
      marks = []; cur = -1; lastQ = "";
      mEl.hidden = true;
    }

    function find(q, { scroll = true } = {}) {
      clear();
      const terms = Search.parse(q);
      if (!terms.length) return 0;
      lastQ = q;
      const re = new RegExp(terms.map(reEsc).sort((a, b) => b.length - a.length).join("|"), "gi");
      const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest(".hx, .code-head, .st, mark") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const text = node.nodeValue;
        re.lastIndex = 0;
        if (!re.test(text)) return;
        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0, m;
        while ((m = re.exec(text))) {
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const mk = document.createElement("mark");
          mk.className = "hit"; mk.textContent = m[0];
          frag.appendChild(mk);
          last = m.index + m[0].length;
          if (!m[0].length) re.lastIndex++;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.replaceWith(frag);
      });
      marks = $$("mark.hit", prose);
      mEl.hidden = false;
      if (!marks.length) { mEl.textContent = `Pattern not found: ${q}`; mEl.classList.add("nf"); return 0; }
      mEl.classList.remove("nf");
      // first match below the current viewport top
      const startIdx = marks.findIndex((mk) => mk.getBoundingClientRect().top > 100);
      go(startIdx === -1 ? 0 : startIdx, scroll);
      return marks.length;
    }

    function go(i, scroll = true) {
      if (!marks.length) return;
      if (marks[cur]) marks[cur].classList.remove("cur");
      cur = (i + marks.length) % marks.length;
      marks[cur].classList.add("cur");
      mEl.textContent = `/${lastQ}  match ${cur + 1}/${marks.length}`;
      if (scroll) marks[cur].scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }

    // the "/" prompt in the status bar
    const form = $("#ls-find"), inp = $("#ls-input"), keys = $("#ls-keys");
    function prompt() {
      form.hidden = false; keys.hidden = true;
      inp.value = lastQ; inp.focus(); inp.select();
    }
    function closePrompt() { form.hidden = true; keys.hidden = false; inp.blur(); }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = inp.value.trim();
      closePrompt();
      if (q) {
        const n = find(q);
        const u = new URL(location.href); u.searchParams.set("q", q); u.hash = ""; history.replaceState(null, "", u);
        if (!n) toast(`Pattern not found: ${q}`);
      }
    });
    inp.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePrompt(); } });
    $("#find-btn").addEventListener("click", prompt);

    return {
      find, prompt, clear,
      next: () => (marks.length ? (go(cur + 1), true) : false),
      prev: () => (marks.length ? (go(cur - 1), true) : false),
      get active() { return marks.length > 0; },
      get promptOpen() { return !form.hidden; },
      clearAll() { clear(); const u = new URL(location.href); u.searchParams.delete("q"); history.replaceState(null, "", u); },
    };
  }

  function lessStatus(post, prose) {
    $("#less-status").hidden = false;
    $("#ls-file").textContent = `~/journal/${post.slug}.md`;
    const upd = () => {
      const lh = parseFloat(getComputedStyle(prose).lineHeight) || 28;
      const top = prose.getBoundingClientRect().top + scrollY;
      const total = Math.max(1, Math.round(prose.scrollHeight / lh));
      const a = Math.min(total, Math.max(1, Math.round((scrollY + 80 - top) / lh) + 1));
      const b = Math.min(total, a + Math.round(innerHeight / lh) - 2);
      const m = document.documentElement.scrollHeight - innerHeight;
      const pct = m > 0 ? Math.round((scrollY / m) * 100) : 100;
      $("#ls-pos").textContent = pct >= 100 ? `lines ${a}-${total}/${total} (END)` : `lines ${a}-${b}/${total} ${pct}%`;
    };
    addEventListener("scroll", upd, { passive: true });
    addEventListener("resize", upd);
    upd();
  }

  function pagerKeys(prose, finder) {
    const heads = () => $$("h2, h3", prose);
    document.addEventListener("keydown", (e) => {
      if ($("#fzf") && !$("#fzf").hidden) return;
      if (typing(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      const beh = reduced ? "auto" : "smooth";
      switch (e.key) {
        case "/": case "?": e.preventDefault(); finder.prompt(); break;
        case "j": case "ArrowDown": e.preventDefault(); scrollBy({ top: 72, behavior: beh }); break;
        case "k": case "ArrowUp": e.preventDefault(); scrollBy({ top: -72, behavior: beh }); break;
        case "d": scrollBy({ top: innerHeight / 2, behavior: beh }); break;
        case "u": scrollBy({ top: -innerHeight / 2, behavior: beh }); break;
        case "b": scrollBy({ top: -innerHeight * 0.9, behavior: beh }); break;
        case "g": scrollTo({ top: 0, behavior: beh }); break;
        case "G": scrollTo({ top: document.documentElement.scrollHeight, behavior: beh }); break;
        case "n": if (!finder.next()) { const h = heads().find((x) => x.getBoundingClientRect().top > 160); if (h) h.scrollIntoView({ behavior: beh }); } break;
        case "N": if (!finder.prev()) { const h = heads().filter((x) => x.getBoundingClientRect().top < 60).pop(); if (h) h.scrollIntoView({ behavior: beh }); } break;
        case "z": zen(); break;
        case "Escape":
          if (document.body.classList.contains("zen")) zen(false);
          else if (finder.active) finder.clearAll();
          else location.href = "./";
          break;
        case "q": location.href = "./"; break;
        default: break;
      }
    });
  }

  /* zen reading mode = the article window's maximize */
  function zen(force) {
    const on = document.body.classList.toggle("zen", force);
    const t = $("#pager-title");
    if (t) t.dataset.state = on ? "zen mode · esc or z to exit" : "";
    if (on) toast("zen mode: esc or z to exit");
  }

  // window controls on journal pages
  if (window.P1R3X && window.P1R3X.win) {
    const W = window.P1R3X.win;
    // article: red = `q` (quit less → back to the log), green = zen mode
    W.on(".pager-win", {
      close: (win) => { W.animate(win, "win-closing", 420).then(() => { location.href = "./"; }); return true; },
      maximize: () => { zen(); return true; },
      minimize: (win) => { if (document.body.classList.contains("zen")) zen(false); return false; },
    });
    // error window: closing it returns to the journal
    W.on("#v-error .panel", {
      close: (win) => { W.animate(win, "win-closing", 420).then(() => { location.href = "./"; }); return true; },
    });
    // tmux: re-attaching replays the log stream
    W.on(".tmux", {
      reopen: () => { $$("#log li").forEach((li, k) => { li.classList.remove("in"); setTimeout(() => li.classList.add("in"), 60 * k); }); },
    });
  }

  function fail(cmd, msg) {
    const el = $("#v-error");
    el.hidden = false;
    el.innerHTML = `<div class="panel corners"><div class="panel-bar"><i></i><i></i><i></i><span class="title">zsh</span></div><div class="pager-body">
<pre><span class="ps">p1r3x@lab:~/journal$</span> ${esc(cmd)}
<span class="err">${esc(msg)}</span>
<span class="ps">p1r3x@lab:~/journal$</span> <a href="./">cd ~/journal</a>   <span class="dim"># back to the log</span>   <button type="button" class="cmdbtn" data-fzf>fzf ~/journal (ctrl+k)</button></pre></div></div>`;
    document.title = "Not found · p1r3x journal";
  }

  /* =====================================================
     boot
     ===================================================== */
  async function init() {
    let posts;
    try { posts = await loadPosts(); }
    catch {
      return fail("journalctl -u journal.service",
        location.protocol === "file:"
          ? "Failed to read journal: open this page through a local server (VS Code Live Server). Browsers block file:// reads."
          : "Failed to read posts.json: run `python tools/build_blog.py` to generate it.");
    }
    const fzf = setupFzf(posts);
    const slug = params.get("p");
    if (slug) renderArticle(slug, posts);
    else renderIndex(posts, fzf);
  }

  init();
})();
