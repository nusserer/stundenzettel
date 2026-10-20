/* Shared time core: runs as an offline classic script and as a Node/CommonJS module. */
(function (root, factory) {
  const api = factory(root && root.crypto);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StundenzettelTimeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (browserCrypto) {
  const isTime = value => /^\d{2}:\d{2}$/.test(value || '');
  const toMinutes = value => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };

  function validateYearData(data) {
    const findings = [];
    for (const [date, day] of Object.entries(data?.days || {})) {
      const stamps = day?.stamps || [];
      if (!Array.isArray(stamps)) { findings.push({ date, kind: 'invalid-stamps' }); continue; }
      if (stamps.some(s => !isTime(s))) findings.push({ date, kind: 'invalid-time', stamps });
      const valid = stamps.filter(isTime);
      if (valid.some((s, i) => i && toMinutes(s) < toMinutes(valid[i - 1]))) findings.push({ date, kind: 'non-chronological', stamps });
      if (valid.length % 2 && day?.migrationReview?.status !== 'confirmed-open') findings.push({ date, kind: 'open-stamp', stamps });
    }
    return findings;
  }
  function monthDayKeys(year, month) {
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`);
  }
  function summarizeMonthRecords(data, year, month) {
    const entries = monthDayKeys(year, month).map(key => data.days?.[key]).filter(Boolean);
    return { calendarDays: new Date(year, month, 0).getDate(), recordedDays: entries.length, codeDays: entries.filter(day => Boolean(day.code)).length, stampCount: entries.reduce((count, day) => count + (day.stamps?.filter(Boolean).length || 0), 0) };
  }
  function legacyStampsToEvents(date, stamps) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(stamps)) throw new Error('Ungültige Alt-Stempelreihe');
    return stamps.map((stamp, index) => {
      if (!isTime(stamp)) throw new Error(`Ungültige Alt-Stempelzeit: ${String(stamp)}`);
      return { id: `import:${date}:${index}`, type: index % 2 === 0 ? 'come' : 'go', at: `${date}T${stamp}:00`, source: 'import' };
    });
  }
  function createEvent(type, at, source = 'manual') {
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new Error('Ungültiger Zeitpunkt');
    const pad = n => String(n).padStart(2, '0');
    const local = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
    const id = browserCrypto?.randomUUID ? browserCrypto.randomUUID() : `event:${Date.now()}:${Math.random()}`;
    return { id, type, at: local, source };
  }
  function calculateWorkMinutes(events) {
    let workStart = null, pauseStart = null, total = 0;
    for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
      const t = new Date(event.at).getTime();
      if (event.type === 'come' && workStart === null) workStart = t;
      if (event.type === 'pause-start' && workStart !== null && pauseStart === null) { total += t - workStart; workStart = null; pauseStart = t; }
      if (event.type === 'pause-end' && pauseStart !== null) { workStart = t; pauseStart = null; }
      if (event.type === 'go' && workStart !== null) { total += t - workStart; workStart = null; }
    }
    return Math.max(0, Math.round(total / 60000));
  }
  function calculateLegacyStampMinutes(stamps, liveNow) {
    let total = 0;
    for (let i = 0; i + 1 < (stamps || []).length; i += 2) {
      if (!isTime(stamps[i]) || !isTime(stamps[i + 1])) continue;
      const diff = toMinutes(stamps[i + 1]) - toMinutes(stamps[i]);
      total += diff >= 0 ? diff : diff + 1440;
    }
    if (liveNow && stamps?.length % 2 && isTime(stamps[stamps.length - 1]) && isTime(liveNow)) {
      const diff = toMinutes(liveNow) - toMinutes(stamps[stamps.length - 1]);
      total += diff >= 0 ? diff : diff + 1440;
    }
    return total;
  }
  return { validateYearData, monthDayKeys, summarizeMonthRecords, legacyStampsToEvents, createEvent, calculateWorkMinutes, calculateLegacyStampMinutes };
});
