/**
 * SmartSpend – Financial Health Score Dashboard
 *
 * Uses ES module imports from calculator.js for all shared financial logic.
 * Fetches ONLY current-month data (filtered by created_at range).
 * Uses calculateWeightedHealthScore for a real 3-component score.
 * Uses getGrade as the SINGLE source-of-truth for all grading.
 */

import {
    formatCurrency,
    calculateTotalExpenses,
    calculateSavings,
    calculateSavingsRate,
    calculateExpenseRatio,
    calculateDebtToIncomeRatio,
    calculateWeightedHealthScore,
    getGrade
} from './calculator.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns { startDate: 'YYYY-MM-01', endDate: 'YYYY-MM-DD' } for the current month.
 */
function getCurrentMonthRange() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    return {
        startDate: `${year}-${String(month).padStart(2, '0')}-01`,
        endDate:   `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
        monthStr:  `${year}-${String(month).padStart(2, '0')}`,
        monthName: now.toLocaleString('default', { month: 'long', year: 'numeric' })
    };
}

/**
 * Returns human-readable month name from YYYY-MM string.
 */
function getMonthName(monthStr) {
    try {
        const [year, month] = monthStr.split('-').map(Number);
        return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    } catch { return monthStr; }
}

/**
 * Shows/hides the three main UI states: loading, empty, content.
 */
function showState(loadingEl, emptyEl, contentEl, state) {
    if (loadingEl) loadingEl.style.display = state === 'loading' ? 'block' : 'none';
    if (emptyEl)   emptyEl.style.display   = state === 'empty'   ? 'block' : 'none';
    if (contentEl) contentEl.style.display = state === 'content' ? 'grid'  : 'none';
}

/**
 * Sets a progress bar width, clamped to 0–100%.
 * Optionally applies warning/danger colour classes.
 */
function setProgressBar(barId, pct, colorClass) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    bar.className = 'progress-bar-fill';
    if (colorClass) bar.classList.add(colorClass);
}

/**
 * Returns a colour class based on a value being good/warning/danger.
 * @param {number} value
 * @param {number} goodThreshold   - value <= this is good (green)
 * @param {number} warningThreshold - value <= this is warning (yellow), else danger (red)
 * @param {boolean} invert - if true, higher is better (for savings rate)
 */
function getColorClass(value, goodThreshold, warningThreshold, invert = false) {
    if (invert) {
        if (value >= goodThreshold)    return '';           // green (default bar color)
        if (value >= warningThreshold) return 'warning';
        return 'danger';
    } else {
        if (value <= goodThreshold)    return '';
        if (value <= warningThreshold) return 'warning';
        return 'danger';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

    const loadingEl = document.getElementById('dashboardLoading');
    const emptyEl   = document.getElementById('emptyState');
    const contentEl = document.getElementById('dashboardContent');

    showState(loadingEl, emptyEl, contentEl, 'loading');

    // ── Supabase Init ────────────────────────────────────────────────────────
    let supabase = null;
    let userId   = null;
    try {
        if (window.initSupabase) {
            supabase = await window.initSupabase();
            userId   = window.getUserId();
        }
    } catch (e) {
        console.error('Supabase init failed', e);
    }

    // ── No Supabase: Try localStorage fallback ───────────────────────────────
    if (!supabase || !userId) {
        const localIncome   = parseFloat(localStorage.getItem('smartspend_income')) || 0;
        const localExpenses = JSON.parse(localStorage.getItem('smartspend_latest_expenses') || '{}');
        const localMonth    = localStorage.getItem('smartspend_month');
        const { monthStr }  = getCurrentMonthRange();

        if (!localIncome || localMonth !== monthStr) {
            showState(loadingEl, emptyEl, contentEl, 'empty');
            return;
        }

        const totalExp = calculateTotalExpenses(localExpenses);
        renderDashboard({
            monthlyIncome:    localIncome,
            totalExpenses:    totalExp,
            expenseBreakdown: localExpenses,
            expenseHistory:   [],
            monthlyDebt:      parseFloat(localStorage.getItem('smartspend_outstanding_debt')) || null,
            monthName:        getMonthName(monthStr)
        });
        return;
    }

    // ── Fetch Current Month Data from Supabase ───────────────────────────────
    const { startDate, endDate, monthStr, monthName } = getCurrentMonthRange();
    const endDateTime = endDate + 'T23:59:59';

    const [incomeResult, expenseResult] = await Promise.all([
        supabase
            .from('incomes')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', startDate)
            .lte('created_at', endDateTime),
        supabase
            .from('expenses')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', startDate)
            .lte('created_at', endDateTime)
            .order('created_at', { ascending: false })
    ]);

    // Handle fetch errors
    if (incomeResult.error || expenseResult.error) {
        console.error('Data fetch error', incomeResult.error, expenseResult.error);
        showState(loadingEl, emptyEl, contentEl, 'empty');
        const subtitle = document.getElementById('dashboardSubtitle');
        if (subtitle) subtitle.textContent = 'Could not load your data. Please check your connection.';
        return;
    }

    const incomeData  = incomeResult.data  || [];
    const expenseData = expenseResult.data || [];

    // No data for current month
    if (incomeData.length === 0) {
        showState(loadingEl, emptyEl, contentEl, 'empty');
        return;
    }

    // ── Process Raw Data ─────────────────────────────────────────────────────

    // Sum all income records for the month
    const monthlyIncome = incomeData.reduce((sum, r) => sum + Number(r.amount), 0);

    // Get outstanding debt from income record if stored there
    let monthlyDebt = null;
    const incomeWithDebt = incomeData.find(r =>
        r.outstanding_debt !== null && r.outstanding_debt !== undefined
    );
    if (incomeWithDebt) {
        monthlyDebt = Number(incomeWithDebt.outstanding_debt);
    }

    // Aggregate expenses by category
    const expenseBreakdown = {};
    expenseData.forEach(exp => {
        const amount = Number(exp.amount);
        if (isFinite(amount) && amount >= 0) {
            expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + amount;
        }
    });

    const totalExpenses = calculateTotalExpenses(expenseBreakdown);

    // If we have income data but zero expenses, still render (Test 5)
    renderDashboard({
        monthlyIncome,
        totalExpenses,
        expenseBreakdown,
        expenseHistory: expenseData,
        monthlyDebt,
        monthName,
        monthStr,
        supabase,
        userId
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

async function renderDashboard({
    monthlyIncome,
    totalExpenses,
    expenseBreakdown,
    expenseHistory,
    monthlyDebt,
    monthName,
    monthStr,
    supabase,
    userId
}) {
    const loadingEl = document.getElementById('dashboardLoading');
    const emptyEl   = document.getElementById('emptyState');
    const contentEl = document.getElementById('dashboardContent');

    showState(loadingEl, emptyEl, contentEl, 'content');

    // ── Core Calculations ────────────────────────────────────────────────────

    // Savings = income – expenses (can be negative for deficits)
    const savings     = calculateSavings(monthlyIncome, totalExpenses) ?? (monthlyIncome - totalExpenses);
    // Savings rate (can be negative for deficits; null when income = 0)
    const savingsRate = calculateSavingsRate(monthlyIncome, totalExpenses);
    // Expense-to-income ratio
    const expRatio    = calculateExpenseRatio(monthlyIncome, totalExpenses);
    // Debt-to-income ratio (EMI from expenses + optional extra debt)
    const emiAmount   = expenseBreakdown['Emi'] || expenseBreakdown['EMI'] || 0;
    const totalDebt   = monthlyDebt !== null ? emiAmount + monthlyDebt : (emiAmount > 0 ? emiAmount : null);
    const debtRatio   = totalDebt !== null ? calculateDebtToIncomeRatio(monthlyIncome, totalDebt) : null;

    // Financial Health Score (3-component weighted model)
    const scoreResult = calculateWeightedHealthScore({
        income:        monthlyIncome,
        totalExpenses: totalExpenses,
        monthlyDebt:   totalDebt  // null if no debt info available
    });

    const { normalizedScore, grade, gradeLabel, components, isPartial, insufficientData } = scoreResult;

    // ── Render Health Score Card ─────────────────────────────────────────────

    const scoreEl   = document.getElementById('healthScoreDisplay');
    const gradeEl   = document.getElementById('healthGradeDisplay');
    const msgEl     = document.getElementById('healthMessageDisplay');
    const partialEl = document.getElementById('scorePartialNote');

    if (scoreEl)  scoreEl.textContent  = insufficientData ? '—' : normalizedScore;
    if (gradeEl)  gradeEl.textContent  = insufficientData ? '—' : `${grade} · ${gradeLabel}`;
    if (msgEl) {
        if (insufficientData) {
            msgEl.textContent = 'No income data found. Add your income and expenses to calculate your score.';
        } else {
            const messages = {
                A: `Excellent! You have a highly sustainable financial profile. Keep maintaining this discipline.`,
                B: `Good job! Your finances are in solid shape. A few optimizations could push you to Excellent.`,
                C: `Average. You're managing, but there's room to significantly improve your savings rate.`,
                D: `Poor. Your expenses are consuming most of your income. Focus on reducing your largest categories.`,
                F: `Critical. Immediate action needed — your expenses are unsustainably high relative to your income.`
            };
            msgEl.textContent = messages[grade] || 'Analyzing your data...';
        }
    }

    if (partialEl) {
        if (isPartial && !insufficientData) {
            partialEl.textContent = '* Score based on available components. Add EMI data for a complete score.';
            partialEl.style.display = 'block';
        } else {
            partialEl.style.display = 'none';
        }
    }

    // ── Render Metric Cards ──────────────────────────────────────────────────

    // 1. Savings Rate
    const srDisplay = document.getElementById('savingsRateDisplay');
    const srSub     = document.getElementById('savingsRateSub');
    const srBar     = document.getElementById('savingsRateBar');

    if (srDisplay) {
        if (savingsRate === null) {
            srDisplay.textContent = 'N/A';
            if (srSub) srSub.textContent = 'No income data';
        } else {
            srDisplay.textContent = savingsRate.toFixed(1) + '%';
            if (srSub) {
                if (savingsRate < 0)        srSub.textContent = `Deficit of ${formatCurrency(Math.abs(savings))}`;
                else if (savingsRate < 10)  srSub.textContent = 'Below target (aim for ≥20%)';
                else if (savingsRate < 20)  srSub.textContent = 'Getting closer to target';
                else                        srSub.textContent = 'At or above recommended target';
            }
            if (srBar) {
                const pct      = Math.min(Math.max(savingsRate, 0), 100);
                const colorCls = getColorClass(savingsRate, 20, 10, true);
                setProgressBar('savingsRateBar', pct, colorCls);
            }
        }
    }

    // 2. Expense-to-Income Ratio
    const erDisplay = document.getElementById('expenseRatioDisplay');
    const erSub     = document.getElementById('expenseRatioSub');

    if (erDisplay) {
        if (expRatio === null) {
            erDisplay.textContent = 'N/A';
            if (erSub) erSub.textContent = 'No income data';
        } else {
            erDisplay.textContent = expRatio.toFixed(1) + '%';
            if (erSub) {
                if (expRatio > 100)      erSub.textContent = 'Over 100% — severe deficit';
                else if (expRatio > 90)  erSub.textContent = 'Very high — critical risk';
                else if (expRatio > 80)  erSub.textContent = 'High — reduce expenses';
                else if (expRatio > 70)  erSub.textContent = 'Moderate — watch closely';
                else if (expRatio > 50)  erSub.textContent = 'Acceptable — room to improve';
                else                     erSub.textContent = 'Excellent — ≤50% of income';
            }
            const erColorCls = getColorClass(expRatio, 50, 80, false);
            setProgressBar('expenseRatioBar', expRatio > 100 ? 100 : expRatio, erColorCls);
        }
    }

    // 3. Debt-to-Income Ratio
    const drDisplay = document.getElementById('debtRatioDisplay');
    const drSub     = document.getElementById('debtRatioSub');

    if (drDisplay) {
        if (debtRatio === null) {
            drDisplay.textContent = 'N/A';
            if (drSub) drSub.textContent = 'No EMI/debt data entered';
        } else {
            drDisplay.textContent = debtRatio.toFixed(1) + '%';
            if (drSub) {
                if (debtRatio === 0)        drSub.textContent = 'No debt — perfect score';
                else if (debtRatio <= 15)   drSub.textContent = 'Low debt — healthy';
                else if (debtRatio <= 30)   drSub.textContent = 'Manageable — watch closely';
                else if (debtRatio <= 43)   drSub.textContent = 'High — consider reducing debt';
                else                        drSub.textContent = 'Very high — critical risk';
            }
            const drColorCls = getColorClass(debtRatio, 15, 43, false);
            setProgressBar('debtRatioBar', Math.min(debtRatio, 100), drColorCls);
        }
    }

    // ── Render Monthly Income in dashboard header ─────────────────────────────
    const incomeDisplay  = document.getElementById('incomeDisplay');
    const balanceDisplay = document.getElementById('balanceDisplay');
    if (incomeDisplay)  incomeDisplay.textContent  = formatCurrency(monthlyIncome);
    if (balanceDisplay) balanceDisplay.textContent = formatCurrency(savings);

    // ── Render Savings Summary List ──────────────────────────────────────────

    const sumIncomeEl   = document.getElementById('sumIncome');
    const sumExpensesEl = document.getElementById('sumExpenses');
    const sumSavingsEl  = document.getElementById('sumSavings');
    const topExpenseEl  = document.getElementById('topExpense');
    const bottomExpEl   = document.getElementById('bottomExpense');

    if (sumIncomeEl)   sumIncomeEl.textContent   = formatCurrency(monthlyIncome);
    if (sumExpensesEl) sumExpensesEl.textContent  = '-' + formatCurrency(totalExpenses);

    if (sumSavingsEl) {
        sumSavingsEl.textContent = (savings >= 0 ? '+' : '') + formatCurrency(savings);
        sumSavingsEl.className   = savings >= 0 ? 'amount positive-text' : 'amount negative-text';
    }

    // Top & Bottom Expense Categories
    const catEntries = Object.entries(expenseBreakdown).filter(([, v]) => v > 0);
    if (catEntries.length > 0) {
        catEntries.sort(([, a], [, b]) => b - a);
        const [topCat, topAmt]       = catEntries[0];
        const [botCat, botAmt]       = catEntries[catEntries.length - 1];
        if (topExpenseEl) topExpenseEl.textContent = `${topCat} (${formatCurrency(topAmt)})`;
        if (bottomExpEl)  bottomExpEl.textContent  = `${botCat} (${formatCurrency(botAmt)})`;
    } else {
        if (topExpenseEl) topExpenseEl.textContent = 'No expenses';
        if (bottomExpEl)  bottomExpEl.textContent  = 'No expenses';
    }

    // ── Dynamic AI Warning Alert ─────────────────────────────────────────────
    const aiWarning = document.getElementById('aiWarningAlert');
    if (aiWarning && monthlyIncome > 0 && totalExpenses > 0) {
        const foodPct  = ((expenseBreakdown['Food'] || 0) / monthlyIncome) * 100;
        const shopPct  = ((expenseBreakdown['Shopping'] || 0) / monthlyIncome) * 100;
        const emiPct   = (emiAmount / monthlyIncome) * 100;

        if (foodPct > 30) {
            aiWarning.style.display = 'block';
            aiWarning.innerHTML = `<strong>⚠️ AI Note:</strong> Food & Groceries accounts for ${foodPct.toFixed(1)}% of your income (above the 30% threshold). Consider meal planning and home cooking to reduce this cost.`;
        } else if (shopPct > 15) {
            aiWarning.style.display = 'block';
            aiWarning.innerHTML = `<strong>⚠️ AI Note:</strong> Shopping accounts for ${shopPct.toFixed(1)}% of your income. Try the 24-hour rule before non-essential purchases.`;
        } else if (emiPct > 43) {
            aiWarning.style.display = 'block';
            aiWarning.innerHTML = `<strong>⚠️ AI Note:</strong> Your EMI payments are ${emiPct.toFixed(1)}% of income, which is a high debt burden. Consider refinancing or accelerating debt payoff.`;
        } else {
            aiWarning.style.display = 'none';
        }
    } else if (aiWarning) {
        aiWarning.style.display = 'none';
    }

    // ── Render Score Breakdown Section ───────────────────────────────────────

    const breakdownContainer = document.getElementById('scoreBreakdownItems');
    const breakdownNote      = document.getElementById('scoreBreakdownNote');

    if (breakdownNote) {
        breakdownNote.textContent = isPartial
            ? `Partial score (${scoreResult.maxPossibleScore || 75}/100 components available)`
            : 'Full 3-component score';
    }

    if (breakdownContainer) {
        breakdownContainer.innerHTML = '';

        const compRows = [
            {
                label:     'Savings Rate',
                component: components.savingsRate,
                detail:    components.savingsRate.rate !== null
                    ? `${components.savingsRate.rate.toFixed(1)}% savings rate`
                    : 'Not available'
            },
            {
                label:     'Expense-to-Income Ratio',
                component: components.expenseRatio,
                detail:    components.expenseRatio.ratio !== null
                    ? `${components.expenseRatio.ratio.toFixed(1)}% of income spent`
                    : 'Not available'
            },
            {
                label:     'Debt-to-Income Ratio',
                component: components.debtRatio,
                detail:    components.debtRatio.ratio !== null
                    ? `${components.debtRatio.ratio.toFixed(1)}% of income on debt`
                    : 'No EMI/debt data — enter in Expenses page'
            }
        ];

        compRows.forEach(({ label, component, detail }) => {
            const pct = component.available
                ? Math.round((component.points / component.maxPoints) * 100)
                : 0;

            const row = document.createElement('div');
            row.className = 'breakdown-item';
            row.innerHTML = `
                <div class="breakdown-label">
                    ${label}
                    <div class="breakdown-unavailable">${detail}</div>
                </div>
                <div class="breakdown-bar">
                    <div class="breakdown-bar-fill" style="width: ${pct}%"></div>
                </div>
                <div class="breakdown-pts">
                    ${component.available
                        ? `${component.points} / ${component.maxPoints} pts`
                        : '<span style="color:#999;font-weight:normal;font-size:12px;">Not scored</span>'}
                </div>
            `;
            breakdownContainer.appendChild(row);
        });
    }

    // ── Render Expense History Table ─────────────────────────────────────────

    const historyTbody = document.getElementById('expenseHistoryTableBody');
    if (historyTbody) {
        historyTbody.innerHTML = '';

        if (expenseHistory.length === 0) {
            historyTbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding: 25px; color: #94a3b8;">
                        No expense records for this month yet.
                        <a href="expenses.html" style="color: #2a5298; margin-left: 8px;">Add expenses →</a>
                    </td>
                </tr>`;
        } else {
            expenseHistory.forEach(exp => {
                const amount  = Number(exp.amount);
                const pct     = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '—';
                const dateStr = exp.date || (exp.created_at ? exp.created_at.slice(0, 10) : 'N/A');
                const tr      = document.createElement('tr');
                tr.innerHTML  = `
                    <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #555;">${dateStr}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">${exp.category}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 500;">${formatCurrency(amount)}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666;">${pct}%</td>
                `;
                historyTbody.appendChild(tr);
            });
        }
    }

    // ── Pie Chart (Expense Breakdown) ────────────────────────────────────────

    const expChartEl = document.getElementById('expenseChart');
    if (expChartEl) {
        const ctx         = expChartEl.getContext('2d');
        const chartLabels = Object.keys(expenseBreakdown).filter(k => expenseBreakdown[k] > 0);
        const chartData   = chartLabels.map(k => expenseBreakdown[k]);

        if (chartLabels.length === 0) {
            // Show a placeholder "no expenses" chart
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Expenses'],
                    datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    cutout: '70%'
                }
            });
        } else {
            const bgColors = [
                '#4F46E5', '#22C55E', '#38BDF8', '#F59E0B',
                '#EC4899', '#8B5CF6', '#94A3B8', '#F97316'
            ];

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: bgColors.slice(0, chartLabels.length),
                        borderWidth: 2,
                        borderColor: '#fff',
                        hoverOffset: 12
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { animateScale: true, animateRotate: true, duration: 1200, easing: 'easeOutQuart' },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { padding: 20, usePointStyle: true, font: { family: "'Inter', sans-serif", size: 13 } }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            padding: 15,
                            callbacks: {
                                label(context) {
                                    const val  = context.parsed;
                                    const pct  = totalExpenses > 0 ? ((val / totalExpenses) * 100).toFixed(1) : 0;
                                    return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
                                }
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
    }

    // ── Bar Chart (Peer Comparison) ──────────────────────────────────────────

    const peerChartEl = document.getElementById('peerChart');
    if (peerChartEl) {
        const peerCtx = peerChartEl.getContext('2d');

        new Chart(peerCtx, {
            type: 'bar',
            data: {
                labels: ['Savings Rate (%)', 'Food/Groceries (₹)', 'Shopping (₹)'],
                datasets: [
                    {
                        label: 'You',
                        data: [
                            savingsRate !== null ? Math.max(savingsRate, 0).toFixed(1) : 0,
                            expenseBreakdown['Food'] || 0,
                            expenseBreakdown['Shopping'] || 0
                        ],
                        backgroundColor: '#4F46E5',
                        borderRadius: 8,
                        borderSkipped: false
                    },
                    {
                        label: 'Average Peer',
                        data: [15, 8000, 3000], // Representative averages
                        backgroundColor: '#94A3B8',
                        borderRadius: 8,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        padding: 12,
                        titleFont: { size: 14 },
                        bodyFont: { size: 14 }
                    },
                    legend: { position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // ── Monthly Report Card ──────────────────────────────────────────────────

    if (supabase && userId && monthStr) {
        await loadMonthlyReportCard({
            supabase,
            userId,
            monthStr,
            monthName,
            normalizedScore,
            grade,
            expenseBreakdown,
            savingsRate,
            totalExpenses,
            monthlyIncome
        });
    } else {
        // Offline mode: render report from current calculations
        renderReportCard({
            health_score: normalizedScore,
            improvements: JSON.stringify(generateImprovements({
                grade, expenseBreakdown, savingsRate, totalExpenses, monthlyIncome
            }))
        });
        const reportMonthEl = document.getElementById('reportMonthStr');
        if (reportMonthEl) reportMonthEl.textContent = monthName || '';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPROVEMENTS GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates data-driven top-3 improvement suggestions based on actual financial data.
 * Never returns generic advice unrelated to the user's actual numbers.
 */
function generateImprovements({ grade, expenseBreakdown, savingsRate, totalExpenses, monthlyIncome }) {
    const improvements = [];

    // Calculate which category is highest
    const catEntries = Object.entries(expenseBreakdown).filter(([, v]) => v > 0);
    catEntries.sort(([, a], [, b]) => b - a);
    const topCat    = catEntries[0]?.[0]  || null;
    const topAmt    = catEntries[0]?.[1]  || 0;
    const emiAmount = expenseBreakdown['Emi'] || expenseBreakdown['EMI'] || 0;
    const sr        = savingsRate ?? 0;
    const expRatio  = monthlyIncome > 0 ? (totalExpenses / monthlyIncome) * 100 : 0;

    // 1. Savings rate suggestion
    if (sr < 0) {
        improvements.push(`⚠️ You have a spending deficit of ${formatCurrency(Math.abs(monthlyIncome - totalExpenses))}. Immediately identify which categories can be reduced to bring expenses below your income.`);
    } else if (sr < 10) {
        improvements.push(`💰 Your savings rate is only ${sr.toFixed(1)}%. Try to cut ${formatCurrency(monthlyIncome * 0.05)} from your largest expense (${topCat || 'top category'}) to reach a 5% savings rate.`);
    } else if (sr < 20) {
        improvements.push(`📈 Your savings rate is ${sr.toFixed(1)}%. Aim for 20% by reducing ${topCat ? `${topCat} (₹${topAmt.toFixed(0)})` : 'your largest expense'} by 10–15%.`);
    } else {
        improvements.push(`✅ Excellent savings rate of ${sr.toFixed(1)}%! Consider investing a portion of your savings into a SIP or fixed deposit to grow your wealth.`);
    }

    // 2. Expense ratio suggestion
    if (expRatio > 90) {
        improvements.push(`🚨 You're spending ${expRatio.toFixed(1)}% of your income. Create a strict monthly budget for each category and track spending weekly.`);
    } else if (expRatio > 70) {
        improvements.push(`📊 Your expense ratio is ${expRatio.toFixed(1)}%. Review subscriptions, dining, and entertainment for quick wins to bring this below 70%.`);
    } else if (topCat && topAmt > 0) {
        const topPct = monthlyIncome > 0 ? ((topAmt / monthlyIncome) * 100).toFixed(1) : 0;
        improvements.push(`🔍 Your highest expense is ${topCat} at ${formatCurrency(topAmt)} (${topPct}% of income). Set a monthly cap for this category and track it actively.`);
    }

    // 3. Debt suggestion (if applicable)
    if (emiAmount > 0 && monthlyIncome > 0) {
        const emiPct = ((emiAmount / monthlyIncome) * 100).toFixed(1);
        if (emiPct > 43) {
            improvements.push(`💳 Your debt payments are ${emiPct}% of income (above the 43% danger threshold). Prioritize paying off the highest-interest debt first to reduce this burden.`);
        } else if (emiPct > 20) {
            improvements.push(`💳 Your EMI payments are ${emiPct}% of income. Avoid taking any new loans until this ratio drops below 20%.`);
        } else {
            improvements.push(`💳 Your debt ratio is a healthy ${emiPct}%. Stay consistent with EMI payments to clear debt ahead of schedule and save on interest.`);
        }
    } else {
        // No debt — give a savings/investment tip
        if (improvements.length < 3) {
            improvements.push(`🏦 You have no recorded EMI/debt — great! Channel the money you save into an emergency fund (target: 3–6 months of expenses).`);
        }
    }

    return improvements.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT CARD
// ─────────────────────────────────────────────────────────────────────────────

function renderReportCard(report) {
    if (!report) return;

    const score = Number(report.health_score) || 0;
    const { grade } = getGrade(score); // Single source of truth for grading

    const reportGradeEl = document.getElementById('reportGrade');
    const reportScoreEl = document.getElementById('reportScore');

    if (reportGradeEl) {
        reportGradeEl.textContent = grade;
        const gradeColors = { A: '#4cd964', B: '#34a853', C: '#ffcc00', D: '#ff9500', F: '#ff3b30' };
        reportGradeEl.style.background = gradeColors[grade] || '#ff3b30';
    }
    if (reportScoreEl) reportScoreEl.textContent = `${score} / 100`;

    const listArea = document.getElementById('reportImprovements');
    if (listArea) {
        listArea.innerHTML = '';
        try {
            const improvArr = typeof report.improvements === 'string'
                ? JSON.parse(report.improvements)
                : report.improvements;

            if (Array.isArray(improvArr) && improvArr.length > 0) {
                improvArr.forEach(imp => {
                    const li = document.createElement('li');
                    li.style.cssText = 'margin-bottom: 10px; color: #e2e8f0; font-size: 14px; line-height: 1.5;';
                    li.textContent = imp;
                    listArea.appendChild(li);
                });
            } else {
                listArea.innerHTML = '<li style="color:#94a3b8;">No recommendations yet. Add more expense data.</li>';
            }
        } catch {
            listArea.innerHTML = '<li style="color:#94a3b8;">Could not load recommendations.</li>';
        }
    }
}

async function loadMonthlyReportCard({
    supabase, userId, monthStr, monthName,
    normalizedScore, grade,
    expenseBreakdown, savingsRate, totalExpenses, monthlyIncome
}) {
    const reportMonthEl = document.getElementById('reportMonthStr');
    if (reportMonthEl) reportMonthEl.textContent = monthName;

    // Fetch all reports for the user
    const { data: existingReports } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('month', { ascending: false });

    let currentReport = existingReports?.find(r => r.month === monthStr);

    // Generate or update the current month's report
    if (!currentReport) {
        const improvements = generateImprovements({
            grade, expenseBreakdown, savingsRate, totalExpenses, monthlyIncome
        });

        const newReport = {
            user_id:      userId,
            month:        monthStr,
            health_score: normalizedScore,
            grade:        grade,
            improvements: JSON.stringify(improvements)
        };

        const { data: inserted, error: insertErr } = await supabase
            .from('reports')
            .insert([newReport])
            .select();

        if (!insertErr && inserted?.length > 0) {
            currentReport = inserted[0];
            if (existingReports) existingReports.unshift(currentReport);
        } else {
            // Render from current calculations even if save failed
            currentReport = newReport;
        }
    } else {
        // Update the existing report with recalculated values
        const improvements = generateImprovements({
            grade, expenseBreakdown, savingsRate, totalExpenses, monthlyIncome
        });

        await supabase
            .from('reports')
            .update({
                health_score: normalizedScore,
                grade:        grade,
                improvements: JSON.stringify(improvements)
            })
            .eq('id', currentReport.id);

        // Use freshly calculated data for rendering
        currentReport = {
            ...currentReport,
            health_score: normalizedScore,
            grade,
            improvements: JSON.stringify(improvements)
        };
    }

    if (currentReport) renderReportCard(currentReport);

    // Render past report navigation buttons
    const pastReportsList = document.getElementById('pastReportsList');
    if (pastReportsList && existingReports?.length > 0) {
        pastReportsList.innerHTML = '';

        existingReports.forEach(rep => {
            const btn = document.createElement('button');
            btn.className = rep.month === monthStr ? 'btn btn-primary' : 'btn btn-outline';
            btn.style.cssText = 'padding: 6px 15px; font-size: 12px; border-radius: 20px; white-space: nowrap;';
            btn.textContent = getMonthName(rep.month);

            btn.addEventListener('click', () => {
                Array.from(pastReportsList.children).forEach(c => {
                    c.className = 'btn btn-outline';
                    c.style.padding = '6px 15px';
                    c.style.fontSize = '12px';
                    c.style.borderRadius = '20px';
                });
                btn.className = 'btn btn-primary';
                btn.style.cssText = 'padding: 6px 15px; font-size: 12px; border-radius: 20px; white-space: nowrap;';
                if (reportMonthEl) reportMonthEl.textContent = getMonthName(rep.month);
                renderReportCard(rep);
            });

            pastReportsList.appendChild(btn);
        });
    }
}
