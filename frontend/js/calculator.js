/**
 * SmartSpend Calculator Module
 * Handles core financial logic including savings, rates, and health score calculations.
 */

/**
 * Calculates total savings (remaining balance).
 * 
 * @param {number} income - Monthly income
 * @param {Object} expenses - Object containing expense categories as keys and values
 * @returns {number} Total savings (income - total expenses)
 */
export const calculateSavings = (income, expenses) => {
    if (!income || income <= 0) return 0;

    let totalExpenses = 0;
    for (const category in expenses) {
        totalExpenses += expenses[category] || 0;
    }

    return income - totalExpenses;
};

/**
 * Calculates the savings rate as a percentage of income.
 * 
 * @param {number} income - Monthly income
 * @param {number} totalExpenses - Total monthly expenses
 * @returns {number} Savings rate percentage (0 to 100)
 */
export const calculateSavingsRate = (income, totalExpenses) => {
    if (!income || income <= 0) return 0;

    const savings = income - totalExpenses;
    if (savings <= 0) return 0;

    return (savings / income) * 100;
};

/**
 * Calculates the user's financial health score and corresponding grade.
 * 
 * Base Score Rules:
 * Savings Rate > 30%  -> Base Score 95
 * Savings Rate 20-30% -> Base Score 85
 * Savings Rate 10-20% -> Base Score 65
 * Savings Rate 5-10%  -> Base Score 50
 * Savings Rate < 5%   -> Base Score 30
 * 
 * Penalty Rules:
 * - Food > 40% of income     -> -10 points
 * - Shopping > 20% of income -> -10 points
 * - EMI > 30% of income      -> -15 points
 * 
 * Grade Rules:
 * 90-100 (Grade A)
 * 75-89  (Grade B)
 * 60-74  (Grade C)
 * 40-59  (Grade D)
 * < 40   (Grade F)
 * 
 * @param {number} income - Monthly income
 * @param {number} savingsRate - Calculated savings rate percentage
 * @param {Object} expenseBreakdown - Breakdown of expenses by category
 * @returns {Object} Object containing { score, grade }
 */
export const calculateFinancialHealthScore = (income, savingsRate, expenseBreakdown) => {
    if (!income || income <= 0) {
        return { score: 0, grade: 'F' };
    }

    let score = 0;

    // 1. Determine base score from savings rate
    if (savingsRate > 30) {
        score = 95;
    } else if (savingsRate >= 20) {
        score = 85;
    } else if (savingsRate >= 10) {
        score = 65;
    } else if (savingsRate >= 5) {
        score = 50;
    } else {
        score = 30; // < 5%
    }

    // 2. Apply Penalties
    const foodExpense = expenseBreakdown.food || expenseBreakdown.Food || 0;
    const shoppingExpense = expenseBreakdown.shopping || expenseBreakdown.Shopping || 0;
    const emiExpense = expenseBreakdown.emi || expenseBreakdown.EMI || 0;

    const foodRate = (foodExpense / income) * 100;
    const shoppingRate = (shoppingExpense / income) * 100;
    const emiRate = (emiExpense / income) * 100;

    if (foodRate > 40) {
        score -= 10;
    }

    if (shoppingRate > 20) {
        score -= 10;
    }

    if (emiRate > 30) {
        score -= 15;
    }

    // Ensure score stays within 0-100 bounds
    score = Math.max(0, Math.min(100, score));

    // 3. Determine Grade
    let grade = 'F';
    if (score >= 90) {
        grade = 'A';
    } else if (score >= 75) {
        grade = 'B';
    } else if (score >= 60) {
        grade = 'C';
    } else if (score >= 40) {
        grade = 'D';
    }

    return {
        score: score,
        grade: grade
    };
};
