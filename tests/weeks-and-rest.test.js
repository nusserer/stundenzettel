const test = require('node:test');
const assert = require('node:assert/strict');
const { calculations } = require('./helpers/calculations');

function week(app, from, perDay) {
  // perDay: Wochentage Mo..Fr mit Stempeln
  const d0 = new Date(from + 'T00:00:00');
  perDay.forEach((st, i) => {
    const d = new Date(d0); d.setDate(d.getDate() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (st) app.run(`state.days['${k}']={stamps:${JSON.stringify(st)},pause:0}`);
  });
}
const summary = (app, id) => JSON.parse(app.run(`JSON.stringify(buildWeekSummaries().get('${id}'))`));

test('Wochensumme: IST, SOLL und +/- aus den Tagen von Montag bis Sonntag', () => {
  const app = calculations('2026-10-30T20:00:00');
  week(app, '2026-10-19', [['08:00', '17:00'], ['08:00', '17:00'], ['08:00', '17:00'], ['08:00', '17:00'], ['08:00', '14:00']]);
  const w = summary(app, '2026-43');
  assert.equal(w.kw, 43); assert.equal(w.from, '2026-10-19'); assert.equal(w.to, '2026-10-25');
  assert.equal(w.ist, 42); assert.equal(w.hasData, true);
  assert.equal(Math.round((w.ist - w.soll - w.diff) * 100) / 100, 0);
});

test('Wochen ohne Eintragungen zählen nicht als Daten', () => {
  const app = calculations('2026-10-30T20:00:00');
  assert.equal(summary(app, '2026-20').hasData, false);
});

test('Höchstes Plus und höchstes Minus werden gefunden', () => {
  const app = calculations('2026-10-30T20:00:00');
  week(app, '2026-10-05', [['08:00', '18:00'], ['08:00', '18:00'], ['08:00', '18:00'], ['08:00', '18:00'], ['08:00', '18:00']]);
  week(app, '2026-10-12', [['08:00', '12:00'], ['08:00', '12:00'], ['08:00', '12:00'], null, null]);
  week(app, '2026-10-19', [['08:00', '17:00'], ['08:00', '17:00'], ['08:00', '17:00'], ['08:00', '17:00'], ['08:00', '14:00']]);
  const r = JSON.parse(app.run("JSON.stringify((()=>{const e=weekExtremes([...buildWeekSummaries().values()]);return {best:e.best&&e.best.id,worst:e.worst&&e.worst.id}})())"));
  assert.equal(r.best, '2026-41'); assert.equal(r.worst, '2026-42');
});

test('Über 48 h in einer Woche ist erkennbar', () => {
  const app = calculations('2026-10-30T20:00:00');
  week(app, '2026-10-05', [['06:00', '18:00'], ['06:00', '18:00'], ['06:00', '18:00'], ['06:00', '18:00'], ['06:00', '18:00']]);
  assert.ok(summary(app, '2026-41').ist > 48);
});

test('Wochen am Jahreswechsel: ohne Vorjahr nur vorhandene Tage, mit Archiv-Vorjahr vollständig', () => {
  const app = calculations('2026-10-30T20:00:00');
  assert.equal(summary(app, '2026-01').partialYear, true);
  assert.equal(app.run("weekIdOf(new Date(2026,0,1))"), '2026-01');
  assert.equal(app.run("weekIdOf(new Date(2027,0,1))"), '2026-53');
  app.run("state.days['2026-01-01']={stamps:['08:00','12:00'],pause:0}; state.days['2026-01-02']={stamps:['08:00','12:00'],pause:0}");
  const ohne = summary(app, '2026-01');
  app.run("state.archive={2025:{settings:{year:2025},days:{'2025-12-29':{stamps:['08:00','17:00'],pause:0},'2025-12-30':{stamps:['08:00','17:00'],pause:0},'2025-12-31':{stamps:['08:00','12:00'],pause:0}}}}");
  const mit = summary(app, '2026-01');
  assert.equal(mit.partialYear, false);
  assert.ok(mit.ist > ohne.ist + 15);
  assert.equal(mit.ist, 9 + 9 + 4 + 4 + 4);   // 29.–31.12. aus dem Archiv, 1.–2.1. aus dem aktuellen Jahr
  assert.equal(app.run("state.settings.year"), 2026);   // Jahr wird nach der Berechnung wieder zurückgesetzt
});

test('Ruhezeit: unter 11 h wird gewarnt, ab 11 h nicht', () => {
  const app = calculations('2026-10-30T20:00:00');
  app.run("state.days['2026-10-26']={stamps:['10:00','21:30'],pause:0}; state.days['2026-10-27']={stamps:['07:30','16:00'],pause:0}; state.days['2026-10-28']={stamps:['08:30','16:00'],pause:0}");
  const r1 = JSON.parse(app.run("JSON.stringify(restInfoFor('2026-10-27'))")), r2 = JSON.parse(app.run("JSON.stringify(restInfoFor('2026-10-28'))"));
  assert.equal(r1.gap, 600); assert.equal(r1.warn, true);
  assert.equal(r2.gap, 990); assert.equal(r2.warn, false);
  assert.equal(app.run("restText(580)"), '9 h 40 min');
});

test('Ruhezeit: Wochenende dazwischen und offene Vortage', () => {
  const app = calculations('2026-10-30T20:00:00');
  app.run("state.days['2026-10-23']={stamps:['08:00','19:00'],pause:0}; state.days['2026-10-26']={stamps:['06:00','12:00'],pause:0}");
  assert.equal(app.run("restInfoFor('2026-10-26').warn"), false);       // Fr 19:00 -> Mo 06:00 = 59 h
  app.run("state.days['2026-10-27']={stamps:['06:00'],pause:0}; state.days['2026-10-28']={stamps:['06:00','12:00'],pause:0}");
  assert.equal(app.run("restInfoFor('2026-10-28')"), null);             // Vortag offen -> nicht beurteilbar
  assert.equal(app.run("restInfoFor('2026-01-01')"), null);             // kein Vortag im Jahr
});

test('Frühestes Kommt heute nach später Geht-Zeit', () => {
  const app = calculations('2026-10-27T05:00:00');
  app.run("state.days['2026-10-26']={stamps:['10:00','21:30'],pause:0}");
  assert.equal(app.run("minToTime(earliestKommtToday().minutes)"), '08:30');
  app.run("state.days['2026-10-26']={stamps:['08:00','16:00'],pause:0}");
  assert.equal(app.run("earliestKommtToday().minutes"), 180);   // 03:00 liegt vor „jetzt“ (05:00): kein Hinweis nötig
});

test('Ruhezeit über den Jahreswechsel nutzt das Archiv', () => {
  const app = calculations('2026-10-30T20:00:00');
  app.run("state.archive={2025:{settings:{year:2025},days:{'2025-12-31':{stamps:['10:00','22:00'],pause:0}}}}; state.days['2026-01-01']={stamps:['06:00','10:00'],pause:0}");
  assert.equal(app.run("restInfoFor('2026-01-01').gap"), 480);
  assert.equal(app.run("restInfoFor('2026-01-01').warn"), true);
});
