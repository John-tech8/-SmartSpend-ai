// backend/services/analyticsService.js
const db = require('../config/db');
const axios = require('axios');

class AnalyticsService {
    /**
     * Helper to resolve start & end date strings (YYYY-MM-DD) based on filter
     */
    resolveDateRange(range = 'current_month', customStart = null, customEnd = null) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed

        let startDate;
        let endDate;

        switch (range) {
            case 'previous_month': {
                const prevDate = new Date(year, month - 1, 1);
                const prevYear = prevDate.getFullYear();
                const prevMonth = prevDate.getMonth();
                const lastDayPrev = new Date(prevYear, prevMonth + 1, 0).getDate();
                startDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
                endDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDayPrev).padStart(2, '0')}`;
                break;
            }
            case '3_months': {
                const d = new Date(year, month - 2, 1);
                startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month + 1, 0).getDate();
                endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                break;
            }
            case '6_months': {
                const d = new Date(year, month - 5, 1);
                startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month + 1, 0).getDate();
                endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                break;
            }
            case 'custom': {
                if (customStart && customEnd) {
                    startDate = customStart;
                    endDate = customEnd;
                } else {
                    const lastDay = new Date(year, month + 1, 0).getDate();
                    startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                    endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                }
                break;
            }
            case 'current_month':
            default: {
                const lastDay = new Date(year, month + 1, 0).getDate();
                startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                break;
            }
        }

        return { startDate, endDate, range };
    }

    /**
     * Feature 1.A: Expense Overview
     */
    async getOverview(userId, { range = 'current_month', startDate: qStart, endDate: qEnd } = {}) {
        const { startDate, endDate } = this.resolveDateRange(range, qStart, qEnd);

        const [expenses, incomes] = await Promise.all([
            db.getExpenses(userId, startDate, endDate),
            db.getIncomes(userId, startDate, endDate)
        ]);

        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? Number(((netSavings / totalIncome) * 100).toFixed(2)) : 0;

        // Calculate days elapsed in period for daily average
        const startD = new Date(startDate);
        const endD = new Date(endDate);
        const nowD = new Date();
        const effectiveEnd = nowD < endD ? nowD : endD;
        const diffMs = Math.max(1000 * 60 * 60 * 24, effectiveEnd - startD);
        const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const avgDailySpending = Number((totalExpenses / days).toFixed(2));

        // Group by category to find highest
        const catMap = {};
        expenses.forEach(e => {
            const cat = e.category || 'Others';
            catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
        });

        let highestCategory = { name: 'None', amount: 0, percentage: 0 };
        for (const [cat, amt] of Object.entries(catMap)) {
            if (amt > highestCategory.amount) {
                highestCategory = {
                    name: cat,
                    amount: amt,
                    percentage: totalExpenses > 0 ? Number(((amt / totalExpenses) * 100).toFixed(1)) : 0
                };
            }
        }

        // Monthly trends over last 6 months for context
        const trends = await this.getTrends(userId, 6);

        return {
            period: { range, startDate, endDate, daysCounted: days },
            totalIncome: Number(totalIncome.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            netSavings: Number(netSavings.toFixed(2)),
            savingsRate,
            avgDailySpending,
            highestCategory,
            transactionCount: expenses.length,
            trends
        };
    }

    /**
     * Feature 1.B: Category-Wise Analysis
     */
    async getCategoryAnalysis(userId, { range = 'current_month', startDate: qStart, endDate: qEnd } = {}) {
        const { startDate, endDate } = this.resolveDateRange(range, qStart, qEnd);
        const expenses = await db.getExpenses(userId, startDate, endDate);

        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const catMap = {};

        expenses.forEach(e => {
            const cat = e.category || 'Others';
            if (!catMap[cat]) {
                catMap[cat] = { amount: 0, count: 0 };
            }
            catMap[cat].amount += Number(e.amount || 0);
            catMap[cat].count += 1;
        });

        const categories = Object.entries(catMap).map(([name, data]) => ({
            name,
            amount: Number(data.amount.toFixed(2)),
            count: data.count,
            percentage: totalExpenses > 0 ? Number(((data.amount / totalExpenses) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.amount - a.amount);

        const highestCategory = categories.length > 0 ? categories[0] : null;
        const lowestCategory = categories.length > 0 ? categories[categories.length - 1] : null;

        return {
            period: { range, startDate, endDate },
            totalExpenses: Number(totalExpenses.toFixed(2)),
            categoriesCount: categories.length,
            categories,
            highestCategory,
            lowestCategory
        };
    }

    /**
     * Feature 1.C: Spending Behaviour Analysis
     */
    async getSpendingBehaviour(userId) {
        // Fetch last 90 days of expenses for robust statistical behaviour detection
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
        const allExpenses = await db.getExpenses(userId, ninetyDaysAgo, null);
        const incomes = await db.getIncomes(userId, ninetyDaysAgo, null);
        const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);

        if (!allExpenses || allExpenses.length === 0) {
            return {
                topCategories: [],
                unusualExpenses: [],
                recurringExpenses: [],
                potentialUnnecessary: [],
                increasedCategories: [],
                opportunities: ["Record regular expenses to activate automated spending behaviour insights."]
            };
        }

        // 1. Top categories
        const catTotals = {};
        allExpenses.forEach(e => {
            const cat = e.category || 'Others';
            catTotals[cat] = (catTotals[cat] || 0) + Number(e.amount || 0);
        });
        const topCategories = Object.entries(catTotals)
            .map(([cat, amt]) => ({ category: cat, amount: Number(amt.toFixed(2)) }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3);

        // 2. Unusually high expenses compared with historical mean
        const amounts = allExpenses.map(e => Number(e.amount || 0));
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);
        // An anomaly is an expense exceeding mean + 1.8 * stdDev (and at least 1.5x mean)
        const threshold = Math.max(mean * 1.5, mean + (1.8 * stdDev));

        const unusualExpenses = allExpenses
            .filter(e => Number(e.amount) >= threshold)
            .map(e => ({
                id: e.id,
                category: e.category,
                amount: Number(e.amount),
                date: e.date,
                reason: `₹${Number(e.amount).toFixed(0)} is significantly above your average transaction of ₹${mean.toFixed(0)}.`
            }))
            .slice(0, 5);

        // 3. Recurring expenses (similar amount and category across different dates)
        const recurringCandidateMap = {};
        allExpenses.forEach(e => {
            const key = `${e.category}_${Math.round(Number(e.amount) / 10) * 10}`;
            if (!recurringCandidateMap[key]) {
                recurringCandidateMap[key] = [];
            }
            recurringCandidateMap[key].push(e);
        });

        const recurringExpenses = [];
        for (const [key, items] of Object.entries(recurringCandidateMap)) {
            if (items.length >= 2) {
                // Ensure they occur on different days
                const uniqueDates = new Set(items.map(i => i.date));
                if (uniqueDates.size >= 2) {
                    const avgAmt = items.reduce((s, i) => s + Number(i.amount), 0) / items.length;
                    recurringExpenses.push({
                        category: items[0].category,
                        estimatedAmount: Number(avgAmt.toFixed(2)),
                        frequency: `${items.length} occurrences recorded`,
                        lastDate: items[0].date
                    });
                }
            }
        }

        // 4. Potential unnecessary / discretionary spending
        // Discretionary categories: Shopping, Entertainment, Others
        const discretionaryCategories = ['Shopping', 'Entertainment', 'Others'];
        const potentialUnnecessary = [];
        for (const [cat, amt] of Object.entries(catTotals)) {
            if (discretionaryCategories.includes(cat)) {
                const ratioToIncome = totalIncome > 0 ? (amt / totalIncome) : 0;
                if (ratioToIncome > 0.15 || (totalIncome === 0 && amt > mean * 3)) {
                    potentialUnnecessary.push({
                        category: cat,
                        amount: Number(amt.toFixed(2)),
                        reason: `Discretionary category taking ${(ratioToIncome * 100).toFixed(1)}% of total income. Review non-essential purchases.`
                    });
                }
            }
        }

        // 5. Increased expenditure by comparing last 30 days vs prior 30 days
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);

        const recentExpenses = allExpenses.filter(e => e.date >= thirtyDaysAgo);
        const priorExpenses = allExpenses.filter(e => e.date >= sixtyDaysAgo && e.date < thirtyDaysAgo);

        const recentCat = {};
        const priorCat = {};
        recentExpenses.forEach(e => { recentCat[e.category] = (recentCat[e.category] || 0) + Number(e.amount); });
        priorExpenses.forEach(e => { priorCat[e.category] = (priorCat[e.category] || 0) + Number(e.amount); });

        const increasedCategories = [];
        for (const [cat, recAmt] of Object.entries(recentCat)) {
            const priAmt = priorCat[cat] || 0;
            if (priAmt > 0 && recAmt > priAmt) {
                const pct = ((recAmt - priAmt) / priAmt) * 100;
                if (pct >= 15) {
                    increasedCategories.push({
                        category: cat,
                        previousAmount: Number(priAmt.toFixed(2)),
                        currentAmount: Number(recAmt.toFixed(2)),
                        percentageIncrease: Number(pct.toFixed(1))
                    });
                }
            }
        }

        // 6. Actionable opportunities
        const opportunities = [];
        if (potentialUnnecessary.length > 0) {
            opportunities.push(`Curbing spending in ${potentialUnnecessary.map(p => p.category).join(' & ')} could free up significant monthly savings.`);
        }
        if (recurringExpenses.length > 0) {
            opportunities.push(`Audit ${recurringExpenses.length} identified recurring commitments to eliminate unused subscriptions.`);
        }
        if (increasedCategories.length > 0) {
            opportunities.push(`${increasedCategories[0].category} expenditure rose by ${increasedCategories[0].percentageIncrease}% recently. Setting a category cap is advised.`);
        }
        if (opportunities.length === 0) {
            opportunities.push("Maintain your current balanced spending discipline across core categories.");
        }

        return {
            topCategories,
            unusualExpenses,
            recurringExpenses,
            potentialUnnecessary,
            increasedCategories,
            opportunities
        };
    }

    /**
     * Feature 1.D: Monthly Comparison (Current vs Previous Month)
     */
    async getMonthlyComparison(userId) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed

        // Current month bounds
        const curStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const curLastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const curEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(curLastDay).padStart(2, '0')}`;

        // Previous month bounds
        const prevD = new Date(currentYear, currentMonth - 1, 1);
        const prevYear = prevD.getFullYear();
        const prevMonth = prevD.getMonth();
        const prevStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
        const prevLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
        const prevEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

        const [curExpenses, prevExpenses, curIncomes, prevIncomes] = await Promise.all([
            db.getExpenses(userId, curStart, curEnd),
            db.getExpenses(userId, prevStart, prevEnd),
            db.getIncomes(userId, curStart, curEnd),
            db.getIncomes(userId, prevStart, prevEnd)
        ]);

        const curExpTotal = curExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const prevExpTotal = prevExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const curIncTotal = curIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
        const prevIncTotal = prevIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);

        const curSavings = curIncTotal - curExpTotal;
        const prevSavings = prevIncTotal - prevExpTotal;

        // Calculate safe percentage change
        const calcChange = (curr, prev) => {
            if (prev === 0) return curr === 0 ? 0 : 100;
            return Number((((curr - prev) / prev) * 100).toFixed(1));
        };

        const expenseChangePct = calcChange(curExpTotal, prevExpTotal);
        const incomeChangePct = calcChange(curIncTotal, prevIncTotal);
        const savingsDiff = Number((curSavings - prevSavings).toFixed(2));

        // Category-wise differences
        const allCategories = new Set([
            ...curExpenses.map(e => e.category || 'Others'),
            ...prevExpenses.map(e => e.category || 'Others')
        ]);

        const categoryComparison = [];
        allCategories.forEach(cat => {
            const curCatAmt = curExpenses.filter(e => (e.category || 'Others') === cat).reduce((s, e) => s + Number(e.amount || 0), 0);
            const prevCatAmt = prevExpenses.filter(e => (e.category || 'Others') === cat).reduce((s, e) => s + Number(e.amount || 0), 0);
            categoryComparison.push({
                category: cat,
                current: Number(curCatAmt.toFixed(2)),
                previous: Number(prevCatAmt.toFixed(2)),
                diff: Number((curCatAmt - prevCatAmt).toFixed(2)),
                percentageChange: calcChange(curCatAmt, prevCatAmt)
            });
        });

        categoryComparison.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

        let spendingTrend = 'stable';
        if (expenseChangePct > 3) spendingTrend = 'increased';
        else if (expenseChangePct < -3) spendingTrend = 'decreased';

        return {
            currentMonth: {
                label: now.toLocaleString('default', { month: 'short', year: 'numeric' }),
                startDate: curStart,
                endDate: curEnd,
                income: Number(curIncTotal.toFixed(2)),
                expenses: Number(curExpTotal.toFixed(2)),
                savings: Number(curSavings.toFixed(2))
            },
            previousMonth: {
                label: prevD.toLocaleString('default', { month: 'short', year: 'numeric' }),
                startDate: prevStart,
                endDate: prevEnd,
                income: Number(prevIncTotal.toFixed(2)),
                expenses: Number(prevExpTotal.toFixed(2)),
                savings: Number(prevSavings.toFixed(2))
            },
            changes: {
                expenseChangePct,
                incomeChangePct,
                savingsDifference: savingsDiff,
                spendingTrend
            },
            categoryComparison
        };
    }

    /**
     * Monthly trend series for chart visualizations
     */
    async getTrends(userId, monthsBack = 6) {
        const now = new Date();
        const trendList = [];

        for (let i = monthsBack - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth();
            const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m + 1, 0).getDate();
            const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const label = d.toLocaleString('default', { month: 'short' });

            const [exps, incs] = await Promise.all([
                db.getExpenses(userId, start, end),
                db.getIncomes(userId, start, end)
            ]);

            const expenseSum = exps.reduce((s, e) => s + Number(e.amount || 0), 0);
            const incomeSum = incs.reduce((s, i) => s + Number(i.amount || 0), 0);

            trendList.push({
                month: `${y}-${String(m + 1).padStart(2, '0')}`,
                label,
                income: Number(incomeSum.toFixed(2)),
                expenses: Number(expenseSum.toFixed(2)),
                savings: Number((incomeSum - expenseSum).toFixed(2))
            });
        }

        return trendList;
    }

    /**
     * Feature 1.E: AI-Powered Expense Insights (Gemini Integration)
     * Backend calculates all financial summaries and passes them to Gemini for structured interpretation.
     */
    async getAIInsights(userId) {
        const [overview, categories, comparison, behaviour, budgets, goals] = await Promise.all([
            this.getOverview(userId, { range: 'current_month' }),
            this.getCategoryAnalysis(userId, { range: 'current_month' }),
            this.getMonthlyComparison(userId),
            this.getSpendingBehaviour(userId),
            db.getBudgets(userId),
            db.getGoals(userId)
        ]);

        const financialDataPayload = {
            monthlySummary: {
                income: overview.totalIncome,
                expenses: overview.totalExpenses,
                netSavings: overview.netSavings,
                savingsRate: `${overview.savingsRate}%`,
                avgDailySpending: overview.avgDailySpending,
                transactionsCount: overview.transactionCount
            },
            highestCategory: overview.highestCategory,
            categoryBreakdown: categories.categories.slice(0, 5),
            monthlyComparison: {
                expenseChange: `${comparison.changes.expenseChangePct}%`,
                trend: comparison.changes.spendingTrend,
                savingsDifference: comparison.changes.savingsDifference
            },
            spendingBehaviour: {
                topCategories: behaviour.topCategories,
                unusualExpensesCount: behaviour.unusualExpenses.length,
                recurringCount: behaviour.recurringExpenses.length,
                potentialUnnecessary: behaviour.potentialUnnecessary
            },
            activeBudgetsCount: budgets.length,
            activeGoalsCount: goals.length
        };

        const geminiKey = process.env.GEMINI_API_KEY;

        if (geminiKey) {
            try {
                const promptText = `You are the SmartSpend AI Financial Analyst. You are provided with strictly calculated financial metrics for the user:
${JSON.stringify(financialDataPayload, null, 2)}

REQUIREMENTS:
Interpret these actual numbers and return a JSON object with EXACTLY these 6 fields:
1. "summary": A 2-sentence summary of the user's monthly financial health based on their numbers.
2. "concerns": Array of 1-3 biggest spending concerns grounded strictly in their actual expenses.
3. "positiveHabits": Array of 1-3 positive financial habits evidenced by their data (or encouragement if low data).
4. "improvements": Array of 2-3 specific areas requiring improvement.
5. "reductionSuggestions": Array of 2-3 practical, realistic expense-reduction actions.
6. "recommendations": Array of 2-3 personalized financial recommendations.

IMPORTANT RULES:
- Never fabricate numbers or mention transactions not in the payload.
- Return ONLY valid JSON with no markdown backticks or commentary.`;

                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
                    {
                        contents: [{ parts: [{ text: promptText }] }],
                        generationConfig: {
                            temperature: 0.2,
                            responseMimeType: "application/json"
                        }
                    },
                    { timeout: 15000 }
                );

                const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (responseText) {
                    const parsed = JSON.parse(responseText);
                    return {
                        success: true,
                        source: 'gemini',
                        metrics: financialDataPayload,
                        insights: parsed
                    };
                }
            } catch (err) {
                console.warn("Gemini API call failed, generating deterministic data-grounded insights:", err.message);
            }
        }

        // Deterministic, data-grounded generation when Gemini API is unavailable or offline
        const concerns = [];
        if (overview.netSavings < 0) {
            concerns.push(`Total expenses (₹${overview.totalExpenses.toLocaleString('en-IN')}) exceed your monthly income by ₹${Math.abs(overview.netSavings).toLocaleString('en-IN')}.`);
        }
        if (overview.highestCategory.percentage > 35) {
            concerns.push(`${overview.highestCategory.name} dominates ${overview.highestCategory.percentage}% of your entire monthly expenditure.`);
        }
        if (behaviour.unusualExpenses.length > 0) {
            concerns.push(`${behaviour.unusualExpenses.length} transactions were detected as unusually high spikes.`);
        }
        if (concerns.length === 0) {
            concerns.push("No critical spending spikes detected for the active month.");
        }

        const positiveHabits = [];
        if (overview.savingsRate >= 20) {
            positiveHabits.push(`Strong savings discipline with a ${overview.savingsRate}% monthly savings rate.`);
        } else if (overview.savingsRate > 0) {
            positiveHabits.push(`Maintaining positive cashflow with ₹${overview.netSavings.toLocaleString('en-IN')} retained.`);
        }
        if (goals.length > 0) {
            positiveHabits.push(`Actively targeting ${goals.length} defined savings goal(s).`);
        }
        if (positiveHabits.length === 0) {
            positiveHabits.push("Taking the initiative to log transactions and monitor your personal finances.");
        }

        const improvements = [];
        if (overview.savingsRate < 20) {
            improvements.push("Aim to elevate your savings rate towards the recommended 20% benchmark.");
        }
        if (behaviour.potentialUnnecessary.length > 0) {
            improvements.push(`Review discretionary outlays in ${behaviour.potentialUnnecessary.map(p => p.category).join(', ')}.`);
        }
        if (budgets.length === 0) {
            improvements.push("Set category budgets to control month-end expense creep.");
        }
        if (improvements.length === 0) {
            improvements.push("Automate monthly transfers to emergency and investment funds right on payday.");
            improvements.push("Periodically audit fixed subscriptions to ensure continued utility.");
        }

        const reductionSuggestions = [];
        if (overview.highestCategory.amount > 0) {
            reductionSuggestions.push(`Establish a strict weekly cap for ${overview.highestCategory.name} to curb bulk outflows.`);
        }
        if (behaviour.recurringExpenses.length > 0) {
            reductionSuggestions.push("Review recurring charges and unsubscribe from low-utility services.");
        }
        reductionSuggestions.push("Follow the 24-hour waiting rule for non-essential purchases above ₹1,000.");

        const recommendations = [
            overview.savingsRate >= 20
                ? "Channel your surplus savings into your designated high-priority financial goals."
                : "Focus on closing the gap between current spending and your 20% savings target.",
            "Schedule a recurring weekly expense review to maintain budget awareness."
        ];

        return {
            success: true,
            source: 'deterministic_engine',
            metrics: financialDataPayload,
            insights: {
                summary: overview.totalIncome > 0
                    ? `For this period, your income was ₹${overview.totalIncome.toLocaleString('en-IN')} with ₹${overview.totalExpenses.toLocaleString('en-IN')} spent, yielding a savings rate of ${overview.savingsRate}%.`
                    : `You have recorded ₹${overview.totalExpenses.toLocaleString('en-IN')} in expenses across ${overview.transactionCount} transactions. Add your income records to view full savings health.`,
                concerns,
                positiveHabits,
                improvements,
                reductionSuggestions,
                recommendations
            }
        };
    }
}

module.exports = new AnalyticsService();
