import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  ReceiptText,
  TrendingUp,
  BarChart3,
  Sliders,
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Download,
  Upload,
  RotateCcw,
  Search,
  Maximize2,
  Minimize2,
  FastForward,
  ArrowRight,
  X
} from 'lucide-react';
import { evaluateShiftFinancials as calcShiftFinancials, solveIncomeGoal } from './utils/calculator';

/* ==========================================================================
   INTERFACES & CONSTANTS
   ========================================================================== */

interface Role {
  id: string;
  title: string;
  organization: string;
  hourlyRate: number;
  weeklyHourTarget: number;
  color: string;
}

interface Shift {
  id: string;
  roleId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  hourlyRate: number;
  notes: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  taxWithheld: number;
  netPay: number;
  createdAt: number;
}

interface Settings {
  activeRoleId: string;
  weeklyHourTarget: number;
  weeklyEarningsGoal: number;
  taxRatePercent: number;
  dailyOtThreshold: number;
  dailyOtEnabled: boolean;
  weeklyOtThreshold: number;
  overtimeMultiplier: number;
  paidBreaks: boolean;
  highPrecisionCounter: boolean;
  expandedViewport: boolean;
}

interface ActiveSession {
  status: 'IDLE' | 'ACTIVE' | 'BREAK';
  startTime: number | null;
  breakStartTime: number | null;
  accumulatedBreakMs: number;
  notes: string;
  roleId: string;
  simOffsetMs: number;
}

interface SavedScenario {
  id: string;
  title: string;
  roleId: string;
  hourlyRate: number;
  weeklyHours: number;
  taxRatePercent: number;
  overtimeThreshold: number;
  weeklyNet: number;
  deltaWeeklyNet: number;
  createdAt: number;
}

const STORAGE_KEYS = {
  ROLES: 'roles_v1',
  SHIFTS: 'shifts_v1',
  SETTINGS: 'settings_v1',
  SESSION: 'activeSession_v1',
  SCENARIOS: 'savedScenarios_v1',
};

const SPRING_TRANSITION = { type: 'spring', stiffness: 320, damping: 28 } as const;

const getOffsetDateString = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const INITIAL_ROLES: Role[] = [
  {
    id: 'role-1',
    title: 'Primary Role',
    organization: 'Core Operations',
    hourlyRate: 7.25,
    weeklyHourTarget: 25.0,
    color: '#3b82f6',
  },
  {
    id: 'role-2',
    title: 'Secondary Role',
    organization: 'Design & Code Lab',
    hourlyRate: 35.0,
    weeklyHourTarget: 15.0,
    color: '#10b981',
  },
  {
    id: 'role-3',
    title: 'Freelance',
    organization: 'Studio Advisory',
    hourlyRate: 50.0,
    weeklyHourTarget: 10.0,
    color: '#f59e0b',
  },
];

const INITIAL_SETTINGS: Settings = {
  activeRoleId: 'role-1',
  weeklyHourTarget: 25.0,
  weeklyEarningsGoal: 500.0,
  taxRatePercent: 12.0,
  dailyOtThreshold: 8.0,
  dailyOtEnabled: true,
  weeklyOtThreshold: 40.0,
  overtimeMultiplier: 1.5,
  paidBreaks: false,
  highPrecisionCounter: true,
  expandedViewport: false,
};

const INITIAL_SESSION: ActiveSession = {
  status: 'IDLE',
  startTime: null,
  breakStartTime: null,
  accumulatedBreakMs: 0,
  notes: '',
  roleId: 'role-1',
  simOffsetMs: 0,
};

function evaluateShiftFinancials(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  hourlyRate: number,
  settings: Pick<Settings, 'dailyOtEnabled' | 'dailyOtThreshold' | 'overtimeMultiplier' | 'paidBreaks' | 'taxRatePercent'>
) {
  return calcShiftFinancials({
    startTime,
    endTime,
    breakMinutes,
    hourlyRate,
    dailyOtEnabled: settings.dailyOtEnabled,
    dailyOtThreshold: settings.dailyOtThreshold,
    overtimeMultiplier: settings.overtimeMultiplier,
    paidBreaks: settings.paidBreaks,
    taxRatePercent: settings.taxRatePercent,
  });
}

function createSeedShifts(settings: Settings, roles: Role[]): Shift[] {
  const seedDefs = [
    { daysAgo: 1, roleId: 'role-1', start: '08:30', end: '17:00', brk: 30 },
    { daysAgo: 2, roleId: 'role-1', start: '08:00', end: '17:30', brk: 45 },
    { daysAgo: 3, roleId: 'role-2', start: '10:00', end: '16:00', brk: 30 },
    { daysAgo: 4, roleId: 'role-1', start: '09:00', end: '18:30', brk: 60 },
    { daysAgo: 5, roleId: 'role-3', start: '13:00', end: '18:00', brk: 0 },
    { daysAgo: 6, roleId: 'role-1', start: '08:00', end: '16:00', brk: 30 },
  ];

  return seedDefs.map((def, idx) => {
    const role = roles.find((r) => r.id === def.roleId) || roles[0];
    const fin = evaluateShiftFinancials(def.start, def.end, def.brk, role.hourlyRate, settings);
    return {
      id: `seed-shift-${idx + 1}`,
      roleId: role.id,
      date: getOffsetDateString(def.daysAgo),
      startTime: def.start,
      endTime: def.end,
      breakMinutes: def.brk,
      hourlyRate: role.hourlyRate,
      notes: '',
      totalHours: fin.totalHours,
      regularHours: fin.regularHours,
      overtimeHours: fin.overtimeHours,
      grossPay: fin.grossPay,
      taxWithheld: fin.taxWithheld,
      netPay: fin.netPay,
      createdAt: Date.now() - def.daysAgo * 86400000,
    };
  });
}

/* ==========================================================================
   APP COMPONENT
   ========================================================================== */

export default function App() {
  const [roles, setRoles] = useState<Role[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (stored) return JSON.parse(stored);
    } catch {}
    return INITIAL_ROLES;
  });

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) return { ...INITIAL_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return INITIAL_SETTINGS;
  });

  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      if (stored) {
        const parsed: Shift[] = JSON.parse(stored);
        const dummyPhrases = [
          'morning sprint', 'inventory & workflow', 'design tokens',
          'extended dispatch', 'architecture audit', 'team onboarding',
          'logged live shift', 'simulated fast forward'
        ];
        return parsed.map((s) => ({
          ...s,
          notes: s.notes && dummyPhrases.some((p) => s.notes.toLowerCase().includes(p)) ? '' : (s.notes || ''),
        }));
      }
    } catch {}
    return createSeedShifts(INITIAL_SETTINGS, INITIAL_ROLES);
  });

  const [session, setSession] = useState<ActiveSession>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (stored) return JSON.parse(stored);
    } catch {}
    return INITIAL_SESSION;
  });

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SCENARIOS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'scen-1',
        title: 'Promotion to $15/h @ 35h/wk',
        roleId: 'role-1',
        hourlyRate: 15.0,
        weeklyHours: 35.0,
        taxRatePercent: 12.0,
        overtimeThreshold: 40.0,
        weeklyNet: 462.0,
        deltaWeeklyNet: 302.5,
        createdAt: Date.now() - 3600000,
      },
      {
        id: 'scen-2',
        title: 'Overtime Sprint (48h/wk)',
        roleId: 'role-1',
        hourlyRate: 7.25,
        weeklyHours: 48.0,
        taxRatePercent: 12.0,
        overtimeThreshold: 40.0,
        weeklyNet: 331.76,
        deltaWeeklyNet: 172.26,
        createdAt: Date.now() - 7200000,
      },
    ];
  });

  const [activeTab, setActiveTab] = useState<'tracker' | 'timesheet' | 'predict' | 'analytics' | 'settings'>('tracker');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCENARIOS, JSON.stringify(savedScenarios));
  }, [savedScenarios]);

  const activeRole = useMemo(() => {
    return roles.find((r) => r.id === settings.activeRoleId) || roles[0] || INITIAL_ROLES[0];
  }, [roles, settings.activeRoleId]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const liveTelemetry = useMemo(() => {
    if (session.status === 'IDLE' || !session.startTime) {
      return {
        elapsedWorkMs: 0,
        elapsedBreakMs: 0,
        payableHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        grossPay: 0,
        taxWithheld: 0,
        netPay: 0,
        timerString: '00:00:00.0',
        rate: activeRole.hourlyRate,
      };
    }

    const currentNow = now + session.simOffsetMs;
    const totalElapsedSinceStart = Math.max(0, currentNow - session.startTime);
    let currentBreakMs = session.accumulatedBreakMs;

    if (session.status === 'BREAK' && session.breakStartTime) {
      currentBreakMs += Math.max(0, currentNow - session.breakStartTime);
    }

    const rawWorkMs = Math.max(0, totalElapsedSinceStart - currentBreakMs);
    const payableMs = settings.paidBreaks ? totalElapsedSinceStart : rawWorkMs;
    const payableHours = payableMs / (1000 * 60 * 60);

    let regularHours = payableHours;
    let overtimeHours = 0;

    if (settings.dailyOtEnabled && payableHours > settings.dailyOtThreshold) {
      regularHours = settings.dailyOtThreshold;
      overtimeHours = payableHours - settings.dailyOtThreshold;
    }

    const rate = activeRole.hourlyRate;
    const regularPay = regularHours * rate;
    const overtimePay = overtimeHours * (rate * settings.overtimeMultiplier);
    const grossPay = regularPay + overtimePay;
    const taxWithheld = grossPay * (settings.taxRatePercent / 100);
    const netPay = grossPay - taxWithheld;

    const totalSecs = Math.floor(payableMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((payableMs % 1000) / 100);

    const timerString = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}.${tenths}`;

    return {
      elapsedWorkMs: rawWorkMs,
      elapsedBreakMs: currentBreakMs,
      payableHours,
      regularHours,
      overtimeHours,
      grossPay,
      taxWithheld,
      netPay,
      timerString,
      rate,
    };
  }, [now, session, activeRole, settings]);

  const handleClockIn = () => {
    setSession({
      status: 'ACTIVE',
      startTime: Date.now(),
      breakStartTime: null,
      accumulatedBreakMs: 0,
      notes: '',
      roleId: activeRole.id,
      simOffsetMs: 0,
    });
  };

  const handleToggleBreak = () => {
    if (session.status === 'ACTIVE') {
      setSession((prev) => ({
        ...prev,
        status: 'BREAK',
        breakStartTime: Date.now() + prev.simOffsetMs,
      }));
    } else if (session.status === 'BREAK' && session.breakStartTime) {
      const addedBreak = Math.max(0, Date.now() + session.simOffsetMs - session.breakStartTime);
      setSession((prev) => ({
        ...prev,
        status: 'ACTIVE',
        breakStartTime: null,
        accumulatedBreakMs: prev.accumulatedBreakMs + addedBreak,
      }));
    }
  };

  const handleClockOut = () => {
    if (!session.startTime) return;

    const startDate = new Date(session.startTime);
    const endDate = new Date(session.startTime + liveTelemetry.elapsedWorkMs + liveTelemetry.elapsedBreakMs);

    const formatTime = (d: Date) =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

    const dateStr = startDate.toISOString().split('T')[0];
    const startStr = formatTime(startDate);
    const endStr = formatTime(endDate);
    const breakMins = Math.round(liveTelemetry.elapsedBreakMs / (1000 * 60));

    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      roleId: activeRole.id,
      date: dateStr,
      startTime: startStr,
      endTime: endStr,
      breakMinutes: breakMins,
      hourlyRate: activeRole.hourlyRate,
      notes: session.notes.trim() || 'Logged live shift',
      totalHours: Number(liveTelemetry.payableHours.toFixed(4)),
      regularHours: Number(liveTelemetry.regularHours.toFixed(4)),
      overtimeHours: Number(liveTelemetry.overtimeHours.toFixed(4)),
      grossPay: Number(liveTelemetry.grossPay.toFixed(2)),
      taxWithheld: Number(liveTelemetry.taxWithheld.toFixed(2)),
      netPay: Number(liveTelemetry.netPay.toFixed(2)),
      createdAt: Date.now(),
    };

    setShifts((prev) => [newShift, ...prev]);
    setSession(INITIAL_SESSION);
  };

  const handleSimFastForward = (minutes: number) => {
    const additionalMs = minutes * 60 * 1000;
    if (session.status === 'IDLE') {
      setSession({
        status: 'ACTIVE',
        startTime: Date.now() - additionalMs,
        breakStartTime: null,
        accumulatedBreakMs: 0,
        notes: '',
        roleId: activeRole.id,
        simOffsetMs: additionalMs,
      });
    } else {
      setSession((prev) => ({
        ...prev,
        simOffsetMs: prev.simOffsetMs + additionalMs,
      }));
    }
  };

  const handleResetSim = () => {
    setSession((prev) => ({ ...prev, simOffsetMs: 0 }));
  };

  const sevenDayMetrics = useMemo(() => {
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const cutoffStr = sevenDaysAgoDate.toISOString().split('T')[0];

    const recentShifts = shifts.filter((s) => s.date >= cutoffStr);
    const loggedHours = recentShifts.reduce((acc, s) => acc + s.totalHours, 0);
    const loggedGross = recentShifts.reduce((acc, s) => acc + s.grossPay, 0);
    const loggedNet = recentShifts.reduce((acc, s) => acc + s.netPay, 0);

    const totalHours = loggedHours + (session.status !== 'IDLE' ? liveTelemetry.payableHours : 0);
    const totalGross = loggedGross + (session.status !== 'IDLE' ? liveTelemetry.grossPay : 0);
    const totalNet = loggedNet + (session.status !== 'IDLE' ? liveTelemetry.netPay : 0);
    const progressPct = Math.min(100, (totalHours / (settings.weeklyHourTarget || 1)) * 100);

    return { totalHours, totalGross, totalNet, progressPct };
  }, [shifts, session.status, liveTelemetry, settings.weeklyHourTarget]);

  // Timesheet state
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTimeframe, setLedgerTimeframe] = useState<'7D' | '14D' | '30D' | 'ALL'>('7D');
  const [ledgerRoleFilter, setLedgerRoleFilter] = useState<string>('ALL');
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({
    roleId: settings.activeRoleId,
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    hourlyRate: activeRole.hourlyRate,
    notes: '',
  });

  const filteredShifts = useMemo(() => {
    let list = [...shifts];
    if (ledgerTimeframe !== 'ALL') {
      const days = ledgerTimeframe === '7D' ? 7 : ledgerTimeframe === '14D' ? 14 : 30;
      const cutoff = getOffsetDateString(days);
      list = list.filter((s) => s.date >= cutoff);
    }
    if (ledgerRoleFilter !== 'ALL') {
      list = list.filter((s) => s.roleId === ledgerRoleFilter);
    }
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      list = list.filter((s) => {
        const role = roles.find((r) => r.id === s.roleId);
        return (
          s.notes.toLowerCase().includes(q) ||
          s.date.includes(q) ||
          (role && role.title.toLowerCase().includes(q))
        );
      });
    }
    return list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.createdAt - a.createdAt));
  }, [shifts, ledgerTimeframe, ledgerRoleFilter, ledgerSearch, roles]);

  const ledgerSummary = useMemo(() => {
    const totalCount = filteredShifts.length;
    const totalHours = filteredShifts.reduce((acc, s) => acc + s.totalHours, 0);
    const totalNet = filteredShifts.reduce((acc, s) => acc + s.netPay, 0);
    return { totalCount, totalHours, totalNet };
  }, [filteredShifts]);

  const openAddShiftModal = () => {
    setEditingShiftId(null);
    setShiftForm({
      roleId: settings.activeRoleId,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: 30,
      hourlyRate: activeRole.hourlyRate,
      notes: '',
    });
    setShiftModalOpen(true);
  };

  const openEditShiftModal = (shift: Shift) => {
    setEditingShiftId(shift.id);
    setShiftForm({
      roleId: shift.roleId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      hourlyRate: shift.hourlyRate,
      notes: shift.notes,
    });
    setShiftModalOpen(true);
  };

  const handleDuplicateShift = (shift: Shift) => {
    const duplicated: Shift = {
      ...shift,
      id: `shift-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
    };
    setShifts((prev) => [duplicated, ...prev]);
  };

  const handleDeleteShift = (shiftId: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    setShiftModalOpen(false);
  };

  const handleSaveShiftModal = (e: React.FormEvent) => {
    e.preventDefault();
    const fin = evaluateShiftFinancials(
      shiftForm.startTime,
      shiftForm.endTime,
      shiftForm.breakMinutes,
      shiftForm.hourlyRate,
      settings
    );

    if (editingShiftId) {
      setShifts((prev) =>
        prev.map((s) =>
          s.id === editingShiftId
            ? {
                ...s,
                roleId: shiftForm.roleId,
                date: shiftForm.date,
                startTime: shiftForm.startTime,
                endTime: shiftForm.endTime,
                breakMinutes: shiftForm.breakMinutes,
                hourlyRate: shiftForm.hourlyRate,
                notes: shiftForm.notes,
                totalHours: fin.totalHours,
                regularHours: fin.regularHours,
                overtimeHours: fin.overtimeHours,
                grossPay: fin.grossPay,
                taxWithheld: fin.taxWithheld,
                netPay: fin.netPay,
              }
            : s
        )
      );
    } else {
      const newShift: Shift = {
        id: `shift-${Date.now()}`,
        roleId: shiftForm.roleId,
        date: shiftForm.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        breakMinutes: shiftForm.breakMinutes,
        hourlyRate: shiftForm.hourlyRate,
        notes: shiftForm.notes,
        totalHours: fin.totalHours,
        regularHours: fin.regularHours,
        overtimeHours: fin.overtimeHours,
        grossPay: fin.grossPay,
        taxWithheld: fin.taxWithheld,
        netPay: fin.netPay,
        createdAt: Date.now(),
      };
      setShifts((prev) => [newShift, ...prev]);
    }
    setShiftModalOpen(false);
  };

  const modalPreview = useMemo(() => {
    return evaluateShiftFinancials(
      shiftForm.startTime,
      shiftForm.endTime,
      shiftForm.breakMinutes,
      shiftForm.hourlyRate,
      settings
    );
  }, [shiftForm, settings]);

  const handleExportCSV = () => {
    const headers = [
      'Date', 'Role', 'Start', 'End', 'Break(m)', 'TotalHours', 'Rate', 'Gross', 'Tax', 'Net', 'Notes'
    ];
    const rows = filteredShifts.map((s) => {
      const r = roles.find((role) => role.id === s.roleId);
      return [
        s.date,
        `"${r ? r.title : s.roleId}"`,
        s.startTime,
        s.endTime,
        s.breakMinutes,
        s.totalHours.toFixed(2),
        s.hourlyRate.toFixed(2),
        s.grossPay.toFixed(2),
        s.taxWithheld.toFixed(2),
        s.netPay.toFixed(2),
        `"${(s.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `timesheet_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportJSON = () => {
    const backupData = { version: 1, exportedAt: new Date().toISOString(), roles, settings, shifts, savedScenarios };
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const link = document.createElement('a');
    link.href = jsonStr;
    link.download = `telemetry_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.roles) setRoles(parsed.roles);
        if (parsed.settings) setSettings((prev) => ({ ...prev, ...parsed.settings }));
        if (parsed.shifts) setShifts(parsed.shifts);
        if (parsed.savedScenarios) setSavedScenarios(parsed.savedScenarios);
      } catch {}
    };
    reader.readAsText(file);
  };

  // Predict tab state
  const [predictMode, setPredictMode] = useState<'whatif' | 'solver' | 'stacker'>('whatif');
  const [baselineRoleId, setBaselineRoleId] = useState<string>(settings.activeRoleId);

  const predictorBaselineRole = useMemo(() => {
    return roles.find((r) => r.id === baselineRoleId) || activeRole;
  }, [roles, baselineRoleId, activeRole]);

  const [simRate, setSimRate] = useState<number>(predictorBaselineRole.hourlyRate);
  const [simHours, setSimHours] = useState<number>(predictorBaselineRole.weeklyHourTarget);
  const [simTaxPercent, setSimTaxPercent] = useState<number>(settings.taxRatePercent);
  const [simOtThreshold, setSimOtThreshold] = useState<number>(settings.weeklyOtThreshold);

  useEffect(() => {
    setSimRate(predictorBaselineRole.hourlyRate);
    setSimHours(predictorBaselineRole.weeklyHourTarget);
  }, [predictorBaselineRole]);

  const baselineWeeklyNet = useMemo(() => {
    const baseRate = predictorBaselineRole.hourlyRate;
    const baseHours = predictorBaselineRole.weeklyHourTarget;
    const otThresh = settings.weeklyOtThreshold;
    const otMult = settings.overtimeMultiplier;
    let regH = Math.min(baseHours, otThresh);
    let otH = Math.max(0, baseHours - otThresh);
    const gross = regH * baseRate + otH * (baseRate * otMult);
    return gross * (1 - settings.taxRatePercent / 100);
  }, [predictorBaselineRole, settings]);

  const simulatedWeeklyNet = useMemo(() => {
    let regH = Math.min(simHours, simOtThreshold);
    let otH = Math.max(0, simHours - simOtThreshold);
    const gross = regH * simRate + otH * (simRate * settings.overtimeMultiplier);
    const net = gross * (1 - simTaxPercent / 100);
    const delta = net - baselineWeeklyNet;
    const deltaPct = baselineWeeklyNet > 0 ? (delta / baselineWeeklyNet) * 100 : 0;
    return {
      net,
      gross,
      delta,
      deltaPct,
      monthly: net * 4.3333,
      annual: net * 52,
    };
  }, [simRate, simHours, simTaxPercent, simOtThreshold, settings.overtimeMultiplier, baselineWeeklyNet]);

  // Solver
  const [targetNetTakeHome, setTargetNetTakeHome] = useState<number>(500);
  const [targetPeriod, setTargetPeriod] = useState<'week' | 'biweek' | 'month' | 'year'>('week');

  const solverResults = useMemo(() => {
    return solveIncomeGoal(
      targetNetTakeHome,
      targetPeriod,
      settings.taxRatePercent,
      predictorBaselineRole.hourlyRate,
      predictorBaselineRole.weeklyHourTarget,
      settings.weeklyOtThreshold,
      settings.overtimeMultiplier
    );
  }, [targetNetTakeHome, targetPeriod, settings, predictorBaselineRole]);

  // Stacker
  const [stackedHours, setStackedHours] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    INITIAL_ROLES.forEach((r) => {
      init[r.id] = r.weeklyHourTarget;
    });
    return init;
  });

  const stackedResults = useMemo(() => {
    let totalGross = 0;
    let totalHours = 0;
    roles.forEach((r) => {
      const h = stackedHours[r.id] ?? r.weeklyHourTarget;
      totalHours += h;
      totalGross += h * r.hourlyRate;
    });
    const totalNet = totalGross * (1 - settings.taxRatePercent / 100);
    const blendedRate = totalHours > 0 ? totalGross / totalHours : 0;
    return { totalHours, totalGross, totalNet, blendedRate };
  }, [roles, stackedHours, settings.taxRatePercent]);

  // Analytics
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'7D' | '14D' | '30D' | 'ALL'>('7D');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const analyticsShifts = useMemo(() => {
    if (analyticsTimeframe === 'ALL') return shifts;
    const days = analyticsTimeframe === '7D' ? 7 : analyticsTimeframe === '14D' ? 14 : 30;
    const cutoff = getOffsetDateString(days);
    return shifts.filter((s) => s.date >= cutoff);
  }, [shifts, analyticsTimeframe]);

  const analyticsTotals = useMemo(() => {
    const gross = analyticsShifts.reduce((acc, s) => acc + s.grossPay, 0);
    const tax = analyticsShifts.reduce((acc, s) => acc + s.taxWithheld, 0);
    const net = analyticsShifts.reduce((acc, s) => acc + s.netPay, 0);
    const hours = analyticsShifts.reduce((acc, s) => acc + s.totalHours, 0);
    const effectiveRate = hours > 0 ? gross / hours : 0;
    return { gross, tax, net, hours, effectiveRate };
  }, [analyticsShifts]);

  const chartDays = useMemo(() => {
    const dayCount = 7;
    const days = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const dayNum = d.getDate();

      const dayShifts = shifts.filter((s) => s.date === dateStr);
      const hours = dayShifts.reduce((acc, s) => acc + s.totalHours, 0);
      const net = dayShifts.reduce((acc, s) => acc + s.netPay, 0);
      days.push({ date: dateStr, label: `${dayName} ${dayNum}`, hours, net });
    }
    return days;
  }, [shifts]);

  const inspectedDay = useMemo(() => {
    if (!selectedDayKey) return chartDays[chartDays.length - 1];
    return chartDays.find((d) => d.date === selectedDayKey) || chartDays[chartDays.length - 1];
  }, [chartDays, selectedDayKey]);

  // Role Manager
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({
    title: '',
    organization: '',
    hourlyRate: 20.0,
    weeklyHourTarget: 20.0,
    color: '#3b82f6',
  });

  const openAddRoleModal = () => {
    setEditingRoleId(null);
    setRoleForm({ title: '', organization: '', hourlyRate: 20, weeklyHourTarget: 20, color: '#3b82f6' });
    setRoleModalOpen(true);
  };

  const openEditRoleModal = (role: Role) => {
    setEditingRoleId(role.id);
    setRoleForm({
      title: role.title,
      organization: role.organization,
      hourlyRate: role.hourlyRate,
      weeklyHourTarget: role.weeklyHourTarget,
      color: role.color,
    });
    setRoleModalOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.title.trim()) return;
    if (editingRoleId) {
      setRoles((prev) =>
        prev.map((r) => (r.id === editingRoleId ? { ...r, ...roleForm, hourlyRate: Number(roleForm.hourlyRate), weeklyHourTarget: Number(roleForm.weeklyHourTarget) } : r))
      );
    } else {
      setRoles((prev) => [
        ...prev,
        { id: `role-${Date.now()}`, ...roleForm, hourlyRate: Number(roleForm.hourlyRate), weeklyHourTarget: Number(roleForm.weeklyHourTarget) },
      ]);
    }
    setRoleModalOpen(false);
  };

  const handleDeleteRole = (id: string) => {
    if (roles.length <= 1) return;
    setRoles((prev) => prev.filter((r) => r.id !== id));
    if (settings.activeRoleId === id) {
      setSettings((prev) => ({ ...prev, activeRoleId: roles.find((r) => r.id !== id)?.id || '' }));
    }
  };

  const isShiftActive = session.status === 'ACTIVE';
  const isShiftBreak = session.status === 'BREAK';

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 flex flex-col items-center font-sans antialiased selection:bg-blue-500/20 selection:text-blue-200">
      {/* Frame: Clean, sleek container */}
      <div
        className={`w-full min-h-screen flex flex-col bg-[#050507] border-x border-white/[0.04] transition-all duration-300 pb-28 ${
          settings.expandedViewport ? 'max-w-2xl' : 'max-w-[430px]'
        }`}
      >
        {/* ==================================================================
            TOP HEADER: ULTRA-SLEEK, BORDERLESS & BREATHING
            Only contains:
            1) Pulsing live status dot
            2) Clean quiet role selector
            3) Canvas width expand toggle
            ================================================================== */}
        <header className="sticky top-0 z-40 bg-[#050507]/80 backdrop-blur-xl px-5 py-3.5 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isShiftActive
                    ? 'bg-emerald-400 ring-4 ring-emerald-500/20'
                    : isShiftBreak
                    ? 'bg-amber-400 ring-4 ring-amber-500/20'
                    : 'bg-zinc-600'
                }`}
              />
              {(isShiftActive || isShiftBreak) && (
                <span
                  className={`absolute w-2 h-2 rounded-full animate-ping opacity-60 ${
                    isShiftActive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              )}
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              {session.status}
            </span>
          </div>

          <div className="flex-1 max-w-[210px] mx-2">
            <select
              value={settings.activeRoleId}
              onChange={(e) => setSettings((prev) => ({ ...prev, activeRoleId: e.target.value }))}
              aria-label="Active role selector"
              className="w-full bg-transparent text-xs font-mono text-zinc-300 hover:text-white focus:outline-none cursor-pointer truncate transition-colors text-center"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id} className="bg-zinc-950 text-zinc-200">
                  {r.title} · ${r.hourlyRate.toFixed(2)}/h
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSettings((prev) => ({ ...prev, expandedViewport: !prev.expandedViewport }))}
            title={settings.expandedViewport ? 'Mobile View (430px)' : 'Expanded View'}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {settings.expandedViewport ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </header>

        {/* MAIN BODY */}
        <main className="flex-1 px-5 pt-4 space-y-6">
          {/* ==============================================================
              TAB 1: LIVE CHRONO TRACKER (DECLUTTERED & SLEEK)
              ============================================================== */}
          {activeTab === 'tracker' && (
            <motion.div
              key="tracker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={SPRING_TRANSITION}
              className="space-y-6"
            >
              {/* Hero Chrono Section */}
              <div className="py-6 text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeRole.color }} />
                  <span className="text-xs font-mono text-zinc-400 tracking-tight">
                    {activeRole.title} · ${activeRole.hourlyRate.toFixed(2)}/h
                  </span>
                </div>

                {/* Hero Accrued Display */}
                <div className="font-mono text-5xl sm:text-6xl font-light tracking-tight text-white tabular-nums">
                  ${settings.highPrecisionCounter ? liveTelemetry.grossPay.toFixed(4) : liveTelemetry.grossPay.toFixed(2)}
                </div>

                {/* Subtle telemetry line */}
                <div className="flex items-center justify-center gap-3 text-xs font-mono text-zinc-400">
                  <span className="text-emerald-400 font-medium">
                    ${liveTelemetry.netPay.toFixed(2)} net
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-300 tabular-nums">
                    {liveTelemetry.timerString}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span>{liveTelemetry.payableHours.toFixed(2)}h</span>
                </div>

                {/* Glowing Pulse Beam (Appears when active) */}
                <div className="w-24 h-[1.5px] mx-auto bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-80" />

                {/* Fast-Forward Simulation Bar (Discreet & minimal) */}
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleSimFastForward(15)}
                    className="px-2.5 py-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-colors"
                  >
                    +15m
                  </button>
                  <button
                    onClick={() => handleSimFastForward(60)}
                    className="px-2.5 py-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-colors"
                  >
                    +1h
                  </button>
                  {session.simOffsetMs > 0 && (
                    <button
                      onClick={handleResetSim}
                      title="Reset fast-forward simulation"
                      className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setSettings((prev) => ({ ...prev, highPrecisionCounter: !prev.highPrecisionCounter }))}
                    className="px-2 py-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 ml-1"
                  >
                    {settings.highPrecisionCounter ? '4 Dec' : '2 Dec'}
                  </button>
                </div>
              </div>

              {/* Shift Notes Input */}
              <div>
                <input
                  type="text"
                  placeholder="Add shift memo..."
                  value={session.notes}
                  onChange={(e) => setSession((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-white/[0.02] border-b border-white/[0.06] hover:border-white/[0.12] focus:border-blue-500/60 px-2 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Primary Action Buttons */}
              <div>
                {session.status === 'IDLE' ? (
                  <button
                    onClick={handleClockIn}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/10 active:scale-[0.99] cursor-pointer"
                  >
                    START SHIFT
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleToggleBreak}
                      className={`py-3 rounded-xl font-mono text-xs font-medium border transition-all cursor-pointer ${
                        session.status === 'BREAK'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {session.status === 'BREAK' ? 'RESUME' : 'TAKE BREAK'}
                    </button>
                    <button
                      onClick={handleClockOut}
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-mono text-xs font-semibold tracking-wider transition-all shadow-lg shadow-emerald-600/10 active:scale-[0.99] cursor-pointer"
                    >
                      CLOCK OUT
                    </button>
                  </div>
                )}
              </div>

              {/* 7-Day Target Pace Section */}
              <div className="pt-2 border-t border-white/[0.04] space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">
                    {sevenDayMetrics.totalHours.toFixed(1)} / {settings.weeklyHourTarget} hrs this week
                  </span>
                  <span className="text-zinc-400">{sevenDayMetrics.progressPct.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${sevenDayMetrics.progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-400 pt-1">
                  <span>Gross: ${sevenDayMetrics.totalGross.toFixed(2)}</span>
                  <span className="text-emerald-400">Net: ${sevenDayMetrics.totalNet.toFixed(2)}</span>
                </div>
              </div>

              {/* Recent Activity List */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Recent Shifts</span>
                  <button
                    onClick={() => setActiveTab('timesheet')}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View All <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {shifts.slice(0, 3).map((shift) => {
                    const role = roles.find((r) => r.id === shift.roleId);
                    return (
                      <div
                        key={shift.id}
                        onClick={() => openEditShiftModal(shift)}
                        className="py-3 flex items-center justify-between hover:bg-white/[0.02] px-1 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: role?.color || '#3b82f6' }} />
                            <span className="text-xs font-medium text-zinc-200 truncate">{role?.title}</span>
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                            {shift.date} · {shift.startTime}–{shift.endTime} ({shift.totalHours.toFixed(1)}h)
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-xs font-medium text-emerald-400">${shift.netPay.toFixed(2)}</div>
                          <div className="text-[10px] text-zinc-500">${shift.grossPay.toFixed(2)} gross</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==============================================================
              TAB 2: TIMESHEET LEDGER (CLEAN TRANSACTION LIST)
              ============================================================== */}
          {activeTab === 'timesheet' && (
            <motion.div
              key="timesheet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={SPRING_TRANSITION}
              className="space-y-4"
            >
              {/* Top Summary & Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-mono font-semibold text-zinc-100">
                    ${ledgerSummary.totalNet.toFixed(2)}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    {ledgerSummary.totalCount} shifts · {ledgerSummary.totalHours.toFixed(1)} hours
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openAddShiftModal}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-mono text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log
                  </button>
                  <button
                    onClick={handleExportCSV}
                    title="Export CSV"
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search & Timeframe Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search shifts..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <div className="flex gap-1">
                    {(['7D', '14D', '30D', 'ALL'] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setLedgerTimeframe(tf)}
                        className={`px-2 py-1 rounded transition-colors ${
                          ledgerTimeframe === tf ? 'text-white font-semibold bg-white/[0.08]' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>

                  <select
                    value={ledgerRoleFilter}
                    onChange={(e) => setLedgerRoleFilter(e.target.value)}
                    className="bg-transparent text-zinc-400 hover:text-zinc-200 text-[11px] focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-zinc-950">All Roles</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id} className="bg-zinc-950">
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clean Ledger Rows (Zero Badges/Pill Clutter) */}
              <div className="divide-y divide-white/[0.04]">
                {filteredShifts.map((shift) => {
                  const role = roles.find((r) => r.id === shift.roleId);
                  return (
                    <div
                      key={shift.id}
                      onClick={() => openEditShiftModal(shift)}
                      className="py-3 flex items-center justify-between hover:bg-white/[0.02] px-1 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: role?.color || '#3b82f6' }} />
                          <span className="text-xs font-medium text-zinc-200 truncate">{role?.title}</span>
                          <span className="text-[10px] font-mono text-zinc-500">{shift.date}</span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                          {shift.startTime}–{shift.endTime} · {shift.totalHours.toFixed(1)}h
                          {shift.breakMinutes > 0 ? ` (${shift.breakMinutes}m brk)` : ''}
                          {shift.notes ? <span className="text-zinc-400"> · {shift.notes}</span> : null}
                        </div>
                      </div>

                      <div className="text-right font-mono flex-shrink-0">
                        <div className="text-xs font-medium text-emerald-400">${shift.netPay.toFixed(2)}</div>
                        <div className="text-[10px] text-zinc-500">${shift.grossPay.toFixed(2)} gross</div>
                      </div>
                    </div>
                  );
                })}

                {filteredShifts.length === 0 && (
                  <div className="text-center py-12 text-zinc-600 font-mono text-xs">
                    No shifts found.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ==============================================================
              TAB 3: PREDICTOR (WHAT-IF, GOAL SOLVER, STACKER)
              ============================================================== */}
          {activeTab === 'predict' && (
            <motion.div
              key="predict"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={SPRING_TRANSITION}
              className="space-y-6"
            >
              {/* Segmented Mode Switcher */}
              <div className="flex border-b border-white/[0.06] font-mono text-xs">
                {(['whatif', 'solver', 'stacker'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPredictMode(mode)}
                    className={`flex-1 py-2 text-center transition-colors border-b-2 -mb-px ${
                      predictMode === mode
                        ? 'border-blue-500 text-white font-medium'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {mode === 'whatif' ? 'What-If' : mode === 'solver' ? 'Goal Solver' : 'Stacker'}
                  </button>
                ))}
              </div>

              {/* Sub-Mode A: What-If Sliders */}
              {predictMode === 'whatif' && (
                <div className="space-y-6 font-mono">
                  {/* Hero Outcome */}
                  <div className="text-center py-2 space-y-1">
                    <div className="text-[11px] text-zinc-500">SIMULATED WEEKLY NET</div>
                    <div className="text-4xl sm:text-5xl font-light text-emerald-400">
                      ${simulatedWeeklyNet.net.toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {simulatedWeeklyNet.delta >= 0 ? '+' : ''}${simulatedWeeklyNet.delta.toFixed(2)}/wk ({simulatedWeeklyNet.deltaPct.toFixed(1)}%) vs base
                    </div>
                  </div>

                  {/* 4 Horizon Projections */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs py-2 border-y border-white/[0.04]">
                    <div>
                      <div className="text-[10px] text-zinc-500">WEEKLY</div>
                      <div className="text-zinc-200 font-medium">${simulatedWeeklyNet.net.toFixed(0)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">BI-WEEKLY</div>
                      <div className="text-zinc-200 font-medium">${(simulatedWeeklyNet.net * 2).toFixed(0)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">MONTHLY</div>
                      <div className="text-zinc-200 font-medium">${simulatedWeeklyNet.monthly.toFixed(0)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">ANNUAL</div>
                      <div className="text-zinc-200 font-medium">${simulatedWeeklyNet.annual.toFixed(0)}</div>
                    </div>
                  </div>

                  {/* Rate Slider & Direct Typing Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Hourly Rate</span>
                      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.18] focus-within:border-blue-500 rounded-md px-2 py-0.5 transition-colors">
                        <span className="text-zinc-500 text-xs">$</span>
                        <input
                          type="number"
                          step="0.25"
                          min="1"
                          max="500"
                          value={simRate === 0 ? '' : simRate}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setSimRate(isNaN(val) ? 0 : val);
                          }}
                          className="w-16 bg-transparent text-right text-xs font-semibold text-blue-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-zinc-500 text-[11px]">/h</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="0.5"
                      value={Math.min(100, Math.max(5, simRate))}
                      onChange={(e) => setSimRate(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 bg-white/[0.06] h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex gap-1.5">
                      {[7.25, 15, 25, 35, 50, 75].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setSimRate(preset)}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                            simRate === preset ? 'bg-blue-600/30 text-blue-300' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hours Slider & Direct Typing Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Weekly Workload</span>
                      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.18] focus-within:border-blue-500 rounded-md px-2 py-0.5 transition-colors">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="168"
                          value={simHours === 0 ? '' : simHours}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setSimHours(isNaN(val) ? 0 : val);
                          }}
                          className="w-14 bg-transparent text-right text-xs font-semibold text-blue-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-zinc-500 text-[11px]">hrs/wk</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="70"
                      step="1"
                      value={Math.min(70, Math.max(1, simHours))}
                      onChange={(e) => setSimHours(parseInt(e.target.value, 10) || 0)}
                      className="w-full accent-blue-500 bg-white/[0.06] h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex gap-1.5">
                      {[10, 20, 25, 35, 40, 50].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setSimHours(preset)}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                            simHours === preset ? 'bg-blue-600/30 text-blue-300' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {preset}h
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tax Withholding & Direct Typing Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Tax Withholding</span>
                      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.18] focus-within:border-amber-500 rounded-md px-2 py-0.5 transition-colors">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="60"
                          value={simTaxPercent === 0 ? '' : simTaxPercent}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setSimTaxPercent(isNaN(val) ? 0 : val);
                          }}
                          className="w-12 bg-transparent text-right text-xs font-semibold text-amber-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-zinc-500 text-[11px]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="1"
                      value={Math.min(40, Math.max(0, simTaxPercent))}
                      onChange={(e) => setSimTaxPercent(parseFloat(e.target.value) || 0)}
                      className="w-full accent-amber-500 bg-white/[0.06] h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Sub-Mode B: Reverse Goal Solver */}
              {predictMode === 'solver' && (
                <div className="space-y-6 font-mono">
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 block">Target Net Take-Home</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                        <input
                          type="number"
                          value={targetNetTakeHome}
                          onChange={(e) => setTargetNetTakeHome(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-7 pr-3 py-2 text-base font-medium text-emerald-400 focus:outline-none"
                        />
                      </div>
                      <select
                        value={targetPeriod}
                        onChange={(e) => setTargetPeriod(e.target.value as any)}
                        className="bg-zinc-900 border border-white/[0.08] text-zinc-300 text-xs rounded-lg px-2.5 focus:outline-none"
                      >
                        <option value="week">/ Week</option>
                        <option value="biweek">/ Bi-Weekly</option>
                        <option value="month">/ Month</option>
                        <option value="year">/ Year</option>
                      </select>
                    </div>
                  </div>

                  {/* Path A & Path B */}
                  <div className="space-y-3">
                    <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-zinc-500">PATH A · ADJUST HOURS</div>
                        <div className="text-sm font-semibold text-zinc-200 mt-0.5">
                          {solverResults.pathAHours} hrs/wk (~{solverResults.pathAHoursPerDay}h/day)
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSimHours(solverResults.pathAHours);
                          setPredictMode('whatif');
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Simulate →
                      </button>
                    </div>

                    <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-zinc-500">PATH B · ADJUST PAY RATE</div>
                        <div className="text-sm font-semibold text-zinc-200 mt-0.5">
                          ${solverResults.pathBRate.toFixed(2)} /hr
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSimRate(solverResults.pathBRate);
                          setPredictMode('whatif');
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Simulate →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Mode C: Role Stacker */}
              {predictMode === 'stacker' && (
                <div className="space-y-6 font-mono">
                  <div className="flex justify-between py-2 border-b border-white/[0.04] text-xs">
                    <div>
                      <div className="text-[10px] text-zinc-500">BLENDED RATE</div>
                      <div className="text-blue-400 font-semibold text-sm">${stackedResults.blendedRate.toFixed(2)}/h</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500">STACKED NET</div>
                      <div className="text-emerald-400 font-semibold text-sm">${stackedResults.totalNet.toFixed(2)}/wk</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {roles.map((r) => {
                      const h = stackedHours[r.id] ?? r.weeklyHourTarget;
                      return (
                        <div key={r.id} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-300">{r.title}</span>
                            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.18] rounded px-1.5 py-0.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={h === 0 ? '' : h}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                  setStackedHours((prev) => ({ ...prev, [r.id]: isNaN(val) ? 0 : val }));
                                }}
                                className="w-10 bg-transparent text-right text-xs text-blue-400 font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="text-zinc-500 text-[10px]">hrs/wk</span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            step="1"
                            value={Math.min(50, Math.max(0, h))}
                            onChange={(e) =>
                              setStackedHours((prev) => ({ ...prev, [r.id]: parseInt(e.target.value, 10) || 0 }))
                            }
                            className="w-full accent-blue-500 bg-white/[0.06] h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ==============================================================
              TAB 4: ANALYTICS (CLEAN BENTO & DAILY BARS)
              ============================================================== */}
          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={SPRING_TRANSITION}
              className="space-y-6 font-mono"
            >
              {/* Timeframe Selector */}
              <div className="flex justify-between border-b border-white/[0.04] pb-2 text-xs">
                {(['7D', '14D', '30D', 'ALL'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setAnalyticsTimeframe(tf)}
                    className={`transition-colors ${
                      analyticsTimeframe === tf ? 'text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* 3 Metric Readouts */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-zinc-500">NET PAYOUT</div>
                  <div className="text-base font-semibold text-emerald-400 mt-0.5">
                    ${analyticsTotals.net.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">TOTAL HOURS</div>
                  <div className="text-base font-semibold text-zinc-200 mt-0.5">
                    {analyticsTotals.hours.toFixed(1)}h
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">EFFECTIVE RATE</div>
                  <div className="text-base font-semibold text-blue-400 mt-0.5">
                    ${analyticsTotals.effectiveRate.toFixed(2)}/h
                  </div>
                </div>
              </div>

              {/* Daily Bar Chart */}
              <div className="space-y-3 pt-2">
                <div className="text-xs text-zinc-400 flex justify-between">
                  <span>{inspectedDay.date}</span>
                  <span className="text-emerald-400">${inspectedDay.net.toFixed(2)} ({inspectedDay.hours.toFixed(1)}h)</span>
                </div>

                <div className="flex items-end justify-between gap-2 h-28 pt-2">
                  {chartDays.map((d) => {
                    const isSelected = inspectedDay.date === d.date;
                    const maxH = Math.max(10, ...chartDays.map((c) => c.hours * 1.2));
                    const heightPct = (d.hours / maxH) * 100;

                    return (
                      <div
                        key={d.date}
                        onClick={() => setSelectedDayKey(d.date)}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                      >
                        <div
                          className={`w-full max-w-[24px] rounded-t transition-all ${
                            isSelected ? 'bg-blue-400 shadow-sm' : 'bg-white/[0.08] hover:bg-white/[0.15]'
                          }`}
                          style={{ height: `${Math.max(6, heightPct)}%` }}
                        />
                        <div className={`text-[9px] mt-2 ${isSelected ? 'text-white font-semibold' : 'text-zinc-600'}`}>
                          {d.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Role Allocation Lines */}
              <div className="space-y-3 pt-2 border-t border-white/[0.04]">
                <div className="text-[11px] text-zinc-500">HOURS ALLOCATION</div>
                {roles.map((r) => {
                  const roleShifts = analyticsShifts.filter((s) => s.roleId === r.id);
                  const hours = roleShifts.reduce((acc, s) => acc + s.totalHours, 0);
                  const net = roleShifts.reduce((acc, s) => acc + s.netPay, 0);
                  const pct = analyticsTotals.hours > 0 ? (hours / analyticsTotals.hours) * 100 : 0;
                  return (
                    <div key={r.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-300">{r.title}</span>
                        <span className="text-zinc-500">{hours.toFixed(1)}h · ${net.toFixed(2)}</span>
                      </div>
                      <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ==============================================================
              TAB 5: CONFIG (ROLES, TAX, BACKUPS)
              ============================================================== */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={SPRING_TRANSITION}
              className="space-y-6 font-mono text-xs"
            >
              {/* Roles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Roles ({roles.length})</span>
                  <button onClick={openAddRoleModal} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {roles.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="text-zinc-200">{r.title}</span>
                        <span className="text-zinc-500 text-[11px]">${r.hourlyRate.toFixed(2)}/h</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditRoleModal(r)} className="text-zinc-500 hover:text-zinc-200">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {roles.length > 1 && (
                          <button onClick={() => handleDeleteRole(r.id)} className="text-zinc-600 hover:text-rose-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & OT Settings */}
              <div className="space-y-3 pt-3 border-t border-white/[0.04]">
                <div className="text-zinc-400">Tax & Overtime</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Estimated Tax</span>
                    <span className="text-amber-400 font-semibold">{settings.taxRatePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="0.5"
                    value={settings.taxRatePercent}
                    onChange={(e) => setSettings((prev) => ({ ...prev, taxRatePercent: parseFloat(e.target.value) }))}
                    className="w-full accent-amber-500 bg-white/[0.06] h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-zinc-400">Daily OT Threshold</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={settings.dailyOtThreshold}
                      onChange={(e) => setSettings((prev) => ({ ...prev, dailyOtThreshold: parseFloat(e.target.value) || 8 }))}
                      className="w-12 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-0.5 text-right text-zinc-200"
                    />
                    <span className="text-zinc-500">hrs</span>
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <span className="text-zinc-400">Paid Rest Breaks</span>
                  <input
                    type="checkbox"
                    checked={settings.paidBreaks}
                    onChange={(e) => setSettings((prev) => ({ ...prev, paidBreaks: e.target.checked }))}
                    className="accent-blue-500"
                  />
                </label>
              </div>

              {/* Persistence / Backup */}
              <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                <button onClick={handleExportJSON} className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Export Data
                </button>
                <label className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Import
                  <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>
            </motion.div>
          )}
        </main>

        {/* ==================================================================
            FLOATING BOTTOM NAV: SLENDER & MINIMAL
            ================================================================== */}
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[360px]">
          <div className="bg-[#09090b]/90 backdrop-blur-2xl border border-white/[0.08] rounded-full p-1 shadow-2xl flex items-center justify-between">
            {[
              { id: 'tracker', label: 'Tracker', icon: Clock },
              { id: 'timesheet', label: 'Ledger', icon: ReceiptText },
              { id: 'predict', label: 'Predict', icon: TrendingUp },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'settings', label: 'Config', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="relative flex-1 py-1.5 flex flex-col items-center justify-center cursor-pointer transition-colors"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 bg-white/[0.08] rounded-full"
                      transition={SPRING_TRANSITION}
                    />
                  )}
                  <Icon
                    className={`w-4 h-4 relative z-10 transition-colors ${
                      isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  />
                  <span
                    className={`text-[9px] mt-0.5 relative z-10 tracking-tight transition-colors ${
                      isActive ? 'text-white font-medium' : 'text-zinc-600'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ==================================================================
            MODAL DRAWER (ADD / EDIT SHIFT)
            ================================================================== */}
        <AnimatePresence>
          {shiftModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={SPRING_TRANSITION}
                className="w-full max-w-md bg-[#09090b] border border-white/[0.08] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto font-mono text-xs"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <span className="text-zinc-100 font-semibold">{editingShiftId ? 'Edit Shift' : 'Log Shift'}</span>
                  <button onClick={() => setShiftModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveShiftModal} className="space-y-3.5">
                  <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl flex justify-between">
                    <span className="text-zinc-400">{modalPreview.totalHours.toFixed(1)}h duration</span>
                    <span className="text-emerald-400 font-semibold">${modalPreview.netPay.toFixed(2)} net</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">ROLE</label>
                    <select
                      value={shiftForm.roleId}
                      onChange={(e) => {
                        const selRole = roles.find((r) => r.id === e.target.value);
                        setShiftForm((prev) => ({
                          ...prev,
                          roleId: e.target.value,
                          hourlyRate: selRole ? selRole.hourlyRate : prev.hourlyRate,
                        }));
                      }}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-zinc-200"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id} className="bg-zinc-950">
                          {r.title} (${r.hourlyRate.toFixed(2)}/h)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">DATE</label>
                      <input
                        type="date"
                        value={shiftForm.date}
                        onChange={(e) => setShiftForm((prev) => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">RATE ($/h)</label>
                      <input
                        type="number"
                        step="0.25"
                        value={shiftForm.hourlyRate}
                        onChange={(e) => setShiftForm((prev) => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">START</label>
                      <input
                        type="time"
                        value={shiftForm.startTime}
                        onChange={(e) => setShiftForm((prev) => ({ ...prev, startTime: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-1.5 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">END</label>
                      <input
                        type="time"
                        value={shiftForm.endTime}
                        onChange={(e) => setShiftForm((prev) => ({ ...prev, endTime: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-1.5 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">BREAK (M)</label>
                      <input
                        type="number"
                        value={shiftForm.breakMinutes}
                        onChange={(e) => setShiftForm((prev) => ({ ...prev, breakMinutes: parseInt(e.target.value, 10) || 0 }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-1.5 py-1.5 text-zinc-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">NOTES</label>
                    <input
                      type="text"
                      placeholder="Optional memo..."
                      value={shiftForm.notes}
                      onChange={(e) => setShiftForm((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-zinc-200"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    {editingShiftId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteShift(editingShiftId)}
                        className="p-2.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                    >
                      {editingShiftId ? 'Save Changes' : 'Log Shift'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ROLE MODAL */}
        <AnimatePresence>
          {roleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={SPRING_TRANSITION}
                className="w-full max-w-sm bg-[#09090b] border border-white/[0.08] rounded-2xl p-5 space-y-4 font-mono text-xs"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <span className="text-zinc-100 font-semibold">{editingRoleId ? 'Edit Role' : 'New Role'}</span>
                  <button onClick={() => setRoleModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveRole} className="space-y-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">TITLE</label>
                    <input
                      type="text"
                      required
                      value={roleForm.title}
                      onChange={(e) => setRoleForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-zinc-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">RATE ($/h)</label>
                      <input
                        type="number"
                        step="0.25"
                        required
                        value={roleForm.hourlyRate}
                        onChange={(e) => setRoleForm((prev) => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">TARGET (h/wk)</label>
                      <input
                        type="number"
                        required
                        value={roleForm.weeklyHourTarget}
                        onChange={(e) => setRoleForm((prev) => ({ ...prev, weeklyHourTarget: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium mt-2"
                  >
                    Save Role
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
