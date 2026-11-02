const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const a = source.indexOf('/* COL_WIDTHS_START */'), b = source.indexOf('/* COL_WIDTHS_END */', a);
function env(initial) {
  const store = new Map(initial === undefined ? [] : [['stundenzettel-v3-month-col-widths', initial]]);
  const ctx = vm.createContext({ localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, document: {} });
  vm.runInContext(source.slice(a, b), ctx);
  return { ctx, store };
}
test('Breiten werden begrenzt und geprüft', () => {
  const { ctx } = env();
  assert.equal(ctx.clampColWidth(5), 36);
  assert.equal(ctx.clampColWidth(9999), 600);
  assert.equal(ctx.clampColWidth('abc'), null);
  assert.deepEqual(Array.from(ctx.sanitizeColWidths([40, 80.4], 2)), [40, 80]);
  assert.equal(ctx.sanitizeColWidths([40], 2), null);
  assert.equal(ctx.sanitizeColWidths([40, null], 2), null);
});
test('Speichern, Laden und Zurücksetzen nur im Browserspeicher', () => {
  const { ctx, store } = env();
  ctx.saveColWidths([50, 60]);
  assert.deepEqual(Array.from(ctx.loadColWidths(2)), [50, 60]);
  assert.equal(ctx.loadColWidths(3), null);
  ctx.saveColWidths(null);
  assert.equal(store.size, 0);
});
test('Kaputter oder gesperrter Speicher bricht nichts', () => {
  assert.equal(env('{kaputt').ctx.loadColWidths(2), null);
  const ctx = vm.createContext({ localStorage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } } });
  vm.runInContext(source.slice(a, b), ctx);
  assert.equal(ctx.loadColWidths(2), null);
  ctx.saveColWidths([40, 40]); ctx.saveColWidths(null);
});

test('Jede Tabelle hat einen eigenen Speicherschlüssel; die Monatstabelle behält den ersten', () => {
  const { ctx, store } = env();
  assert.equal(ctx.colWidthKey(''), 'stundenzettel-v3-month-col-widths');
  ctx.saveColWidths([50, 60], 'logTable'); ctx.saveColWidths([70, 80], 'taskTable');
  assert.deepEqual(Array.from(ctx.loadColWidths(2, 'logTable')), [50, 60]);
  assert.deepEqual(Array.from(ctx.loadColWidths(2, 'taskTable')), [70, 80]);
  assert.equal(ctx.loadColWidths(2, ''), null);
  ctx.saveColWidths(null, 'logTable');
  assert.equal(store.size, 1);
});
test('Alle Haupttabellen sind ziehbar', () => {
  for (const name of ['""', '"jahrKalender"', '"jahrTable"', '"logTable"', '"holidays"'])
    assert.ok(source.includes('initColResize(') && source.match(new RegExp('initColResize\\([^\\n]*' + name.replace(/"/g, '"'))), name);
  assert.match(source, /isStoer\?"stoerTable":"taskTable"/);
});
