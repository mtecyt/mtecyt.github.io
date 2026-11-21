/**
 * Stimmen-Adapter für den News-Ticker (HTTP zum Cloudflare Worker).
 * Speichert im Browser nur, welche IDs dieses Gerät bereits unterstützt hat.
 */
(function (w) {
  "use strict";
  var KEY_VOTED = "mtec-hot-voted";
  var CFG = w.MTEC_HOT_CONFIG || { mode: "http", endpoint: "https://mtec-hot-news.mtec-hot.workers.dev" };

  function readJson(key, fallback) {
    try {
      var raw = w.localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJson(key, val) {
    try { w.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function votedSet() {
    var v = readJson(KEY_VOTED, []);
    return v instanceof Array ? v : [];
  }
  function hasVoted(id) { return votedSet().indexOf(id) !== -1; }
  function setVoted(id, on) {
    var s = votedSet().filter(function (x) { return x !== id; });
    if (on) s.push(id);
    writeJson(KEY_VOTED, s);
  }

  async function http(path, body) {
    var url = String(CFG.endpoint || "").replace(/\/$/, "") + path;
    var opt = { method: body ? "POST" : "GET", headers: { "Accept": "application/json" } };
    if (body) {
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    var res = await fetch(url, opt);
    if (!res.ok) throw new Error("hot-votes HTTP " + res.status);
    return res.json();
  }

  function zeros(ids) {
    var out = {};
    (ids || []).forEach(function (id) { out[id] = 0; });
    return out;
  }

  var api = {
    mode: function () { return CFG.mode || "http"; },
    hasVoted: hasVoted,
    getCounts: async function (ids) {
      ids = ids || [];
      if (CFG.mode === "http" && CFG.endpoint) {
        try {
          var q = ids.length ? ("/votes?ids=" + encodeURIComponent(ids.join(","))) : "/votes";
          var data = await http(q);
          var map = (data && data.counts) || data || {};
          var out = {};
          ids.forEach(function (id) { out[id] = Math.max(0, +map[id] || 0); });
          return out;
        } catch (e) {
          console.warn("HotVotes: Backend nicht erreichbar.", e && e.message);
        }
      }
      return zeros(ids);
    },
    vote: async function (id) {
      var already = hasVoted(id);
      var delta = already ? -1 : 1;
      var data = await http("/votes", { id: id, delta: delta });
      setVoted(id, !already);
      return { id: id, count: Math.max(0, +data.count || 0), voted: !already };
    }
  };

  w.HotVotes = api;
})(window);
