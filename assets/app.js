(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Forgiving Urdu/Arabic matching: strips diacritics, unifies look-alike letters.
  const norm = s => String(s ?? "").toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[يىۓے]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[هۃۂ]/g, "ہ")
    .replace(/[أإآ]/g, "ا")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ").trim();
  const tokens = q => norm(q).split(" ").filter(Boolean);
  const hit = (s, toks) => toks.every(t => s.includes(t));

  /* ---------- search index (loaded once, on first use) ---------- */
  let IDX = null, pending = null;
  function loadIndex() {
    if (IDX) return Promise.resolve(IDX);
    if (!pending) pending = fetch("/assets/search.json").then(r => r.json()).then(d => {
      IDX = {
        k: d.k.map(r => ({ url: r[0], title: r[1], eng: r[2], poet: r[3], topic: r[4], s: norm(r.join(" ")) })),
        p: d.p.map(r => ({ url: r[0], name: r[1], n: r[2], s: norm(r[1]) })),
        t: d.t.map(r => ({ url: r[0], name: r[1], n: r[2], s: norm(r[1]) })),
        a: d.a.map(r => ({ title: r[0], url: r[1], album: r[2], s: norm(r[0] + " " + r[2]) })),
      };
      return IDX;
    });
    return pending;
  }
  function run(q) {
    const toks = tokens(q);
    if (!toks.length) return null;
    return {
      k: IDX.k.filter(x => hit(x.s, toks)), p: IDX.p.filter(x => hit(x.s, toks)),
      t: IDX.t.filter(x => hit(x.s, toks)), a: IDX.a.filter(x => hit(x.s, toks)),
    };
  }

  /* ---------- live suggestions (every page) ---------- */
  const input = $("#q"), box = $("#suggest");
  if (input && box) {
    let timer;
    const close = () => { box.hidden = true; box.innerHTML = ""; };
    const row = (url, ur, en) => `<a href="${esc(url)}"><span class="ur" lang="ur">${esc(ur)}</span><span class="en">${esc(en || "")}</span></a>`;
    const draw = async () => {
      const q = input.value;
      if (!norm(q)) return close();
      await loadIndex();
      const r = run(q);
      if (!r) return close();
      let h = "";
      if (r.k.length) h += "<h4>Naats</h4>" + r.k.slice(0, 7).map(x => row(x.url, x.title, x.eng)).join("");
      if (r.p.length) h += "<h4>Poets</h4>" + r.p.slice(0, 3).map(x => row(x.url, x.name, x.n + " naats")).join("");
      if (r.t.length) h += "<h4>Topics</h4>" + r.t.slice(0, 3).map(x => row(x.url, x.name, x.n + " naats")).join("");
      if (r.a.length) h += "<h4>Audio</h4>" + r.a.slice(0, 3).map(x => row(x.url, x.title, x.album)).join("");
      h += h ? `<a class="all" href="/search.html?q=${encodeURIComponent(q)}">See all results →</a>`
             : '<p class="empty">No match. The app has the complete collection.</p>';
      box.innerHTML = h; box.hidden = false;
    };
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(draw, 120); });
    input.addEventListener("focus", () => { loadIndex(); if (input.value) draw(); });
    input.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    document.addEventListener("click", e => { if (!e.target.closest(".searchwrap")) close(); });
  }

  /* ---------- full results (search.html) ---------- */
  const res = $("#results");
  if (res && res.dataset.page === "search") {
    const q = new URLSearchParams(location.search).get("q") || "";
    if (input) input.value = q;
    if (q) loadIndex().then(() => {
      const r = run(q);
      const list = (title, items, fn, cap) => items.length
        ? `<h2 class="sec">${title} (${items.length})</h2><ul class="klist ${cap ? "" : "cols"}">${items.slice(0, cap || 400).map(fn).join("")}</ul>` : "";
      const li = (url, ur, en) => `<li><a href="${esc(url)}"><span class="ur" lang="ur">${esc(ur)}</span><span class="en">${esc(en || "")}</span></a></li>`;
      let h = list("Naats", r.k, x => li(x.url, x.title, [x.eng, x.poet].filter(Boolean).join(" · ")), 200)
            + list("Poets", r.p, x => li(x.url, x.name, x.n + " naats"))
            + list("Topics", r.t, x => li(x.url, x.name, x.n + " naats"))
            + list("Audio", r.a, x => li(x.url, x.title, x.album), 100);
      res.innerHTML = h || `<p class="empty">Nothing found for “${esc(q)}”. The app has the complete collection.</p>`;
    });
  }

  /* ---------- QR code for desktop visitors ---------- */
  const qr = $("#qr");
  if (qr) window.addEventListener("load", () => {
    const play = $(".play-link");
    if (window.QRCode && play) {
      try { new QRCode(qr, { text: play.href, width: 128, height: 128 }); qr.classList.add("on"); } catch (e) {}
    }
  });
})();
