/**
 * money.js is pure and imports nothing, so this file needs no jest.mock and no
 * @testing-library/jest-dom - it asserts no DOM matchers.
 *
 * Every formatMoney assertion pins { locale: 'en-US' }: ICU renders LKR as
 * "Rs" on some Node builds and "LKR" on others, so asserting against the
 * default locale is a guaranteed flake.
 */
import {
    parseMoneyInput,
    formatMoney,
    compactMoney,
    isValidExpenseCents,
    budgetState,
    percentOf,
    barPercent,
    minorUnitsFor,
    MAX_AMOUNT_CENTS
} from './money';

const EN = { locale: 'en-US' };

/**
 * ICU separates a currency code from the number with U+00A0 (a non-breaking
 * space), and which space it picks varies by code and Node build. Comparing
 * raw strings makes an assertion fail against output that looks identical, so
 * every space-like character is normalized before comparing.
 */
const norm = (value) => value.replace(/[\s  ]/g, ' ');

describe('parseMoneyInput', () => {
    it('reads whole numbers and decimals', () => {
        expect(parseMoneyInput('12')).toBe(1200);
        expect(parseMoneyInput('12.3')).toBe(1230);
        expect(parseMoneyInput('12.34')).toBe(1234);
        expect(parseMoneyInput('0')).toBe(0);
    });

    it('handles partial decimal forms a keyboard produces mid-typing', () => {
        expect(parseMoneyInput('.5')).toBe(50);
        expect(parseMoneyInput('12.')).toBe(1200);
    });

    it('strips thousands separators and surrounding whitespace', () => {
        expect(parseMoneyInput('1,234.50')).toBe(123450);
        expect(parseMoneyInput('  1,234.50  ')).toBe(123450);
        expect(parseMoneyInput('1,000,000')).toBe(100000000);
    });

    it('rejects a comma used as a decimal separator rather than guessing', () => {
        // The dangerous case: read as a thousands separator this would be
        // 123450, a 100x error. A null becomes a message to the user instead.
        expect(parseMoneyInput('1234,50')).toBeNull();
    });

    it('does not lose precision on values that break float multiplication', () => {
        // 19.99 * 100 === 1998.9999999999998 in IEEE-754. This is the single
        // assertion the whole string-based implementation exists for.
        expect(parseMoneyInput('19.99')).toBe(1999);
        expect(parseMoneyInput('0.29')).toBe(29);
        expect(parseMoneyInput('1.005')).toBe(101);
        expect(parseMoneyInput('8.13')).toBe(813);
    });

    it('rounds half-up at the minor-unit boundary', () => {
        expect(parseMoneyInput('0.005')).toBe(1);
        expect(parseMoneyInput('0.004')).toBe(0);
        expect(parseMoneyInput('19.999')).toBe(2000);
    });

    it('respects zero-decimal currencies', () => {
        expect(parseMoneyInput('1234', 'JPY')).toBe(1234);
        expect(parseMoneyInput('12.5', 'JPY')).toBe(13);
        expect(parseMoneyInput('12.4', 'JPY')).toBe(12);
    });

    it('carries the sign but does not call a negative amount valid', () => {
        expect(parseMoneyInput('-5')).toBe(-500);
        expect(isValidExpenseCents(-500)).toBe(false);
    });

    it('accepts numbers as well as strings', () => {
        expect(parseMoneyInput(12.34)).toBe(1234);
        expect(parseMoneyInput(19.99)).toBe(1999);
    });

    it('returns null for anything it cannot read exactly', () => {
        ['', '   ', 'abc', '1.2.3', '-', '.', '12abc', '$12', '1 234']
            .forEach((junk) => expect(parseMoneyInput(junk)).toBeNull());
        [null, undefined, {}, [], NaN, Infinity, true]
            .forEach((junk) => expect(parseMoneyInput(junk)).toBeNull());
    });

    it('returns null past the API ceiling instead of sending a rejected amount', () => {
        expect(parseMoneyInput('999999999999999999')).toBeNull();
        expect(parseMoneyInput(`${MAX_AMOUNT_CENTS + 1}`)).toBeNull();
    });
});

describe('formatMoney', () => {
    it('renders minor units as a decimal amount', () => {
        expect(formatMoney(123450, 'LKR', EN)).toContain('1,234.50');
        expect(formatMoney(42, 'USD', EN)).toContain('0.42');
        expect(formatMoney(100, 'USD', EN)).toBe('$1.00');
    });

    it('never throws on absent or nonsense input', () => {
        [null, undefined, NaN, Infinity].forEach((bad) => {
            expect(() => formatMoney(bad, 'USD', EN)).not.toThrow();
            expect(formatMoney(bad, 'USD', EN)).toBe('$0.00');
        });
    });

    it('renders an unrecognised but well-formed code without throwing', () => {
        // Intl accepts any three letters, so this goes through the normal path
        // and prints the code in place of a symbol.
        expect(() => formatMoney(100, 'ZZZ', EN)).not.toThrow();
        expect(norm(formatMoney(100, 'ZZZ', EN))).toBe('ZZZ 1.00');
    });

    it('falls back rather than throwing on a malformed currency code', () => {
        // These make Intl throw RangeError; the fallback path must catch it.
        ['US', 'TOOLONG', '', '12'].forEach((bad) => {
            expect(() => formatMoney(100, bad, EN)).not.toThrow();
        });
        expect(norm(formatMoney(100, 'TOOLONG', EN))).toBe('TOOLONG 1.00');
    });

    it('gives zero-decimal currencies no decimal places', () => {
        expect(formatMoney(1234, 'JPY', EN)).not.toContain('.');
        expect(formatMoney(1234, 'JPY', EN)).toContain('1,234');
    });

    it('marks positives when asked', () => {
        expect(formatMoney(500, 'USD', { ...EN, signed: true })).toBe('+$5.00');
        expect(formatMoney(-500, 'USD', { ...EN, signed: true })).toContain('5.00');
        expect(formatMoney(500, 'USD', EN)).toBe('$5.00');
    });

    it('round-trips through the parser', () => {
        [1, 42, 1999, 123450, 100000000].forEach((cents) => {
            const rendered = formatMoney(cents, 'USD', EN).replace(/[^\d.,-]/g, '');
            expect(parseMoneyInput(rendered)).toBe(cents);
        });
    });
});

describe('compactMoney', () => {
    it('shortens thousands and millions', () => {
        expect(compactMoney(370000, 'LKR', EN)).toBe('3.7K');
        expect(compactMoney(1200000, 'LKR', EN)).toBe('12K');
        expect(compactMoney(123456789, 'LKR', EN)).toBe('1.2M');
    });

    it('prints whole major units below a thousand, with no symbol by default', () => {
        expect(compactMoney(34000, 'LKR', EN)).toBe('340');
        expect(compactMoney(34049, 'LKR', EN)).toBe('340');   // rounds, not truncates
        expect(compactMoney(34050, 'LKR', EN)).toBe('341');
        expect(compactMoney(0, 'LKR', EN)).toBe('0');
    });

    it('crosses into compact notation on the rounded value, not the raw one', () => {
        // 999.50 must not render "1,000" - wider than the "1K" it was avoiding.
        expect(compactMoney(99950, 'LKR', EN)).toBe('1K');
        expect(compactMoney(99900, 'LKR', EN)).toBe('999');
    });

    it('never renders a real expense as zero', () => {
        expect(compactMoney(42, 'USD', EN)).toBe('<1');
        expect(compactMoney(1, 'USD', EN)).toBe('<1');
        expect(compactMoney(-42, 'USD', EN)).toBe('-<1');
        expect(compactMoney(100, 'USD', EN)).toBe('1');
    });

    it('carries a negative sign', () => {
        expect(compactMoney(-370000, 'LKR', EN)).toBe('-3.7K');
    });

    it('respects zero-decimal currencies', () => {
        // 1234 minor units is 1,234 yen, not 12.34 - already compact-sized.
        expect(compactMoney(1234, 'JPY', EN)).toBe('1.2K');
        expect(compactMoney(42, 'JPY', EN)).toBe('42');
    });

    it('adds the symbol only when asked', () => {
        expect(compactMoney(370000, 'USD', { ...EN, withSymbol: true })).toBe('$3.7K');
        // Fails loudly if minimumFractionDigits: 0 is ever dropped - under
        // style:'currency' Intl would demand two decimals and throw.
        expect(compactMoney(34000, 'USD', { ...EN, withSymbol: true })).toBe('$340');
        expect(compactMoney(370000, 'USD', EN)).toBe('3.7K');
    });

    it('never throws on absent or nonsense input', () => {
        [null, undefined, NaN, Infinity].forEach((bad) => {
            expect(() => compactMoney(bad, 'USD', EN)).not.toThrow();
            expect(compactMoney(bad, 'USD', EN)).toBe('0');
        });
    });

    it('falls back rather than throwing on a malformed currency code', () => {
        ['US', 'TOOLONG', '', '12'].forEach((bad) => {
            expect(() => compactMoney(100, bad, { ...EN, withSymbol: true })).not.toThrow();
        });
        expect(norm(compactMoney(100, 'TOOLONG', { ...EN, withSymbol: true }))).toBe('TOOLONG 1');
        expect(norm(compactMoney(370000, 'ZZZ', { ...EN, withSymbol: true }))).toBe('ZZZ 3.7K');
    });
});

describe('minorUnitsFor', () => {
    it('knows the zero-decimal exceptions and defaults to 2', () => {
        expect(minorUnitsFor('JPY')).toBe(0);
        expect(minorUnitsFor('LKR')).toBe(2);
        expect(minorUnitsFor('usd')).toBe(2);
        expect(minorUnitsFor('ZZZ')).toBe(2);
        expect(minorUnitsFor(undefined)).toBe(2);
    });
});

describe('budgetState', () => {
    it('reports no budget when none is set', () => {
        expect(budgetState(0, 0)).toBe('none');
        expect(budgetState(500, null)).toBe('none');
        expect(budgetState(500, undefined)).toBe('none');
    });

    it('separates under, near and over', () => {
        expect(budgetState(500, 1000)).toBe('under');
        expect(budgetState(899, 1000)).toBe('under');
        expect(budgetState(900, 1000)).toBe('near');
        expect(budgetState(1001, 1000)).toBe('over');
    });

    it('treats exactly on budget as near, not over', () => {
        // You have not overspent until you have actually overspent.
        expect(budgetState(1000, 1000)).toBe('near');
    });
});

describe('percentOf / barPercent', () => {
    it('computes a rounded percentage', () => {
        expect(percentOf(500, 1000)).toBe(50);
        expect(percentOf(2450000, 2000000)).toBe(123);
    });

    it('never divides by zero', () => {
        expect(percentOf(100, 0)).toBe(0);
        expect(percentOf(100, null)).toBe(0);
        expect(Number.isNaN(percentOf(100, 0))).toBe(false);
    });

    it('clamps the bar so an overspend cannot overflow its track', () => {
        expect(barPercent(2450000, 2000000)).toBe(100);
        expect(barPercent(500, 1000)).toBe(50);
        expect(barPercent(-100, 1000)).toBe(0);
    });
});
