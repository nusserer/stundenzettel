const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { calculations } = require('./helpers/calculations');

// Eingabe-Parser aus der echten app.js
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const parser = source.split('\n').find(line => line.startsWith('function parseMinutesInput('));
function parseMinutesInput(value) { const context = vm.createContext({}); vm.runInContext(parser, context); return context.parseMinutesInput(value); }

function pause(date, stamps, extra = {}) {
  const app = calculations(date + 'T20:00:00');
  app.run(`state.days['${date}']=Object.assign({stamps:${JSON.stringify(stamps)},pause:''},${JSON.stringify(extra)})`);
  return app.run(`calcPauseMinutes(state.days['${date}'],keyToDate('${date}'),false,null)`);
}

test('Pauseneingabe unterscheidet leer, Null und Minuten; Uhrzeit wird abgewiesen', () => {
  assert.equal(parseMinutesInput(''), '');
  assert.equal(parseMinutesInput('   '), '');
  assert.equal(parseMinutesInput('0'), 0);
  assert.equal(parseMinutesInput('45'), 45);
  assert.equal(parseMinutesInput('30,5'), 31);
  assert.equal(parseMinutesInput('0:45'), null);
  assert.equal(parseMinutesInput('-5'), null);
});

test('Eigene Pause gewinnt, Leeren stellt die automatische Pause wieder her', () => {
  assert.equal(pause('2026-10-26', ['07:00', '16:00']), 45);
  assert.equal(pause('2026-10-26', ['07:00', '16:00'], { pause: 0 }), 0);
  assert.equal(pause('2026-10-26', ['07:00', '16:00'], { pause: 60 }), 60);
  assert.equal(pause('2026-10-26', ['07:00', '16:00'], { pause: '' }), 45);
});

test('Freitag: 30 Min. Pause, ab 9 h netto gesetzlich 45 Min.', () => {
  assert.equal(pause('2026-10-30', ['07:00', '15:00']), 30);
  assert.equal(pause('2026-10-30', ['07:00', '17:30']), 45);
  assert.equal(pause('2026-10-30', ['07:00', '15:00'], { pause: 0 }), 0);
});
