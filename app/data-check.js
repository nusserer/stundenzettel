/* Prüfliste: findet Stempel- und Auftragsdaten, die wahrscheinlich nicht stimmen. Rein lesend – ändert nichts. */
(function (root, factory) {
  const api = factory(typeof require !== 'undefined' ? require('./task-evaluation.js') : root.StundenzettelTaskEvaluation);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StundenzettelDataCheck = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (evaluation) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const isTime = t => /^\d{2}:\d{2}$/.test(t || '');
  const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const OUTSIDE_MIN = 60, LONG_PAIR_MIN = 14 * 60, MAX_LOG_DAYS = 40, START_GAP_MAX_MIN = 90;

  function stampsOf(day) { return ((day && day.stamps) || []).filter(Boolean); }
  /* Ein automatisch eingetragenes, noch nicht geprüfte Geht (rote Zeit) ist keine verlässliche Grundlage für Korrekturen. */
  function uncheckedStamp(day, index) { return Array.isArray(day && day.autoIdx) && day.autoIdx.includes(index); }
  function lastRawIndex(day) { const st = (day && day.stamps) || []; for (let i = st.length - 1; i >= 0; i--) if (st[i]) return i; return -1; }
  function atTime(key, time) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3))); }

  /* Anwesenheitsintervalle nach Tag gruppiert, damit jeder Protokolleintrag nur die betroffenen Tage prüft. */
  function presenceByDay(days, now) {
    const map = Object.create(null);
    for (const iv of evaluation.presence(days, now)) (map[iv.key] ||= []).push(iv);
    return map;
  }
  function overlapMs(intervalsByDay, start, stop) {
    let sum = 0, details = [];
    const first = new Date(start); first.setHours(0, 0, 0, 0);
    for (let i = 0, d = first; d.getTime() < stop && i < MAX_LOG_DAYS; i++, d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      for (const iv of intervalsByDay[keyOf(d)] || []) {
        const a = Math.max(start, iv.start), b = Math.min(stop, iv.stop);
        if (b > a) { sum += b - a; details.push({ start: iv.start, stop: iv.stop }); }
      }
    }
    return { sum, details };
  }

  function findIssues(options) {
    const { days = {}, tasks = [], log = [], today, now: nowOpt, isHoliday = () => false, ignored = [], evaluation: evaluated = null, fillInfo = null } = options;
    const now = nowOpt instanceof Date ? nowOpt : new Date(nowOpt || Date.now());
    const skip = new Set(ignored), issues = [];
    const add = issue => { if (!skip.has(issue.id)) issues.push(issue); };
    const keys = Object.keys(days).sort();
    const firstData = keys.find(k => stampsOf(days[k]).length || days[k].code);
    const year = (today || keyOf(now)).slice(0, 4);

    // 1) Tage
    if (firstData) {
      for (let d = new Date(firstData + 'T00:00:00'); keyOf(d) < today && keyOf(d).slice(0, 4) === year; d.setDate(d.getDate() + 1)) {
        const k = keyOf(d), day = days[k] || {}, st = stampsOf(day), wd = d.getDay();
        if (st.length % 2 === 1) add({ id: 'open:' + k, type: 'open-day', key: k, text: 'Kommt ohne Geht', detail: 'Letzte Zeit: ' + st[st.length - 1], fix: { kind: 'addGeht', key: k, after: st[st.length - 1] } });
        else if (st.length === 0 && wd >= 1 && wd <= 5 && !day.code && !isHoliday(k)) add({ id: 'missing:' + k, type: 'missing-day', key: k, text: 'Arbeitstag ohne Eintrag', detail: 'Weder Zeiten noch Code (z. B. Urlaub, Krank).', fix: null });
        for (let i = 0; i + 1 < st.length; i += 2) {
          if (!isTime(st[i]) || !isTime(st[i + 1])) continue;
          let len = toMin(st[i + 1]) - toMin(st[i]); if (len < 0) len += 1440;
          if (len > LONG_PAIR_MIN) { add({ id: 'long:' + k + ':' + i, type: 'long-pair', key: k, text: 'Ungewöhnlich langer Zeitraum', detail: st[i] + ' – ' + st[i + 1] + ' (' + Math.floor(len / 60) + ' h ' + pad(len % 60) + ' min)', fix: null }); break; }
        }
      }
    }

    // 2) Aufträge, die über Nacht weiterliefen
    for (const t of tasks) {
      if (t.status !== 'in Arbeit' || !t.activeSince) continue;
      const start = new Date(t.activeSince), startKey = keyOf(start);
      if (!(startKey < today)) continue;
      const st = stampsOf(days[startKey]);
      let stop = null;
      if (st.length && st.length % 2 === 0 && isTime(st[st.length - 1])) { const g = atTime(startKey, st[st.length - 1]); if (g > start) stop = g; }
      const unchecked = stop && uncheckedStamp(days[startKey], lastRawIndex(days[startKey]));
      add({ id: 'running:' + t.id + ':' + t.activeSince, type: 'order-running', key: startKey, taskId: t.id, unchecked: !!unchecked,
        text: (t.kind === 'stoerung' ? 'Störung' : 'Auftrag') + ' „' + (t.orderNr || '(ohne Nr.)') + '“ läuft seit ' + startKey.slice(8) + '.' + startKey.slice(5, 7) + '. ' + pad(start.getHours()) + ':' + pad(start.getMinutes()),
        detail: !stop ? 'Kein passendes Geht an diesem Tag.' : unchecked ? 'Das Geht um ' + pad(stop.getHours()) + ':' + pad(stop.getMinutes()) + ' ist noch ungeprüft. Erst das Geht prüfen oder korrigieren, danach erscheint der Vorschlag.' : 'Ende am Geht um ' + pad(stop.getHours()) + ':' + pad(stop.getMinutes()) + ' setzen?',
        fix: stop && !unchecked ? { kind: 'stopTask', taskId: t.id, stop: stop.toISOString() } : null });
    }

    // 3) Protokolleinträge außerhalb der Anwesenheit
    const byDay = presenceByDay(days, now);
    log.forEach((entry, index) => {
      if (entry.kind === 'pause') return;
      const start = new Date(entry.start).getTime(), stop = new Date(entry.stop).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start) return;
      const { sum, details } = overlapMs(byDay, start, stop), outside = Math.round((stop - start - sum) / 60000);
      if (outside < OUTSIDE_MIN) return;
      const firstKey = keyOf(new Date(start));
      const containing = details.find(iv => iv.start <= start && iv.stop > start);
      const trimTo = containing ? Math.min(stop, containing.stop) : null;
      const trimDayKey = trimTo ? keyOf(new Date(trimTo - 1)) : null, trimDay = trimDayKey ? days[trimDayKey] : null;
      const endIdx = trimDay ? (trimDay.stamps || []).findIndex(t => t && atTime(trimDayKey, t).getTime() === trimTo) : -1;
      const unchecked = !!(trimDay && endIdx >= 0 && uncheckedStamp(trimDay, endIdx));
      const label = (entry.art === 'stoerung' ? 'Störung' : 'Auftrag') + ' „' + (entry.orderNr || '(ohne Nr.)') + '“';
      add({ id: 'log:' + entry.taskId + ':' + entry.start + ':' + entry.stop, type: 'log-outside', key: firstKey, taskId: entry.taskId, logIndex: index, unchecked: unchecked && !!trimTo,
        text: label + ' ' + firstKey.slice(8) + '.' + firstKey.slice(5, 7) + '.: ' + Math.floor(outside / 60) + ' h ' + pad(outside % 60) + ' min außerhalb der Anwesenheit',
        detail: !(trimTo && trimTo < stop) ? 'Kein passendes Geht gefunden.' : unchecked ? 'Das Geht um ' + pad(new Date(trimTo).getHours()) + ':' + pad(new Date(trimTo).getMinutes()) + ' am ' + trimDayKey.slice(8) + '.' + trimDayKey.slice(5, 7) + '. ist noch ungeprüft. Erst das Geht prüfen oder korrigieren, danach erscheint der Vorschlag.' : 'Auf das Geht um ' + pad(new Date(trimTo).getHours()) + ':' + pad(new Date(trimTo).getMinutes()) + ' kürzen?',
        fix: trimTo && trimTo < stop && trimTo > start && !unchecked ? { kind: 'trimLog', logIndex: index, stop: new Date(trimTo).toISOString() } : null });
    });

    // 4) Morgens: Der zuletzt gewählte Auftrag läuft ab dem Kommt der Stempeluhr, die App startet aber erst ein paar Minuten später.
    for (const k of keys) {
      const st = (days[k] && days[k].stamps) || [], first = st.findIndex(Boolean);
      if (first < 0 || !isTime(st[first])) continue;
      const kommt = atTime(k, st[first]).getTime(), dayStart = atTime(k, '00:00').getTime(), dayEnd = dayStart + 86400000;
      const acts = [];
      log.forEach((e, index) => { const a = new Date(e.start).getTime(), b = new Date(e.stop).getTime(); if (e.kind !== 'pause' && Number.isFinite(a) && b > a) acts.push({ index, start: a, stop: b, taskId: e.taskId, art: e.art, auto: !!e.autoStart, orderNr: e.orderNr }); });
      tasks.forEach(t => { if (t.status === 'in Arbeit' && t.activeSince) { const a = new Date(t.activeSince).getTime(); if (Number.isFinite(a)) acts.push({ index: -1, taskId: t.id, start: a, stop: Infinity, art: t.kind, auto: !!t.autoStart, orderNr: t.orderNr, running: true }); } });
      const today0 = acts.filter(a => a.start >= dayStart && a.start < dayEnd).sort((x, y) => x.start - y.start)[0];
      if (!today0 || today0.art === 'stoerung' || today0.start <= kommt || today0.start - kommt > START_GAP_MAX_MIN * 60000) continue;
      if (acts.some(a => a !== today0 && a.start < kommt && a.stop > kommt)) continue;          // läuft schon durch (z. B. über Nacht)
      const before = acts.filter(a => a.stop <= kommt && !a.running).sort((x, y) => y.stop - x.stop)[0];
      if (!(today0.auto || (before && before.taskId === today0.taskId))) continue;               // nur der zuletzt gewählte bzw. automatisch fortgesetzte Auftrag
      const unchecked = uncheckedStamp(days[k], first);
      const hhmm = pad(new Date(kommt).getHours()) + ':' + pad(new Date(kommt).getMinutes()), was = pad(new Date(today0.start).getHours()) + ':' + pad(new Date(today0.start).getMinutes());
      add({ id: 'startgap:' + k + ':' + today0.taskId, type: 'start-gap', key: k, taskId: today0.taskId, unchecked,
        text: 'Auftrag „' + (today0.orderNr || '(ohne Nr.)') + '“ beginnt erst um ' + was + ', Kommt war ' + hhmm + ' (' + k.slice(8) + '.' + k.slice(5, 7) + '.)',
        detail: unchecked ? 'Das Kommt um ' + hhmm + ' ist noch ungeprüft. Erst das Kommt prüfen oder korrigieren, danach erscheint der Vorschlag.' : 'Beginn auf das Kommt um ' + hhmm + ' vorziehen?',
        fix: unchecked ? null : (today0.running ? { kind: 'extendTask', taskId: today0.taskId, start: new Date(kommt).toISOString() } : { kind: 'extendLog', logIndex: today0.index, start: new Date(kommt).toISOString() }) });
    }

    // 5) Überlappende Protokolleinträge (innerhalb der Anwesenheit)
    const presenceDays = presenceByDay(days, now), entries = [];
    log.forEach(e => { if (e.kind === 'pause') return; const a = new Date(e.start).getTime(), b = new Date(e.stop).getTime(); if (Number.isFinite(a) && b > a) entries.push({ e, a, b }); });
    tasks.forEach(t => { if (t.status === 'in Arbeit' && t.activeSince) { const a = new Date(t.activeSince).getTime(); if (Number.isFinite(a) && now.getTime() > a) entries.push({ e: { taskId: t.id, art: t.kind, orderNr: t.orderNr, start: t.activeSince, stop: now.toISOString() }, a, b: now.getTime(), running: true }); } });
    entries.sort((x, y) => x.a - y.a);
    const pairs = new Map();
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length && entries[j].a < entries[i].b; j++) {
      const A = entries[i], B = entries[j], from = Math.max(A.a, B.a), to = Math.min(A.b, B.b);
      const minutes = Math.round(overlapMs(presenceDays, from, to).sum / 60000);
      if (minutes < 1 || (A.e.taskId === B.e.taskId)) continue;
      const first = keyOf(new Date(from)), label = x => (x.art === 'stoerung' ? 'Störung' : 'Auftrag') + ' „' + (x.orderNr || '(ohne Nr.)') + '“';
      const idv = 'overlap:' + A.e.taskId + '@' + A.e.start + '|' + B.e.taskId + '@' + B.e.start;
      add({ id: idv, type: 'overlap', key: first, taskId: A.e.taskId, text: label(A.e) + ' und ' + label(B.e) + ' überlappen am ' + first.slice(8) + '.' + first.slice(5, 7) + '. um ' + minutes + ' min',
        detail: 'Die Zeit wird auf beide verteilt. Im Protokoll das Ende bzw. den Beginn eines Eintrags anpassen.', fix: null });
    }

    // 7) Vergangene Arbeitstage ohne jede Auftragszeit (z. B. App nicht gestartet): zuletzt benutzten Auftrag für die Anwesenheit eintragen
    if (fillInfo) {
      const firstLogStart = Math.min(...entries.filter(x => !x.running).map(x => x.a), Infinity);
      for (const k of keys) {
        if (!(k < today) || k.slice(0, 4) !== year) continue;
        const day = days[k], st = stampsOf(day);
        if (st.length < 2 || st.length % 2 || day.code || st.some(t => !isTime(t))) continue;
        const dayStart = atTime(k, '00:00').getTime();
        if (!(dayStart > firstLogStart)) continue;
        const pairs = []; let crosses = false;
        for (let i = 0; i < st.length; i += 2) { const a = toMin(st[i]), b = toMin(st[i + 1]); if (b <= a) crosses = true; else pairs.push([a, b]); }
        if (crosses || !pairs.length) continue;
        const covered = pairs.some(([a, b]) => entries.some(x => x.a < dayStart + b * 60000 && x.b > dayStart + a * 60000));
        if (covered) continue;
        const kommt = dayStart + pairs[0][0] * 60000;
        const prev = entries.filter(x => !x.running && x.b <= kommt && x.e.art !== 'stoerung').sort((x, y) => y.b - x.b)[0];
        const task = prev && tasks.find(t => t.id === prev.e.taskId);
        let segs = pairs.map(p => p.slice());
        for (const w of (fillInfo.breaks(k) || [])) segs = segs.flatMap(([a, b]) => (w.e <= a || w.s >= b) ? [[a, b]] : [[a, Math.max(a, w.s)], [Math.min(b, w.e), b]].filter(x => x[1] > x[0]));
        const net = fillInfo.net(k);
        if (Number.isFinite(net)) {
          let over = segs.reduce((n, x) => n + x[1] - x[0], 0) - net;
          for (let i = segs.length - 1; i >= 0 && over > 0; i--) { const cut = Math.min(over, segs[i][1] - segs[i][0]); segs[i][1] -= cut; over -= cut; }
        }
        segs = segs.filter(x => x[1] - x[0] >= 1);
        if (!segs.length) continue;
        const total = segs.reduce((n, x) => n + x[1] - x[0], 0), hm = pad(Math.floor(total / 60)) + ':' + pad(total % 60);
        const usable = task && task.status !== 'fertig';
        add({ id: 'noorder:' + k, type: 'no-order-time', key: k, taskId: usable ? task.id : null,
          text: 'Keine Auftragszeit am ' + k.slice(8) + '.' + k.slice(5, 7) + '. (Anwesenheit ' + st[0] + '–' + st[st.length - 1] + ')',
          detail: usable ? 'Zuletzt benutzten Auftrag „' + (task.orderNr || '(ohne Nr.)') + '“ für ' + hm + ' h eintragen? (Netto, ohne Pausen)' : 'Es gibt keinen zuletzt benutzten, offenen Auftrag zum Eintragen.',
          fix: usable ? { kind: 'fillDay', key: k, taskId: task.id, segments: segs.map(([a, b]) => ({ start: new Date(dayStart + a * 60000).toISOString(), stop: new Date(dayStart + b * 60000).toISOString() })) } : null });
      }
    }

    // 6) Tage, an denen die Auftragszeit anteilig geschätzt wurde
    if (evaluated && evaluated.byDay) for (const [k, v] of Object.entries(evaluated.byDay)) {
      if (!v.estimated || k.slice(0, 4) !== year) continue;
      add({ id: 'estimate:' + k, type: 'estimate', key: k, text: 'Auftragszeit am ' + k.slice(8) + '.' + k.slice(5, 7) + '. nur geschätzt',
        detail: 'Die Auftragszeiten übersteigen die Netto-IST-Zeit (' + v.total + ' min verteilt) und wurden anteilig gekürzt. Meist stecken Überlappungen oder eine zu lange Pause dahinter.', fix: null });
    }
    return issues;
  }
  return Object.freeze({ findIssues });
});
