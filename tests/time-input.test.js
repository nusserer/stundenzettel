const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8');
const a = source.indexOf('function normalizeTimeText('), b = source.indexOf('function clockText(', a);
const ctx = vm.createContext({ localStorage: { getItem: () => null, setItem() {} } });
vm.runInContext(source.slice(source.indexOf('const INPUT_FORMAT_KEY'), b), ctx);
const n = v => ctx.normalizeTimeText(v);

test('Uhrzeiten werden immer als 24-Stunden-hh:mm normalisiert', () => {
  for (const [input, out] of [['7:30', '07:30'], ['07:30', '07:30'], ['730', '07:30'], ['0730', '07:30'], ['1445', '14:45'], ['14.45', '14:45'], ['14h45', '14:45'], ['7', '07:00'], ['07', '07:00'], ['', ''], ['  9:05 ', '09:05'], ['2:30 pm', '14:30'], ['12:00 am', '00:00'], ['12:15 pm', '12:15'], ['07:30 PM', '19:30']])
    assert.equal(n(input), out, input);
});
test('Ungültige Uhrzeiten werden abgelehnt', () => {
  for (const v of ['24:00', '12:60', 'abc', '7:3x', '25', '13 pm', '0 am', '12345', '1:2:3']) assert.equal(n(v), null, v);
});
test('Anzeige der Uhrzeit: Standard 24 h, wahlweise 12 h', () => {
  assert.equal(ctx.formatTimeValue('19:30', '24'), '19:30');
  assert.equal(ctx.formatTimeValue('19:30', '12'), '07:30 PM');
  assert.equal(ctx.formatTimeValue('00:05', '12'), '12:05 AM');
  assert.equal(ctx.formatTimeValue('12:00', '12'), '12:00 PM');
  assert.equal(ctx.formatTimeValue('', '12'), '');
  assert.equal(ctx.normalizeTimeText(ctx.formatTimeValue('13:45', '12')), '13:45');
});
test('Datum: Eingaben werden zu JJJJ-MM-TT; Anzeige europäisch (Standard) oder ISO', () => {
  const d = (v, now) => ctx.normalizeDateText(v, now);
  for (const [input, out] of [['2.11.2026', '2026-11-02'], ['02.11.2026', '2026-11-02'], ['02.11.26', '2026-11-02'], ['2026-11-02', '2026-11-02'], ['02112026', '2026-11-02'], ['2/11/2026', '2026-11-02'], ['29.2.2028', '2028-02-29'], ['', '']])
    assert.equal(d(input), out, input);
  assert.equal(d('5.3.', new Date(2027, 0, 1)), '2027-03-05');
  for (const v of ['31.2.2026', '32.1.2026', '2026-13-01', 'abc', '1.1.1800', '11/02/2026x']) assert.equal(d(v), null, v);
  assert.equal(ctx.formatDateValue('2026-11-02', 'de'), '02.11.2026');
  assert.equal(ctx.formatDateValue('2026-11-02', 'iso'), '2026-11-02');
  assert.equal(ctx.formatDateValue('', 'de'), '');
});
test('Standardformat ist 24 h und TT.MM.JJJJ; Wahl wird nur im Browser gespeichert', () => {
  assert.deepEqual({ ...ctx.inputFormats() }, { time: '24', date: 'de' });
  assert.match(source, /stundenzettel-v3-input-formats/);
});
test('Keine Zeit- oder Datumsfelder verwenden mehr die Browserfelder (zeigen in Edge AM/PM und MM/DD/YYYY)', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'), ext = fs.readFileSync(path.join(__dirname, '../app/excel-checkpoints-view.js'), 'utf8');
  const markup = source.replace(/\/\* TIME_INPUT_START \*\/[\s\S]*?\/\* TIME_INPUT_END \*\//, '');
  for (const text of [markup, html, ext]) assert.doesNotMatch(text, /type=\\?"(time|date)\\?"/);
});
