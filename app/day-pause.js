/* Tagespausen sind bewusst unabhängig von Auftrags-Pausen. Classic script + CommonJS. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StundenzettelDayPause = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function minute(value) { const time = String(value || '').includes('T') ? String(value).split('T')[1] : String(value || ''); const [h, m] = time.split(':').map(Number); return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null; }
  function span(start, end) { const a = minute(start), b = minute(end); if (a == null || b == null) return 0; return b >= a ? b - a : b + 1440 - a; }
  function list(day) { if (!Array.isArray(day.dayPauses)) day.dayPauses = []; return day.dayPauses; }
  function hasOpen(day) { const entries = list(day); return Boolean(entries.length && !entries[entries.length - 1].end); }
  function start(day, at, source) { if (!minute(at) && minute(at) !== 0) throw new TypeError('Ungültiger Pausenbeginn'); if (hasOpen(day)) throw new Error('Eine Tagespause läuft bereits.'); list(day).push({ start: at, end: '', source: source || 'manual' }); return day; }
  function end(day, at, source) { if (!minute(at) && minute(at) !== 0) throw new TypeError('Ungültiges Pausenende'); const entries = list(day); const open = entries[entries.length - 1]; if (!open || open.end) throw new Error('Keine laufende Tagespause.'); open.end = at; if (source) open.source = source; return day; }
  function minutes(day, liveNow) { return list(day).reduce((sum, entry) => sum + span(entry.start, entry.end || liveNow), 0); }
  return Object.freeze({ start, end, minutes, hasOpen });
});
