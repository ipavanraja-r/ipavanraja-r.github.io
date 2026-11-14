/* =========================================================
   Credential Vault: renders certifications from assets/data/certs.js
   ========================================================= */
(() => {
  "use strict";
  const CERTS = (window.CERTS || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const CATS = window.CERT_CATEGORIES || {};
  const $ = (s, r = document) => r.querySelector(s);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (d) => { const [y, m] = d.split("-"); return `${MONTHS[(+m || 1) - 1]} ${y}`; };
  const color = (c) => (CATS[c.category] || {}).color || "#00ff9c";
  const catLabel = (c) => (CATS[c.category] || {}).label || c.category;

  /* ---------- stats + dial ---------- */
  const verified = CERTS.filter((c) => c.status !== "in-progress");
  const issuers = new Set(CERTS.map((c) => c.issuer.split("·")[0].trim()));
  const years = CERTS.map((c) => +c.date.slice(0, 4));
  $("#vault-stats").innerHTML = `
    <div><b>${String(verified.length).padStart(2, "0")}</b><span>verified keys</span></div>
    <div><b>${String(issuers.size).padStart(2, "0")}</b><span>issuers</span></div>
    <div><b>${String(new Set(CERTS.map((c) => c.category)).size).padStart(2, "0")}</b><span>domains</span></div>
    <div><b>${years.length ? Math.min(...years) + "→" + String(Math.max(...years)).slice(2) : "--"}</b><span>active span</span></div>`;

  const dial = $("#dial-count");
  const target = verified.length;
  if (reduced) dial.textContent = String(target).padStart(2, "0");
  else {
    let n = 0;
    const spin = setInterval(() => {
      dial.textContent = String(Math.floor(Math.random() * 99)).padStart(2, "0");
      if (++n > 18) { clearInterval(spin); dial.textContent = String(target).padStart(2, "0"); }
    }, 55);
  }

  /* ---------- filters ---------- */
  const usedCats = [...new Set(CERTS.map((c) => c.category))];
  $("#cert-filters").innerHTML =
    `<button class="on" data-f="all">./all <small>${CERTS.length}</small></button>` +
    usedCats.map((c) => `<button data-f="${esc(c)}">./${esc((CATS[c] || {}).label || c).toLowerCase()} <small>${CERTS.filter((x) => x.category === c).length}</small></button>`).join("");

  /* ---------- cards ---------- */
  const grid = $("#vault-grid");
  grid.innerHTML = CERTS.map((c, i) => `
    <article class="vcard reveal" tabindex="0" role="button" aria-label="Open ${esc(c.title)}" data-id="${esc(c.id)}" data-cat="${esc(c.category)}" style="--accent:${color(c)}">
      <div class="vcard-inner">
        <div class="circuit"></div>
        <div class="vc-top">
          <span>#${String(i + 1).padStart(2, "0")} · ${esc(c.id.toUpperCase())}</span>
          <span class="vc-status ${c.status === "in-progress" ? "pending" : ""}">${c.status === "in-progress" ? "IN PROGRESS" : "VERIFIED"}</span>
        </div>
        <div class="vc-emblem"><i></i><b>${esc(c.code)}</b></div>
        <div class="vc-cat">${esc(catLabel(c))}</div>
        <h3 class="vc-title">${esc(c.title)}</h3>
        <div class="vc-issuer">${esc(c.issuer)}</div>
        <div class="vc-skills">${(c.skills || []).slice(0, 4).map((s) => `<span>${esc(s)}</span>`).join("")}</div>
        <div class="vc-foot">
          <div class="vc-date"><small>ISSUED</small>${fmt(c.date)}</div>
          <span class="vc-open">inspect ▸</span>
        </div>
        <div class="vc-barcode"></div>
        <div class="foil"></div>
        <div class="shine"></div>
      </div>
    </article>`).join("");

  /* tilt */
  if (finePointer && !reduced) {
    grid.querySelectorAll(".vcard").forEach((card) => {
      const inner = card.querySelector(".vcard-inner");
      card.addEventListener("pointermove", (e) => {
        const r = inner.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--ry", `${(px - 0.5) * 18}deg`);
        card.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* filter behaviour */
  const btns = [...document.querySelectorAll("#cert-filters button")];
  btns.forEach((b) => b.addEventListener("click", () => {
    btns.forEach((x) => x.classList.toggle("on", x === b));
    grid.querySelectorAll(".vcard").forEach((card) => {
      const show = b.dataset.f === "all" || card.dataset.cat === b.dataset.f;
      card.classList.toggle("hide", !show);
      if (show) card.classList.add("in");
    });
  }));

  /* ---------- timeline (oldest → newest) ---------- */
  let lastYear = "";
  $("#cert-tl").innerHTML = CERTS.slice().reverse().map((c) => {
    const y = c.date.slice(0, 4);
    const label = y !== lastYear ? y : "";
    lastYear = y;
    return `<div class="tl-item" style="--c:${color(c)}"><div class="y">${label}</div><div class="node"></div><h4>${esc(c.title)}</h4><p>${fmt(c.date)} · ${esc(c.issuer.split("·")[0].trim())}</p></div>`;
  }).join("");

  /* ---------- modal ---------- */
  const modal = $("#modal"), body = $("#modal-body");
  let lastFocus = null;

  let currentId = null;
  function open(id) {
    const c = CERTS.find((x) => x.id === id);
    if (!c) return;
    currentId = id;
    const chip = document.getElementById("dock-chip");
    if (chip) chip.remove();
    lastFocus = document.activeElement;
    $("#m-path").textContent = `cat ~/vault/${c.id}.pem`;
    body.style.setProperty("--accent", color(c));
    body.innerHTML = `
      <div class="vc-emblem" style="--accent:${color(c)}"><i></i><b>${esc(c.code)}</b></div>
      <div>
        <div class="vc-cat" style="--accent:${color(c)}">${esc(catLabel(c))}</div>
        <h3 id="m-title">${esc(c.title)}</h3>
        <div class="m-issuer">${esc(c.issuer)}</div>
        <p class="m-summary">${esc(c.summary || "")}</p>
        <div class="vc-skills">${(c.skills || []).map((s) => `<span>${esc(s)}</span>`).join("")}</div>
        <table class="m-table">
          <tr><td>status</td><td>${c.status === "in-progress" ? "in progress" : "verified ✓"}</td></tr>
          <tr><td>issued</td><td>${fmt(c.date)}</td></tr>
          ${c.credentialId ? `<tr><td>credential id</td><td>${esc(c.credentialId)}</td></tr>` : ""}
          <tr><td>holder</td><td>I Pavanraja (p1r3x)</td></tr>
        </table>
        <div class="m-actions">
          ${c.verify ? `<a class="btn solid" href="${esc(c.verify)}" target="_blank" rel="noopener">Verify ↗</a>` : ""}
          ${c.image ? `<a class="btn" href="${esc(c.image)}" target="_blank" rel="noopener">Full certificate ↗</a>` : ""}
          <button class="btn" type="button" data-close>Close</button>
        </div>
      </div>
      ${c.image ? `<div class="m-image"><img src="${esc(c.image)}" alt="${esc(c.title)} certificate" loading="lazy"></div>` : ""}`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".m-close").focus();
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  // minimize → dock the credential as a chip; click the chip to bring it back
  function dock() {
    const c = CERTS.find((x) => x.id === currentId);
    close();
    if (!c) return;
    let chip = document.getElementById("dock-chip");
    if (!chip) { chip = document.createElement("button"); chip.id = "dock-chip"; chip.type = "button"; chip.className = "dock-chip"; document.body.appendChild(chip); }
    chip.style.setProperty("--accent", color(c));
    chip.innerHTML = `<span class="dc-dot"></span><span>[1]+ Stopped</span><b>cat ~/vault/${esc(c.id)}.pem</b><span class="dc-fg">fg ↑</span>`;
    chip.onclick = () => { chip.remove(); open(c.id); };
  }

  if (window.P1R3X && window.P1R3X.win) {
    window.P1R3X.win.on(".modal-card", {
      close: () => { close(); return true; },
      minimize: () => { dock(); return true; },
      maximize: (win) => { win.classList.toggle("max"); return true; },
    });
  }

  grid.addEventListener("click", (e) => { const card = e.target.closest(".vcard"); if (card) open(card.dataset.id); });
  grid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("vcard")) { e.preventDefault(); open(e.target.dataset.id); }
  });
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  // deep link: certifications.html#thm-jpt
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash && CERTS.some((c) => c.id === hash)) setTimeout(() => open(hash), 400);
})();
