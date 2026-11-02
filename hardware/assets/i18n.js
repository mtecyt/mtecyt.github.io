/* M-TEC – Sprachauswahl & Übersetzung (ohne Abhängigkeiten).
   Wird synchron im <head> geladen (klein), damit die Seite in der gewählten Sprache erscheint, ohne erst Deutsch zu zeigen.

   DATENSCHUTZ: Die Sprache steht NUR in der Adresse (?lang=en). Es werden keine Cookies, kein localStorage,
   kein sessionStorage und keine sonstigen Daten im Browser gespeichert. Die Browsersprache (navigator.languages)
   wird nur lokal gelesen, um einen dezenten Vorschlag anzuzeigen – sie wird nicht gesendet und nichts wird
   automatisch umgestellt. Interne Links bekommen ?lang=… angehängt, damit die Auswahl beim Weiterklicken bleibt.

   Deutsch ist die Originalsprache. Übersetzungen: assets/i18n/<lang>.js (Oberfläche + statische Seiten, siehe
   scripts/i18n-pages.py) und data/i18n/<lang>.js (Ticker-/Archiv-Einträge, siehe scripts/update-news.mjs). */
(function () {
  "use strict";
  var svg = function (b) { return '<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true" focusable="false">' + b + "</svg>"; };
  var h3 = function (a, b, c) { return svg('<rect width="30" height="20" fill="' + c + '"/><rect width="30" height="13.34" fill="' + b + '"/><rect width="30" height="6.67" fill="' + a + '"/>'); };
  var v3 = function (a, b, c) { return svg('<rect width="30" height="20" fill="' + b + '"/><rect width="10" height="20" fill="' + a + '"/><rect x="20" width="10" height="20" fill="' + c + '"/>'); };
  // Flaggen 1:1 aus GPU Tycoon (src/i18n/languages.ts, FLAGS) – SVG statt Emoji, weil Emoji-Flaggen unter Windows nicht dargestellt werden
  var FLAGS = {
    de: h3("#000", "#dd0000", "#ffce00"),
    gb: svg('<clipPath id="fgb"><rect width="30" height="20"/></clipPath><g clip-path="url(#fgb)"><rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6.5"/><path d="M15 0V20M0 10H30" stroke="#c8102e" stroke-width="3.6"/></g>'),
    es: svg('<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="7" y="7.5" width="3.2" height="5" rx=".6" fill="#aa151b" opacity=".75"/>'),
    br: svg('<rect width="30" height="20" fill="#009c3b"/><path d="M15 2.2L27.6 10L15 17.8L2.4 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.6 9.1Q15 7.9 19.4 10.9" stroke="#fff" stroke-width=".9" fill="none"/>'),
    fr: v3("#002395", "#fff", "#ed2939"),
    pl: svg('<rect width="30" height="20" fill="#dc143c"/><rect width="30" height="10" fill="#fff"/>'),
    bg: h3("#fff", "#00966e", "#d62612"),
    tr: svg('<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/><path d="M15.6 10l3.9-1.27-2.41 3.32V7.95l2.41 3.32z" fill="#fff"/>'),
    it: v3("#009246", "#fff", "#ce2b37")
  };
  // Reihenfolge wie im Spiel GPU Tycoon. suggest = [Vorschlagstext, Knopf, "bei Deutsch bleiben"] in der jeweiligen Sprache.
  var LANGS = [
    { code: "de", name: "Deutsch", short: "DE", locale: "de-AT", flag: "de" },
    { code: "en", name: "English", short: "EN", locale: "en-GB", flag: "gb", suggest: ["This site is also available in English (AI-translated).", "Switch to English", "Stay in German"] },
    { code: "es", name: "Español", short: "ES", locale: "es-ES", flag: "es", suggest: ["Esta web también está disponible en español (traducción con IA).", "Cambiar a español", "Seguir en alemán"] },
    { code: "pt-BR", name: "Português (Brasil)", short: "PT", locale: "pt-BR", flag: "br", suggest: ["Este site também está disponível em português (tradução por IA).", "Mudar para português", "Continuar em alemão"] },
    { code: "fr", name: "Français", short: "FR", locale: "fr-FR", flag: "fr", suggest: ["Ce site est aussi disponible en français (traduction par IA).", "Passer au français", "Rester en allemand"] },
    { code: "pl", name: "Polski", short: "PL", locale: "pl-PL", flag: "pl", suggest: ["Ta strona jest dostępna także po polsku (tłumaczenie AI).", "Przełącz na polski", "Zostań przy niemieckim"] },
    { code: "bg", name: "Български", short: "BG", locale: "bg-BG", flag: "bg", suggest: ["Сайтът е достъпен и на български (превод с ИИ).", "Към български", "Остани на немски"] },
    { code: "tr", name: "Türkçe", short: "TR", locale: "tr-TR", flag: "tr", suggest: ["Bu site Türkçe olarak da mevcut (yapay zekâ çevirisi).", "Türkçeye geç", "Almanca kal"] },
    { code: "it", name: "Italiano", short: "IT", locale: "it-IT", flag: "it", suggest: ["Questo sito è disponibile anche in italiano (traduzione IA).", "Passa all’italiano", "Resta in tedesco"] }
  ];
  function find(code) {
    if (!code) return null;
    var c = String(code).toLowerCase();
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code.toLowerCase() === c) return LANGS[i];
    c = c.split(/[-_]/)[0];   // "pt", "pt-pt", "en-US", "de-AT" …
    for (i = 0; i < LANGS.length; i++) if (LANGS[i].code.toLowerCase().split("-")[0] === c) return LANGS[i];
    return null;
  }

  // Oberflächentexte – deutsches Original. Schlüssel gleich in assets/i18n/<lang>.json → "ui".
  // {n} usw. sind Platzhalter. Schlüssel mit _one/_few/_many/_other = Mehrzahlformen (Intl.PluralRules).
  var UI_DE = /*UI_DE*/{
  "lang_label": "Sprache",
  "lang_button": "Sprache wählen, aktuell: {name}",
  "lang_note": "Original: Deutsch · andere Sprachen KI-übersetzt",
  "legal_note": "Rechtlich verbindlich ist ausschließlich die deutsche Fassung dieser Seite.",
  "ai_page_note": "Original: Deutsch.",
  "ai_translated": "KI-übersetzt aus dem Deutschen.",
  "show_original": "Original auf Deutsch",
  "not_translated": "Diese Meldung ist noch nicht übersetzt und wird im deutschen Original angezeigt.",
  "sources_german_only": "Die Beschreibungen der einzelnen Quellen (Typ, Status, Bilanz, Vorsicht) gibt es nur auf Deutsch.",
  "time_suffix": "Uhr (Wien)",
  "area_hardware": "Hardware",
  "area_software": "Software",
  "area_games": "Games",
  "label_News": "News",
  "label_Leak": "Leak",
  "filter_News": "News",
  "filter_Leak": "Leaks",
  "reliability": "Zuverlässigkeit: {stufe}",
  "reliability_title": "Unsere Einschätzung der Quelle – unbestätigt",
  "level_hoch": "hoch",
  "level_mittel-hoch": "mittel-hoch",
  "level_mittel": "mittel",
  "level_niedrig-mittel": "niedrig-mittel",
  "level_niedrig": "niedrig",
  "level_unklar": "unklar",
  "level_unbekannt": "unbekannt",
  "level_nicht nutzbar": "nicht nutzbar",
  "area_title": "Bereich: {name}",
  "draft": "Entwurf",
  "draft_title": "Noch nicht freigegeben",
  "draft_note": "Entwurf – noch nicht von der Redaktion freigegeben. KI-gestützt zusammengefasst.",
  "ai_image": "KI-generiertes Bild",
  "ai_image_long": "KI-generiertes Bild (Symbolbild, zeigt keine echten Produkte)",
  "more": "Mehr",
  "archive_tag": "Archiv",
  "leak_unconfirmed": "Leak – unbestätigt.",
  "read_more": "Weiterlesen",
  "show_less": "Weniger anzeigen",
  "full_report": "Der ganze Bericht",
  "source": "Quelle:",
  "origin": "Ursprung:",
  "more_links": "Weitere Links:",
  "note": "Hinweis:",
  "no_entries": "Keine Einträge",
  "no_entries_for": "Keine Einträge für {filter}",
  "empty_ticker_extra": " in den letzten 7 Tagen – ältere Meldungen findest du im {archiv}",
  "archive_link": "Archiv",
  "empty_search_extra": " zur Suche „{q}“",
  "reset_filter": "Filter zurücksetzen",
  "ticker_error": "Ticker konnte nicht geladen werden ({err}).",
  "archive_error": "Archiv konnte nicht geladen werden ({err}).",
  "preview_drafts": "Vorschau-Modus: {d} von {n} Einträgen sind Entwürfe und warten auf Freigabe durch M-TEC. Vor dem Veröffentlichen modus auf \"live\" stellen.",
  "preview_all": "Vorschau-Modus: alle {n} Einträge sind von M-TEC freigegeben. Vor dem Veröffentlichen modus auf \"live\" stellen.",
  "slide": "Folie",
  "slide_label": "{i} von {n}",
  "dot_label": "Position {i}",
  "count_all_one": "{n} Eintrag",
  "count_all_other": "{n} Einträge",
  "count_some": "{shown} von {n} Einträgen",
  "archive_count_one": "{n} Eintrag im Archiv",
  "archive_count_other": "{n} Einträge im Archiv",
  "archive_empty": "Das Archiv ist noch leer. Meldungen wandern nach 7 Tagen hierher.",
  "visits_one": "{n} Besucher",
  "visits_other": "{n} Besucher",
  "visits_title": "Besuche insgesamt, gezählt mit GoatCounter (ohne Cookies) – siehe Datenschutz",
  "video_alt": "Vorschaubild des Videos „{t}“",
  "video_meta": "Veröffentlicht am {d} · M-TEC auf YouTube",
  "video_aria": "„{t}“ auf YouTube ansehen (öffnet YouTube)",
  "src_rating": "Bewertung: {b}",
  "src_language": "Sprache: {s}",
  "src_caution": "Vorsicht:",
  "src_wish": "von {n} gewünscht",
  "cat_Gebraucht-Hardware": "Gebraucht-Hardware",
  "cat_Hardware-Geschichte": "Hardware-Geschichte",
  "cat_Tools & Mods": "Tools & Mods",
  "cat_Speicher & Markt": "Speicher & Markt",
  "cat_Linux & Sicherheit": "Linux & Sicherheit",
  "cat_Windows": "Windows",
  "cat_CPU": "CPU",
  "cat_GPU": "GPU",
  "cat_Games": "Games",
  "cat_GPU & Markt": "GPU & Markt",
  "cat_CPU & Fertigung": "CPU & Fertigung",
  "cat_Hersteller": "Hersteller",
  "cat_Speicher": "Speicher",
  "rating_hoch": "hoch",
  "rating_mittel-hoch": "mittel-hoch",
  "rating_hoch (für Produkt-Existenz)": "hoch (für Produkt-Existenz)",
  "rating_mittel (abhängig von der Ursprungsquelle)": "mittel (abhängig von der Ursprungsquelle)",
  "rating_mittel": "mittel",
  "rating_unklar / mittel": "unklar / mittel",
  "rating_niedrig-mittel": "niedrig-mittel",
  "rating_mittel (stark schwankend)": "mittel (stark schwankend)",
  "rating_nicht nutzbar": "nicht nutzbar",
  "rating_hoch (für technische IDs)": "hoch (für technische IDs)",
  "rating_hoch (als Nachrichtenquelle)": "hoch (als Nachrichtenquelle)",
  "rating_hoch (für Einordnung)": "hoch (für Einordnung)",
  "rating_hoch (offiziell)": "hoch (offiziell)",
  "rating_hoch (für Build-Funde)": "hoch (für Build-Funde)",
  "rating_hoch (für Releases)": "hoch (für Releases)",
  "rating_hoch (für Preise/PS-Plus-Listen)": "hoch (für Preise/PS-Plus-Listen)",
  "rating_niedrig (keine Leak-Quelle)": "niedrig (keine Leak-Quelle)"
}/*END_UI_DE*/;

  // ---- Sprache bestimmen: nur ?lang=… (Standard: Deutsch) ----
  var params; try { params = new URLSearchParams(location.search); } catch (e) { params = { get: function () { return null; } }; }
  var asked = params.get("lang");
  var L = find(asked) || LANGS[0];
  var explicit = !!find(asked);
  var root = document.documentElement;
  root.lang = L.code;
  var me = document.currentScript;
  var V = (me && /[?&]v=([\w.-]+)/.exec(me.src || "") || [])[1] || "";
  function vurl(u) { return V ? u + (u.indexOf("?") < 0 ? "?" : "&") + "v=" + V : u; }

  var dict = { ui: {}, seiten: {} };
  function loadScript(src, globalName) {
    return new Promise(function (res) {
      if (window[globalName]) return res(window[globalName]);
      var s = document.createElement("script");
      s.src = vurl(src); s.async = false;
      s.onload = function () { res(window[globalName] || null); };
      s.onerror = function () { res(null); };
      (document.head || root).appendChild(s);
    });
  }
  var dictReady = L.code === "de" ? Promise.resolve(null) : (root.classList.add("i18n-wait"), loadScript("assets/i18n/" + L.code + ".js", "MTEC_I18N"));
  var failSafe = setTimeout(function () { root.classList.remove("i18n-wait"); }, 2500);
  var newsP = null;

  function t(key, vars) {
    var s = (dict.ui && dict.ui[key] != null && dict.ui[key] !== "") ? dict.ui[key] : UI_DE[key];
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }
  var pr = null; try { pr = new Intl.PluralRules(L.locale); } catch (e) {}
  function tn(key, n, vars) {
    var cat = pr ? pr.select(n) : (n === 1 ? "one" : "other");
    var k = key + "_" + cat;
    var src = (dict.ui && dict.ui[k]) || UI_DE[k] ? k : key + "_other";
    vars = vars || {}; vars.n = vars.n != null ? vars.n : n.toLocaleString(L.locale);
    return t(src, vars);
  }
  function withLang(href, code) {
    code = code || (explicit ? L.code : null);
    if (!code) return href;
    if (!href || /^(https?:|mailto:|tel:|javascript:|data:)/i.test(href) || href.charAt(0) === "#") return href;
    var m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href);
    var path = m[1] || "", q = (m[2] || "").replace(/^\?/, ""), hash = m[3] || "";
    if (path && !/(\.html|\/)$/.test(path)) return href;   // nur eigene Seiten, keine Bilder/Dateien
    var parts = q ? q.split("&").filter(function (p) { return p && !/^lang=/.test(p); }) : [];
    parts.push("lang=" + encodeURIComponent(code));
    return path + "?" + parts.join("&") + hash;
  }
  function decode(s) { var ta = document.createElement("textarea"); ta.innerHTML = s; return ta.value; }

  var flagN = 0;
  function flag(l) { var n = ++flagN; return '<span class="flag">' + FLAGS[l.flag].replace(/fgb/g, "fgb" + n) + "</span>"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hrefFor(l) {
    var q = new URLSearchParams(location.search); q.set("lang", l.code);
    return location.pathname + "?" + q.toString() + location.hash;
  }

  // ---- Seite übersetzen ----
  function applyPage() {
    var S = dict.seiten || {};
    if (L.code !== "de") {
      Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
        var v = S[el.getAttribute("data-i18n")];
        if (v == null) { el.setAttribute("lang", "de"); return; }   // fehlt -> Deutsch, korrekt ausgezeichnet
        if (el.tagName === "TITLE") document.title = decode(v); else el.innerHTML = v;
      });
      Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-attr]"), function (el) {
        el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
          var i = pair.indexOf(":"), a = pair.slice(0, i), v = S[pair.slice(i + 1)];
          if (a && v != null) el.setAttribute(a, decode(v));
        });
      });
    }
    // Links: gewählte Sprache mitnehmen (nur wenn ?lang=… gesetzt ist)
    if (explicit) Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
      if (a.closest(".lang-menu")) return;
      var h = a.getAttribute("href"); var n = withLang(h); if (n !== h) a.setAttribute("href", n);
    });
    renderSwitch();
    if (L.code !== "de") {
      var legal = document.querySelector(".legal");
      if (legal) {
        var note = document.createElement("p");
        note.className = "legal-note"; note.setAttribute("role", "note"); note.lang = L.code;
        note.textContent = t("legal_note");
        legal.parentNode.insertBefore(note, legal);
      }
      var foot = document.querySelector(".site-footer .wrap");
      if (foot) {
        var d = document.createElement("div"); d.className = "i18n-foot"; d.style.flexBasis = "100%";
        d.innerHTML = esc(t("ai_translated")) + " " + esc(t("ai_page_note")) + ' <a href="' + esc(hrefFor(LANGS[0])) + '" hreflang="de" lang="de">Deutsch</a>';
        foot.appendChild(d);
      }
    } else if (!explicit) suggest();
  }

  // ---- Auswahlfeld (Disclosure-Muster: Knopf + Liste von Links; Tastatur: Enter/Leertaste/↓ öffnet, ↑/↓/Pos1/Ende, Esc schließt) ----
  function renderSwitch() {
    var box = document.getElementById("lang-switch");
    if (!box || box.firstChild) return;
    var h = '<button type="button" class="lang-btn" id="lang-btn" aria-expanded="false" aria-controls="lang-menu" aria-label="' + esc(t("lang_button", { name: L.name })) + '">' +
      flag(L) + '<span class="lang-code">' + L.short + '</span><span class="chev" aria-hidden="true"></span></button>' +
      '<div class="lang-menu" id="lang-menu" hidden><p class="lang-head" id="lang-head">' + esc(t("lang_label")) + '</p><ul aria-labelledby="lang-head">';
    LANGS.forEach(function (l) {
      h += '<li><a href="' + esc(hrefFor(l)) + '" hreflang="' + l.code + '" lang="' + l.code + '"' + (l === L ? ' aria-current="true"' : "") + ">" +
        flag(l) + '<span class="lang-name">' + esc(l.name) + "</span>" + (l === L ? '<span class="check" aria-hidden="true">✓</span>' : "") + "</a></li>";
    });
    h += '</ul><p class="lang-foot">' + esc(t("lang_note")) + "</p></div>";
    box.innerHTML = h;
    var btn = box.querySelector(".lang-btn"), menu = box.querySelector(".lang-menu");
    var links = function () { return Array.prototype.slice.call(menu.querySelectorAll("a")); };
    function setOpen(open, focusWhat) {
      menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); box.classList.toggle("open", open);
      if (open && focusWhat) { var ls = links(); var cur = menu.querySelector('[aria-current="true"]'); (focusWhat === "last" ? ls[ls.length - 1] : cur || ls[0]).focus(); }
      if (!open && focusWhat === "btn") btn.focus();
    }
    btn.addEventListener("click", function () { setOpen(menu.hidden, null); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true, "current"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setOpen(true, "last"); }
    });
    menu.addEventListener("keydown", function (e) {
      var ls = links(), i = ls.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); setOpen(false, "btn"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); ls[(i + 1) % ls.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); ls[(i - 1 + ls.length) % ls.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); ls[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); ls[ls.length - 1].focus(); }
    });
    box.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { e.preventDefault(); setOpen(false, "btn"); } });
    box.addEventListener("focusout", function (e) { if (!menu.hidden && e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false); });
    document.addEventListener("click", function (e) { if (!menu.hidden && !box.contains(e.target)) setOpen(false); });
    // Klick auf eine Sprache: Adresse aktuell halten (Filter/Anker können sich seit dem Rendern geändert haben)
    menu.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[hreflang]");
      if (a) { var l = find(a.getAttribute("hreflang")); if (l) a.setAttribute("href", hrefFor(l)); }
    });
  }

  // ---- Vorschlag nach Browsersprache (nur Anzeige, nichts wird umgestellt oder gespeichert) ----
  function suggest() {
    var pref = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]);
    var first = find(pref[0]);
    if (!first || first.code === "de" || !first.suggest) return;
    var hdr = document.querySelector(".site-header");
    if (!hdr) return;
    var bar = document.createElement("div");
    bar.className = "lang-suggest"; bar.lang = first.code; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", first.name);
    bar.innerHTML = '<div class="wrap">' + flag(first) + "<span>" + esc(first.suggest[0]) + '</span><a class="ls-go" hreflang="' + first.code + '" href="' + esc(hrefFor(first)) + '">' + esc(first.suggest[1]) + '</a><button type="button" class="ls-stay">' + esc(first.suggest[2]) + "</button></div>";
    hdr.parentNode.insertBefore(bar, hdr.nextSibling);
    bar.querySelector(".ls-stay").addEventListener("click", function () {
      // "Bei Deutsch bleiben": ?lang=de in die Adresse, damit der Vorschlag auf den nächsten Seiten nicht wiederkommt
      explicit = true;
      try { var q = new URLSearchParams(location.search); q.set("lang", "de"); history.replaceState(null, "", location.pathname + "?" + q + location.hash); } catch (e) {}
      Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) { if (!a.closest(".lang-menu")) { var h = a.getAttribute("href"); a.setAttribute("href", withLang(h)); } });
      bar.remove();
    });
  }

  // Dynamisch eingefügte Links (Karten, Leer-Hinweise) beim Klick ebenfalls mit ?lang= versehen
  document.addEventListener("click", function (e) {
    if (!explicit) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (a && !a.closest(".lang-menu")) { var h = a.getAttribute("href"), n = withLang(h); if (n !== h) a.setAttribute("href", n); }
  }, true);

  // ---- Kopfzeile passend machen: passt sie nicht (lange Menüwörter + Sprachauswahl), erst den Untertitel
  //      der Marke ausblenden (hdr-compact), dann aufs Menü-Symbol umschalten (hdr-burger). Gemessen, nicht geraten. ----
  function fitHeader() {
    var w = document.querySelector(".site-header .wrap"); if (!w) return;
    var steps = ["hdr-compact", "hdr-tight", "hdr-burger"];
    root.classList.remove.apply(root.classList, steps);
    var over = function () { return w.scrollWidth > w.clientWidth; };
    for (var i = 0; i < steps.length && over(); i++) root.classList.add(steps[i]);
  }
  var fitT = 0;
  function fitSoon() { clearTimeout(fitT); fitT = setTimeout(fitHeader, 50); }
  window.addEventListener("resize", fitSoon);
  if (document.fonts) { if (document.fonts.ready) document.fonts.ready.then(fitSoon); if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", fitSoon); }
  function watchHeader() {   // Schrift nachgeladen / Text geändert -> neu messen
    var n = document.querySelector(".site-header .nav"), br = document.querySelector(".site-header .brand b");
    if (window.ResizeObserver && n && br) { var ro = new ResizeObserver(fitSoon); [].forEach.call(n.children, function (a) { ro.observe(a); }); ro.observe(br); }
  }

  var ready = new Promise(function (res) {
    dictReady.then(function (d) {
      if (d) dict = d;
      function go() { try { applyPage(); fitHeader(); watchHeader(); } finally { clearTimeout(failSafe); root.classList.remove("i18n-wait"); res(); } }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
    });
  });

  window.MTEC_LANG = {
    code: L.code, locale: L.locale, name: L.name, isDe: L.code === "de", explicit: function () { return explicit; },
    t: t, tn: tn, withLang: withLang, ready: ready, version: V, vurl: vurl, langs: LANGS,
    // Übersetzungen der Ticker-/Archiv-Einträge (nur Seiten, die sie brauchen, laden sie nach)
    news: function () {
      if (L.code === "de") return Promise.resolve(null);
      return newsP || (newsP = loadScript("data/i18n/" + L.code + ".js", "MTEC_NEWS_I18N"));
    }
  };
})();
