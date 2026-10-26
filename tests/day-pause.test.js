const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const pause = require('../app/day-pause');

test('Offene Pause mischt UTC-Speicherung und lokale Uhrzeit ohne Zeitversatz', () => {
  for (const month of ['01', '07']) {
    const script = `const p=require('./app/day-pause');const day={dayPauses:[{start:new Date('2026-${month}-12T12:15:00').toISOString(),end:''}]};console.log(p.minutes(day,'12:20'));`;
    const actual = Number(execFileSync(process.execPath, ['-e', script], {
      cwd: require('node:path').join(__dirname, '..'),
      env: { ...process.env, TZ: 'Europe/Berlin' }, encoding: 'utf8'
    }));
    assert.equal(actual, 5, 'Winter-/Sommerzeit: ' + month);
  }
});

test('Geschlossene manuelle Pausen behalten die bisherige minutengenaue Abrechnung', () => {
  const day = { dayPauses: [{ start: '2026-10-26T09:15:55Z', end: '2026-10-26T09:16:05Z' }] };
  const original = JSON.stringify(day);
  assert.equal(pause.minutes(day), 1);
  assert.equal(JSON.stringify(day), original);
});
