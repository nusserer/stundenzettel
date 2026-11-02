const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const start = source.indexOf('/* FILE_NAMES_START */'), end = source.indexOf('/* FILE_NAMES_END */', start);

test('Dateinamen enthalten kein Jahr, weil eine Datei mehrere Jahre enthält', () => {
  assert.ok(start >= 0 && end > start, 'Dateinamen-Helfer ist vorhanden');
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  assert.equal(context.dataFileName(), 'Stundenzettel.json');
  assert.equal(context.backupFileName('2026-11-02-09-30'), 'Stundenzettel-Sicherung-2026-11-02-09-30.json');
});

test('Kein Speichern-Dialog schlägt mehr einen Namen mit Jahreszahl vor', () => {
  assert.doesNotMatch(source, /suggestedName:\s*`Stundenzettel-\$\{/);
  assert.doesNotMatch(source, /Stundenzettel-\$\{state\.settings\.year\}/);
  assert.doesNotMatch(source, /Stundenzettel-\$\{year\}\.json/);
});
