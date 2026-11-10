/**
 * SmartSpend Calculator Module
 * Shared financial calculation utilities used by both Expense Analysis and Financial Health Score.
 *
 * SCORING MODEL (3 Components, 0–100 scale):
 *   1. Savings Rate         – 40 points max
 *   2. Expense-to-Income    – 35 points max
 *   3. Debt-to-Income       – 25 points max
 *
 * GRADE SCALE:
 *   A: 80–100 (Excellent)
 *   B: 60–79  (Good)
 *   C: 40–59  (Average)
 *   D: 20–39  (Poor)
 *   F: 0–19   (Critical)
 */

// ---------------------------------------------------------------------------
// 1. INPUT SANITIZATION
// ---------------------------------------------------------------------------

/**
 * Safely parses a numeric value from a form input.
 * Returns null if the value is invalid, negative, NaN, or Infinity.
 * Returns the parsed number (including 0) for valid non-negative values.
 *
 * @param {string|number} val
 * @returns {number|null}
 */
export function safeParseFloat(val) {
    if (val === '' || val === null || val === undefined) return null;
    const n = parseFloat(val);
    if (!isFinite(n) || isNaN(n)) return null;
    if (n < 0) return null;
    return n;
}

/**
 * Safely parses a numeric value, treating empty/null as 0.
 * Returns null only for explicitly negative or non-numeric values.
 *
 * @param {string|number} val
 * @returns {number|null}
 */
export function safeParseFloatOrZero(val) {
    if (val === '' || val === null || val === undefined) return 0;
    const n = parseFloat(val);
    if (!isFinite(n) || isNaN(n)) return null;
    if (n < 0) return null;
    return n;
}

// ---------------------------------------------------------------------------
// 2. CURRENCY FORMATTING
// ---------------------------------------------------------------------------

/**
 * Formats a number as Indian Rupee currency string.
 * Handles negative values correctly (shows minus sign before ₹).
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(absAmount);
    return amount < 0 ? '-' + formatted : formatted;
}

// ---------------------------------------------------------------------------
// 3. CORE FINANCIAL CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Sums all valid expense category amounts.
 * Skips categories with null/invalid values.
 *
 * @param {Object} expensesObj - category → amount
 * @returns {number}
 */
export function calculateTotalExpenses(expensesObj) {
    if (!expensesObj || typeof expensesObj !== 'object') return 0;
    let total = 0;
    for (const key in expensesObj) {
        const val = expensesObj[key];
        if (typeof val === 'number' && isFinite(val) && val >= 0) {
            total += val;
        }
    }
    return total;
}

/**
 * Calculates net savings (income - totalExpenses).
 * Returns negative for deficits. Returns null if inputs are invalid.
 *
 * @param {number} income
 * @param {number} totalExpenses
 * @returns {number|null}
 */
export function calculateSavings(income, totalExpenses) {
    if (income === null || income === undefined || !isFinite(income) || income < 0) return null;
    if (totalExpenses === null || totalExpenses === undefined || !isFinite(totalExpenses) || totalExpenses < 0) return null;
    return income - totalExpenses;
}

/**
 * Calculates savings rate as percentage of income.
 * Returns NEGATIVE percentage for deficits (expenses > income).
 * Returns null when income is 0 or invalid (prevents division by zero).
 *
 * @param {number} income
 * @param {number} totalExpenses
 * @returns {number|null}
 */
export function calculateSavingsRate(income, totalExpenses) {
    if (!income || income <= 0 || !isFinite(income)) return null;
    if (totalExpenses < 0 || !isFinite(totalExpenses)) return null;
    return ((income - totalExpenses) / income) * 100;
}

/**
 * Calculates expense-to-income ratio as a percentage.
 * Returns null when income is 0 or invalid.
 *
 * @param {number} income
 * @param {number} totalExpenses
 * @returns {number|null}
 */
export function calculateExpenseRatio(income, totalExpenses) {
    if (!income || income <= 0 || !isFinite(income)) return null;
    if (totalExpenses < 0 || !isFinite(totalExpenses)) return null;
    return (totalExpenses / income) * 100;
}

/**
 * Calculates debt-to-income ratio as a percentage.
 * Returns null when income is 0 or invalid.
 *
 * @param {number} income
 * @param {number} monthlyDebt - Monthly EMI / debt payments
 * @returns {number|null}
 */
export function calculateDebtToIncomeRatio(income, monthlyDebt) {
    if (!income || income <= 0 || !isFinite(income)) return null;
    if (monthlyDebt < 0 || !isFinite(monthlyDebt)) return null;
    return (monthlyDebt / income) * 100;
}

// ---------------------------------------------------------------------------
// 4. GRADING SYSTEM (SINGLE SOURCE OF TRUTH)
// ---------------------------------------------------------------------------

/**
 * Converts a numeric score (0–100) into a letter grade and label.
 * This is the ONLY grading function — used everywhere in the app.
 *
 * A: 80–100 (Excellent) | B: 60–79 (Good) | C: 40–59 (Average)
 * D: 20–39 (Poor)       | F: 0–19  (Critical)
 *
 * @param {number} score
 * @returns {{ grade: string, label: string }}
 */
export function getGrade(score) {
    if (score >= 80) return { grade: 'A', label: 'Excellent' };
    if (score >= 60) return { grade: 'B', label: 'Good' };
    if (score >= 40) return { grade: 'C', label: 'Average' };
    if (score >= 20) return { grade: 'D', label: 'Poor' };
    return { grade: 'F', label: 'Critical' };
}

// ---------------------------------------------------------------------------
// 5. WEIGHTED FINANCIAL HEALTH SCORE (3 COMPONENTS, NO EMERGENCY FUND)
// ---------------------------------------------------------------------------

/**
 * Calculates the Financial Health Score using a 3-component weighted model.
 *
 * Components (total 100 points):
 *
 *   1. Savings Rate (40 pts):
 *      >= 30%  → 40 | 20–29% → 32 | 10–19% → 22 | 5–9% → 12 | 0–4% → 4 | <0% → 0 (deficit)
 *
 *   2. Expense-to-Income Ratio (35 pts):
 *      <= 50%  → 35 | 51–70% → 28 | 71–80% → 18 | 81–90% → 9 | >90% → 0
 *
 *   3. Debt-to-Income Ratio (25 pts):
 *      0%      → 25 | 1–15%  → 20 | 16–30% → 13 | 31–43% → 6 | >43% → 0
 *      (If monthlyDebt is null = not provided, component is marked unavailable)
 *
 * @param {Object} params
 * @param {number}      params.income         - Monthly income
 * @param {number}      params.totalExpenses  - Total monthly expenses
 * @param {number|null} params.monthlyDebt    - Monthly EMI/debt payments (null = not provided)
 *
 * @returns {{
 *   normalizedScore: number,
 *   grade: string,
 *   gradeLabel: string,
 *   components: {
 *     savingsRate:  { points: number, maxPoints: number, rate: number|null,  available: boolean },
 *     expenseRatio: { points: number, maxPoints: number, ratio: number|null, available: boolean },
 *     debtRatio:    { points: number, maxPoints: number, ratio: number|null, available: boolean }
 *   },
 *   isPartial: boolean,
 *   insufficientData: boolean
 * }}
 */
export function calculateWeightedHealthScore({ income, totalExpenses, monthlyDebt }) {
    const hasIncome   = income !== null && income !== undefined && income > 0 && isFinite(income);
    const hasExpenses = totalExpenses !== null && totalExpenses !== undefined && totalExpenses >= 0 && isFinite(totalExpenses);
    const hasDebt     = monthlyDebt !== null && monthlyDebt !== undefined && isFinite(monthlyDebt) && monthlyDebt >= 0;

    // No income = insufficient data
    if (!hasIncome) {
        return {
            normalizedScore: 0,
            grade: 'F',
            gradeLabel: 'Critical',
            components: {
                savingsRate:  { points: 0, maxPoints: 40, rate: null,  available: false },
                expenseRatio: { points: 0, maxPoints: 35, ratio: null, available: false },
                debtRatio:    { points: 0, maxPoints: 25, ratio: null, available: false }
            },
            isPartial: false,
            insufficientData: true
        };
    }

    let totalPoints  = 0;
    let maxAvailable = 0;
    const components = {};

    // --- Component 1: Savings Rate (40 points) ---
    {
        const maxPts = 40;
        let pts  = 0;
        let rate = null;

        if (hasIncome && hasExpenses) {
            rate = calculateSavingsRate(income, totalExpenses);
            const r = rate ?? 0;
            if (r >= 30)      pts = 40;
            else if (r >= 20) pts = 32;
            else if (r >= 10) pts = 22;
            else if (r >= 5)  pts = 12;
            else if (r >= 0)  pts = 4;
            else              pts = 0; // Deficit → 0 pts
        }

        components.savingsRate = { points: pts, maxPoints: maxPts, rate, available: hasIncome && hasExpenses };
        if (hasIncome && hasExpenses) { totalPoints += pts; maxAvailable += maxPts; }
    }

    // --- Component 2: Expense-to-Income Ratio (35 points) ---
    {
        const maxPts = 35;
        let pts   = 0;
        let ratio = null;

        if (hasIncome && hasExpenses) {
            ratio = calculateExpenseRatio(income, totalExpenses);
            const r = ratio ?? 100;
            if (r <= 50)      pts = 35;
            else if (r <= 70) pts = 28;
            else if (r <= 80) pts = 18;
            else if (r <= 90) pts = 9;
            else              pts = 0;
        }

        components.expenseRatio = { points: pts, maxPoints: maxPts, ratio, available: hasIncome && hasExpenses };
        if (hasIncome && hasExpenses) { totalPoints += pts; maxAvailable += maxPts; }
    }

    // --- Component 3: Debt-to-Income Ratio (25 points) ---
    {
        const maxPts = 25;
        let pts   = 0;
        let ratio = null;

        if (hasIncome && hasDebt) {
            ratio = calculateDebtToIncomeRatio(income, monthlyDebt);
            const r = ratio ?? 0;
            if (r === 0)      pts = 25;
            else if (r <= 15) pts = 20;
            else if (r <= 30) pts = 13;
            else if (r <= 43) pts = 6;
            else              pts = 0;
        }

        components.debtRatio = { points: pts, maxPoints: maxPts, ratio, available: hasIncome && hasDebt };
        if (hasIncome && hasDebt) { totalPoints += pts; maxAvailable += maxPts; }
    }

    // Normalize to 0–100 based on available components
    const isPartial = maxAvailable < 100;
    let normalizedScore = 0;
    if (maxAvailable > 0) {
        normalizedScore = Math.round((totalPoints / maxAvailable) * 100);
    }
    normalizedScore = Math.max(0, Math.min(100, normalizedScore));

    const { grade, label: gradeLabel } = getGrade(normalizedScore);

    return {
        normalizedScore,
        grade,
        gradeLabel,
        components,
        isPartial,
        insufficientData: false
    };
}
