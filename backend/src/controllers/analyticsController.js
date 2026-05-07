const Analytics = require('../models/Analytics');

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
                duration_minutes
            } = req.body;

            const normalizedDate = this.normalizeDate(date);
            const normalizedStart = this.normalizeClock(start_time);
            const normalizedEnd = this.normalizeClock(end_time);
            const minutes = Math.max(1, parseInt(duration_minutes, 10) || 0);

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

            if (normalizedEnd) {
                const startSeconds = this.clockToSeconds(normalizedStart);
                const endSeconds = this.clockToSeconds(normalizedEnd);

                // For this endpoint, sessions are expected to end the same day.
                if (startSeconds !== null && endSeconds !== null && endSeconds < startSeconds) {
                    return res.status(400).json({
                        success: false,
                        message: 'Validation failed',
                        errors: [{ field: 'end_time', message: 'end_time cannot be earlier than start_time for the same date' }]
                    });
                }
            }

            const analytics = await Analytics.recordFocusSession(req.user.id, normalizedDate, minutes);

            res.status(201).json({
                success: true,
                message: 'Focus session recorded',
                data: {
                    date: normalizedDate,
                    start_time: normalizedStart,
                    end_time: normalizedEnd,
                    duration_minutes: minutes,
                    focus_time_spent_minutes: analytics?.focus_time_spent_minutes || 0,
                    focus_sessions_count: analytics?.focus_sessions_count || 0
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
}

module.exports = AnalyticsController;
