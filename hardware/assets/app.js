/* M-TEC Hardware. Statisch, ohne Abhängigkeiten.
   Daten: data/news.json (fetch). Ticker als Karussell mit Detail-Modal. Fallback für file://: data/news.js setzt window.MTEC_NEWS. */
(function () {
  "use strict";

  // Besucherstatistik (GoatCounter, ohne Cookies) – NUR auf der echten Website.
  // Entspricht dem offiziellen Snippet
  //   <script data-goatcounter="https://mtec-hardware.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
  // wird aber per JS eingefügt, damit file://-, localhost- und Test-Vorschauen keine externen Anfragen stellen.
  var GC_LIVE_HOST = "mtecyt.github.io";
  var GC_SITE = "https://mtec-hardware.goatcounter.com";
  if (location.protocol === "https:" && location.hostname === GC_LIVE_HOST) {
    var gc = document.createElement("script");
    gc.async = true;
    gc.src = "https://gc.zgo.at/count.js";
    gc.setAttribute("data-goatcounter", GC_SITE + "/count");
    document.head.appendChild(gc);
    // Dezenter Zähler in der Fußzeile: Gesamtbesuche (Pfad TOTAL). Bei Fehler/0/leer bleibt er unsichtbar.
    var foot = document.querySelector(".site-footer .wrap > div:last-child");
    if (foot && window.fetch) {
      fetch(GC_SITE + "/counter/TOTAL.json", { credentials: "omit", cache: "default" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var n = j && parseInt(String(j.count || "").replace(/\D/g, ""), 10);
          if (!n || n < 1) return;
          var el = document.createElement("span");
          el.className = "visit-count";
          el.title = "Besuche insgesamt, gezählt mit GoatCounter (ohne Cookies) – siehe Datenschutz";
          el.textContent = n.toLocaleString("de-DE") + " Besucher";
          foot.appendChild(document.createTextNode(" · "));
          foot.appendChild(el);
        }).catch(function () {});
    }
  }

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


  // ---------------- Gemeinsame Bausteine: Ticker + Archiv ----------------
  var DAY = 864e5, ACTIVE_DAYS = 7, MIN_ACTIVE = 4;   // gleiche Regel wie scripts/update-news.mjs archive
  function byDateDesc(a, b) { return Date.parse(b.datum) - Date.parse(a.datum); }
  function visibleEntries(data) {
    var mode = (data && data._info && data._info.modus) || "live";
    return ((data && data.eintraege) || []).filter(function (e) { return mode === "vorschau" || e.approved === true; });
  }
  // Ticker = Einträge der letzten 7 Tage; sind das weniger als 4, bleiben die 4 neuesten stehen.
  function splitActive(list) {
    var sorted = list.slice().sort(byDateDesc), cutoff = Date.now() - ACTIVE_DAYS * DAY;
    var active = sorted.filter(function (e, i) { return i < MIN_ACTIVE || Date.parse(e.datum) >= cutoff; });
    return { active: active, old: sorted.slice(active.length) };
  }
  function imgPath(e) {
    var f = e.bild && e.bild.datei;
    return /^assets\/img\/news\/[\w.-]+\.webp$/.test(f || "") ? f : "";
  }
  // Bereich: "hardware" (Standard, auch für ältere Einträge ohne Feld), "software" oder "games"
  var AREA_NAMES = { hardware: "Hardware", software: "Software", games: "Games" };
  function area(e) { return AREA_NAMES[e.bereich] ? e.bereich : "hardware"; }
  function areaName(e) { return AREA_NAMES[area(e)]; }
  function topic(e) { return (e.themen && e.themen[0]) || areaName(e); }
  function labels(e) {
    var isLeak = e.label === "Leak";
    var rel = e.zuverlaessigkeit || {};
    var h = '<div class="labels"><span class="badge ' + (isLeak ? "leak" : "news") + '">' + esc(e.label) + "</span>";
    if (isLeak) h += '<span class="badge plain" title="Unsere Einschätzung der Quelle – unbestätigt">Zuverlässigkeit: ' + esc(rel.stufe || "unbekannt") + "</span>";
    h += '<span class="badge area" title="Bereich: ' + esc(areaName(e)) + '">' + esc(topic(e)) + "</span>";
    if (!e.approved) h += '<span class="badge draft" title="Noch nicht freigegeben">Entwurf</span>';
    return h + "</div>";
  }
  // Bildfläche der Karte: KI-Bild, sonst (oder bei Ladefehler) ein ruhiger Farbverlauf
  function media(e, eager) {
    var src = imgPath(e), kind = e.label === "Leak" ? "leak" : "news";
    if (!src) return '<span class="nc-media noimg ' + kind + '" aria-hidden="true"></span>';
    return '<span class="nc-media ' + kind + '"><img class="nc-img" src="' + esc(src) + '" alt="" width="800" height="450" decoding="async"' + (eager ? "" : ' loading="lazy"') + '>' +
      '<span class="ki-cap">KI-generiertes Bild</span></span>';
  }
  // Ticker-Karte: Bild + Labels + knackige Schlagzeile (kein Teaser). Archiv-Karte: Text, Schlagzeile + Kurzfassung.
  function headline(e) { return e.schlagzeile || e.titel; }
  function shortText(e) { return e.kurz || teaser(e.zusammenfassung); }
  function cardInner(e, withImage, eager) {
    return (withImage ? media(e, eager) : "") + labels(e) + '<h3 class="headline">' + esc(headline(e)) + "</h3>" +
      (withImage ? "" : '<p class="teaser">' + esc(shortText(e)) + "</p>") +
      '<span class="foot"><span>' + esc(e.quelle && e.quelle.name) + " · " + '<time datetime="' + esc(e.datum) + '">' + esc(fmtDay(e.datum)) + "</time></span>" +
      '<span class="more">Mehr&nbsp;→</span></span>';
  }
  function detailHtml(e, archived) {
    var isLeak = e.label === "Leak";
    var rel = e.zuverlaessigkeit || {};
    var src = imgPath(e);
    var h = "";
    if (src && !archived) h += '<figure class="detail-media"><img src="' + esc(src) + '" alt="" width="800" height="450" decoding="async"><figcaption>KI-generiertes Bild (Symbolbild, zeigt keine echten Produkte)</figcaption></figure>';
    h += labels(e);
    h += '<h2 id="modal-title">' + esc(e.titel) + "</h2>";
    h += '<p class="date"><time datetime="' + esc(e.datum) + '">' + esc(fmtDate(e.datum)) + "</time>" + (e.kategorie ? " · " + esc(e.kategorie) : "") + (archived ? " · Archiv" : "") + "</p>";
    // Stufe 1: Kurzfassung (2–4 Sätze). Stufe 2 (Weiterlesen): voller Bericht + Quell-Links.
    h += '<p class="kurz">' + esc(shortText(e)) + "</p>";
    if (isLeak) h += '<p class="rel-note"><b>Leak – unbestätigt.</b> Zuverlässigkeit: ' + esc(rel.stufe || "unbekannt") + (rel.hinweis ? ". " + esc(rel.hinweis) : "") + "</p>";
    h += '<button type="button" class="more-btn" data-expand aria-expanded="false" aria-controls="detail-full">Weiterlesen <span aria-hidden="true">↓</span></button>';
    h += '<div class="detail-full" id="detail-full" hidden>';
    h += '<h3 class="full-h">Der ganze Bericht</h3><p class="body">' + esc(e.zusammenfassung) + "</p>";
    h += '<div class="src">Quelle: <a href="' + esc(safeUrl(e.quelle && e.quelle.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(e.quelle && e.quelle.name) + "</a>";
    if (e.ursprungsquelle) h += " · Ursprung: " + esc(e.ursprungsquelle);
    if (e.weitere_links && e.weitere_links.length) {
      h += '<div style="margin-top:10px">Weitere Links:</div><ul>' + e.weitere_links.map(function (l) {
        return '<li><a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(l.name) + "</a></li>";
      }).join("") + "</ul>";
    }
    if (e.datum_hinweis) h += '<p class="small" style="margin:10px 0 0">Hinweis: ' + esc(e.datum_hinweis) + "</p>";
    h += "</div></div>";
    if (!e.approved) h += '<p class="small" style="margin:10px 0 0;color:var(--faint)">Entwurf – noch nicht von der Redaktion freigegeben. KI-gestützt zusammengefasst.</p>';
    return h;
  }
  // Detail-Modal (#news-modal) – von Ticker und Archiv gemeinsam genutzt
  function makeModal(byId, opts) {
    var modal = document.getElementById("news-modal");
    var mBody = document.getElementById("modal-body");
    opts = opts || {};
    function open(id) {
      var e = byId[id];
      if (!e || !modal) return false;
      mBody.innerHTML = detailHtml(e, opts.archived);
      mBody.scrollTop = 0;
      if (opts.onOpen) opts.onOpen();
      if (typeof modal.showModal === "function") { if (!modal.open) modal.showModal(); } else modal.setAttribute("open", "");
      if (history.replaceState) history.replaceState(null, "", "#" + id);
      return true;
    }
    function close() {
      if (!modal) return;
      if (typeof modal.close === "function" && modal.open) modal.close(); else modal.removeAttribute("open");
    }
    if (modal) {
      modal.addEventListener("close", function () {
        if (opts.onClose) opts.onClose();
        if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
      });
      modal.addEventListener("click", function (ev) { if (ev.target === modal) close(); });
      mBody.addEventListener("click", function (ev) {
        var b = ev.target.closest && ev.target.closest("[data-expand]");
        if (!b) return;
        var full = document.getElementById("detail-full");
        var openNow = b.getAttribute("aria-expanded") !== "true";
        full.hidden = !openNow;
        b.setAttribute("aria-expanded", String(openNow));
        b.innerHTML = openNow ? 'Weniger anzeigen <span aria-hidden="true">↑</span>' : 'Weiterlesen <span aria-hidden="true">↓</span>';
        if (openNow) { var hh = full.querySelector(".full-h"); if (hh) { hh.setAttribute("tabindex", "-1"); hh.focus({ preventScroll: true }); } full.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
      });
      document.getElementById("modal-close").addEventListener("click", close);
    }
    return { open: open, close: close };
  }
  // Bild fehlt/defekt -> Verlauf bleibt stehen, Bild + Hinweis werden ausgeblendet (kein kaputtes Icon)
  document.addEventListener("error", function (ev) {
    var t = ev.target;
    if (t && t.tagName === "IMG" && t.closest) {
      var m = t.closest(".nc-media, .detail-media");
      if (m) { if (m.classList.contains("detail-media")) m.remove(); else { m.classList.add("noimg"); t.remove(); } }
    }
  }, true);
  // Zwei Filtergruppen: Art (alle/News/Leak) und Bereich (alle/hardware/software/games).
  // Chips sind echte <button>s (Tastatur: Tab + Enter/Leertaste), aria-pressed zeigt die Auswahl je Gruppe.
  // Die Auswahl steht nur in der Adresse (?art=…&bereich=…), es wird nichts gespeichert (keine Cookies/kein Storage).
  var FILTER_VALUES = { art: ["alle", "News", "Leak"], bereich: ["alle", "hardware", "software", "games"] };
  // Alte bzw. alternative Adress-Werte weiterleiten statt zu ignorieren (z. B. ?bereich=Software, ?bereich=spiele).
  var FILTER_ALIASES = { bereich: { sw: "software", spiele: "games", game: "games", gaming: "games", hw: "hardware" }, art: { news: "News", leak: "Leak", leaks: "Leak" } };
  function readFilterState() {
    var st = { art: "alle", bereich: "alle" };
    try {
      var q = new URLSearchParams(location.search);
      Object.keys(st).forEach(function (g) {
        var v = q.get(g); if (!v) return;
        if (FILTER_VALUES[g].indexOf(v) === -1) { var l = v.toLowerCase(); v = FILTER_ALIASES[g][l] || (FILTER_VALUES[g].indexOf(l) !== -1 ? l : null); }
        if (v) st[g] = v;   // unbekannte Werte -> "alle"
      });
    } catch (err) {}
    return st;
  }
  function writeFilterState(st) {
    if (!history.replaceState || location.protocol === "file:") return;
    try {
      var q = new URLSearchParams(location.search);
      Object.keys(st).forEach(function (g) { if (st[g] === "alle") q.delete(g); else q.set(g, st[g]); });
      var qs = q.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    } catch (err) {}
  }
  function paintChips(st) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-filter]"), function (x) {
      var g = x.getAttribute("data-group") || "art";
      x.setAttribute("aria-pressed", st[g] === x.getAttribute("data-filter") ? "true" : "false");
    });
  }
  function matchesFilter(e, st) {
    return (st.art === "alle" || e.label === st.art) && (st.bereich === "alle" || area(e) === st.bereich);
  }
  function filterSummary(st) {
    var a = { alle: "", News: "News", Leak: "Leaks" }[st.art];
    var b = st.bereich === "alle" ? "" : AREA_NAMES[st.bereich];
    return [a, b].filter(Boolean).join(" · ");
  }
  function emptyHtml(st, extra) {
    return '<div class="empty empty-filter"><p>Keine Einträge' + (filterSummary(st) ? " für <b>" + esc(filterSummary(st)) + "</b>" : "") + (extra || "") + ".</p>" +
      '<button type="button" class="chip reset-filter" data-reset-filter>Filter zurücksetzen</button></div>';
  }
  function bindFilterChips(st, onChange) {
    paintChips(st);
    document.addEventListener("click", function (ev) {
      var c = ev.target.closest && ev.target.closest("[data-filter], [data-reset-filter]");
      if (!c) return;
      if (c.hasAttribute("data-reset-filter")) { st.art = "alle"; st.bereich = "alle"; }
      else st[c.getAttribute("data-group") || "art"] = c.getAttribute("data-filter");
      paintChips(st); writeFilterState(st); onChange(c.hasAttribute("data-reset-filter"));
    });
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
    var all = splitActive(visibleEntries(data)).active;
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
    var filt = readFilterState(), pos = 0;

    function slide(e, i, arr) {
      return '<div class="slide" role="group" aria-roledescription="Folie" aria-label="' + (i + 1) + " von " + arr.length + '">' +
        '<button type="button" class="news-card has-media" data-id="' + esc(e.id) + '" id="card-' + esc(e.id) + '" aria-haspopup="dialog" title="' + esc(e.titel) + '">' +
        cardInner(e, true, i < 3) + "</button></div>";
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
    var detail = makeModal(byId, {
      onOpen: function () { paused.modal = true; restart(); },
      onClose: function () { paused.modal = false; restart(); }
    });
    track.addEventListener("click", function (ev) {
      var c = ev.target.closest(".news-card");
      if (c) detail.open(c.getAttribute("data-id"));
    });

    // ---- Filter ----
    bindFilterChips(filt, function (wasReset) {
      draw();
      if (wasReset) { var f = document.querySelector('[data-group="art"][data-filter="alle"]'); if (f) f.focus(); }
    });

    function draw() {
      var shown = all.filter(function (e) { return matchesFilter(e, filt); });
      track.innerHTML = shown.length ? shown.map(slide).join("") : emptyHtml(filt, " in den letzten 7 Tagen – ältere Meldungen findest du im <a href=\"archiv.html\">Archiv</a>");
      carousel.classList.toggle("is-empty", !shown.length);
      var cnt = document.getElementById("news-count");
      if (cnt) cnt.textContent = shown.length === all.length ? all.length + " Einträge" : shown.length + " von " + all.length + " Einträgen";
      dotsBox.innerHTML = "";
      track.scrollTo({ left: 0, behavior: "instant" });
      pos = 0; paintDots(); restart();
    }
    draw();

    // Direktlink index.html#<id> öffnet die Meldung; ältere Meldungen liegen im Archiv
    var hash = decodeURIComponent((location.hash || "").slice(1));
    if (hash && byId[hash]) {
      var card = document.getElementById("card-" + hash);
      if (card) {
        var idx = Array.prototype.indexOf.call(slides(), card.parentNode);
        goTo(Math.min(idx, positions() - 1));
      }
      detail.open(hash);
    } else if (/^\d{4}-\d{2}-\d{2}-[\w-]+$/.test(hash)) {
      location.replace("archiv.html#" + encodeURIComponent(hash));
    }
  }

  // ---------------- Archiv (archiv.html) ----------------
  var archBox = document.getElementById("archive-list");
  if (archBox) {
    Promise.all([
      loadJson("data/archive.json", "MTEC_ARCHIVE").catch(function () { return { eintraege: [] }; }),
      loadJson("data/news.json", "MTEC_NEWS").catch(function () { return { eintraege: [] }; })
    ]).then(function (r) { renderArchive(r[0], r[1]); }).catch(function (e) {
      archBox.innerHTML = '<p class="empty">Archiv konnte nicht geladen werden (' + esc(e.message) + ").</p>";
    });
  }

  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  var MONTH = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", month: "long", year: "numeric" });
  var MONTH_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit" });

  function renderArchive(arch, news) {
    // Archiv = archive.json + Ticker-Einträge, die nach der 7-Tage-Regel nicht mehr im Ticker stehen
    var seen = {}, list = [];
    visibleEntries(arch).concat(splitActive(visibleEntries(news)).old).forEach(function (e) {
      if (!seen[e.id]) { seen[e.id] = 1; list.push(e); }
    });
    list.sort(byDateDesc);
    var byId = {};
    list.forEach(function (e) { byId[e.id] = e; e._q = norm([e.titel, e.schlagzeile, e.kurz, e.zusammenfassung, e.kategorie, e.quelle && e.quelle.name, (e.tags || []).join(" "), (e.themen || []).join(" "), areaName(e)].join(" ")); });

    var filt = readFilterState(), query = "";
    var input = document.getElementById("archive-search");
    var cnt = document.getElementById("archive-count");
    var detail = makeModal(byId, { archived: true });

    function draw() {
      var words = norm(query).split(/\s+/).filter(Boolean);
      var shown = list.filter(function (e) {
        return matchesFilter(e, filt) && words.every(function (w) { return e._q.indexOf(w) !== -1; });
      });
      if (cnt) cnt.textContent = shown.length === list.length ? list.length + " Einträge im Archiv" : shown.length + " von " + list.length + " Einträgen";
      if (!list.length) { archBox.innerHTML = '<p class="empty">Das Archiv ist noch leer. Meldungen wandern nach 7 Tagen hierher.</p>'; return; }
      if (!shown.length) { archBox.innerHTML = emptyHtml(filt, query.trim() ? " zur Suche „" + esc(query.trim()) + "“" : ""); return; }
      var h = "", lastKey = null;
      shown.forEach(function (e) {
        var d = new Date(e.datum), key = MONTH_KEY.format(d);
        if (key !== lastKey) {
          if (lastKey) h += "</div></section>";
          h += '<section class="arch-month" aria-label="' + esc(MONTH.format(d)) + '"><h2>' + esc(MONTH.format(d)) + '</h2><div class="arch-grid">';
          lastKey = key;
        }
        h += '<button type="button" class="news-card arch-card" data-id="' + esc(e.id) + '" aria-haspopup="dialog">' + cardInner(e, false) + "</button>";
      });
      archBox.innerHTML = h + "</div></section>";
    }

    bindFilterChips(filt, function (wasReset) {
      if (wasReset && input) { input.value = ""; query = ""; }
      draw();
      if (wasReset) { var f = document.querySelector('[data-group="art"][data-filter="alle"]'); if (f) f.focus(); }
    });
    if (input) input.addEventListener("input", function () { query = input.value; draw(); });
    archBox.addEventListener("click", function (ev) {
      var c = ev.target.closest(".arch-card");
      if (c) detail.open(c.getAttribute("data-id"));
    });
    draw();
    var hash = decodeURIComponent((location.hash || "").slice(1));
    if (hash && byId[hash]) detail.open(hash);
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

/* Startseite: neuestes YouTube-Video aus data/latest-video.json (erzeugt von scripts/update-latest-video.mjs).
   Vorschaubild liegt lokal; YouTube wird erst per Klick auf den Link geöffnet. */
(function () {
  var box = document.getElementById("latest-video");
  if (!box) return;
  var p = (location.protocol === "file:" && window.MTEC_LATEST_VIDEO)
    ? Promise.resolve(window.MTEC_LATEST_VIDEO)
    : fetch("data/latest-video.json", { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .catch(function () { return window.MTEC_LATEST_VIDEO || null; });
  p.then(function (v) {
    if (!v || !/^[\w-]{11}$/.test(v.video_id || "") || !/^assets\/img\/youtube\/[\w-]+\.(webp|jpg)$/.test(v.thumbnail || "")) return;
    var link = "https://www.youtube.com/watch?v=" + v.video_id;
    var day = v.veroeffentlicht;
    try { day = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v.veroeffentlicht)); } catch (e) {}
    var img = document.getElementById("lv-img");
    img.src = v.thumbnail;
    img.alt = "Vorschaubild des Videos „" + v.titel + "“";
    document.getElementById("lv-title").textContent = v.titel;
    document.getElementById("lv-meta").textContent = "Veröffentlicht am " + day + " · M-TEC auf YouTube";
    document.getElementById("lv-link").href = link;
    var th = document.getElementById("lv-thumb");
    th.href = link;
    th.setAttribute("aria-label", "„" + v.titel + "“ auf YouTube ansehen (öffnet YouTube)");
    box.hidden = false;
  }).catch(function () {});
})();
