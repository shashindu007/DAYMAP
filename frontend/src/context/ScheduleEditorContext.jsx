import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSchedule } from './ScheduleContext';
import ScheduleEditor from '../components/schedule/ScheduleEditor';

/**
 * Makes the schedule editor reachable from anywhere.
 *
 * Task creation used to exist only inside ScheduleEditor, which was mounted
 * solely by the Dashboard page. So "+ New Task" on /tasks navigated to /today,
 * which has no form either — a two-hop dead end. The editor now lives above the
 * router and any page can open it in place.
 */
const ScheduleEditorContext = createContext(null);

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const ScheduleEditorProvider = ({ children }) => {
    const { scheduleByDate, fetchSchedule, saveSchedule } = useSchedule();

    const [editingDate, setEditingDate] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    /** @param {string} [date] YYYY-MM-DD; defaults to today. */
    const openEditor = useCallback((date) => {
        setSaveError('');
        setEditingDate(date || toYmd(new Date()));
    }, []);

    const closeEditor = useCallback(() => {
        setEditingDate(null);
        setSaveError('');
    }, []);

    useEffect(() => {
        if (editingDate) fetchSchedule(editingDate).catch(() => null);
    }, [editingDate, fetchSchedule]);

    const handleSave = useCallback(async (slots) => {
        if (!editingDate) return;
        try {
            setSaving(true);
            setSaveError('');
            await saveSchedule(editingDate, slots, true);
            await fetchSchedule(editingDate);
            setEditingDate(null);
        } catch (error) {
            setSaveError(error?.errors?.[0]?.message || error?.message || 'Failed to save schedule.');
        } finally {
            setSaving(false);
        }
    }, [editingDate, fetchSchedule, saveSchedule]);

    const value = useMemo(() => ({
        openEditor,
        closeEditor,
        editingDate,
        saveError
    }), [openEditor, closeEditor, editingDate, saveError]);

    return (
        <ScheduleEditorContext.Provider value={value}>
            {children}
            {editingDate && (
                <ScheduleEditor
                    date={editingDate}
                    tasks={scheduleByDate[editingDate]?.tasks || []}
                    onSave={handleSave}
                    onClose={closeEditor}
                    saving={saving}
                />
            )}
        </ScheduleEditorContext.Provider>
    );
};

export const useScheduleEditor = () => {
    const context = useContext(ScheduleEditorContext);
    if (!context) {
        throw new Error('useScheduleEditor must be used within a ScheduleEditorProvider');
    }
    return context;
};

export default ScheduleEditorContext;
