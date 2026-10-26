/* Tagespausen sind bewusst unabhängig von Auftrags-Pausen. Classic script + CommonJS. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StundenzettelDayPause = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function minute(value) {
    if (String(value || '').includes('T')) {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.getHours() * 60 + date.getMinutes() : null;
    }
    if (!/^\d{2}:[0-5]\d$/.test(value || '')) return null;
    const [h, m] = value.split(':').map(Number);
    return h < 24 ? h * 60 + m : null;
  }
  function span(start, end) {
    if (String(start || '').includes('T') && String(end || '').includes('T')) {
      const difference = Math.floor(new Date(end).getTime() / 60000) - Math.floor(new Date(start).getTime() / 60000);
      return Number.isFinite(difference) ? Math.max(0, difference) : 0;
    }
    const a = minute(start), b = minute(end);
    if (a == null || b == null) return 0;
    return b >= a ? b - a : b + 1440 - a;
  }
  function list(day) { if (!Array.isArray(day.dayPauses)) day.dayPauses = []; return day.dayPauses; }
  function hasOpen(day) { const entries = list(day); return Boolean(entries.length && !entries[entries.length - 1].end); }
  function start(day, at, source) { if (!minute(at) && minute(at) !== 0) throw new TypeError('Ungültiger Pausenbeginn'); if (hasOpen(day)) throw new Error('Eine Tagespause läuft bereits.'); list(day).push({ start: at, end: '', source: source || 'manual' }); return day; }
  function end(day, at, source) { if (!minute(at) && minute(at) !== 0) throw new TypeError('Ungültiges Pausenende'); const entries = list(day); const open = entries[entries.length - 1]; if (!open || open.end) throw new Error('Keine laufende Tagespause.'); open.end = at; if (source) open.source = source; return day; }
  function minutes(day, liveNow, options = {}) {
    return list(day).reduce((sum, entry) => sum + (options.excludeScheduled && entry.scheduledBreakId ? 0 : span(entry.start, entry.end || liveNow)), 0);
  }
  return Object.freeze({ start, end, minutes, hasOpen });
});
