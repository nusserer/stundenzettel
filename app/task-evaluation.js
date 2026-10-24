/* Gemeinsame, lesende Auftragsauswertung. Verändert weder Stempel noch Protokoll. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StundenzettelTaskEvaluation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const keyOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const minutes = ms => Math.max(0, Math.round(ms / 60000));
  function presence(days, now) {
    const out = [];
    for (const [key, day] of Object.entries(days || {})) {
      const [y, m, d] = key.split('-').map(Number);
      const stamps = day.stamps || [];
      for (let i = 0; i < stamps.length; i += 2) {
        if (!/^\d{2}:\d{2}$/.test(stamps[i] || '')) continue;
        const [h, min] = stamps[i].split(':').map(Number);
        if (h > 23 || min > 59) continue;
        const start = new Date(y, m - 1, d, h, min).getTime();
        let stop;
        if (i + 1 < stamps.length) {
          if (!/^\d{2}:\d{2}$/.test(stamps[i + 1] || '')) continue;
          const [eh, em] = stamps[i + 1].split(':').map(Number);
          if (eh > 23 || em > 59) continue;
          const end = new Date(y, m - 1, d, eh, em);
          if (end.getTime() < start) end.setDate(end.getDate() + 1);
          stop = end.getTime();
        } else if (key === keyOf(now)) stop = now.getTime();
        if (Number.isFinite(start) && stop > start) out.push({ key, start, stop });
      }
    }
    return out;
  }
  function evaluate(options) {
    const { logs = [], tasks = [], days = {}, netMinutesForDay } = options;
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const intervals = presence(days, now);
    const records = logs.map((entry, index) => ({ ...entry, id: 'log:' + index }));
    for (const task of tasks) {
      if (task.status === 'in Arbeit' && task.activeSince) records.push({
        id: 'live:' + task.id, taskId: task.id, art: task.kind || 'auftrag', orderNr: task.orderNr,
        start: task.activeSince, stop: now.toISOString()
      });
    }
    const byDayParts = Object.create(null), entries = [], byTask = Object.create(null), byDay = Object.create(null);
    for (const record of records) {
      const start = new Date(record.start).getTime(), stop = new Date(record.stop).getTime();
      const valid = Number.isFinite(start) && Number.isFinite(stop) && stop > start;
      const entry = { ...record, rawMinutes: valid ? minutes(stop - start) : 0, minutes: 0, byDay: {}, clipped: false, overlap: false, estimated: false };
      entries.push(entry);
      let presentMs = 0;
      if (valid) for (const interval of intervals) {
        const a = Math.max(start, interval.start), b = Math.min(stop, interval.stop);
        if (b <= a) continue;
        presentMs += b - a;
        (byDayParts[interval.key] ||= []).push({ entry, start: a, stop: b });
      }
      entry.clipped = valid && presentMs < stop - start;
    }
    for (const [key, parts] of Object.entries(byDayParts)) {
      const groups = new Map();
      for (const part of parts) groups.set(part.entry, (groups.get(part.entry) || 0) + part.stop - part.start);
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], b = parts[j];
        if (a.entry !== b.entry && a.start < b.stop && b.start < a.stop) a.entry.overlap = b.entry.overlap = true;
      }
      const sum = [...groups.values()].reduce((a, b) => a + b, 0) / 60000;
      const supplied = netMinutesForDay ? Number(netMinutesForDay(key)) : sum;
      const limit = Number.isFinite(supplied) ? Math.max(0, Math.round(supplied)) : sum;
      // Bestehende Tagesbegrenzung beibehalten, aber jede anteilige Kürzung als Schätzung ausweisen.
      const factor = sum > limit && sum > 0 ? limit / sum : 1;
      const portions = [...groups].map(([entry, ms]) => ({ entry, exact: ms / 60000 * factor }));
      portions.forEach(p => { p.value = Math.floor(p.exact); });
      let remaining = Math.round(Math.min(sum, limit)) - portions.reduce((n, p) => n + p.value, 0);
      const byRemainder = [...portions].sort((a, b) => (b.exact - b.value) - (a.exact - a.value));
      for (const p of byRemainder) if (remaining-- > 0) p.value++;
      const day = byDay[key] = { total: 0, auftrag: 0, stoer: 0, orders: Object.create(null), clipped: false, overlap: false, estimated: factor < 1 };
      for (const p of portions) {
        const e = p.entry;
        e.byDay[key] = p.value;
        e.minutes += p.value;
        e.estimated ||= factor < 1;
        day.total += p.value;
        if (e.art === 'stoerung') day.stoer += p.value;
        else { day.auftrag += p.value; day.orders[e.orderNr || '(ohne Nr.)'] = (day.orders[e.orderNr || '(ohne Nr.)'] || 0) + p.value; }
        day.clipped ||= e.clipped;
        day.overlap ||= e.overlap;
      }
    }
    for (const entry of entries) {
      const total = byTask[entry.taskId] ||= { minutes: 0, rawMinutes: 0, clipped: false, overlap: false, estimated: false };
      total.minutes += entry.minutes; total.rawMinutes += entry.rawMinutes;
      total.clipped ||= entry.clipped; total.overlap ||= entry.overlap; total.estimated ||= entry.estimated;
    }
    return { entries, byTask, byDay };
  }
  function taskTotal(result, task) {
    return Math.max(0, (result.byTask[task.id]?.minutes || 0) + (Number(task.manualDurationOffsetMinutes) || 0));
  }
  return Object.freeze({ evaluate, taskTotal });
});
