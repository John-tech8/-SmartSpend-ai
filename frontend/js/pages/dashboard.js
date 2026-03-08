document.addEventListener('DOMContentLoaded', async () => {
    // Attempt init
    let supabase = null;
    let userId = null;
    try {
        if (window.initSupabase) {
            supabase = await window.initSupabase();
            userId = window.getUserId();
        }
    } catch (e) { console.error("Supabase init failed", e); }

    const loadingEl = document.getElementById('dashboardLoading');
    const emptyEl = document.getElementById('emptyState');
    const contentEl = document.getElementById('dashboardContent');

    if (!supabase || !userId) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    // ---- FETCH PROD DATA ----
    const { data: incomeData, error: incErr } = await supabase.from('incomes').select('*').eq('user_id', userId);
    const { data: expenseData, error: expErr } = await supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false });

    if (incErr || expErr) {
        console.error("Data fetch error", incErr, expErr);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (!incomeData || incomeData.length === 0 || !expenseData || expenseData.length === 0) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        return;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'grid'; // Grid layout per CSS

    // ---- PROCESS DATA ----
    let monthlyIncome = 0;
    incomeData.forEach(inc => { monthlyIncome += Number(inc.amount); });

    let totalExpenses = 0;
    const expenseBreakdown = {};

    const historyTbody = document.getElementById('expenseHistoryTableBody');
    if (historyTbody) historyTbody.innerHTML = '';

    expenseData.forEach(exp => {
        const amount = Number(exp.amount);
        totalExpenses += amount;
        expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + amount;

        // Populate Table History
        if (historyTbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">${exp.date || 'N/A'}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">${exp.category}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 500;">₹${amount.toFixed(2)}</td>
            `;
            historyTbody.appendChild(tr);
        }
    });

    // Calculate core logic metrics
    const savings = monthlyIncome - totalExpenses;
    let savingsRate = 0;
    if (monthlyIncome > 0) {
        savingsRate = (savings / monthlyIncome) * 100;
    }

    // Apply New Grading System specific to user instructions
    let grade = 'D';
    if (savingsRate >= 60) grade = 'A';
    else if (savingsRate >= 40) grade = 'B';
    else if (savingsRate >= 20) grade = 'C';

    const roundedScore = Math.max(0, Math.min(100, Math.round(savingsRate)));

    // ---- RENDER UI ----
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    document.getElementById('healthScoreDisplay').textContent = roundedScore + '%';
    document.getElementById('healthGradeDisplay').textContent = `Grade ${grade}`;

    // Messages based on Grade (Health Message Box)
    const messageEl = document.getElementById('healthMessageDisplay');
    if (grade === 'A') messageEl.textContent = "Excellent! You have a highly sustainable financial profile.";
    else if (grade === 'B') messageEl.textContent = "Good job! You are saving a healthy amount of your income.";
    else if (grade === 'C') messageEl.textContent = "Fair. Look for areas to cut back on discretionary spending.";
    else messageEl.textContent = "Warning ⚠️ Your expenses are too high relative to your income.";

    // Top Metrics
    const formattedRate = savingsRate.toFixed(1) + '%';
    document.getElementById('savingsRateDisplay').textContent = formattedRate;
    document.getElementById('savingsRateBar').style.width = Math.min(savingsRate, 100) + '%';
    document.getElementById('incomeDisplay').textContent = formatCurrency(monthlyIncome);
    document.getElementById('balanceDisplay').textContent = formatCurrency(savings);

    // Summary Details List
    document.getElementById('sumIncome').textContent = formatCurrency(monthlyIncome);
    document.getElementById('sumExpenses').textContent = '-' + formatCurrency(totalExpenses);

    const sumSavingsEl = document.getElementById('sumSavings');
    sumSavingsEl.textContent = (savings >= 0 ? '+' : '') + formatCurrency(savings);
    sumSavingsEl.className = savings >= 0 ? 'amount positive-text' : 'amount negative-text';

    // Top Expense Category
    let maxExpenseCategory = '';
    let maxExpenseAmount = 0;
    for (const [category, amount] of Object.entries(expenseBreakdown)) {
        if (amount > maxExpenseAmount) {
            maxExpenseAmount = amount;
            maxExpenseCategory = category;
        }
    }
    document.getElementById('topExpense').textContent = `${maxExpenseCategory} (${formatCurrency(maxExpenseAmount)})`;

    // ---- PIE CHART ----
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const chartLabels = Object.keys(expenseBreakdown);
    const chartData = Object.values(expenseBreakdown);
    const bgColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { padding: 20, usePointStyle: true, font: { family: "'Inter', sans-serif", size: 13 } } },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 15, titleFont: { size: 14 }, bodyFont: { size: 14, weight: 'bold' },
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            if (context.parsed !== null) label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed);
                            return label;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });

    // ---- PEER COMPARISON CHART ----
    const peerCtx = document.getElementById('peerChart').getContext('2d');
    new Chart(peerCtx, {
        type: 'bar',
        data: {
            labels: ['Savings Rate (%)', 'Food/Groceries (₹)', 'Shopping (₹)'],
            datasets: [
                {
                    label: 'You',
                    data: [savingsRate.toFixed(1), expenseBreakdown.Food || 0, expenseBreakdown.Shopping || 0],
                    backgroundColor: '#2B61FF', borderRadius: 4
                },
                {
                    label: 'Average Peer',
                    data: [15, 800, 300], // Mock peer data
                    backgroundColor: '#C9CBCF', borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 10, titleFont: { size: 14 }, bodyFont: { size: 14 } } },
            scales: { y: { beginAtZero: true, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } }
        }
    });

    // ---- MONTHLY REPORT CARD ----
    async function loadMonthlyReportCard() {
        const date = new Date();
        const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

        document.getElementById('reportMonthStr').textContent = monthName;

        const { data: existingReports } = await supabase.from('reports').select('*').eq('user_id', userId).order('month', { ascending: false });
        let currentReport = existingReports?.find(r => r.month === currentMonth);

        if (!currentReport) {
            // Generate New Report dynamically if it missing
            let improvements = [];
            if (grade === 'A') improvements = ["Maintain your excellent savings rate by sticking to your budget.", "Look into diversified investment options to grow your wealth.", "Try optimizing your tax strategy this year."];
            else if (grade === 'B') improvements = ["Try saving an extra 5% of your income next month.", `Cut back on ${maxExpenseCategory} to boost your savings.`, "Build up a stronger emergency fund cushion."];
            else improvements = [`Strictly limit your spending on ${maxExpenseCategory}.`, "Review all your subscriptions and cancel unused ones.", "Consider a 'no-spend' week to quickly boost savings."];

            const newReport = {
                user_id: userId,
                month: currentMonth,
                health_score: roundedScore,
                grade: grade,
                improvements: JSON.stringify(improvements)
            };

            const { data: inserted, error: insertErr } = await supabase.from('reports').insert([newReport]).select();
            if (!insertErr && inserted && inserted.length > 0) {
                currentReport = inserted[0];
                if (existingReports) existingReports.unshift(currentReport);
            }
        }

        function renderReport(report) {
            let currentGrade = 'D';
            if (report.health_score >= 60) currentGrade = 'A';
            else if (report.health_score >= 40) currentGrade = 'B';
            else if (report.health_score >= 20) currentGrade = 'C';

            document.getElementById('reportGrade').textContent = currentGrade;
            document.getElementById('reportScore').textContent = `${report.health_score}%`;

            const gradeBox = document.getElementById('reportGrade');
            if (currentGrade === 'A') gradeBox.style.background = '#4cd964';
            else if (currentGrade === 'B') gradeBox.style.background = '#34a853';
            else if (currentGrade === 'C') gradeBox.style.background = '#ffcc00';
            else gradeBox.style.background = '#ff3b30';

            const listArea = document.getElementById('reportImprovements');
            listArea.innerHTML = '';
            try {
                const improvementsArr = JSON.parse(report.improvements);
                improvementsArr.forEach(imp => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '8px';
                    li.innerHTML = `<i class="fas fa-check-circle" style="color: #2B61FF; margin-right: 8px;"></i> ${imp}`;
                    listArea.appendChild(li);
                });
            } catch (e) { listArea.innerHTML = '<li style="color: #666;">View data on dashboard to see improvements.</li>'; }
        }

        if (currentReport) renderReport(currentReport);

        const pastReportsList = document.getElementById('pastReportsList');
        if (existingReports && existingReports.length > 0) {
            existingReports.forEach(rep => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline';
                btn.style.padding = '6px 15px';
                btn.style.fontSize = '12px';
                btn.style.borderRadius = '20px';
                btn.textContent = rep.month;
                if (rep.month === currentMonth) {
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-outline');
                }

                btn.addEventListener('click', () => {
                    Array.from(pastReportsList.children).forEach(c => {
                        c.classList.remove('btn-primary');
                        c.classList.add('btn-outline');
                    });
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-outline');
                    document.getElementById('reportMonthStr').textContent = rep.month;
                    renderReport(rep);
                });
                pastReportsList.appendChild(btn);
            });
        }
    }

    await loadMonthlyReportCard();
});
