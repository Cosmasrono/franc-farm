import assert from 'node:assert/strict';
import test from 'node:test';
import { getPosReportRange } from '../app/lib/pos-report-range';

test('defaults to today in Kenya even when UTC is still yesterday', () => {
  const range = getPosReportRange({}, new Date('2026-09-28T22:30:00Z'));
  assert.equal(range.date, '2026-09-29');
  assert.equal(range.from.toISOString(), '2026-09-28T21:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-09-29T21:00:00.000Z');
});

test('weeks include Monday through Sunday across a year boundary', () => {
  const range = getPosReportRange({ period: 'week', date: '2027-01-03' });
  assert.equal(range.start, '2026-12-28');
  assert.equal(range.end, '2027-01-03');
  assert.equal(range.to.toISOString(), '2027-01-03T21:00:00.000Z');
});

test('a Monday starts a new reporting week', () => {
  const range = getPosReportRange({ period: 'week', date: '2027-01-04' });
  assert.equal(range.start, '2027-01-04');
  assert.equal(range.end, '2027-01-10');
});

test('months handle leap years and December rollover', () => {
  const leap = getPosReportRange({ period: 'month', date: '2028-02-15' });
  assert.equal(leap.start, '2028-02-01');
  assert.equal(leap.end, '2028-02-29');
  const december = getPosReportRange({ period: 'month', date: '2026-12-15' });
  assert.equal(december.start, '2026-12-01');
  assert.equal(december.end, '2026-12-31');
  assert.equal(december.to.toISOString(), '2026-12-31T21:00:00.000Z');
});

test('custom ranges include both dates with an exclusive next-day boundary', () => {
  const range = getPosReportRange({ period: 'custom', start: '2026-08-31', end: '2026-09-02' });
  const inRange = (date: string) => new Date(date) >= range.from && new Date(date) < range.to;
  assert.equal(inRange('2026-08-30T20:59:59.999Z'), false);
  assert.equal(inRange('2026-08-30T21:00:00.000Z'), true);
  assert.equal(inRange('2026-09-02T20:59:59.999Z'), true);
  assert.equal(inRange('2026-09-02T21:00:00.000Z'), false);
});

test('custom ranges allow a single day', () => {
  const range = getPosReportRange({ period: 'custom', start: '2026-09-29', end: '2026-09-29' });
  assert.equal(range.to.getTime() - range.from.getTime(), 86_400_000);
});

test('rejects missing, impossible, reversed, and duplicate date filters', () => {
  assert.throws(() => getPosReportRange({ period: 'custom' }), /valid date/);
  assert.throws(() => getPosReportRange({ date: '2026-02-30' }), /valid date/);
  assert.throws(() => getPosReportRange({ period: 'custom', start: '2026-09-30', end: '2026-09-01' }), /on or after/);
  assert.throws(() => getPosReportRange({ period: 'year' }), /Choose day/);
  assert.throws(() => getPosReportRange({ date: ['2026-09-01', '2026-09-02'] }), /one value/);
});
