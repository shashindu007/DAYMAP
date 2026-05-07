const STORAGE_KEY = 'daymap_route_usage_v1';
const MAX_ROUTE_SESSION_MS = 30 * 60 * 1000;

const ROUTE_LABELS = {
    '/dashboard': 'Dashboard',
    '/today': 'Today View',
    '/tasks': 'Task Management',
    '/week': 'Week View',
    '/routines': 'Routines',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
    '/login': 'Login',
    '/register': 'Register'
};

const getInitialState = () => ({
    routes: {},
    lastRoute: null,
    lastTimestamp: null,
    updatedAt: null
});

const readState = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getInitialState();
        const parsed = JSON.parse(raw);
        return {
            ...getInitialState(),
            ...parsed,
            routes: parsed?.routes || {}
        };
    } catch (error) {
        return getInitialState();
    }
};

const writeState = (state) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        // Ignore storage write failures (private mode, quota exceeded, etc.)
    }
};

const withActiveRouteTime = (state, now) => {
    if (!state.lastRoute || !state.lastTimestamp) return state;

    const elapsed = Math.max(0, Math.min(now - state.lastTimestamp, MAX_ROUTE_SESSION_MS));
    if (elapsed === 0) return state;

    const previous = state.routes[state.lastRoute] || {
        visits: 0,
        totalMs: 0,
        lastVisitedAt: null
    };

    return {
        ...state,
        routes: {
            ...state.routes,
            [state.lastRoute]: {
                ...previous,
                totalMs: (previous.totalMs || 0) + elapsed
            }
        }
    };
};

const normalizePath = (path) => {
    if (!path || path === '/') return '/today';
    return path;
};

const usageService = {
    recordRouteVisit: (path) => {
        const normalizedPath = normalizePath(path);
        const now = Date.now();
        let state = readState();

        // Attribute time spent to previous route.
        state = withActiveRouteTime(state, now);

        const current = state.routes[normalizedPath] || {
            visits: 0,
            totalMs: 0,
            lastVisitedAt: null
        };

        state = {
            ...state,
            routes: {
                ...state.routes,
                [normalizedPath]: {
                    ...current,
                    visits: (current.visits || 0) + 1,
                    lastVisitedAt: new Date(now).toISOString()
                }
            },
            lastRoute: normalizedPath,
            lastTimestamp: now,
            updatedAt: new Date(now).toISOString()
        };

        writeState(state);
        return state;
    },

    getUsageSummary: () => {
        const now = Date.now();
        const state = withActiveRouteTime(readState(), now);

        const routes = Object.entries(state.routes || {})
            .map(([path, metrics]) => ({
                path,
                label: ROUTE_LABELS[path] || path,
                visits: metrics.visits || 0,
                totalMs: metrics.totalMs || 0,
                totalMinutes: parseFloat(((metrics.totalMs || 0) / 60000).toFixed(2)),
                lastVisitedAt: metrics.lastVisitedAt || null
            }))
            .sort((a, b) => b.visits - a.visits);

        const totalVisits = routes.reduce((acc, route) => acc + route.visits, 0);
        const totalMinutes = routes.reduce((acc, route) => acc + route.totalMinutes, 0);

        return {
            routes,
            topRoutes: routes.slice(0, 4),
            totalVisits,
            totalMinutes: parseFloat(totalMinutes.toFixed(2))
        };
    }
};

export default usageService;
