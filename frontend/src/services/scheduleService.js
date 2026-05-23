import api from './api';

const scheduleService = {
    getScheduleByDate: async (date) => api.get(`/schedules/${date}`),
    getTodaySchedule: async () => api.get('/schedules/today'),
    getTomorrowSchedule: async () => api.get('/schedules/tomorrow'),
    getScheduleRange: async (startDate, endDate) => api.get(`/schedules/range?start_date=${startDate}&end_date=${endDate}`),
    saveSchedule: async (payload) => api.post('/schedules', payload),
    replaceSchedule: async (date, payload) => api.put(`/schedules/${date}`, payload),
    updateScheduleTask: async (id, payload) => api.patch(`/schedules/tasks/${id}`, payload),
    updateScheduleTaskStatus: async (id, status) => api.patch(`/schedules/tasks/${id}/status`, { status }),
    deleteScheduleTask: async (id) => api.delete(`/schedules/tasks/${id}`),
    deleteScheduleByDate: async (date) => api.delete(`/schedules/${date}`)
};

export default scheduleService;
