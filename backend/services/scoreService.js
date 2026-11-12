// backend/services/scoreService.js
const db = require('../config/db');

class ScoreService {
    /**
     * Calculate 100-Point Weighted Financial Health Score
     */
    async calculateScore(userId) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // 1. Current month dates
        const curStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const curLastDay = new Date(year, month + 1, 0).getDate();
        const curEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(curLastDay).padStart(2, '0')}`;

        // 2. Fetch past 3 months for consistency metrics
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);

        const [
            curExpenses,
            curIncomes,
            historicalExpenses,
            historicalIncomes,
            budgets,
            goals
        ] = await Promise.all([
            db.getExpenses(userId, curStart, curEnd),
            db.getIncomes(userId, curStart, curEnd),
            db.getExpenses(userId, ninetyDaysAgo, null),
            db.getIncomes(userId, ninetyDaysAgo, null),
            db.getBudgets(userId, `${year}-${String(month + 1).padStart(2, '0')}`),
            db.getGoals(userId)
        ]);

        const totalIncome = curIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
        const totalExpenses = curExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        const components = {};
        const missingData = [];
        const recommendations = [];

        // -------------------------------------------------------------
        // Component 1: Savings Rate (Max: 30 Points)
        // -------------------------------------------------------------
        if (totalIncome > 0) {
            const savings = totalIncome - totalExpenses;
            const savingsRate = (savings / totalIncome) * 100;

            let points = 0;
            if (savingsRate >= 20) points = 30;
            else if (savingsRate >= 15) points = 25;
            else if (savingsRate >= 10) points = 20;
            else if (savingsRate >= 5) points = 15;
            else if (savingsRate >= 0) points = 10;
            else points = 0; // negative savings

            components.savingsRate = {
                name: "Savings Rate",
                available: true,
                maxPoints: 30,
                earnedPoints: points,
                value: `${savingsRate.toFixed(1)}%`,
                status: points >= 25 ? 'optimal' : points >= 15 ? 'moderate' : 'critical',
                details: `Saved ₹${savings.toFixed(0)} out of ₹${totalIncome.toFixed(0)} income (${savingsRate.toFixed(1)}%).`
            };

            if (points < 25) {
                recommendations.push({
                    component: "Savings Rate",
                    suggestion: "Increase your monthly savings target towards 20% by curbing discretionary expenses.",
                    whyItMatters: "A 20%+ savings rate provides a crucial emergency buffer and accelerates compound wealth creation."
                });
            }
        } else {
            components.savingsRate = {
                name: "Savings Rate",
                available: false,
                maxPoints: 30,
                earnedPoints: 0,
                details: "Monthly income data not recorded for the active period."
            };
            missingData.push("Monthly Income records (needed for Savings Rate calculation).");
        }

        // -------------------------------------------------------------
        // Component 2: Expense Management (Max: 25 Points)
        // -------------------------------------------------------------
        if (curExpenses.length > 0 || totalExpenses > 0) {
            let ratioPoints = 0;
            if (totalIncome > 0) {
                const ratio = (totalExpenses / totalIncome) * 100;
                if (ratio <= 50) ratioPoints = 15;
                else if (ratio <= 70) ratioPoints = 12;
                else if (ratio <= 85) ratioPoints = 8;
                else if (ratio <= 100) ratioPoints = 4;
                else ratioPoints = 0;
            } else {
                // If income is missing, score neutrally on ratio
                ratioPoints = 8;
            }

            // Volatility / Unusual Spending Control (Max: 10 points)
            let volatilityPoints = 10;
            if (historicalExpenses.length >= 4) {
                const prevMonthD = new Date(year, month - 1, 1);
                const prevMonthPrefix = `${prevMonthD.getFullYear()}-${String(prevMonthD.getMonth() + 1).padStart(2, '0')}`;
                const prevExpenses = historicalExpenses.filter(e => (e.date || '').startsWith(prevMonthPrefix));
                const prevTotal = prevExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

                if (prevTotal > 0 && totalExpenses > prevTotal * 1.3) {
                    volatilityPoints = 4; // High unexplained spike
                } else if (prevTotal > 0 && totalExpenses > prevTotal * 1.15) {
                    volatilityPoints = 7;
                }
            }

            const earnedExp = ratioPoints + volatilityPoints;
            components.expenseManagement = {
                name: "Expense Management",
                available: true,
                maxPoints: 25,
                earnedPoints: earnedExp,
                status: earnedExp >= 20 ? 'optimal' : earnedExp >= 12 ? 'moderate' : 'critical',
                details: `Expense-to-income control: ${ratioPoints}/15 pts. Spending stability: ${volatilityPoints}/10 pts.`
            };

            if (earnedExp < 20) {
                recommendations.push({
                    component: "Expense Management",
                    suggestion: "Keep total recurring overheads under 65% of your income and avoid unbudgeted spending surges.",
                    whyItMatters: "Uncontrolled expenses squeeze your monthly savings and increase financial vulnerability to unexpected emergencies."
                });
            }
        } else {
            components.expenseManagement = {
                name: "Expense Management",
                available: false,
                maxPoints: 25,
                earnedPoints: 0,
                details: "No expense transactions logged for this period."
            };
            missingData.push("Expense transactions (needed for Expense Management evaluation).");
        }

        // -------------------------------------------------------------
        // Component 3: Budget Management (Max: 20 Points)
        // -------------------------------------------------------------
        if (budgets && budgets.length > 0) {
            let totalBudgetLimit = 0;
            let totalBudgetActual = 0;

            budgets.forEach(b => {
                const limit = Number(b.monthly_limit || 0);
                totalBudgetLimit += limit;
                const catSpent = curExpenses
                    .filter(e => (e.category || '').toLowerCase() === (b.category || '').toLowerCase())
                    .reduce((s, e) => s + Number(e.amount || 0), 0);
                totalBudgetActual += catSpent;
            });

            if (totalBudgetLimit > 0) {
                const budgetUtilization = (totalBudgetActual / totalBudgetLimit) * 100;
                let points = 3;
                if (budgetUtilization <= 80) points = 20;
                else if (budgetUtilization <= 90) points = 17;
                else if (budgetUtilization <= 100) points = 14;
                else if (budgetUtilization <= 110) points = 8;
                else points = 3;

                components.budgetManagement = {
                    name: "Budget Management",
                    available: true,
                    maxPoints: 20,
                    earnedPoints: points,
                    value: `${budgetUtilization.toFixed(1)}% utilized`,
                    status: points >= 17 ? 'optimal' : points >= 14 ? 'moderate' : 'critical',
                    details: `Spent ₹${totalBudgetActual.toFixed(0)} against a set budget of ₹${totalBudgetLimit.toFixed(0)} across ${budgets.length} categories.`
                };

                if (points < 17) {
                    recommendations.push({
                        component: "Budget Management",
                        suggestion: "Adhere to your established category budgets and monitor high-volume categories mid-month.",
                        whyItMatters: "Consistently overshooting budgets destroys financial planning and depletes your surplus cash."
                    });
                }
            } else {
                components.budgetManagement = {
                    name: "Budget Management",
                    available: false,
                    maxPoints: 20,
                    earnedPoints: 0,
                    details: "Budgets exist but limits are set to zero."
                };
                missingData.push("Valid non-zero budget limits.");
            }
        } else {
            components.budgetManagement = {
                name: "Budget Management",
                available: false,
                maxPoints: 20,
                earnedPoints: 0,
                details: "No category budgets configured."
            };
            missingData.push("Category budgets (create category budgets to unlock 20 score points).");
        }

        // -------------------------------------------------------------
        // Component 4: Financial Consistency (Max: 15 Points)
        // -------------------------------------------------------------
        // Evaluate historical transaction data across past months
        const distinctExpenseDates = new Set(historicalExpenses.map(e => e.date));
        if (historicalExpenses.length >= 2 || historicalIncomes.length >= 1) {
            let regularityPoints = 5;
            let stabilityPoints = 5;
            let savingsConsistencyPoints = 5;

            // Income regularity
            if (historicalIncomes.length === 0) regularityPoints = 2;

            // Spending stability over recorded months
            const monthlySums = {};
            historicalExpenses.forEach(e => {
                const mKey = (e.date || '').slice(0, 7);
                if (mKey) monthlySums[mKey] = (monthlySums[mKey] || 0) + Number(e.amount);
            });
            const mValues = Object.values(monthlySums);
            if (mValues.length >= 2) {
                const avgM = mValues.reduce((a, b) => a + b, 0) / mValues.length;
                const maxDiff = Math.max(...mValues) - Math.min(...mValues);
                if (avgM > 0 && (maxDiff / avgM) > 0.45) {
                    stabilityPoints = 2.5;
                }
            } else if (distinctExpenseDates.size < 3) {
                stabilityPoints = 3;
            }

            const earnedCons = regularityPoints + stabilityPoints + savingsConsistencyPoints;
            components.financialConsistency = {
                name: "Financial Consistency",
                available: true,
                maxPoints: 15,
                earnedPoints: earnedCons,
                status: earnedCons >= 12 ? 'optimal' : earnedCons >= 8 ? 'moderate' : 'critical',
                details: `Historical consistency evaluated across ${Object.keys(monthlySums).length || 1} month(s) and ${historicalExpenses.length} transactions.`
            };

            if (earnedCons < 12) {
                recommendations.push({
                    component: "Financial Consistency",
                    suggestion: "Maintain steady month-to-month expenditure and avoid sporadic large outlays.",
                    whyItMatters: "Consistent spending patterns make financial forecasts reliable and prevent cash-flow shocks."
                });
            }
        } else {
            components.financialConsistency = {
                name: "Financial Consistency",
                available: false,
                maxPoints: 15,
                earnedPoints: 0,
                details: "Insufficient historical transaction history."
            };
            missingData.push("Historical transaction data across multiple months.");
        }

        // -------------------------------------------------------------
        // Component 5: Savings Goal Progress (Max: 10 Points)
        // -------------------------------------------------------------
        if (goals && goals.length > 0) {
            let totalTarget = 0;
            let totalSaved = 0;

            goals.forEach(g => {
                totalTarget += Number(g.target_amount || 0);
                totalSaved += Number(g.current_amount || 0);
            });

            if (totalTarget > 0) {
                const goalProgressPct = (totalSaved / totalTarget) * 100;
                let points = 1;
                if (goalProgressPct >= 75) points = 10;
                else if (goalProgressPct >= 50) points = 8;
                else if (goalProgressPct >= 25) points = 6;
                else if (goalProgressPct > 0) points = 3;
                else points = 1;

                components.savingsGoalProgress = {
                    name: "Savings Goal Progress",
                    available: true,
                    maxPoints: 10,
                    earnedPoints: points,
                    value: `${goalProgressPct.toFixed(1)}% complete`,
                    status: points >= 8 ? 'optimal' : points >= 4 ? 'moderate' : 'critical',
                    details: `Accumulated ₹${totalSaved.toFixed(0)} of ₹${totalTarget.toFixed(0)} across ${goals.length} target goals.`
                };

                if (points < 8) {
                    recommendations.push({
                        component: "Savings Goal Progress",
                        suggestion: "Set up automatic monthly contributions to your active savings goals.",
                        whyItMatters: "Consistent goal funding ensures you hit your milestones on schedule without taking on high-interest debt."
                    });
                }
            } else {
                components.savingsGoalProgress = {
                    name: "Savings Goal Progress",
                    available: false,
                    maxPoints: 10,
                    earnedPoints: 0,
                    details: "Savings goals have no target amounts defined."
                };
            }
        } else {
            components.savingsGoalProgress = {
                name: "Savings Goal Progress",
                available: false,
                maxPoints: 10,
                earnedPoints: 0,
                details: "No savings goals established yet."
            };
            missingData.push("Active savings goals (create goals in the Goal Tracker to earn up to 10 points).");
        }

        // -------------------------------------------------------------
        // Weighted Normalization:
        // Score = (Points Earned / Available Maximum Points) * 100
        // -------------------------------------------------------------
        let totalEarned = 0;
        let totalAvailableMax = 0;

        for (const comp of Object.values(components)) {
            if (comp.available) {
                totalEarned += comp.earnedPoints;
                totalAvailableMax += comp.maxPoints;
            }
        }

        let normalizedScore = 0;
        if (totalAvailableMax > 0) {
            normalizedScore = Number(((totalEarned / totalAvailableMax) * 100).toFixed(1));
        }

        // Score Classification
        let classification = 'Poor';
        let gradeLetter = 'D';
        if (normalizedScore >= 90) {
            classification = 'Excellent';
            gradeLetter = 'A+';
        } else if (normalizedScore >= 75) {
            classification = 'Very Good';
            gradeLetter = 'A';
        } else if (normalizedScore >= 60) {
            classification = 'Good';
            gradeLetter = 'B';
        } else if (normalizedScore >= 40) {
            classification = 'Needs Improvement';
            gradeLetter = 'C';
        } else {
            classification = 'Poor';
            gradeLetter = 'D';
        }

        // Data Completeness Assessment
        let dataCompleteness = 'High';
        const availableCount = Object.values(components).filter(c => c.available).length;
        if (availableCount <= 2 || curExpenses.length < 3) {
            dataCompleteness = 'Preliminary (Low Data)';
        } else if (availableCount < 5) {
            dataCompleteness = 'Moderate';
        }

        // Fallback recommendation if user is already optimal
        if (recommendations.length === 0) {
            recommendations.push({
                component: "General Health",
                suggestion: "Maintain your stellar budgeting discipline and consider investing excess cash into long-term assets.",
                whyItMatters: "Sustained high financial health compounds your net worth and secures long-term independence."
            });
        }

        const result = {
            score: normalizedScore,
            classification,
            grade: gradeLetter,
            dataCompleteness,
            pointsSummary: {
                earned: Number(totalEarned.toFixed(1)),
                availableMax: totalAvailableMax,
                totalPossible: 100
            },
            components,
            missingData,
            recommendations,
            calculatedAt: now.toISOString()
        };

        // Persist snapshot to history
        await db.saveHealthScoreSnapshot({
            userId,
            score: normalizedScore,
            classification,
            componentScores: components,
            earnedPoints: totalEarned,
            availablePoints: totalAvailableMax,
            dataCompleteness
        });

        return result;
    }

    /**
     * Retrieve historical snapshots
     */
    async getHistory(userId, limit = 10) {
        return await db.getHealthScoreHistory(userId, limit);
    }
}

module.exports = new ScoreService();
