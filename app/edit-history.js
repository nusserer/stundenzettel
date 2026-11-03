/* Kurzlebiger Verlauf manueller Tagesänderungen; niemals in der Datendatei gespeichert. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StundenzettelEditHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  function capture(record, fields) {
    const result = {};
    for (const field of fields) result[field] = Object.hasOwn(record, field)
      ? { exists: true, value: clone(record[field] === undefined ? null : record[field]) }
      : { exists: false };
    return result;
  }
  function createHistory(limit = 20) {
    const entries = [];
    return {
      get length() { return entries.length; },
      peek() { return entries.length ? clone(entries[entries.length - 1]) : null; },
      clear() { entries.length = 0; },
      recordBatch(entry) {
        const items = entry.items.filter(item => JSON.stringify(item.before) !== JSON.stringify(item.after));
        if (!items.length) return false;
        entries.push(clone({ ...entry, items, batch: true }));
        while (entries.length > limit) entries.shift();
        return true;
      },
      undoBatch(resolve) {
        const entry = entries[entries.length - 1];
        if (!entry || !entry.batch) return { ok: false, reason: 'empty' };
        const resolved = entry.items.map(item => ({ item, target: resolve(item) }));
        if (resolved.some(x => !x.target)) return { ok: false, reason: 'unavailable' };
        if (resolved.some(x => JSON.stringify(capture(x.target, Object.keys(x.item.after))) !== JSON.stringify(x.item.after))) {
          return { ok: false, reason: 'changed' };
        }
        for (const { item, target } of resolved) {
          for (const [field, old] of Object.entries(item.before)) {
            if (old.exists) target[field] = clone(old.value);
            else delete target[field];
          }
        }
        entries.pop();
        return { ok: true, entry: clone(entry) };
      },
      record(entry) {
        if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) return false;
        entries.push(clone(entry));
        while (entries.length > limit) entries.shift();
        return true;
      },
      undo(resolve) {
        const entry = entries[entries.length - 1];
        if (!entry) return { ok: false, reason: 'empty' };
        const target = resolve(entry);
        if (!target) return { ok: false, reason: 'unavailable' };
        if (JSON.stringify(capture(target, Object.keys(entry.after))) !== JSON.stringify(entry.after)) {
          return { ok: false, reason: 'changed' };
        }
        for (const [field, old] of Object.entries(entry.before)) {
          if (old.exists) target[field] = clone(old.value);
          else delete target[field];
        }
        entries.pop();
        return { ok: true, entry: clone(entry) };
      }
    };
  }
  return Object.freeze({ capture, createHistory });
});
