import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLedgerDate } from '../lib/ledger-filters.ts';
test('date filter compares displayed calendar days, including times', () => {
  const date = new Date(2026, 10, 8);
  assert.equal(compareLedgerDate(date, new Date(2026, 10, 8, 23, 59).toISOString()), 0);
  assert.equal(compareLedgerDate(date, new Date(2026, 10, 7, 23, 59).toISOString()), -1);
  assert.equal(compareLedgerDate(date, new Date(2026, 10, 9).toISOString()), 1);
  assert.equal(compareLedgerDate(date, null), -1);
  assert.equal(compareLedgerDate(date, 'invalid'), -1);
});

import { publicLedgerEntries } from '../lib/ledger-filters.ts';
test('public ledger hides unsuccessful attempts and labels completed donations', () => {
  const rows = ['created', 'pending', 'failed', 'captured', 'donated'].map((status) => ({ type: 'donation', status, amount: 10 }));
  const result = publicLedgerEntries([...rows, {type: 'refund', status: 'completed', amount: -5}]);
  assert.deepEqual(result.map((row) => row.status), ['Donated', 'Donated', 'completed']);
  assert.equal(result.filter((row) => row.type === 'donation').reduce((sum, row) => sum + row.amount, 0), 20);
  assert.equal(rows[3].status, 'captured');
});
