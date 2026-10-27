const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
function helpers() {
  const start = source.indexOf('/* FRI_ADJUST_START */'), end = source.indexOf('/* FRI_ADJUST_END */', start);
  assert.ok(start >= 0 && end > start, 'Freitag-Anpassung ist als Hilfsfunktion vorhanden');
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  return context;
}

test('Eingabe −2 bedeutet Freitag 2 h kürzer und wird intern wie bisher als +2 gespeichert', () => {
  const { friAdjustToStored, friAdjustToInput } = helpers();
  assert.equal(friAdjustToStored('-2'), 2);
  assert.equal(friAdjustToStored('-1,5'), 1.5);
  assert.equal(friAdjustToStored('2'), -2);
  assert.equal(friAdjustToInput(2), -2);
  assert.equal(friAdjustToInput(-2), 2);
});

test('Leer, ungültig und Null bleiben 0 und erzeugen kein −0', () => {
  const { friAdjustToStored, friAdjustToInput } = helpers();
  for (const value of ['', 'abc', '0', null]) assert.ok(Object.is(friAdjustToStored(value), 0), String(value));
  assert.ok(Object.is(friAdjustToInput(0), 0));
  assert.ok(Object.is(friAdjustToInput(undefined), 0));
});
