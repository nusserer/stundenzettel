const test = require('node:test');
const assert = require('node:assert/strict');
const { capture, createHistory } = require('../app/edit-history.js');

function edit(history, day, fields, change, extra = {}) {
  const before = capture(day, fields);
  change();
  return history.record({ year: 2026, key: '2026-10-21', label: 'Test', before, after: capture(day, fields), ...extra });
}

test('Rückgängig stellt nur bearbeitete Felder wieder her', () => {
  const h = createHistory(), day = { stamps: ['08:00', '16:00'], pause: '', code: '' };
  edit(h, day, ['pause'], () => { day.pause = 0; });
  day.stamps.push('17:00');
  assert.equal(h.undo(() => day).ok, true);
  assert.equal(day.pause, '');
  assert.deepEqual(day.stamps, ['08:00', '16:00', '17:00']);
});

test('Stempelzeiten und Auto-Markierungen werden gemeinsam exakt wiederhergestellt', () => {
  const h = createHistory(), day = { stamps: ['08:00', '16:00'], autoIdx: [1] };
  edit(h, day, ['stamps','autoIdx'], () => { day.stamps[1] = '17:00'; day.autoIdx = []; });
  assert.equal(h.undo(() => day).ok, true);
  assert.deepEqual(day, { stamps: ['08:00', '16:00'], autoIdx: [1] });
});

test('Fehlende Eigenschaften bleiben nach Rückgängig fehlend', () => {
  const h = createHistory(), day = { stamps: [] };
  edit(h, day, ['code'], () => { day.code = 'U'; });
  h.undo(() => day);
  assert.equal(Object.hasOwn(day, 'code'), false);
});

test('Zwischenzeitliche Änderung am selben Feld wird nicht überschrieben', () => {
  const h = createHistory(), day = { stamps: ['08:00','16:00'] };
  edit(h, day, ['stamps'], () => { day.stamps[1] = '17:00'; });
  day.stamps.push('18:00');
  assert.equal(h.undo(() => day).ok, false);
  assert.deepEqual(day.stamps, ['08:00','17:00','18:00']);
});

test('Mehrere Änderungen sind in umgekehrter Reihenfolge rückgängig', () => {
  const h = createHistory(), day = { pause: '' };
  edit(h, day, ['pause'], () => { day.pause = 0; });
  edit(h, day, ['pause'], () => { day.pause = 30; });
  h.undo(() => day); assert.equal(day.pause, 0);
  h.undo(() => day); assert.equal(day.pause, '');
  assert.equal(h.length, 0);
});

test('Unveränderte Eingaben erzeugen keinen Verlauf', () => {
  const h = createHistory(), day = { code: 'U' };
  assert.equal(edit(h, day, ['code'], () => {}), false);
  assert.equal(h.length, 0);
});

test('Dateiwechsel löscht Verlauf, keine Wiederherstellung in fremde Datei', () => {
  const h = createHistory(), day = { pause: '' };
  edit(h, day, ['pause'], () => { day.pause = 0; });
  h.clear();
  assert.equal(h.undo(() => day).ok, false);
  assert.equal(day.pause, 0);
});

test('Gesperrtes oder nicht mehr verfügbares Jahr verändert nichts', () => {
  const h = createHistory(), day = { code: '' };
  edit(h, day, ['code'], () => { day.code = 'K'; });
  assert.equal(h.undo(() => null).ok, false);
  assert.equal(day.code, 'K');
});

test('Jahr und Tag werden ausdrücklich an die Zielauflösung übergeben', () => {
  const h = createHistory(), day = { pause: '' };
  edit(h, day, ['pause'], () => { day.pause = 0; });
  const r = h.undo(e => { assert.equal(e.year, 2026); assert.equal(e.key, '2026-10-21'); return day; });
  assert.equal(r.ok, true);
});

test('Verlauf hat eine begrenzte Größe', () => {
  const h = createHistory(2), day = { pause: '' };
  for (const p of [0, 30, 45]) edit(h, day, ['pause'], () => { day.pause = p; });
  assert.equal(h.length, 2);
});
