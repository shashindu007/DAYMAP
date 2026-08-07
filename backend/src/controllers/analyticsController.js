const Analytics = require('../models/Analytics');
const FocusSession = require('../models/FocusSession');
const ScheduleTask = require('../models/ScheduleTask');
const { getUserToday, addDaysToYmd, eachYmd } = require('../utils/date');

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * TIMEZONE RULE for this file: every "today" and every default range is derived
 * from req.user.timezone via utils/date, never from `new Date().toISOString()`.
 * UTC-derived ranges put a user east or west of UTC on the wrong calendar day
 * for part of every day, which made the Analytics page disagree with Today's
 * Dashboard and the Wallet — both of which already resolve dates per-user.
 */

/** Hour (0-23) from an HH:MM[:SS] clock string, or null. */
const hourOf = (clock) => {
    if (!clock || typeof clock !== 'string') return null;
    const hour = parseInt(clock.slice(0, 2), 10);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
};

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Day-of-week (0=Sun) from a YYYY-MM-DD string, or null. Uses UTC arithmetic on
 * the date parts so the weekday depends only on the string, not on whatever
 * timezone the server process happens to run in.
 */
const dowOf = (ymd) => {
    if (!YMD_PATTERN.test(ymd || '')) return null;
    const [year, month, day] = ymd.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed.getUTCDay();
};

const formatHms = (date) => (
    `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}:${`${date.getSeconds()}`.padStart(2, '0')}`
);

/**
 * Local calendar date of a Date, as YYYY-MM-DD. The Date objects in
 * logFocusSession are built by parsing `${ymd}T${hms}`, which resolves in
 * server-local time — so reading them back out has to be local too, or an
 * evening session silently lands on the next day.
 */
const localYmd = (date) => (
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
);

/** Monday-based week start for a YYYY-MM-DD string, as a YYYY-MM-DD string. */
const getWeekStart = (ymd) => {
    const dow = dowOf(ymd);
    if (dow === null) return ymd;
    return addDaysToYmd(ymd, dow === 0 ? -6 : 1 - dow);
};

class AnalyticsController {
    static normalizeDate(value, timezone) {
        if (YMD_PATTERN.test(value || '')) {
            return value;
        }

        return getUserToday(timezone);
    }

    static normalizeClock(value) {
        if (!value || typeof value !== 'string') return null;
        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return `${value}:00`;
        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) return value;
        return null;
    }

    static normalizeTags(tags) {
        if (Array.isArray(tags)) {
            return tags
                .map((tag) => `${tag}`.trim())
                .filter(Boolean);
        }

        if (typeof tags === 'string') {
            return tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
        }

        return [];
    }

    /**
     * Get daily analytics
     * @route GET /api/analytics/daily/:date
     */
    static async getDailyAnalytics(req, res) {
        try {
            const { date } = req.params;

            const analytics = await Analytics.findByDate(req.user.id, date);

            if (!analytics) {
                return res.json({
                    success: true,
                    data: {
                        date,
                        total_tasks_scheduled: 0,
                        total_tasks_completed: 0,
                        total_time_scheduled_minutes: 0,
                        total_time_spent_minutes: 0,
                        focus_time_spent_minutes: 0,
                        focus_sessions_count: 0,
                        focus_sessions_total: 0,
                        focus_sessions_completed: 0,
                        completion_rate: 0
                    }
                });
            }

            const completion_rate = analytics.total_tasks_scheduled > 0
                ? (analytics.total_tasks_completed / analytics.total_tasks_scheduled) * 100
                : 0;

            const focus_success_rate = analytics.focus_sessions_total > 0
                ? (analytics.focus_sessions_completed / analytics.focus_sessions_total) * 100
                : 0;

            res.json({
                success: true,
                data: {
                    ...analytics,
                    completion_rate: parseFloat(completion_rate.toFixed(2)),
                    focus_success_rate: parseFloat(focus_success_rate.toFixed(2))
                }
            });
        } catch (error) {
            console.error('Get daily analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching daily analytics'
            });
        }
    }

    /**
     * Get weekly analytics
     * @route GET /api/analytics/weekly
     */
    static async getWeeklyAnalytics(req, res) {
        try {
            const { start_date, end_date } = req.query;

            let startDate;
            let endDate;

            if (start_date && end_date) {
                startDate = start_date;
                endDate = end_date;
            } else {
                // Default to the user's current (Sunday-based) week.
                const today = getUserToday(req.user.timezone);
                startDate = addDaysToYmd(today, -dowOf(today));
                endDate = addDaysToYmd(startDate, 6);
            }

            const analytics = await Analytics.findByWeek(req.user.id, startDate, endDate);

            // Calculate totals
            const totals = analytics.reduce((acc, day) => {
                acc.total_tasks_scheduled += day.total_tasks_scheduled;
                acc.total_tasks_completed += day.total_tasks_completed;
                acc.total_time_scheduled_minutes += day.total_time_scheduled_minutes;
                acc.total_time_spent_minutes += day.total_time_spent_minutes;
                acc.focus_time_spent_minutes += day.focus_time_spent_minutes || 0;
                acc.focus_sessions_count += day.focus_sessions_count || 0;
                acc.focus_sessions_total += day.focus_sessions_total || day.focus_sessions_count || 0;
                acc.focus_sessions_completed += day.focus_sessions_completed || 0;
                return acc;
            }, {
                total_tasks_scheduled: 0,
                total_tasks_completed: 0,
                total_time_scheduled_minutes: 0,
                total_time_spent_minutes: 0,
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0,
                focus_sessions_total: 0,
                focus_sessions_completed: 0
            });

            const completion_rate = totals.total_tasks_scheduled > 0
                ? (totals.total_tasks_completed / totals.total_tasks_scheduled) * 100
                : 0;

            const focus_success_rate = totals.focus_sessions_total > 0
                ? (totals.focus_sessions_completed / totals.focus_sessions_total) * 100
                : 0;

            res.json({
                success: true,
                data: {
                    start_date: startDate,
                    end_date: endDate,
                    daily: analytics,
                    totals: {
                        ...totals,
                        completion_rate: parseFloat(completion_rate.toFixed(2)),
                        focus_success_rate: parseFloat(focus_success_rate.toFixed(2))
                    }
                }
            });
        } catch (error) {
            console.error('Get weekly analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching weekly analytics'
            });
        }
    }

    /**
     * Get monthly analytics
     * @route GET /api/analytics/monthly
     */
    static async getMonthlyAnalytics(req, res) {
        try {
            const { year, month } = req.query;

            let selectedYear;
            let selectedMonth;

            if (year && month) {
                selectedYear = parseInt(year, 10);
                selectedMonth = parseInt(month, 10);
            } else {
                // Default to the user's current month.
                const [y, m] = getUserToday(req.user.timezone).split('-').map(Number);
                selectedYear = y;
                selectedMonth = m;
            }

            const analytics = await Analytics.findByMonth(req.user.id, selectedYear, selectedMonth);

            // Calculate totals
            const totals = analytics.reduce((acc, day) => {
                acc.total_tasks_scheduled += day.total_tasks_scheduled;
                acc.total_tasks_completed += day.total_tasks_completed;
                acc.total_time_scheduled_minutes += day.total_time_scheduled_minutes;
                acc.total_time_spent_minutes += day.total_time_spent_minutes;
                acc.focus_time_spent_minutes += day.focus_time_spent_minutes || 0;
                acc.focus_sessions_count += day.focus_sessions_count || 0;
                acc.focus_sessions_total += day.focus_sessions_total || day.focus_sessions_count || 0;
                acc.focus_sessions_completed += day.focus_sessions_completed || 0;
                return acc;
            }, {
                total_tasks_scheduled: 0,
                total_tasks_completed: 0,
                total_time_scheduled_minutes: 0,
                total_time_spent_minutes: 0,
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0,
                focus_sessions_total: 0,
                focus_sessions_completed: 0
            });

            const completion_rate = totals.total_tasks_scheduled > 0
                ? (totals.total_tasks_completed / totals.total_tasks_scheduled) * 100
                : 0;

            const focus_success_rate = totals.focus_sessions_total > 0
                ? (totals.focus_sessions_completed / totals.focus_sessions_total) * 100
                : 0;

            const avg_daily_tasks = analytics.length > 0
                ? totals.total_tasks_scheduled / analytics.length
                : 0;

            res.json({
                success: true,
                data: {
                    year: selectedYear,
                    month: selectedMonth,
                    daily: analytics,
                    totals: {
                        ...totals,
                        completion_rate: parseFloat(completion_rate.toFixed(2)),
                        focus_success_rate: parseFloat(focus_success_rate.toFixed(2)),
                        avg_daily_tasks: parseFloat(avg_daily_tasks.toFixed(2))
                    }
                }
            });
        } catch (error) {
            console.error('Get monthly analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching monthly analytics'
            });
        }
    }

    /**
     * Get overall summary
     * @route GET /api/analytics/summary
     */
    static async getSummary(req, res) {
        try {
            const summary = await Analytics.getSummary(req.user.id);

            res.json({
                success: true,
                data: {
                    ...summary,
                    avg_completion_rate: parseFloat((summary.avg_completion_rate || 0).toFixed(2))
                }
            });
        } catch (error) {
            console.error('Get summary error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching analytics summary'
            });
        }
    }

    /**
     * Get productivity trends
     * @route GET /api/analytics/trends
     */
    static async getTrends(req, res) {
        try {
            const { days = 30 } = req.query;

            const end = getUserToday(req.user.timezone);
            const start = addDaysToYmd(end, -parseInt(days, 10));

            const analytics = await Analytics.findByWeek(req.user.id, start, end);

            // Calculate trends
            const trends = analytics.map((day) => ({
                date: day.date,
                completion_rate: day.total_tasks_scheduled > 0
                    ? (day.total_tasks_completed / day.total_tasks_scheduled) * 100
                    : 0,
                total_tasks: day.total_tasks_scheduled,
                completed_tasks: day.total_tasks_completed,
                time_spent_hours: (day.total_time_spent_minutes / 60).toFixed(2),
                focus_success_rate: day.focus_sessions_total > 0
                    ? (day.focus_sessions_completed / day.focus_sessions_total) * 100
                    : 0
            }));

            res.json({
                success: true,
                data: {
                    period: `${days} days`,
                    start_date: start,
                    end_date: end,
                    trends
                }
            });
        } catch (error) {
            console.error('Get trends error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching trends'
            });
        }
    }

    /**
     * Time-management analytics over a date range: peak productive hours,
     * time by category, planned-vs-actual accuracy, and best focus time/day.
     * ScheduleTask is the unified execution record (scheduled + routine +
     * task-sourced items all land there), so it is the single source for the
     * task metrics to avoid double-counting.
     * @route GET /api/analytics/time-management
     */
    static async getTimeManagement(req, res) {
        try {
            const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

            const end = getUserToday(req.user.timezone);
            const start = addDaysToYmd(end, -(days - 1));

            const [tasks, focusSessions] = await Promise.all([
                ScheduleTask.findByDateRange(req.user.id, start, end),
                FocusSession.getByRange(req.user.id, start, end, 2000)
            ]);

            // Hour-of-day + day-of-week distribution of completed work.
            const hours = Array.from({ length: 24 }, (_, hour) => ({
                hour,
                tasks_completed: 0,
                time_spent_minutes: 0
            }));
            const dayOfWeek = DOW_LABELS.map((label, dow) => ({
                dow,
                label,
                tasks_completed: 0,
                time_spent_minutes: 0
            }));

            // Per-category planned vs actual time.
            const categoryMap = new Map();
            const bumpCategory = (name) => {
                const key = (name && name.trim()) || 'Uncategorized';
                if (!categoryMap.has(key)) {
                    categoryMap.set(key, {
                        category: key,
                        planned_minutes: 0,
                        actual_minutes: 0,
                        tasks: 0,
                        completed: 0
                    });
                }
                return categoryMap.get(key);
            };

            let totalPlanned = 0;
            let totalActual = 0;

            tasks.forEach((task) => {
                const planned = Number(task.duration_minutes) || 0;
                const actual = Number(task.actual_duration_minutes) || 0;
                const isCompleted = task.status === 'completed';
                const spent = isCompleted ? (actual || planned) : 0;

                const cat = bumpCategory(task.category);
                cat.planned_minutes += planned;
                cat.tasks += 1;
                totalPlanned += planned;

                if (isCompleted) {
                    cat.actual_minutes += spent;
                    cat.completed += 1;
                    totalActual += spent;

                    const hour = hourOf(task.slot_start_time);
                    if (hour !== null) {
                        hours[hour].tasks_completed += 1;
                        hours[hour].time_spent_minutes += spent;
                    }
                    const dow = dowOf(task.scheduled_date);
                    if (dow !== null) {
                        dayOfWeek[dow].tasks_completed += 1;
                        dayOfWeek[dow].time_spent_minutes += spent;
                    }
                }
            });

            const byCategory = Array.from(categoryMap.values())
                .map((entry) => ({
                    ...entry,
                    // >0 means it took longer than planned, <0 means faster.
                    variance_minutes: entry.actual_minutes - entry.planned_minutes,
                    accuracy_pct: entry.planned_minutes > 0
                        ? Math.round((entry.actual_minutes / entry.planned_minutes) * 100)
                        : null
                }))
                .sort((a, b) => b.actual_minutes - a.actual_minutes);

            // Focus timing: minutes and sessions per hour and per weekday.
            const focusByHour = Array.from({ length: 24 }, (_, hour) => ({
                hour,
                minutes: 0,
                sessions: 0
            }));
            const focusByDay = DOW_LABELS.map((label, dow) => ({
                dow,
                label,
                minutes: 0,
                sessions: 0
            }));
            let focusTotalMinutes = 0;

            focusSessions.forEach((session) => {
                const minutes = Number(session.duration_minutes) || 0;
                focusTotalMinutes += minutes;
                const hour = hourOf(session.start_time);
                if (hour !== null) {
                    focusByHour[hour].minutes += minutes;
                    focusByHour[hour].sessions += 1;
                }
                const dow = dowOf(session.date);
                if (dow !== null) {
                    focusByDay[dow].minutes += minutes;
                    focusByDay[dow].sessions += 1;
                }
            });

            const pickMax = (list, field) => (
                list.reduce((best, item) => (item[field] > (best?.[field] ?? -1) ? item : best), null)
            );
            const peakTaskHour = pickMax(hours, 'tasks_completed');
            const bestFocusHour = pickMax(focusByHour, 'minutes');
            const bestFocusDay = pickMax(focusByDay, 'minutes');

            res.json({
                success: true,
                data: {
                    range: { start_date: start, end_date: end, days },
                    hour_distribution: hours,
                    day_of_week: dayOfWeek,
                    peak_hour: peakTaskHour && peakTaskHour.tasks_completed > 0 ? peakTaskHour.hour : null,
                    by_category: byCategory,
                    planned_vs_actual: {
                        total_planned_minutes: totalPlanned,
                        total_actual_minutes: totalActual,
                        variance_minutes: totalActual - totalPlanned,
                        accuracy_pct: totalPlanned > 0
                            ? Math.round((totalActual / totalPlanned) * 100)
                            : null
                    },
                    focus: {
                        total_minutes: focusTotalMinutes,
                        by_hour: focusByHour,
                        by_day: focusByDay,
                        best_hour: bestFocusHour && bestFocusHour.minutes > 0 ? bestFocusHour.hour : null,
                        best_day: bestFocusDay && bestFocusDay.minutes > 0 ? bestFocusDay.label : null
                    }
                }
            });
        } catch (error) {
            console.error('Get time-management analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching time-management analytics'
            });
        }
    }

    /**
     * Record a completed focus session for a date
     * @route POST /api/analytics/focus-session
     */
    static async logFocusSession(req, res) {
        try {
            const {
                date,
                start_time,
                end_time,
                duration_minutes,
                status,
                schedule_task_id,
                task_id,
                target_minutes,
                actual_minutes,
                category,
                tags
            } = req.body;

            const normalizedDate = AnalyticsController.normalizeDate(date, req.user.timezone);
            const normalizedStart = AnalyticsController.normalizeClock(start_time);
            const normalizedEnd = AnalyticsController.normalizeClock(end_time);
            const minutes = Math.max(1, parseInt(duration_minutes, 10) || 0);
            const normalizedTarget = Number.isFinite(parseInt(target_minutes, 10))
                ? Math.max(1, parseInt(target_minutes, 10) || 0)
                : null;
            const normalizedActual = Number.isFinite(parseInt(actual_minutes, 10))
                ? Math.max(1, parseInt(actual_minutes, 10) || 0)
                : null;
            const normalizedStatus = status === 'partial' ? 'partial' : 'completed';
            const normalizedCategory = typeof category === 'string' ? category.trim() : '';
            const normalizedTags = AnalyticsController.normalizeTags(tags);

            if (!normalizedStart) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: [{ field: 'start_time', message: 'start_time must be HH:MM or HH:MM:SS' }]
                });
            }

            if (end_time && !normalizedEnd) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: [{ field: 'end_time', message: 'end_time must be HH:MM or HH:MM:SS' }]
                });
            }

            if (minutes < 1 || minutes > 1440) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: [{ field: 'duration_minutes', message: 'duration_minutes must be between 1 and 1440' }]
                });
            }

            const startDateTime = new Date(`${normalizedDate}T${normalizedStart}`);
            const safeStart = Number.isNaN(startDateTime.getTime()) ? new Date() : startDateTime;
            let endDateTime = null;
            let resolvedEndTime = normalizedEnd;
            let resolvedEndDate = normalizedDate;

            if (normalizedEnd) {
                const endCandidate = new Date(`${normalizedDate}T${normalizedEnd}`);
                if (!Number.isNaN(endCandidate.getTime())) {
                    endDateTime = endCandidate;
                }
            }

            if (!endDateTime) {
                endDateTime = new Date(safeStart.getTime() + (minutes * 60 * 1000));
                resolvedEndTime = formatHms(endDateTime);
                resolvedEndDate = localYmd(endDateTime);
            } else if (endDateTime.getTime() < safeStart.getTime()) {
                endDateTime = new Date(safeStart.getTime() + (minutes * 60 * 1000));
                resolvedEndTime = formatHms(endDateTime);
                resolvedEndDate = localYmd(endDateTime);
            }

            await FocusSession.createSession(req.user.id, {
                schedule_task_id: schedule_task_id || null,
                task_id: task_id || null,
                status: normalizedStatus,
                date: normalizedDate,
                start_time: normalizedStart,
                end_time: resolvedEndTime,
                target_minutes: normalizedTarget,
                actual_minutes: normalizedActual,
                duration_minutes: minutes,
                category: normalizedCategory,
                tags: normalizedTags,
                started_at: safeStart,
                ended_at: endDateTime
            });

            const analytics = await Analytics.recordFocusSession(req.user.id, normalizedDate, minutes, normalizedStatus);

            const focus_success_rate = analytics.focus_sessions_total > 0
                ? (analytics.focus_sessions_completed / analytics.focus_sessions_total) * 100
                : 0;

            res.status(201).json({
                success: true,
                message: 'Focus session recorded',
                data: {
                    date: normalizedDate,
                    start_time: normalizedStart,
                    end_time: resolvedEndTime,
                    end_date: resolvedEndDate,
                    duration_minutes: minutes,
                    status: normalizedStatus,
                    schedule_task_id: schedule_task_id || null,
                    task_id: task_id || null,
                    target_minutes: normalizedTarget,
                    actual_minutes: normalizedActual,
                    focus_time_spent_minutes: analytics?.focus_time_spent_minutes || 0,
                    focus_sessions_count: analytics?.focus_sessions_count || 0,
                    focus_sessions_total: analytics?.focus_sessions_total || 0,
                    focus_sessions_completed: analytics?.focus_sessions_completed || 0,
                    focus_success_rate: parseFloat(focus_success_rate.toFixed(2)),
                    category: normalizedCategory,
                    tags: normalizedTags
                }
            });
        } catch (error) {
            console.error('Log focus session error:', error);
            res.status(500).json({
                success: false,
                message: 'Error recording focus session'
            });
        }
    }

    /**
     * Get focus patterns over a date range
     * @route GET /api/analytics/focus-patterns
     */
    static async getFocusPatterns(req, res) {
        try {
            const days = Math.max(1, parseInt(req.query.days, 10) || 14);

            const end = getUserToday(req.user.timezone);
            const start = addDaysToYmd(end, -(days - 1));

            const rows = await Analytics.getFocusByRange(req.user.id, start, end);
            const byDate = new Map(rows.map((row) => [row.date, row]));

            const daily = eachYmd(start, end).map((key) => {
                const row = byDate.get(key);
                return {
                    date: key,
                    focus_time_spent_minutes: row?.focus_time_spent_minutes || 0,
                    focus_sessions_count: row?.focus_sessions_count || 0,
                    focus_sessions_total: row?.focus_sessions_total || row?.focus_sessions_count || 0,
                    focus_sessions_completed: row?.focus_sessions_completed || 0
                };
            });

            const totals = daily.reduce((acc, item) => {
                acc.focus_time_spent_minutes += item.focus_time_spent_minutes;
                acc.focus_sessions_count += item.focus_sessions_count;
                acc.focus_sessions_total += item.focus_sessions_total;
                acc.focus_sessions_completed += item.focus_sessions_completed;
                return acc;
            }, {
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0,
                focus_sessions_total: 0,
                focus_sessions_completed: 0
            });

            const avgDailyFocusMinutes = daily.length > 0
                ? totals.focus_time_spent_minutes / daily.length
                : 0;
            const avgSessionsPerDay = daily.length > 0
                ? totals.focus_sessions_count / daily.length
                : 0;

            const bestFocusDay = daily.reduce((best, item) => (
                item.focus_time_spent_minutes > (best?.focus_time_spent_minutes || 0) ? item : best
            ), null);

            res.json({
                success: true,
                data: {
                    period_days: days,
                    start_date: start,
                    end_date: end,
                    totals,
                    avg_daily_focus_minutes: parseFloat(avgDailyFocusMinutes.toFixed(2)),
                    avg_sessions_per_day: parseFloat(avgSessionsPerDay.toFixed(2)),
                    best_focus_day: bestFocusDay || { date: null, focus_time_spent_minutes: 0, focus_sessions_count: 0 },
                    daily
                }
            });
        } catch (error) {
            console.error('Get focus patterns error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching focus patterns'
            });
        }
    }

    /**
     * Get focus insights over a date range
     * @route GET /api/analytics/focus-insights
     */
    static async getFocusInsights(req, res) {
        try {
            const { start_date, end_date } = req.query;
            const days = Math.max(1, parseInt(req.query.days, 10) || 14);

            let start;
            let end;

            if (start_date && end_date) {
                // Already validated as YYYY-MM-DD, so use the strings directly
                // rather than round-tripping them through Date (which reads them
                // as UTC midnight and can shift the range by a day).
                start = start_date;
                end = end_date;
            } else {
                end = getUserToday(req.user.timezone);
                start = addDaysToYmd(end, -(days - 1));
            }

            const rows = await Analytics.getFocusByRange(req.user.id, start, end);
            const byDate = new Map(rows.map((row) => [row.date, row]));

            const daily = eachYmd(start, end).map((key) => {
                const row = byDate.get(key);
                return {
                    date: key,
                    focus_time_spent_minutes: row?.focus_time_spent_minutes || 0,
                    focus_sessions_count: row?.focus_sessions_count || 0,
                    focus_sessions_total: row?.focus_sessions_total || row?.focus_sessions_count || 0,
                    focus_sessions_completed: row?.focus_sessions_completed || 0
                };
            });

            const totals = daily.reduce((acc, item) => {
                acc.focus_time_spent_minutes += item.focus_time_spent_minutes;
                acc.focus_sessions_count += item.focus_sessions_count;
                acc.focus_sessions_total += item.focus_sessions_total;
                acc.focus_sessions_completed += item.focus_sessions_completed;
                return acc;
            }, {
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0,
                focus_sessions_total: 0,
                focus_sessions_completed: 0
            });

            const avgDailyFocusMinutes = daily.length > 0
                ? totals.focus_time_spent_minutes / daily.length
                : 0;
            const avgSessionsPerDay = daily.length > 0
                ? totals.focus_sessions_count / daily.length
                : 0;

            const bestFocusDay = daily.reduce((best, item) => (
                item.focus_time_spent_minutes > (best?.focus_time_spent_minutes || 0) ? item : best
            ), null);

            const sessions = await FocusSession.getByRange(req.user.id, start, end, 500);

            const categoryTotals = new Map();
            const tagTotals = new Map();

            sessions.forEach((session) => {
                const minutes = session.duration_minutes || 0;
                const category = (session.category || '').trim() || 'Uncategorized';
                const tagsList = Array.isArray(session.tags) ? session.tags : [];

                const categoryData = categoryTotals.get(category) || { label: category, minutes: 0, sessions: 0 };
                categoryData.minutes += minutes;
                categoryData.sessions += 1;
                categoryTotals.set(category, categoryData);

                tagsList.forEach((tag) => {
                    const trimmed = `${tag}`.trim();
                    if (!trimmed) return;
                    const tagData = tagTotals.get(trimmed) || { label: trimmed, minutes: 0, sessions: 0 };
                    tagData.minutes += minutes;
                    tagData.sessions += 1;
                    tagTotals.set(trimmed, tagData);
                });
            });

            const byCategory = Array.from(categoryTotals.values())
                .sort((a, b) => b.minutes - a.minutes);
            const byTag = Array.from(tagTotals.values())
                .sort((a, b) => b.minutes - a.minutes);

            const weeklyMap = new Map();
            daily.forEach((day) => {
                const weekStart = getWeekStart(day.date);
                const current = weeklyMap.get(weekStart) || {
                    week_start: weekStart,
                    focus_time_spent_minutes: 0,
                    focus_sessions_count: 0
                };
                current.focus_time_spent_minutes += day.focus_time_spent_minutes;
                current.focus_sessions_count += day.focus_sessions_count;
                weeklyMap.set(weekStart, current);
            });

            const weekly = Array.from(weeklyMap.values())
                .sort((a, b) => a.week_start.localeCompare(b.week_start))
                .map((item) => ({
                    ...item,
                    week_end: addDaysToYmd(item.week_start, 6)
                }));

            const insights = [];
            if (totals.focus_time_spent_minutes > 0) {
                insights.push(`Total focus time: ${totals.focus_time_spent_minutes} min across ${totals.focus_sessions_count} session(s).`);
            }
            if (bestFocusDay?.date) {
                insights.push(`Best focus day: ${bestFocusDay.date} with ${bestFocusDay.focus_time_spent_minutes} min.`);
            }
            if (byCategory.length > 0) {
                insights.push(`Top category: ${byCategory[0].label} (${byCategory[0].minutes} min).`);
            }

            res.json({
                success: true,
                data: {
                    period_days: daily.length,
                    start_date: start,
                    end_date: end,
                    totals,
                    avg_daily_focus_minutes: parseFloat(avgDailyFocusMinutes.toFixed(2)),
                    avg_sessions_per_day: parseFloat(avgSessionsPerDay.toFixed(2)),
                    best_focus_day: bestFocusDay || { date: null, focus_time_spent_minutes: 0, focus_sessions_count: 0 },
                    daily,
                    weekly,
                    by_category: byCategory,
                    by_tag: byTag,
                    insights
                }
            });
        } catch (error) {
            console.error('Get focus insights error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching focus insights'
            });
        }
    }

    /**
     * Get focus sessions list
     * @route GET /api/analytics/focus-sessions
     */
    static async getFocusSessions(req, res) {
        try {
            const { start_date, end_date } = req.query;
            const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 200));

            const end = end_date || getUserToday(req.user.timezone);
            const start = start_date || addDaysToYmd(end, -13);

            const sessions = await FocusSession.getByRange(req.user.id, start, end, limit);

            res.json({
                success: true,
                data: {
                    start_date: start,
                    end_date: end,
                    sessions
                }
            });
        } catch (error) {
            console.error('Get focus sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching focus sessions'
            });
        }
    }
}

module.exports = AnalyticsController;
