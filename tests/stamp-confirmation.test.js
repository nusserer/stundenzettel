const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
function part(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'App-Abschnitt vorhanden: ' + from);
  return source.slice(start, end);
}
function app(days) {
  const recorded = [];
  const context = vm.createContext({
    state: { days }, currentView: 'monat', recorded, renders: [], dirty: 0,
    captureDayEdit: (day, fields) => JSON.parse(JSON.stringify(Object.fromEntries(fields.map(f => [f, day[f]])))),
    recordDayEdit: (key, label, before) => recorded.push({ key, label, before }),
    markDirty() { context.dirty++; }, renderMonat() { context.renders.push('monat'); },
    renderHeute() { context.renders.push('heute'); }, renderMiniPlayer() {}
  });
  vm.runInContext(part('function markAutoStamp(', 'function doKommen()'), context);
  return context;
}

test('Ungeprüfte Zeiten werden nur gezählt, wenn der markierte Eintrag existiert', () => {
  const ctx = app({ a: { stamps: ['07:00', '17:00'], autoIdx: [1] }, b: { stamps: ['07:00'], autoIdx: [0, 1] }, c: { stamps: [''], autoIdx: [0] } });
  assert.equal(ctx.uncheckedStampCount(), 2);
});

test('Nur der Prüfen-Button hebt die Markierung auf und ist rückgängig machbar', () => {
  const days = { '2026-10-26': { stamps: ['07:00', '17:00'], autoIdx: [0, 1] } };
  const ctx = app(days);
  assert.equal(ctx.confirmAutoStamp('2026-10-26', 1), true);
  assert.deepEqual(days['2026-10-26'].autoIdx, [0]);
  assert.deepEqual(days['2026-10-26'].stamps, ['07:00', '17:00']);
  assert.equal(ctx.recorded.length, 1);
  assert.deepEqual(ctx.recorded[0].before.autoIdx, [0, 1]);
  assert.equal(ctx.dirty, 1);
  assert.equal(ctx.confirmAutoStamp('2026-10-26', 1), false);
  assert.equal(ctx.recorded.length, 1);
});
