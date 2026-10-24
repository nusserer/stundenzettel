const test = require('node:test');
const assert = require('node:assert/strict');
const { calculations } = require('./helpers/calculations.js');

function fixture(iso) {
  const c = calculations(iso);
  c.run(`state.settings.rules.breaks.fr=[{start:'09:45',end:'10:15'}];ensureMonthAdjust(10).kaTarget=0;`);
  return c;
}

test('Alle Geht-Codes liefern die erwarteten Zeiten bei ausgeglichener Woche', () => {
  const c = fixture();
  c.run("state.days[todayKey()]={stamps:['07:00']};");
  const rows = JSON.parse(c.run('JSON.stringify(computeGehtEmpfehlungen(9).rows)'));
  const expected = { O:'15:21', S:'15:45', J:'10:00', K:'14:15', W:'15:21', WF:'17:21', WZ:'15:21', WZF:'17:21', '10':'17:45', M:'15:21', MZ:'15:21', KA:'15:21', MKA:'15:21', WKA:'15:21' };
  assert.equal(rows.length, Object.keys(expected).length);
  for (const row of rows) assert.equal(row.time, expected[row.code], row.code);
});

test('Geht-Empfehlung verwendet den Saldo bis gestern und bleibt tagsüber stabil', () => {
  const c = fixture();
  c.run("state.days['2026-10-21']={stamps:['07:00','16:21']};state.days[todayKey()]={stamps:['07:00']};");
  const first = c.run('computeGehtEmpfehlungen(9).rows.find(r=>r.code==="W").time');
  c.setNow('2026-10-22T16:00:00');
  assert.equal(c.run('computeGehtEmpfehlungen(9).rows.find(r=>r.code==="W").time'), first);
});

for (const goal of [0, 2]) for (const holiday of [false, true]) {
  test(`WZF endet am Wochenziel ${goal} h, Donnerstag frei: ${holiday}`, () => {
    const c = fixture();
    c.run(`ensureMonthAdjust(10).wochenziel=${goal};`);
    if (holiday) c.run("state.holidays.push({date:'2026-10-22',label:'Test frei',factor:0});");
    for (const day of ['19','20','21','22','23']) {
      c.setNow(`2026-10-${day}T07:00:00`);
      if (holiday && day === '22') continue;
      c.run("state.days[todayKey()]={stamps:['07:00']};state.days[todayKey()].stamps.push(computeGehtEmpfehlungen(9).rows.find(r=>r.code==='WZF').time);");
    }
    const diff = c.run("['19','20','21','22','23'].reduce((s,d)=>s+calcDay('2026-10-'+d,true).diff,0)");
    assert.ok(Math.abs(diff-goal) <= 0.02, `Wochensaldo ${diff}`);
    assert.equal(c.run("computeGehtEmpfehlungen(9).rows.find(r=>r.code==='WZF').time"), '13:06');
  });
}

test('WZ zählt den Freitag als Resttag, WZF nur Mo–Do', () => {
  const c = fixture('2026-10-19T07:00:00');
  c.run("state.days[todayKey()]={stamps:['07:00']};");
  assert.equal(c.run('computeGehtEmpfehlungen(9).remWeek'), 5);
  assert.equal(c.run('computeGehtEmpfehlungen(9).remWeekWZF'), 4);
});

test('Ein freier Freitag wird bei WZF nicht vorgearbeitet', () => {
  const c = fixture('2026-10-19T07:00:00');
  c.run("state.days[todayKey()]={stamps:['07:00']};state.holidays.push({date:'2026-10-23',label:'frei',factor:0});");
  assert.equal(c.run('computeGehtEmpfehlungen(9).J42F'), 0);
});

test('Geplante Abwesenheit verkleinert die Resttage', () => {
  const c = fixture('2026-10-19T07:00:00');
  c.run("state.days[todayKey()]={stamps:['07:00']};state.days['2026-10-20']={stamps:[],code:'U'};");
  assert.equal(c.run('computeGehtEmpfehlungen(9).remWeek'), 4);
  assert.equal(c.run('computeGehtEmpfehlungen(9).remWeekWZF'), 3);
});

test('Eigene Nullpause und mehrere Stempelpaare fließen in die Empfehlung ein', () => {
  const c = fixture();
  c.run("state.days[todayKey()]={stamps:['07:00'],pause:0};");
  assert.equal(c.run("computeGehtEmpfehlungen(9).rows.find(r=>r.code==='O').time"), '14:36');
  c.run("state.days[todayKey()].stamps=['07:00','10:00','11:00'];");
  assert.equal(c.run("computeGehtEmpfehlungen(9).rows.find(r=>r.code==='O').time"), '15:36');
});

test('Code 10 ist begrenzt; heutige Projektion zählt danach die echte Uhrzeit', () => {
  const c = fixture('2026-10-22T19:00:00');
  c.run("state.days[todayKey()]={stamps:['09:00']};state.settings.gehtEmpfehlung.activeCode='10';");
  assert.equal(c.run("computeGehtEmpfehlungen(9).rows.find(r=>r.code==='10').time"), '18:30');
  assert.equal(c.run('projectedLiveTime(state.days[todayKey()])'), '19:00');
});

test('Geschlossener alter Tag: eine zusätzliche Stunde ändert den Abschluss exakt um eine Stunde', () => {
  const c = fixture();
  c.run("state.days['2026-01-12']={stamps:['07:00','16:00']};");
  const before = c.run('monthClosingBalance(0)');
  c.run("state.days['2026-01-12'].stamps[1]='17:00';");
  assert.equal(c.run('round2(monthClosingBalance(0)-'+before+')'), 1);
});

test('Auszahlung erbt den Modus bis zur nächsten ausdrücklichen Änderung', () => {
  const c = fixture();
  c.run("ensureMonthAdjust(3).payoutMode='on';ensureMonthAdjust(7).payoutMode='off';");
  assert.equal(c.run('payoutSetting(1).active'), false);
  assert.equal(c.run('payoutSetting(2).active'), true);
  assert.equal(c.run('payoutSetting(5).active'), true);
  assert.equal(c.run('payoutSetting(6).active'), false);
  assert.equal(c.run('payoutSetting(11).active'), false);
});

test('Auszahlung ist auf 30 h Monatsplus begrenzt, Minus wird nicht ausgezahlt', () => {
  const c = fixture();
  c.run("ensureMonthAdjust(1).payoutMode='on';ensureMonthAdjust(1).payout=5;");
  assert.equal(c.run('monthPayoutInfo(0,35).auto'), 30);
  assert.equal(c.run('monthPayoutInfo(0,35).total'), 35);
  assert.equal(c.run('monthPayoutInfo(0,-2).auto'), 0);
  assert.equal(c.run('monthPayoutInfo(0,-2).total'), 5);
});

test('Monats-, Jahresverlauf und nächster Übertrag berücksichtigen dieselbe Auszahlung', () => {
  const c = fixture();
  c.run("state.settings.glz.carryOverHours=50;state.days['2026-01-12']={stamps:['07:00','17:00'],pause:0};ensureMonthAdjust(1).payoutMode='on';ensureMonthAdjust(1).payout=2;");
  const closing = c.run('monthClosingBalance(0)');
  assert.equal(closing, 48);
  assert.equal(c.run('monthOpeningBalance(1)'), closing);
  assert.equal(c.run("yearBalanceSeries().find(p=>p.date==='2026-01-31').bal"), closing);
  assert.equal(c.run('monthBalanceSeries(0).at(-1).bal'), closing);
});
