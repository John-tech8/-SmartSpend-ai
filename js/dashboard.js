// js/dashboard.js
/**
 * SmartSpend Dashboard Logic
 * Integrates Feature 1 (Intelligent Expense Analysis)
 * and Feature 2 (Financial Health Score Calculation)
 * using actual Supabase PostgreSQL transactions.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Determine API Base URL
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBase = isLocal ? '' : (window.SMARTSPEND_API_URL || 'https://smartspend-ai-1-q37g.onrender.com');

    let supabase = null;
    let userId = null;

    try {
        if (window.initSupabase) {
            supabase = await window.initSupabase();
            userId = window.getUserId();
        }
    } catch (e) {
        console.error("Supabase init error:", e);
    }

    if (!userId) {
        userId = localStorage.getItem('smartspend_user_id') || 'guest';
    }

    const loadingEl = document.getElementById('dashboardLoading');
    const emptyEl = document.getElementById('emptyState');
    const contentEl = document.getElementById('dashboardContent');

    // Chart instances
    let categoryChartInstance = null;
    let trendChartInstance = null;

    // Active Filter State
    let currentRange = 'current_month';
    let customStartDate = null;
    let customEndDate = null;

    // Currency Formatter
    const formatINR = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    /**
     * API Request Helper with Authentication Header
     */
    async function apiFetch(endpoint) {
        const url = `${apiBase}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'x-user-id': userId
        };

        if (supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }
            } catch (e) {}
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Request failed with status ${res.status}`);
        }
        return await res.json();
    }

    /**
     * Initialize Date Filters
     */
    function setupFilterToolbar() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        const customBox = document.getElementById('customDateBox');
        const applyBtn = document.getElementById('applyCustomDateBtn');
        const startInput = document.getElementById('customStartInput');
        const endInput = document.getElementById('customEndInput');

        // Set default custom dates (last 30 days)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        startInput.value = thirtyDaysAgo.toISOString().slice(0, 10);
        endInput.value = now.toISOString().slice(0, 10);

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (range === 'custom') {
                    customBox.style.display = 'inline-flex';
                } else {
                    customBox.style.display = 'none';
                    currentRange = range;
                    loadExpenseAnalysis();
                }
            });
        });

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (startInput.value && endInput.value) {
                    currentRange = 'custom';
                    customStartDate = startInput.value;
                    customEndDate = endInput.value;
                    loadExpenseAnalysis();
                }
            });
        }
    }

    /**
     * FEATURE 2: Render Financial Health Score (Section B)
     */
    async function loadFinancialHealthScore() {
        try {
            const result = await apiFetch('/api/financial-health/score');
            const data = result.data;

            if (!data) return;

            // 1. Update Gauge & Classification
            const score = Math.round(data.score || 0);
            const scoreEl = document.getElementById('healthScoreDisplay');
            const classEl = document.getElementById('healthClassification');
            const circlePath = document.getElementById('scoreCirclePath');
            const completenessEl = document.getElementById('healthDataCompleteness');

            scoreEl.textContent = score;
            classEl.textContent = data.classification || 'Calculating...';

            if (completenessEl) {
                completenessEl.textContent = `Confidence: ${data.dataCompleteness || 'Medium'}`;
            }

            // Classification Colors
            let strokeColor = '#22C55E';
            let classBg = 'rgba(34, 197, 94, 0.2)';
            let classColor = '#4ADE80';

            if (score >= 90) {
                strokeColor = '#22C55E';
                classBg = 'rgba(34, 197, 94, 0.2)';
                classColor = '#4ADE80';
            } else if (score >= 75) {
                strokeColor = '#38BDF8';
                classBg = 'rgba(56, 189, 248, 0.2)';
                classColor = '#38BDF8';
            } else if (score >= 60) {
                strokeColor = '#818CF8';
                classBg = 'rgba(129, 140, 248, 0.2)';
                classColor = '#A5B4FC';
            } else if (score >= 40) {
                strokeColor = '#FBBF24';
                classBg = 'rgba(251, 191, 36, 0.2)';
                classColor = '#FCD34D';
            } else {
                strokeColor = '#F87171';
                classBg = 'rgba(248, 113, 113, 0.2)';
                classColor = '#FCA5A5';
            }

            classEl.style.backgroundColor = classBg;
            classEl.style.color = classColor;
            circlePath.style.stroke = strokeColor;

            // Animate SVG circle progress
            setTimeout(() => {
                circlePath.setAttribute('stroke-dasharray', `${score}, 100`);
            }, 100);

            // 2. Component-Wise Breakdown Bars
            const comps = data.components || {};

            const updateCompUI = (key, ptsId, barId, maxPts) => {
                const comp = comps[key];
                const ptsEl = document.getElementById(ptsId);
                const barEl = document.getElementById(barId);
                if (!ptsEl || !barEl) return;

                if (comp && comp.available) {
                    ptsEl.textContent = `${comp.earnedPoints} / ${comp.maxPoints} pts`;
                    const pct = Math.min(100, (comp.earnedPoints / comp.maxPoints) * 100);
                    barEl.style.width = `${pct}%`;
                    barEl.style.backgroundColor = pct >= 80 ? '#22C55E' : pct >= 50 ? '#38BDF8' : '#F87171';
                } else {
                    ptsEl.textContent = `Unavailable (Excluded)`;
                    barEl.style.width = '0%';
                }
            };

            updateCompUI('savingsRate', 'compSavingsRatePts', 'compSavingsRateBar', 30);
            updateCompUI('expenseManagement', 'compExpenseMgmtPts', 'compExpenseMgmtBar', 25);
            updateCompUI('budgetManagement', 'compBudgetMgmtPts', 'compBudgetMgmtBar', 20);
            updateCompUI('financialConsistency', 'compConsistencyPts', 'compConsistencyBar', 15);
            updateCompUI('savingsGoalProgress', 'compGoalProgressPts', 'compGoalProgressBar', 10);

            // 3. Score Recommendations List
            const recListEl = document.getElementById('scoreRecommendationsList');
            if (recListEl) {
                recListEl.innerHTML = '';
                const recs = data.recommendations || [];
                if (recs.length === 0) {
                    recListEl.innerHTML = '<p style="color: #94A3B8; margin: 0; font-size: 13px;">No critical weaknesses identified. Excellent financial control!</p>';
                } else {
                    recs.forEach(rec => {
                        const item = document.createElement('div');
                        item.className = 'rec-item';
                        item.innerHTML = `
                            <i class="fas fa-check-circle"></i>
                            <div class="rec-body">
                                <h5>${rec.component}: ${rec.suggestion}</h5>
                                <p><strong>Why it matters:</strong> ${rec.whyItMatters}</p>
                            </div>
                        `;
                        recListEl.appendChild(item);
                    });
                }
            }
        } catch (err) {
            console.error("Error loading financial health score:", err);
        }
    }

    /**
     * FEATURE 1: Render Intelligent Expense Analysis (Section A)
     */
    async function loadExpenseAnalysis() {
        try {
            let queryStr = `?range=${currentRange}`;
            if (currentRange === 'custom' && customStartDate && customEndDate) {
                queryStr += `&startDate=${customStartDate}&endDate=${customEndDate}`;
            }

            // Concurrent API requests
            const [overviewRes, categoryRes, comparisonRes, behaviourRes, aiRes] = await Promise.all([
                apiFetch(`/api/analytics/overview${queryStr}`),
                apiFetch(`/api/analytics/categories${queryStr}`),
                apiFetch('/api/analytics/monthly-comparison'),
                apiFetch('/api/analytics/behaviour'),
                apiFetch('/api/analytics/ai-insights')
            ]);

            const overview = overviewRes.data;
            const categories = categoryRes.data;
            const comparison = comparisonRes.data;
            const behaviour = behaviourRes.data;
            const aiData = aiRes.data;

            // If completely empty, show empty state
            if (overview.transactionCount === 0 && overview.totalIncome === 0) {
                if (loadingEl) loadingEl.style.display = 'none';
                if (emptyEl) emptyEl.style.display = 'block';
                if (contentEl) contentEl.style.display = 'none';
                return;
            }

            if (loadingEl) loadingEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'grid';

            // 1. Overview KPIs
            document.getElementById('kpiIncome').textContent = formatINR(overview.totalIncome);
            document.getElementById('kpiExpenses').textContent = formatINR(overview.totalExpenses);
            document.getElementById('kpiExpenseSub').textContent = `${overview.transactionCount} transactions`;

            const savingsEl = document.getElementById('kpiSavings');
            savingsEl.textContent = (overview.netSavings >= 0 ? '+' : '') + formatINR(overview.netSavings);
            savingsEl.className = `kpi-value ${overview.netSavings >= 0 ? 'positive-val' : 'negative-val'}`;
            document.getElementById('kpiSavingsRate').textContent = `Savings Rate: ${overview.savingsRate}%`;

            document.getElementById('kpiDailySpend').textContent = formatINR(overview.avgDailySpending);

            const topCat = overview.highestCategory;
            document.getElementById('kpiTopCategory').textContent = topCat.name;
            document.getElementById('kpiTopCategorySub').textContent = topCat.amount > 0
                ? `${formatINR(topCat.amount)} (${topCat.percentage}%)`
                : 'No expenses';

            document.getElementById('kpiTxnCount').textContent = overview.transactionCount;

            // 2. Category Doughnut Chart
            renderCategoryChart(categories);

            // 3. Trends & Comparison Chart
            renderTrendChart(overview.trends, comparison);

            // 4. Behaviour & Anomalies
            renderBehaviourSection(behaviour);

            // 5. AI Insights (Gemini)
            renderAIInsights(aiData);

            // 6. Recent Transaction History
            renderTransactionHistory(overview.period);

        } catch (err) {
            console.error("Error loading expense analysis:", err);
            if (loadingEl) loadingEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
        }
    }

    /**
     * Render Category Doughnut Chart with Chart.js
     */
    function renderCategoryChart(categoriesData) {
        const ctx = document.getElementById('expenseChart').getContext('2d');
        const badgeEl = document.getElementById('categoryRangeBadge');
        const pillsEl = document.getElementById('categorySummaryPills');

        if (badgeEl) {
            badgeEl.textContent = categoriesData.period.range.replace('_', ' ').toUpperCase();
        }

        const cats = categoriesData.categories || [];
        const labels = cats.map(c => c.name);
        const data = cats.map(c => c.amount);

        const palette = ['#4F46E5', '#06B6D4', '#22C55E', '#F59E0B', '#EC4899', '#8B5CF6', '#64748B'];

        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: palette.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#1E293B',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#CBD5E1',
                            font: { family: "'Poppins', sans-serif", size: 12 },
                            usePointStyle: true,
                            padding: 14
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const val = ctx.parsed || 0;
                                const pct = categoriesData.totalExpenses > 0
                                    ? ((val / categoriesData.totalExpenses) * 100).toFixed(1)
                                    : 0;
                                return ` ${ctx.label}: ${formatINR(val)} (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '68%'
            }
        });

        // Summary pills below chart
        if (pillsEl) {
            pillsEl.innerHTML = '';
            if (categoriesData.highestCategory && categoriesData.highestCategory.amount > 0) {
                const highPill = document.createElement('span');
                highPill.style.cssText = 'background: rgba(245, 158, 11, 0.15); color: #FCD34D; padding: 3px 10px; border-radius: 6px;';
                highPill.innerHTML = `<strong>Highest:</strong> ${categoriesData.highestCategory.name} (${formatINR(categoriesData.highestCategory.amount)})`;
                pillsEl.appendChild(highPill);
            }
            if (categoriesData.lowestCategory && categoriesData.lowestCategory.amount > 0 && categoriesData.categories.length > 1) {
                const lowPill = document.createElement('span');
                lowPill.style.cssText = 'background: rgba(34, 197, 94, 0.15); color: #4ADE80; padding: 3px 10px; border-radius: 6px;';
                lowPill.innerHTML = `<strong>Lowest:</strong> ${categoriesData.lowestCategory.name} (${formatINR(categoriesData.lowestCategory.amount)})`;
                pillsEl.appendChild(lowPill);
            }
        }
    }

    /**
     * Render Spending Trends Line/Bar Chart
     */
    function renderTrendChart(trends, comparison) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        const bannerEl = document.getElementById('monthlyComparisonBanner');

        // Banner text for Month-over-Month comparison
        if (bannerEl && comparison) {
            const chg = comparison.changes;
            const isIncrease = chg.expenseChangePct > 0;
            const arrow = isIncrease ? '↑' : '↓';
            const color = isIncrease ? '#F87171' : '#4ADE80';

            bannerEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span><strong>MoM Comparison:</strong> Expenses changed by <span style="color: ${color}; font-weight: 700;">${arrow} ${Math.abs(chg.expenseChangePct)}%</span> (${chg.spendingTrend})</span>
                    <span>Savings Shift: <strong style="color: ${chg.savingsDifference >= 0 ? '#4ADE80' : '#F87171'};">${chg.savingsDifference >= 0 ? '+' : ''}${formatINR(chg.savingsDifference)}</strong></span>
                </div>
            `;
        }

        if (!trends || trends.length === 0) return;

        const labels = trends.map(t => t.label);
        const incomeData = trends.map(t => t.income);
        const expenseData = trends.map(t => t.expenses);
        const savingsData = trends.map(t => t.savings);

        if (trendChartInstance) {
            trendChartInstance.destroy();
        }

        trendChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                        borderRadius: 6
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderRadius: 6
                    },
                    {
                        type: 'line',
                        label: 'Net Savings',
                        data: savingsData,
                        borderColor: '#38BDF8',
                        backgroundColor: '#38BDF8',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#CBD5E1', font: { family: "'Poppins', sans-serif", size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94A3B8' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94A3B8',
                            callback: (val) => '₹' + (val >= 1000 ? (val / 1000) + 'k' : val)
                        }
                    }
                }
            }
        });
    }

    /**
     * Render Spending Behaviour & Anomalies
     */
    function renderBehaviourSection(behaviour) {
        // 1. Unusual Spikes
        const unusualList = document.getElementById('unusualExpensesList');
        if (unusualList) {
            unusualList.innerHTML = '';
            if (!behaviour.unusualExpenses || behaviour.unusualExpenses.length === 0) {
                unusualList.innerHTML = '<li style="color: #4ADE80;">✓ No statistical spending surges detected.</li>';
            } else {
                behaviour.unusualExpenses.forEach(e => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '6px';
                    li.innerHTML = `<strong>${e.category}:</strong> ${formatINR(e.amount)} on ${e.date || 'N/A'}`;
                    unusualList.appendChild(li);
                });
            }
        }

        // 2. Recurring Subscriptions
        const recList = document.getElementById('recurringExpensesList');
        if (recList) {
            recList.innerHTML = '';
            if (!behaviour.recurringExpenses || behaviour.recurringExpenses.length === 0) {
                recList.innerHTML = '<li style="color: #94A3B8;">No regular recurring commitments identified yet.</li>';
            } else {
                behaviour.recurringExpenses.forEach(r => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '6px';
                    li.innerHTML = `<strong>${r.category}:</strong> ~${formatINR(r.estimatedAmount)} (${r.frequency})`;
                    recList.appendChild(li);
                });
            }
        }

        // 3. Discretionary / Potential Savings
        const discList = document.getElementById('discretionaryList');
        if (discList) {
            discList.innerHTML = '';
            if (!behaviour.potentialUnnecessary || behaviour.potentialUnnecessary.length === 0) {
                discList.innerHTML = '<li style="color: #4ADE80;">✓ Discretionary spending is well within balanced ratios.</li>';
            } else {
                behaviour.potentialUnnecessary.forEach(p => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '6px';
                    li.innerHTML = `<strong>${p.category}:</strong> ${p.reason}`;
                    discList.appendChild(li);
                });
            }
        }
    }

    /**
     * Render Gemini AI Insights
     */
    function renderAIInsights(aiData) {
        if (!aiData || !aiData.insights) return;
        const ins = aiData.insights;

        // Source badge
        const srcEl = document.getElementById('aiInsightsSource');
        if (srcEl) {
            srcEl.textContent = aiData.source === 'gemini'
                ? 'Powered by Google Gemini 1.5'
                : 'Deterministic Financial Engine';
        }

        // Summary text
        const sumEl = document.getElementById('aiSummaryText');
        if (sumEl && ins.summary) {
            sumEl.textContent = ins.summary;
        }

        // Helper to populate lists
        const fillList = (id, items) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '';
            (items || []).forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                el.appendChild(li);
            });
        };

        fillList('aiConcernsList', ins.concerns);
        fillList('aiHabitsList', ins.positiveHabits);
        fillList('aiImprovementsList', ins.improvements);
        fillList('aiSuggestionsList', ins.reductionSuggestions);
    }

    /**
     * Render Recent Expense History Table
     */
    async function renderTransactionHistory(period) {
        const tbody = document.getElementById('expenseHistoryTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        try {
            const exps = await db.getExpenses(userId, period?.startDate, period?.endDate);
            if (!exps || exps.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #94A3B8;">No transactions found in this period.</td></tr>';
                return;
            }

            exps.slice(0, 15).forEach(e => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                tr.innerHTML = `
                    <td style="padding: 12px; color: #CBD5E1;">${e.date || 'N/A'}</td>
                    <td style="padding: 12px; font-weight: 500; color: #ffffff;">${e.category || 'Others'}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 600; color: #F87171;">-${formatINR(e.amount)}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.warn("Could not load transaction history table:", e);
        }
    }

    // -------------------------------------------------------------
    // INITIALIZATION RUN
    // -------------------------------------------------------------
    setupFilterToolbar();

    // Load both interconnected features
    await Promise.all([
        loadFinancialHealthScore(),
        loadExpenseAnalysis()
    ]);
});
