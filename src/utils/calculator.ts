export interface ShiftEvaluationParams {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  breakMinutes: number;
  hourlyRate: number;
  dailyOtThreshold: number;
  dailyOtEnabled: boolean;
  overtimeMultiplier: number;
  paidBreaks: boolean;
  taxRatePercent: number;
}

export interface ShiftEvaluationResult {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  breakHours: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  taxWithheld: number;
  netPay: number;
  effectiveRate: number;
}

/**
 * Accurately parses span minutes with support for overnight shifts (crossing midnight).
 */
export function calculateSpanMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map((v) => parseInt(v, 10) || 0);
  const [endH, endM] = endTime.split(':').map((v) => parseInt(v, 10) || 0);

  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Next day
  }

  return Math.max(0, endMinutes - startMinutes);
}

/**
 * Evaluates payable hours, overtime splits, and gross/tax/net financials for any shift.
 */
export function evaluateShiftFinancials(params: ShiftEvaluationParams): ShiftEvaluationResult {
  const {
    startTime,
    endTime,
    breakMinutes,
    hourlyRate,
    dailyOtThreshold,
    dailyOtEnabled,
    overtimeMultiplier,
    paidBreaks,
    taxRatePercent,
  } = params;

  const rawSpanMinutes = calculateSpanMinutes(startTime, endTime);
  const effectiveBreakMinutes = paidBreaks ? 0 : Math.min(breakMinutes, rawSpanMinutes);
  const payableMinutes = Math.max(0, rawSpanMinutes - effectiveBreakMinutes);

  const totalHours = Number((payableMinutes / 60).toFixed(4));
  const breakHours = Number((breakMinutes / 60).toFixed(2));

  let regularHours = totalHours;
  let overtimeHours = 0;

  if (dailyOtEnabled && totalHours > dailyOtThreshold) {
    regularHours = dailyOtThreshold;
    overtimeHours = totalHours - dailyOtThreshold;
  }

  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * (hourlyRate * (overtimeMultiplier || 1.5));
  const grossPay = regularPay + overtimePay;
  const taxWithheld = grossPay * (taxRatePercent / 100);
  const netPay = grossPay - taxWithheld;

  return {
    totalHours,
    regularHours: Number(regularHours.toFixed(4)),
    overtimeHours: Number(overtimeHours.toFixed(4)),
    breakHours,
    regularPay: Number(regularPay.toFixed(2)),
    overtimePay: Number(overtimePay.toFixed(2)),
    grossPay: Number(grossPay.toFixed(2)),
    taxWithheld: Number(taxWithheld.toFixed(2)),
    netPay: Number(netPay.toFixed(2)),
    effectiveRate: totalHours > 0 ? Number((grossPay / totalHours).toFixed(2)) : hourlyRate,
  };
}

/**
 * Reverse-engineers required hours or hourly rate to achieve a target net income.
 */
export function solveIncomeGoal(
  targetNet: number,
  period: 'week' | 'biweek' | 'month' | 'year',
  taxRatePercent: number,
  baseRate: number,
  baseHours: number,
  otThreshold: number,
  otMultiplier: number
) {
  let weeklyNetTarget = targetNet;
  if (period === 'biweek') weeklyNetTarget = targetNet / 2;
  if (period === 'month') weeklyNetTarget = targetNet / 4.3333;
  if (period === 'year') weeklyNetTarget = targetNet / 52;

  const taxFraction = taxRatePercent / 100;
  const requiredWeeklyGross = weeklyNetTarget / Math.max(0.01, 1 - taxFraction);

  // Path A: Keep Rate -> Solve for Hours
  let requiredHours = 0;
  if (requiredWeeklyGross <= otThreshold * baseRate) {
    requiredHours = requiredWeeklyGross / Math.max(0.01, baseRate);
  } else {
    const regGross = otThreshold * baseRate;
    const remGross = requiredWeeklyGross - regGross;
    const otRate = baseRate * otMultiplier;
    const otHours = remGross / otRate;
    requiredHours = otThreshold + otHours;
  }

  // Path B: Keep Schedule -> Solve for Rate
  let requiredRate = 0;
  if (baseHours <= otThreshold) {
    requiredRate = requiredWeeklyGross / Math.max(0.1, baseHours);
  } else {
    const regH = otThreshold;
    const otH = baseHours - otThreshold;
    const weightedHours = regH + otH * otMultiplier;
    requiredRate = requiredWeeklyGross / weightedHours;
  }

  return {
    weeklyNetTarget: Number(weeklyNetTarget.toFixed(2)),
    requiredWeeklyGross: Number(requiredWeeklyGross.toFixed(2)),
    pathAHours: Number(requiredHours.toFixed(1)),
    pathAHoursPerDay: Number((requiredHours / 5).toFixed(1)),
    pathBRate: Number(requiredRate.toFixed(2)),
    pathBRateDelta: Number((requiredRate - baseRate).toFixed(2)),
  };
}
