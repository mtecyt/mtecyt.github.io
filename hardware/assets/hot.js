/**
 * HOT-NEWS-Leiste (Variante A) und Stimmen-Button je Ticker-Karte.
 * Daten kommen aus assets/hot-votes.js (HTTP-Adapter).
 */
(function (w) {
  "use strict";
  var TOP_N = 5;
  var ctx = { all: [], byId: {}, jumpTo: function () {} };
  var counts = {};
  var ready = false;
  var ICO = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8.2 1.2c.3 1.8-.3 3-1.3 4.1C6 6.3 5.3 7.2 5.3 8.7c0 1.6 1.1 3 2.7 3 1.5 0 2.6-1.1 2.6-2.6 0-.6-.1-1.1-.4-1.7 1.1.7 1.8 1.8 1.8 3.2 0 2.3-1.9 4.1-4.2 4.1S3.6 12.9 3.6 10.6c0-2.5 1.3-4.1 2.7-5.5C7.4 3.9 8 3 8.2 1.2z"/></svg>';

  function I18N() { return w.MTEC_LANG || { t: function (k) { return k; }, tn: function (k, n) { return String(n); }, ready: Promise.resolve() }; }
  function t(key, vars) { return I18N().t(key, vars); }
  function tn(key, n) { return I18N().tn(key, n); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function headline(e) { return (e && (e.schlagzeile || e.titel)) || ""; }

  function topList() {
    var list = (ctx.all || []).map(function (e) {
      return { e: e, n: +counts[e.id] || 0 };
    }).filter(function (x) { return x.n > 0; });
    list.sort(function (a, b) { return b.n - a.n || a.e.id.localeCompare(b.e.id); });
    return list.slice(0, TOP_N);
  }

  function paintHotNews() {
    var el = document.getElementById("hot-news");
    if (!el) return;
    var top = topList();
    var body;
    if (!top.length) {
      body = '<p class="hot-empty">' + esc(t("hot_empty")) + "</p>";
    } else {
      body = "<ol>" + top.map(function (x, i) {
        var e = x.e;
        return '<li><a href="#' + esc(e.id) + '" data-hot-jump="' + esc(e.id) + '" aria-label="' + esc(t("hot_aria_jump", { title: headline(e) })) + '">' +
          '<span class="hot-item-kicker">' + esc(t("hot_rank", { n: i + 1 })) + "</span>" +
          '<span class="hot-item-title">' + esc(headline(e)) + "</span>" +
          '<span class="hot-item-meta">' + esc(tn("hot_votes", x.n)) + "</span>" +
          "</a></li>";
      }).join("") + "</ol>";
    }
    el.hidden = false;
    el.innerHTML = "<h2>" + esc(t("hot_section_a")) + "</h2>" +
      '<p class="hot-lead">' + esc(t("hot_lead_a")) + "</p>" + body;
  }

  function voteButton(id) {
    var e = ctx.byId[id] || { id: id, titel: id, schlagzeile: id };
    var n = +counts[id] || 0;
    var voted = w.HotVotes && w.HotVotes.hasVoted(id);
    var label = voted ? t("hot_voted") : t("hot_vote_a");
    var aria = voted ? t("hot_aria_unvote", { title: headline(e) }) : t("hot_aria_vote", { title: headline(e) });
    return '<button type="button" class="hot-vote" data-hot-id="' + esc(id) + '" aria-pressed="' + (voted ? "true" : "false") + '" aria-label="' + esc(aria) + '">' +
      '<span class="hot-vote-ico">' + ICO + "</span>" +
      '<span class="hot-vote-label">' + esc(label) + "</span>" +
      '<span class="hot-vote-count">' + esc(String(n)) + "</span></button>";
  }

  function paintButtons() {
    var slots = document.querySelectorAll(".hot-vote-slot[data-hot-id]");
    for (var i = 0; i < slots.length; i++) {
      slots[i].innerHTML = voteButton(slots[i].getAttribute("data-hot-id"));
    }
  }

  function paintBadges() {
    var topIds = {};
    topList().forEach(function (x, i) { topIds[x.e.id] = i + 1; });
    var slots = document.querySelectorAll(".hot-badge-slot[data-hot-badge]");
    for (var i = 0; i < slots.length; i++) {
      var id = slots[i].getAttribute("data-hot-badge");
      if (!topIds[id]) { slots[i].innerHTML = ""; continue; }
      var n = +counts[id] || 0;
      slots[i].innerHTML = '<span class="hot-badge">' + esc(t("hot_badge", { n: n })) + "</span>";
    }
  }

  function paint() {
    if (!ready) return;
    paintHotNews();
    paintButtons();
    paintBadges();
  }

  async function refresh() {
    var ids = (ctx.all || []).map(function (e) { return e.id; });
    if (w.HotVotes) {
      try { counts = await w.HotVotes.getCounts(ids) || {}; } catch (e) { counts = counts || {}; }
    }
    paint();
  }

  function bindTicker(opts) {
    ctx = opts || ctx;
    I18N().ready.then(function () { ready = true; return refresh(); });
  }

  document.documentElement.setAttribute("data-hot-variant", "a");

  document.addEventListener("click", function (ev) {
    var jump = ev.target.closest && ev.target.closest("[data-hot-jump]");
    if (jump) {
      ev.preventDefault();
      var jid = jump.getAttribute("data-hot-jump");
      if (ctx.jumpTo) ctx.jumpTo(jid);
      return;
    }
    var btn = ev.target.closest && ev.target.closest("button.hot-vote");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    var id = btn.getAttribute("data-hot-id");
    if (!id || !w.HotVotes) return;
    btn.disabled = true;
    w.HotVotes.vote(id).then(function (res) {
      if (res && res.id) counts[res.id] = res.count;
      paint();
    }).catch(function (err) {
      console.warn("HotVotes:", err && err.message);
      paint();
    });
  });

  I18N().ready.then(function () { ready = true; paint(); });

  w.MTEC_HOT = { bindTicker: bindTicker, paint: paint, refresh: refresh };
})(window);
