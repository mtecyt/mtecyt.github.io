/* M-TEC Hardware. Statisch, ohne Abhängigkeiten.
   Daten: data/news.json (fetch). Ticker als Karussell mit Detail-Modal. Fallback für file://: data/news.js setzt window.MTEC_NEWS. */
(function () {
  "use strict";

  // Mobile Navigation
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : "#"; }

  function fmtDate(iso) {
    try {
      return new Intl.DateTimeFormat("de-AT", {
        timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }).format(new Date(iso)) + " Uhr (Wien)";
    } catch (e) { return iso; }
  }

  function loadJson(path, globalName) {
    // file:// – fetch ist dort gesperrt, direkt den Fallback aus data/*.js nehmen
    if (location.protocol === "file:" && window[globalName]) return Promise.resolve(window[globalName]);
    return fetch(path, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () {
        if (window[globalName]) return window[globalName];
        throw new Error("Konnte " + path + " nicht laden");
      });
  }

  function fmtDay(iso) {
    try {
      return new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
    } catch (e) { return iso; }
  }
  function teaser(text) {
    var parts = String(text || "").split(/([.!?]["“”]?\s+)/);
    var joined = [];
    for (var k = 0; k < parts.length; k += 2) joined.push(parts[k] + (parts[k + 1] || ""));
    parts = joined;
    // Sätze an Abkürzungen wie "z. B." oder "ca." nicht trennen
    var sent = [], buf = "";
    parts.forEach(function (p) {
      buf += p;
      if (!/(\b[a-zäöü]{1,3}\.|\d\.)\s*$/i.test(buf) || buf.length > 220) { sent.push(buf.trim()); buf = ""; }
    });
    if (buf.trim()) sent.push(buf.trim());
    var t = sent.slice(0, 2).join(" ");
    if (t.length < 170 && sent.length > 2) t += " " + sent[2];
    return t;
  }

  // ---------------- News-Ticker (Karussell) ----------------
  var track = document.getElementById("news-list");
  if (track) {
    loadJson("data/news.json", "MTEC_NEWS").then(renderNews).catch(function (e) {
      track.innerHTML = '<p class="empty">Ticker konnte nicht geladen werden (' + esc(e.message) + ").</p>";
    });
  }

  function renderNews(data) {
    var mode = (data._info && data._info.modus) || "live";
    var all = (data.eintraege || []).filter(function (e) { return mode === "vorschau" || e.approved === true; });
    all.sort(function (a, b) { return a.datum < b.datum ? 1 : -1; });
    var byId = {};
    all.forEach(function (e) { byId[e.id] = e; });

    var upd = document.getElementById("news-updated");
    if (upd && data._info && data._info.stand) upd.textContent = fmtDate(data._info.stand);

    var banner = document.getElementById("preview-banner");
    var drafts = all.filter(function (e) { return !e.approved; }).length;
    if (banner && mode === "vorschau") {
      banner.hidden = false;
      banner.textContent = drafts
        ? "Vorschau-Modus: " + drafts + " von " + all.length + " Einträgen sind Entwürfe und warten auf Freigabe durch M-TEC. Vor dem Veröffentlichen modus auf \"live\" stellen."
        : "Vorschau-Modus: alle " + all.length + " Einträge sind von M-TEC freigegeben. Vor dem Veröffentlichen modus auf \"live\" stellen.";
    }

    var carousel = document.getElementById("carousel");
    var dotsBox = document.getElementById("car-dots");
    var prev = document.getElementById("car-prev");
    var next = document.getElementById("car-next");
    var bar = document.getElementById("car-progress");
    var INTERVAL = 4500;
    var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    var paused = { hover: false, focus: false, touch: false, modal: false, hidden: false };
    var timer = null, touchTimer = null, scrollTimer = null;
    var current = "alle", pos = 0;

    function labels(e) {
      var isLeak = e.label === "Leak";
      var rel = e.zuverlaessigkeit || {};
      var h = '<div class="labels"><span class="badge ' + (isLeak ? "leak" : "news") + '">' + esc(e.label) + "</span>";
      if (isLeak) h += '<span class="badge plain" title="Unsere Einschätzung der Quelle – unbestätigt">Zuverlässigkeit: ' + esc(rel.stufe || "unbekannt") + "</span>";
      if (!e.approved) h += '<span class="badge draft" title="Noch nicht freigegeben">Entwurf</span>';
      return h + "</div>";
    }

    function slide(e, i, arr) {
      return '<div class="slide" role="group" aria-roledescription="Folie" aria-label="' + (i + 1) + " von " + arr.length + '">' +
        '<button type="button" class="news-card" data-id="' + esc(e.id) + '" id="card-' + esc(e.id) + '" aria-haspopup="dialog">' +
        labels(e) + "<h3>" + esc(e.titel) + "</h3>" +
        '<p class="teaser">' + esc(teaser(e.zusammenfassung)) + "</p>" +
        '<span class="foot"><span>' + esc(e.quelle && e.quelle.name) + " · " + '<time datetime="' + esc(e.datum) + '">' + esc(fmtDay(e.datum)) + "</time></span>" +
        '<span class="more">Mehr&nbsp;→</span></span></button></div>';
    }

    // ---- Geometrie ----
    function slides() { return track.querySelectorAll(".slide"); }
    function step() {
      var s = slides();
      if (s.length < 2) return track.clientWidth || 1;
      return (s[1].offsetLeft - s[0].offsetLeft) || 1;
    }
    function positions() {
      var n = slides().length;
      var visible = Math.max(1, Math.floor((track.clientWidth + 4) / step()));
      return Math.max(1, n - visible + 1);
    }
    function goTo(i, user) {
      var p = positions();
      if (i >= p) i = 0;
      if (i < 0) i = p - 1;
      pos = i;
      var left = Math.min(i * step(), track.scrollWidth - track.clientWidth);
      track.scrollTo({ left: left, behavior: mqReduce.matches ? "instant" : "smooth" });
      paintDots();
      if (user) restart();
    }
    function paintDots() {
      var p = positions();
      if (dotsBox.children.length !== p) {
        var h = "";
        for (var i = 0; i < p; i++) h += '<button type="button" class="dot" data-i="' + i + '" aria-label="Position ' + (i + 1) + '"></button>';
        dotsBox.innerHTML = p > 1 ? h : "";
      }
      Array.prototype.forEach.call(dotsBox.children, function (d, i) { d.setAttribute("aria-current", i === pos ? "true" : "false"); });
      var disabled = p <= 1;
      prev.disabled = disabled; next.disabled = disabled;
    }

    // ---- Automatisches Weiterlaufen ----
    function isPaused() {
      return mqReduce.matches || paused.hover || paused.focus || paused.touch || paused.modal || paused.hidden || positions() <= 1;
    }
    function resetBar() { if (bar) { bar.style.transition = "none"; bar.style.width = "0"; } }
    function restart() {
      clearTimeout(timer); resetBar();
      if (isPaused()) return;
      if (bar) { void bar.offsetWidth; bar.style.transition = "width " + INTERVAL + "ms linear"; bar.style.width = "100%"; }
      timer = setTimeout(function () { goTo(pos + 1); restart(); }, INTERVAL);
    }
    function setPause(key, val) { paused[key] = val; restart(); }

    carousel.addEventListener("mouseenter", function () { setPause("hover", true); });
    carousel.addEventListener("mouseleave", function () { setPause("hover", false); });
    carousel.addEventListener("focusin", function () { setPause("focus", true); });
    carousel.addEventListener("focusout", function (ev) { if (!carousel.contains(ev.relatedTarget)) setPause("focus", false); });
    carousel.addEventListener("touchstart", function () { clearTimeout(touchTimer); setPause("touch", true); }, { passive: true });
    carousel.addEventListener("touchend", function () {
      clearTimeout(touchTimer);
      touchTimer = setTimeout(function () { setPause("touch", false); }, 6000);
    }, { passive: true });
    document.addEventListener("visibilitychange", function () { setPause("hidden", document.hidden); });
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", restart);

    // Wischen/Scrollen: Position aus scrollLeft ableiten
    track.addEventListener("scroll", function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var p = positions();
        var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
        var i = atEnd ? p - 1 : Math.round(track.scrollLeft / step());
        if (i !== pos) { pos = Math.max(0, Math.min(p - 1, i)); paintDots(); }
      }, 90);
    }, { passive: true });

    prev.addEventListener("click", function () { goTo(pos - 1, true); });
    next.addEventListener("click", function () { goTo(pos + 1, true); });
    dotsBox.addEventListener("click", function (ev) {
      var d = ev.target.closest(".dot");
      if (d) goTo(+d.getAttribute("data-i"), true);
    });
    carousel.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { ev.preventDefault(); goTo(pos + 1, true); }
      if (ev.key === "ArrowLeft") { ev.preventDefault(); goTo(pos - 1, true); }
    });
    var rz;
    window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { goTo(Math.min(pos, positions() - 1)); restart(); }, 150); });

    // ---- Detailansicht (Modal) ----
    var modal = document.getElementById("news-modal");
    var mBody = document.getElementById("modal-body");
    function openDetail(id) {
      var e = byId[id];
      if (!e || !modal) return;
      var isLeak = e.label === "Leak";
      var rel = e.zuverlaessigkeit || {};
      var h = labels(e);
      h += '<h2 id="modal-title">' + esc(e.titel) + "</h2>";
      h += '<p class="date"><time datetime="' + esc(e.datum) + '">' + esc(fmtDate(e.datum)) + "</time>" + (e.kategorie ? " · " + esc(e.kategorie) : "") + "</p>";
      h += '<p class="body">' + esc(e.zusammenfassung) + "</p>";
      if (isLeak) h += '<p class="rel-note"><b>Leak – unbestätigt.</b> Zuverlässigkeit: ' + esc(rel.stufe || "unbekannt") + (rel.hinweis ? ". " + esc(rel.hinweis) : "") + "</p>";
      h += '<div class="src">Quelle: <a href="' + esc(safeUrl(e.quelle.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(e.quelle.name) + "</a>";
      if (e.ursprungsquelle) h += " · Ursprung: " + esc(e.ursprungsquelle);
      if (e.weitere_links && e.weitere_links.length) {
        h += '<div style="margin-top:10px">Weitere Links:</div><ul>' + e.weitere_links.map(function (l) {
          return '<li><a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(l.name) + "</a></li>";
        }).join("") + "</ul>";
      }
      if (e.datum_hinweis) h += '<p class="small" style="margin:10px 0 0">Hinweis: ' + esc(e.datum_hinweis) + "</p>";
      if (!e.approved) h += '<p class="small" style="margin:10px 0 0;color:var(--faint)">Entwurf – noch nicht von der Redaktion freigegeben. KI-gestützt zusammengefasst.</p>';
      h += "</div>";
      mBody.innerHTML = h;
      mBody.scrollTop = 0;
      paused.modal = true; restart();
      if (typeof modal.showModal === "function") { if (!modal.open) modal.showModal(); } else modal.setAttribute("open", "");
      if (history.replaceState) history.replaceState(null, "", "#" + id);
    }
    function closeDetail() {
      if (!modal) return;
      if (typeof modal.close === "function" && modal.open) modal.close(); else modal.removeAttribute("open");
    }
    if (modal) {
      modal.addEventListener("close", function () {
        paused.modal = false; restart();
        if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
      });
      modal.addEventListener("click", function (ev) { if (ev.target === modal) closeDetail(); });
      document.getElementById("modal-close").addEventListener("click", closeDetail);
    }
    track.addEventListener("click", function (ev) {
      var c = ev.target.closest(".news-card");
      if (c) openDetail(c.getAttribute("data-id"));
    });

    // ---- Filter ----
    var chips = document.querySelectorAll("[data-filter]");
    Array.prototype.forEach.call(chips, function (c) {
      c.addEventListener("click", function () {
        current = c.getAttribute("data-filter");
        Array.prototype.forEach.call(chips, function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        draw();
      });
    });

    function draw() {
      var shown = all.filter(function (e) { return current === "alle" || e.label === current; });
      track.innerHTML = shown.length ? shown.map(slide).join("") : '<p class="empty">Keine Einträge.</p>';
      var cnt = document.getElementById("news-count");
      if (cnt) cnt.textContent = shown.length + " Einträge";
      dotsBox.innerHTML = "";
      track.scrollTo({ left: 0, behavior: "instant" });
      pos = 0; paintDots(); restart();
    }
    draw();

    // Direktlink index.html#<id> öffnet die Meldung
    var hash = decodeURIComponent((location.hash || "").slice(1));
    if (hash && byId[hash]) {
      var card = document.getElementById("card-" + hash);
      if (card) {
        var idx = Array.prototype.indexOf.call(slides(), card.parentNode);
        goTo(Math.min(idx, positions() - 1));
      }
      openDetail(hash);
    }
  }

  // ---------------- Quellenliste ----------------
  var srcBox = document.getElementById("source-list");
  if (srcBox) {
    loadJson("data/sources.json", "MTEC_SOURCES").then(function (data) {
      var order = { "hoch": 0, "mittel-hoch": 1, "mittel": 2, "unklar": 3, "niedrig-mittel": 4, "niedrig": 5, "nicht nutzbar": 6 };
      function key(b) { var k = String(b).split(" ")[0]; return order[k] == null ? 3 : order[k]; }
      var q = (data.quellen || []).slice().sort(function (a, b) { return key(a.bewertung) - key(b.bewertung); });
      srcBox.innerHTML = q.map(function (s) {
        var lvl = String(s.bewertung).split(" ")[0];
        var cls = lvl.indexOf("hoch") === 0 ? "hoch" : lvl.indexOf("mittel") === 0 ? "mittel" : "niedrig";
        if (lvl === "mittel-hoch") cls = "mittel-hoch";
        return '<div class="card src-card"><div class="labels"><span class="badge plain">' + esc(s.typ) + '</span><span class="rating ' + cls + '">Bewertung: ' + esc(s.bewertung) + '</span><span class="small muted">' + esc(s.status || "") + "</span>" + (s.gewuenscht_von ? '<span class="badge wish">von ' + esc(s.gewuenscht_von) + ' gewünscht</span>' : "") + "</div>" +
          "<h3>" + esc(s.name) + "</h3>" +
          '<div class="handle">' + (s.url ? '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(s.handle || s.url) + "</a>" : esc(s.handle || "")) + " · " + esc(s.plattform) + (s.sprache ? " · Sprache: " + esc(s.sprache) : "") + " · " + esc((s.bereich || []).join(", ")) + "</div>" +
          "<p>" + esc(s.track_record) + "</p>" +
          (s.vorsicht && s.vorsicht !== "—" ? '<p class="rel-hint"><b>Vorsicht:</b> ' + esc(s.vorsicht) + "</p>" : "") + "</div>";
      }).join("");
    }).catch(function (e) { srcBox.innerHTML = '<p class="empty">' + esc(e.message) + "</p>"; });
  }
})();

/* GPU-Tycoon-Galerie: Lightbox (Esc schließt, ←/→ blättert, Klick daneben schließt) */
(function () {
  var gal = document.getElementById("tycoon-gallery"), lb = document.getElementById("lightbox");
  if (!gal || !lb || typeof lb.showModal !== "function") return;
  var shots = Array.prototype.slice.call(gal.querySelectorAll(".shot"));
  var img = lb.querySelector("img"), cap = lb.querySelector("figcaption"), pos = 0, opener = null;
  function show(i) {
    pos = (i + shots.length) % shots.length;
    var s = shots[pos];
    img.src = s.getAttribute("data-full");
    img.alt = s.querySelector("img").alt;
    cap.textContent = s.getAttribute("data-caption") + " (" + (pos + 1) + "/" + shots.length + ")";
  }
  shots.forEach(function (s, i) {
    s.addEventListener("click", function () { opener = s; show(i); lb.showModal(); });
  });
  lb.querySelector(".lb-close").addEventListener("click", function () { lb.close(); });
  lb.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); show(pos - 1); });
  lb.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); show(pos + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(pos - 1);
    else if (e.key === "ArrowRight") show(pos + 1);
  });
  lb.addEventListener("close", function () { if (opener) opener.focus(); });
})();
