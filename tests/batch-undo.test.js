const test = require('node:test');
const assert = require('node:assert/strict');
const { capture, createHistory } = require('../app/edit-history.js');

test('Sammeländerung stellt mehrere Tage und Auftragsdaten gemeinsam wieder her', () => {
  const targets = { a: { code: '' }, b: { code: 'K' }, log: { stop: '17:00' } };
  const items = Object.entries(targets).map(([key, value]) => ({ key, before: capture(value, Object.keys(value)) }));
  targets.a.code = 'U'; targets.b.code = 'U'; targets.log.stop = '16:00';
  for (const item of items) item.after = capture(targets[item.key], Object.keys(item.before));
  const h = createHistory();
  h.recordBatch({ label: 'Einfügen', items });
  assert.equal(h.undoBatch(item => targets[item.key]).ok, true);
  assert.deepEqual(targets, { a: { code: '' }, b: { code: 'K' }, log: { stop: '17:00' } });
});

test('Konflikt verhindert die gesamte Rücknahme ohne Teiländerungen', () => {
  const targets = { a: { code: '' }, b: { code: '' } };
  const items = Object.entries(targets).map(([key, value]) => ({ key, before: capture(value, ['code']) }));
  targets.a.code = 'U'; targets.b.code = 'U';
  for (const item of items) item.after = capture(targets[item.key], ['code']);
  const h = createHistory(); h.recordBatch({ label: 'Einfügen', items });
  targets.b.code = 'K';
  assert.equal(h.undoBatch(item => targets[item.key]).reason, 'changed');
  assert.equal(targets.a.code, 'U'); assert.equal(targets.b.code, 'K');
  assert.equal(h.length, 1);
});
