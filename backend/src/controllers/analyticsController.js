const Analytics = require('../models/Analytics');

class AnalyticsController {
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
            
            let startDate, endDate;
            
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
                return acc;
            }, {
                total_tasks_scheduled: 0,
                total_tasks_completed: 0,
                total_time_scheduled_minutes: 0,
                total_time_spent_minutes: 0
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
            
            let selectedYear, selectedMonth;
            
            if (year && month) {
                selectedYear = parseInt(year);
                selectedMonth = parseInt(month);
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
                return acc;
            }, {
                total_tasks_scheduled: 0,
                total_tasks_completed: 0,
                total_time_scheduled_minutes: 0,
                total_time_spent_minutes: 0
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
            startDate.setDate(endDate.getDate() - parseInt(days));
            
            const start = startDate.toISOString().split('T')[0];
            const end = endDate.toISOString().split('T')[0];
            
            const analytics = await Analytics.findByWeek(req.user.id, start, end);
            
            // Calculate trends
            const trends = analytics.map(day => ({
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
}

module.exports = AnalyticsController;
