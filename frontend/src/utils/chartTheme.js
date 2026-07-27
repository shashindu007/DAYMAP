/**
 * Chart.js theming bridge.
 *
 * Charts are the one part of the UI that CSS cannot reach: colours are baked
 * into JS config objects, so they never participated in the design tokens and
 * never responded to the theme toggle. Chart.js's default tick/legend colour is
 * #666, which on the dark app background (--app-bg: #0b1020) is effectively
 * unreadable — every axis label and legend entry on Analytics and Focus.
 *
 * This reads the tokens straight off the document so charts stay in step with
 * App.css instead of carrying a second, hardcoded palette.
 */
import { Chart as ChartJS } from 'chart.js';

const readToken = (name, fallback) => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return value?.trim() || fallback;
};

/**
 * Categorical series colours. Ordered so the first two — the pairing used by
 * every grouped bar on the page — are clearly distinct in both themes.
 */
export const seriesColors = (darkMode) => (darkMode
    ? ['#a78bfa', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#93c5fd']
    : ['#7c3aed', '#0891b2', '#059669', '#d97706', '#e11d48', '#2563eb']);

/** Muted fill for the "planned"/baseline series in a planned-vs-actual pair. */
export const baselineColor = (darkMode) => (darkMode
    ? 'rgba(148, 163, 184, 0.45)'
    : 'rgba(100, 116, 139, 0.35)');

/**
 * Applies token-derived defaults globally. Call from a component effect that
 * re-runs when the theme changes.
 */
export const applyChartTheme = (darkMode) => {
    ChartJS.defaults.color = readToken('--text-secondary', darkMode ? '#a3adc8' : '#5c6584');
    ChartJS.defaults.borderColor = readToken('--divider', 'rgba(148, 163, 184, 0.2)');
    ChartJS.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ChartJS.defaults.font.size = 12;

    ChartJS.defaults.plugins.legend.labels.boxWidth = 10;
    ChartJS.defaults.plugins.legend.labels.boxHeight = 10;
    ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
    ChartJS.defaults.plugins.legend.labels.padding = 16;

    ChartJS.defaults.plugins.tooltip.backgroundColor = darkMode ? '#181f36' : '#16192b';
    ChartJS.defaults.plugins.tooltip.titleColor = '#ffffff';
    ChartJS.defaults.plugins.tooltip.bodyColor = darkMode ? '#eef1f9' : '#ffffff';
    ChartJS.defaults.plugins.tooltip.borderColor = readToken('--border', 'rgba(148,163,184,0.28)');
    ChartJS.defaults.plugins.tooltip.borderWidth = 1;
    ChartJS.defaults.plugins.tooltip.padding = 10;
    ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
    ChartJS.defaults.plugins.tooltip.displayColors = true;
};
