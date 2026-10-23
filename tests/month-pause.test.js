const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// app.js is a browser script. Exercise its actual pause functions without booting the DOM.
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const parser = source.split('\n').find(line => line.startsWith('function parseMinutesInput('));
const pauseFunctions = source.slice(source.indexOf('const LONG_PAUSE_AFTER_NET_MIN'), source.indexOf('/* Geht-Zeit, mit der heute'));
function pauseContext(group = 'moDo') {
  const context = vm.createContext({
    window: {},
    rawWorkedMinutes: day => day.raw,
    dayGroup: () => group,
    timeToMin: time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; },
    rulesOf: () => ({
      breaks: {
        moDo: [{ start: '09:15', end: '09:30' }, { start: '12:15', end: '12:45' }],
        fr: [{ start: '09:15', end: '09:30' }, { start: '12:15', end: '12:30' }]
      },
      pause: { moDo: 45, fr: 30, holiday: 30 }
    })
  });
  vm.runInContext(parser + '\n' + pauseFunctions, context);
  return context;
}

test('Pauseneingabe unterscheidet leer, Null und Minuten; Uhrzeit wird abgewiesen', () => {
  const { parseMinutesInput } = pauseContext();
  assert.equal(parseMinutesInput(''), '');
  assert.equal(parseMinutesInput('   '), '');
  assert.equal(parseMinutesInput('0'), 0);
  assert.equal(parseMinutesInput('45'), 45);
  assert.equal(parseMinutesInput('30,5'), 31);
  assert.equal(parseMinutesInput('0:45'), null);
  assert.equal(parseMinutesInput('-5'), null);
});

test('Eigene Pause gewinnt, Leeren stellt die automatische Pause wieder her', () => {
  const { calcPauseMinutes } = pauseContext();
  const day = { raw: 9 * 60, pause: '' };
  assert.equal(calcPauseMinutes(day), 45);
  day.pause = 0;
  assert.equal(calcPauseMinutes(day), 0);
  day.pause = 60;
  assert.equal(calcPauseMinutes(day), 60);
  day.pause = '';
  assert.equal(calcPauseMinutes(day), 45);
});

test('Freitag verwendet nach Leeren wieder feste bzw. rechtliche Mindestpause', () => {
  const { calcPauseMinutes } = pauseContext('fr');
  const day = { raw: 8 * 60, pause: '' };
  assert.equal(calcPauseMinutes(day), 30);
  day.raw = 10 * 60;
  assert.equal(calcPauseMinutes(day), 45);
  day.pause = 0;
  assert.equal(calcPauseMinutes(day), 0);
  day.pause = '';
  assert.equal(calcPauseMinutes(day), 45);
});
