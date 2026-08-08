/**
 * Money maths. Pure - imports nothing.
 *
 * Amounts are INTEGER MINOR UNITS everywhere: the API, the store, the context,
 * this module's inputs and outputs. A floating point number exists only for the
 * few microseconds Intl.NumberFormat needs one. That is deliberate: 0.1 + 0.2
 * is not 0.3, and adding thirty grocery receipts is exactly where that stops
 * being a curiosity.
 *
 * Nothing here reaches services/api.js, so CRA's Jest can test it directly with
 * no jest.mock and no jsdom matchers. That is the whole reason this file exists
 * as a separate module rather than living inside the Wallet page.
 *
 * Mirrors backend/src/utils/currency.js for the supported list.
 */

export const DEFAULT_CURRENCY = 'LKR';

/**
 * `minorUnits` is how many decimal places the currency really has. JPY has
 * none, so 1234 minor units is ¥1,234 and not ¥12.34. Intl knows this too, but
 * the parser needs it as data before any Intl call happens.
 */
export const CURRENCY_OPTIONS = [
    { code: 'LKR', label: 'Sri Lankan Rupee (Rs)', minorUnits: 2 },
    { code: 'USD', label: 'US Dollar ($)', minorUnits: 2 },
    { code: 'EUR', label: 'Euro (€)', minorUnits: 2 },
    { code: 'GBP', label: 'British Pound (£)', minorUnits: 2 },
    { code: 'INR', label: 'Indian Rupee (₹)', minorUnits: 2 },
    { code: 'AUD', label: 'Australian Dollar (A$)', minorUnits: 2 },
    { code: 'CAD', label: 'Canadian Dollar (C$)', minorUnits: 2 },
    { code: 'SGD', label: 'Singapore Dollar (S$)', minorUnits: 2 },
    { code: 'AED', label: 'UAE Dirham', minorUnits: 2 },
    { code: 'JPY', label: 'Japanese Yen (¥)', minorUnits: 0 }
];

const MINOR_UNITS_BY_CODE = CURRENCY_OPTIONS.reduce((map, entry) => {
    map[entry.code] = entry.minorUnits;
    return map;
}, {});

/** Decimal places for a currency; 2 for anything unrecognised. */
export const minorUnitsFor = (currency) => {
    const digits = MINOR_UNITS_BY_CODE[String(currency || '').toUpperCase()];
    return Number.isInteger(digits) ? digits : 2;
};

/** Largest amount accepted, matching the backend validator's ceiling. */
export const MAX_AMOUNT_CENTS = 99999999999;

/**
 * Parse user keyboard input into integer minor units.
 *
 * Works on the digit STRING, never `value * 100` - because 19.99 * 100 is
 * 1998.9999999999998, and Math.round hiding that is luck rather than a design.
 *
 * Returns null for anything it cannot read exactly. A null is a message to the
 * user; a wrong number is a corrupted ledger.
 *
 * @param {String|Number} raw   e.g. '1,234.50'
 * @param {String} currency     decides how many decimals are meaningful
 * @returns {Number|null} integer minor units, or null when unparseable
 */
export const parseMoneyInput = (raw, currency = DEFAULT_CURRENCY) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) return null;
        return parseMoneyInput(raw.toString(), currency);
    }
    if (typeof raw !== 'string') return null;

    let text = raw.trim();
    if (!text) return null;

    const negative = text.startsWith('-');
    if (negative || text.startsWith('+')) text = text.slice(1);

    // Thousands separators only. A comma used as a DECIMAL separator
    // ('1234,50') is rejected rather than read as 123450 - turning a silent
    // 100x error into a visible message.
    text = text.replace(/,/g, (match, offset, whole) => {
        const after = whole.slice(offset + 1);
        return /^\d{3}(\D|$)/.test(after) ? '' : ',';
    });

    if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') return null;

    const digits = minorUnitsFor(currency);
    const [whole = '', fraction = ''] = text.split('.');

    const wholePart = whole || '0';
    // One extra digit is kept so the final rounding is half-up on the exact
    // decimal string rather than on a float.
    const padded = `${fraction}${'0'.repeat(digits + 1)}`.slice(0, digits + 1);

    const scaled = Number(`${wholePart}${padded.slice(0, digits)}`);
    const rounder = Number(padded.slice(digits, digits + 1));
    if (!Number.isFinite(scaled)) return null;

    const cents = scaled + (rounder >= 5 ? 1 : 0);
    if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;

    return negative ? -cents : cents;
};

/** An amount the expense API will accept: a whole, positive, in-range number. */
export const isValidExpenseCents = (cents) => (
    Number.isSafeInteger(cents) && cents >= 1 && cents <= MAX_AMOUNT_CENTS
);

/**
 * Render minor units for display.
 *
 * `locale` is an option because ICU renders LKR as "Rs" on some Node builds and
 * "LKR" on others - tests must pin it or they flake. Never throws: a bad
 * currency code falls back to "CODE 1,234.50" rather than taking the page down.
 *
 * @param {Number} cents
 * @param {String} currency
 * @param {Object} [options]
 * @param {String} [options.locale]
 * @param {Boolean} [options.signed]  force a leading + on positives
 */
export const formatMoney = (cents, currency = DEFAULT_CURRENCY, options = {}) => {
    const { locale, signed = false } = options;
    const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
    const digits = minorUnitsFor(code);

    const safe = Number.isFinite(cents) ? cents : 0;
    const value = safe / (10 ** digits);
    const prefix = signed && safe > 0 ? '+' : '';

    try {
        return prefix + new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }).format(value);
    } catch {
        // Unknown ISO code, or an environment without full ICU.
        return `${prefix}${code} ${new Intl.NumberFormat(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }).format(value)}`;
    }
};

/**
 * Short money for a space that cannot hold a real amount - a calendar cell.
 *
 * "3.7K", "340", "<1". Precision is deliberately traded for width, so every
 * caller MUST also expose the exact figure through formatMoney in a title or an
 * aria-label. The symbol is off by default: the currency is already stated
 * elsewhere on the page, and "Rs 3.7K" does not fit in a seventh of a card.
 *
 * Never throws - same two-level fallback as formatMoney.
 *
 * @param {Number} cents
 * @param {String} currency
 * @param {Object} [options]
 * @param {String} [options.locale]
 * @param {Boolean} [options.withSymbol]  render the currency symbol too
 */
export const compactMoney = (cents, currency = DEFAULT_CURRENCY, options = {}) => {
    const { locale, withSymbol = false } = options;
    const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
    const digits = minorUnitsFor(code);

    const safe = Number.isFinite(cents) ? cents : 0;
    const exact = safe / (10 ** digits);
    const magnitude = Math.abs(exact);

    // A real expense must never render as "0". Below one major unit the true
    // figure does not fit and rounding it away would be a lie, so say so.
    if (magnitude > 0 && magnitude < 1) return `${safe < 0 ? '-' : ''}<1`;

    // Branch on the ROUNDED magnitude, not the raw one: 999.50 has to render
    // "1K", because the plain branch would round it to the wider "1,000" that
    // compacting was avoiding in the first place.
    const compact = Math.round(magnitude) >= 1000;

    // Intl decides to say "K" from the value it is handed, not from what it
    // will print - so 999.5 compacts to "999.5" and defeats the branch above.
    // Snapping that sliver to its rounded form is what makes it read "1K".
    const value = compact && magnitude < 1000 ? Math.round(exact) : exact;

    // minimumFractionDigits: 0 is not optional. Under style:'currency' Intl
    // defaults the minimum to the currency's own digits (2), and a maximum
    // below that minimum is a RangeError - which the catch would silently
    // swallow, dropping every 2-decimal currency into the fallback.
    const shape = compact
        ? {
            notation: 'compact',
            compactDisplay: 'short',
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        }
        : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

    if (!withSymbol) {
        try {
            return new Intl.NumberFormat(locale, shape).format(value);
        } catch {
            return `${Math.round(value)}`;
        }
    }

    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            ...shape
        }).format(value);
    } catch {
        // Unknown ISO code, or an environment without full ICU.
        return `${code} ${new Intl.NumberFormat(locale, shape).format(value)}`;
    }
};

/**
 * Where a category sits against its budget.
 * 'none'  - no budget set
 * 'under' - comfortably below
 * 'near'  - at or past 90%, including exactly on budget
 * 'over'  - spent more than budgeted
 *
 * Exactly at budget reads 'near', not 'over': you have not overspent until you
 * have actually overspent.
 */
export const budgetState = (spentCents, budgetCents) => {
    if (!Number.isFinite(budgetCents) || budgetCents <= 0) return 'none';
    const spent = Number.isFinite(spentCents) ? spentCents : 0;
    if (spent > budgetCents) return 'over';
    if (spent >= budgetCents * 0.9) return 'near';
    return 'under';
};

/** Percentage spent, rounded. 0 when there is no budget - never NaN. */
export const percentOf = (spentCents, budgetCents) => {
    if (!Number.isFinite(budgetCents) || budgetCents <= 0) return 0;
    const spent = Number.isFinite(spentCents) ? spentCents : 0;
    return Math.round((spent / budgetCents) * 100);
};

/** Progress-bar width: percentOf clamped to 0..100 so the fill cannot overflow. */
export const barPercent = (spentCents, budgetCents) => (
    Math.min(100, Math.max(0, percentOf(spentCents, budgetCents)))
);
