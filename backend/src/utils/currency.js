/**
 * Currency preference defaults, and a normalizer for user documents that
 * predate the field.
 *
 * Same trap as notification preferences: Mongoose schema defaults only apply
 * when a document is CREATED, so every account that existed before the wallet
 * shipped reads back `undefined`. Normalizing on read keeps the API response
 * shape identical for old and new accounts.
 *
 * One currency per user. Amounts are stored as integer minor units and are
 * never converted between currencies - changing this setting reinterprets what
 * the stored numbers mean, it does not convert them.
 *
 * Mirrored on the frontend in frontend/src/utils/money.js (CURRENCY_OPTIONS).
 */

const DEFAULT_CURRENCY = 'LKR';

/**
 * ISO 4217 codes offered in Settings. `minor_units` is how many decimal places
 * the currency actually has - JPY has none, so 1234 minor units is ¥1,234, not
 * ¥12.34. Intl.NumberFormat knows this too, but the parser needs it as data.
 */
const SUPPORTED_CURRENCIES = [
    { code: 'LKR', label: 'Sri Lankan Rupee', minor_units: 2 },
    { code: 'USD', label: 'US Dollar', minor_units: 2 },
    { code: 'EUR', label: 'Euro', minor_units: 2 },
    { code: 'GBP', label: 'British Pound', minor_units: 2 },
    { code: 'INR', label: 'Indian Rupee', minor_units: 2 },
    { code: 'AUD', label: 'Australian Dollar', minor_units: 2 },
    { code: 'CAD', label: 'Canadian Dollar', minor_units: 2 },
    { code: 'SGD', label: 'Singapore Dollar', minor_units: 2 },
    { code: 'AED', label: 'UAE Dirham', minor_units: 2 },
    { code: 'JPY', label: 'Japanese Yen', minor_units: 0 }
];

const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((entry) => entry.code);

const isSupportedCurrency = (value) => (
    typeof value === 'string' && SUPPORTED_CURRENCY_CODES.includes(value.toUpperCase())
);

/**
 * @param {*} value raw currency off a user record
 * @returns {String} always a supported code, never undefined
 */
const normalizeCurrency = (value) => (
    isSupportedCurrency(value) ? value.toUpperCase() : DEFAULT_CURRENCY
);

module.exports = {
    DEFAULT_CURRENCY,
    SUPPORTED_CURRENCIES,
    SUPPORTED_CURRENCY_CODES,
    isSupportedCurrency,
    normalizeCurrency
};
