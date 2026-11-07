import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSpanMinutes,
  evaluateShiftFinancials,
  solveIncomeGoal,
} from './calculator';

test('calculateSpanMinutes handles standard same-day shift', () => {
  const span = calculateSpanMinutes('09:00', '17:00');
  assert.equal(span, 480); // 8 hours
});

test('calculateSpanMinutes handles overnight shifts crossing midnight', () => {
  // 22:00 to 06:00 is 8 hours (480 minutes)
  const span = calculateSpanMinutes('22:00', '06:00');
  assert.equal(span, 480);
});

test('evaluateShiftFinancials calculates regular hours and pay correctly', () => {
  const res = evaluateShiftFinancials({
    startTime: '09:00',
    endTime: '17:30',
    breakMinutes: 30, // 8.5 hrs span - 0.5h break = 8.0 hrs payable
    hourlyRate: 10.0,
    dailyOtThreshold: 8.0,
    dailyOtEnabled: true,
    overtimeMultiplier: 1.5,
    paidBreaks: false,
    taxRatePercent: 10.0,
  });

  assert.equal(res.totalHours, 8.0);
  assert.equal(res.regularHours, 8.0);
  assert.equal(res.overtimeHours, 0.0);
  assert.equal(res.grossPay, 80.0);
  assert.equal(res.taxWithheld, 8.0);
  assert.equal(res.netPay, 72.0);
});

test('evaluateShiftFinancials splits overtime correctly above daily threshold', () => {
  const res = evaluateShiftFinancials({
    startTime: '08:00',
    endTime: '18:00',
    breakMinutes: 0, // 10 hrs payable
    hourlyRate: 20.0,
    dailyOtThreshold: 8.0,
    dailyOtEnabled: true,
    overtimeMultiplier: 1.5, // 1.5 * 20 = $30/h
    paidBreaks: false,
    taxRatePercent: 12.0,
  });

  assert.equal(res.totalHours, 10.0);
  assert.equal(res.regularHours, 8.0);
  assert.equal(res.overtimeHours, 2.0);
  // Reg: 8 * 20 = 160. OT: 2 * 30 = 60. Gross = 220
  assert.equal(res.grossPay, 220.0);
  // Tax: 220 * 0.12 = 26.4
  assert.equal(res.taxWithheld, 26.4);
  assert.equal(res.netPay, 193.6);
});

test('evaluateShiftFinancials respects paidBreaks flag', () => {
  const resUnpaid = evaluateShiftFinancials({
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 60,
    hourlyRate: 15.0,
    dailyOtThreshold: 8.0,
    dailyOtEnabled: true,
    overtimeMultiplier: 1.5,
    paidBreaks: false,
    taxRatePercent: 10.0,
  });
  assert.equal(resUnpaid.totalHours, 7.0);

  const resPaid = evaluateShiftFinancials({
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 60,
    hourlyRate: 15.0,
    dailyOtThreshold: 8.0,
    dailyOtEnabled: true,
    overtimeMultiplier: 1.5,
    paidBreaks: true,
    taxRatePercent: 10.0,
  });
  assert.equal(resPaid.totalHours, 8.0);
});

test('solveIncomeGoal calculates required hours and pay rate accurately', () => {
  // Goal: $440/wk net at 12% tax -> Gross = 440 / 0.88 = 500
  // Rate: $20/h -> 500 / 20 = 25 hrs/wk
  const res = solveIncomeGoal(440, 'week', 12.0, 20.0, 25.0, 40.0, 1.5);
  assert.equal(res.requiredWeeklyGross, 500.0);
  assert.equal(res.pathAHours, 25.0);
  assert.equal(res.pathAHoursPerDay, 5.0);
  assert.equal(res.pathBRate, 20.0);
  assert.equal(res.pathBRateDelta, 0.0);
});
