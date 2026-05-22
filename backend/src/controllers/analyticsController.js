const Analytics = require('../models/Analytics');
const FocusSession = require('../models/FocusSession');

const formatHms = (date) => (
    `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}:${`${date.getSeconds()}`.padStart(2, '0')}`
);

const getWeekStart = (date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return start.toISOString().split('T')[0];
};

class AnalyticsController {
    static normalizeDate(value) {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }

        return new Date().toISOString().split('T')[0];
    }

    static normalizeClock(value) {
        if (!value || typeof value !== 'string') return null;
        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return `${value}:00`;
        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) return value;
        return null;
    }

    static clockToSeconds(value) {
        const normalized = this.normalizeClock(value);
        if (!normalized) return null;

        const [h, m, s] = normalized.split(':').map((part) => parseInt(part, 10));
        return (h * 3600) + (m * 60) + s;
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
                        completion_rate: 0
                    }
                });
            }

            const completion_rate = analytics.total_tasks_scheduled > 0
                ? (analytics.total_tasks_completed / analytics.total_tasks_scheduled) * 100
                : 0;

            res.json({
                success: true,
                data: {
                    ...analytics,
                    completion_rate: parseFloat(completion_rate.toFixed(2))
                }
            });
        } catch (error) {
            console.error('Get daily analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching daily analytics',
                error: error.message
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
                // Default to current week
                const today = new Date();
                const start = new Date(today);
                start.setDate(today.getDate() - today.getDay());
                const end = new Date(start);
                end.setDate(start.getDate() + 6);

                startDate = start.toISOString().split('T')[0];
                endDate = end.toISOString().split('T')[0];
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
                return acc;
            }, {
                total_tasks_scheduled: 0,
                total_tasks_completed: 0,
                total_time_scheduled_minutes: 0,
                total_time_spent_minutes: 0,
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0
            });

            const completion_rate = totals.total_tasks_scheduled > 0
                ? (totals.total_tasks_completed / totals.total_tasks_scheduled) * 100
                : 0;

            res.json({
                success: true,
                data: {
                    start_date: startDate,
                    end_date: endDate,
                    daily: analytics,
                    totals: {
                        ...totals,
                        completion_rate: parseFloat(completion_rate.toFixed(2))
                    }
                }
            });
        } catch (error) {
            console.error('Get weekly analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching weekly analytics',
                error: error.message
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
                // Default to current month
                const today = new Date();
                selectedYear = today.getFullYear();
                selectedMonth = today.getMonth() + 1;
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
                return acc;
            }, {
                total_tasks_scheduled: 0,
                total_tasks_completed: 0,
                total_time_scheduled_minutes: 0,
                total_time_spent_minutes: 0,
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0
            });

            const completion_rate = totals.total_tasks_scheduled > 0
                ? (totals.total_tasks_completed / totals.total_tasks_scheduled) * 100
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
                        avg_daily_tasks: parseFloat(avg_daily_tasks.toFixed(2))
                    }
                }
            });
        } catch (error) {
            console.error('Get monthly analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching monthly analytics',
                error: error.message
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
                message: 'Error fetching analytics summary',
                error: error.message
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

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - parseInt(days, 10));

            const start = startDate.toISOString().split('T')[0];
            const end = endDate.toISOString().split('T')[0];

            const analytics = await Analytics.findByWeek(req.user.id, start, end);

            // Calculate trends
            const trends = analytics.map((day) => ({
                date: day.date,
                completion_rate: day.total_tasks_scheduled > 0
                    ? (day.total_tasks_completed / day.total_tasks_scheduled) * 100
                    : 0,
                total_tasks: day.total_tasks_scheduled,
                completed_tasks: day.total_tasks_completed,
                time_spent_hours: (day.total_time_spent_minutes / 60).toFixed(2)
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
                message: 'Error fetching trends',
                error: error.message
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
                category,
                tags
            } = req.body;

            const normalizedDate = AnalyticsController.normalizeDate(date);
            const normalizedStart = AnalyticsController.normalizeClock(start_time);
            const normalizedEnd = AnalyticsController.normalizeClock(end_time);
            const minutes = Math.max(1, parseInt(duration_minutes, 10) || 0);
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
                resolvedEndDate = endDateTime.toISOString().split('T')[0];
            } else if (endDateTime.getTime() < safeStart.getTime()) {
                endDateTime = new Date(safeStart.getTime() + (minutes * 60 * 1000));
                resolvedEndTime = formatHms(endDateTime);
                resolvedEndDate = endDateTime.toISOString().split('T')[0];
            }

            await FocusSession.createSession(req.user.id, {
                date: normalizedDate,
                start_time: normalizedStart,
                end_time: resolvedEndTime,
                duration_minutes: minutes,
                category: normalizedCategory,
                tags: normalizedTags,
                started_at: safeStart,
                ended_at: endDateTime
            });

            const analytics = await Analytics.recordFocusSession(req.user.id, normalizedDate, minutes);

            res.status(201).json({
                success: true,
                message: 'Focus session recorded',
                data: {
                    date: normalizedDate,
                    start_time: normalizedStart,
                    end_time: resolvedEndTime,
                    end_date: resolvedEndDate,
                    duration_minutes: minutes,
                    focus_time_spent_minutes: analytics?.focus_time_spent_minutes || 0,
                    focus_sessions_count: analytics?.focus_sessions_count || 0,
                    category: normalizedCategory,
                    tags: normalizedTags
                }
            });
        } catch (error) {
            console.error('Log focus session error:', error);
            res.status(500).json({
                success: false,
                message: 'Error recording focus session',
                error: error.message
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

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days + 1);

            const start = startDate.toISOString().split('T')[0];
            const end = endDate.toISOString().split('T')[0];

            const rows = await Analytics.getFocusByRange(req.user.id, start, end);
            const byDate = new Map(rows.map((row) => [row.date, row]));

            const daily = [];
            const walker = new Date(startDate);
            while (walker <= endDate) {
                const key = walker.toISOString().split('T')[0];
                const row = byDate.get(key);
                daily.push({
                    date: key,
                    focus_time_spent_minutes: row?.focus_time_spent_minutes || 0,
                    focus_sessions_count: row?.focus_sessions_count || 0
                });
                walker.setDate(walker.getDate() + 1);
            }

            const totals = daily.reduce((acc, item) => {
                acc.focus_time_spent_minutes += item.focus_time_spent_minutes;
                acc.focus_sessions_count += item.focus_sessions_count;
                return acc;
            }, {
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0
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
                message: 'Error fetching focus patterns',
                error: error.message
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

            let startDate;
            let endDate;

            if (start_date && end_date) {
                startDate = new Date(start_date);
                endDate = new Date(end_date);
            } else {
                endDate = new Date();
                startDate = new Date();
                startDate.setDate(endDate.getDate() - days + 1);
            }

            const start = startDate.toISOString().split('T')[0];
            const end = endDate.toISOString().split('T')[0];

            const rows = await Analytics.getFocusByRange(req.user.id, start, end);
            const byDate = new Map(rows.map((row) => [row.date, row]));

            const daily = [];
            const walker = new Date(startDate);
            while (walker <= endDate) {
                const key = walker.toISOString().split('T')[0];
                const row = byDate.get(key);
                daily.push({
                    date: key,
                    focus_time_spent_minutes: row?.focus_time_spent_minutes || 0,
                    focus_sessions_count: row?.focus_sessions_count || 0
                });
                walker.setDate(walker.getDate() + 1);
            }

            const totals = daily.reduce((acc, item) => {
                acc.focus_time_spent_minutes += item.focus_time_spent_minutes;
                acc.focus_sessions_count += item.focus_sessions_count;
                return acc;
            }, {
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0
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
                const weekStart = getWeekStart(new Date(`${day.date}T00:00:00`));
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
                    week_end: (() => {
                        const endWeek = new Date(`${item.week_start}T00:00:00`);
                        endWeek.setDate(endWeek.getDate() + 6);
                        return endWeek.toISOString().split('T')[0];
                    })()
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
                message: 'Error fetching focus insights',
                error: error.message
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

            const endDate = end_date ? new Date(end_date) : new Date();
            const startDate = start_date ? new Date(start_date) : new Date(endDate);
            if (!start_date) {
                startDate.setDate(endDate.getDate() - 13);
            }

            const start = startDate.toISOString().split('T')[0];
            const end = endDate.toISOString().split('T')[0];

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
                message: 'Error fetching focus sessions',
                error: error.message
            });
        }
    }
}

module.exports = AnalyticsController;
