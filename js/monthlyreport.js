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

    const loadingEl = document.getElementById('loadingState');
    const emptyEl = document.getElementById('emptyState');
    const contentEl = document.getElementById('reportContent');

    const date = new Date();
    const currentMonthNum = String(date.getMonth() + 1).padStart(2, '0');
    const currentYear = date.getFullYear();
    const currentMonthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

    document.getElementById('reportMonthSubtitle').textContent = `For ${currentMonthName}`;

    if (!supabase || !userId) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    // ---- FETCH PROD EXPENSE DATA FOR THIS MONTH ----
    // We only want data from this month. We query by string matching 'YYYY-MM'
    const { data: expenseData, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .gte('date', `${currentYear}-${currentMonthNum}-01`)
        .lte('date', `${currentYear}-${currentMonthNum}-31`) // Handles up to end of month safely
        .order('date', { ascending: false });

    if (expErr) {
        console.error("Data fetch error", expErr);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (!expenseData || expenseData.length === 0) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        return;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';

    // ---- GROUP AND PROCESS DATA ----
    let totalMonthlyExpenses = 0;
    const categoryTotals = {};

    expenseData.forEach(exp => {
        const amount = Number(exp.amount);
        totalMonthlyExpenses += amount;
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amount;
    });

    // Formatting utility
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    // Modern Fintech Colors Mapping
    const colorMap = {
        'Food': '#36A2EB',
        'Transport': '#FFCE56',
        'Shopping': '#4BC0C0',
        'Entertainment': '#9966FF',
        'Rent': '#FF6384',
        'EMI': '#FF9F40',
        'Bills': '#FF9F40', // fallback alias
        'Misc': '#C9CBCF',
        'Others': '#C9CBCF' // fallback alias
    };

    const chartLabels = Object.keys(categoryTotals);
    const chartData = Object.values(categoryTotals);
    const bgColors = chartLabels.map(label => colorMap[label] || '#2B61FF'); // Default blue if unknown

    // ---- RENDER SUMMARY TABLE ----
    const tableBody = document.getElementById('summaryTableBody');
    tableBody.innerHTML = '';

    // Sort categories by amount descending
    const sortedCategories = chartLabels.sort((a, b) => categoryTotals[b] - categoryTotals[a]);

    sortedCategories.forEach((category, index) => {
        const amount = categoryTotals[category];
        const percentage = ((amount / totalMonthlyExpenses) * 100).toFixed(1);
        const color = bgColors[index];

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center;">
                    <span class="category-bullet" style="background-color: ${color}"></span>
                    <span style="font-weight: 500;">${category}</span>
                </div>
            </td>
            <td style="text-align: right; font-weight: 500;">${formatCurrency(amount)}</td>
            <td style="text-align: right; color: #666;">${percentage}%</td>
        `;
        tableBody.appendChild(tr);
    });

    // ---- RENDER PIE CHART ----
    const ctx = document.getElementById('monthlyChart').getContext('2d');

    // Create a glossy gradient for each category based on its base hex color
    const chartBgColors = bgColors.map(hexColor => {
        const g = ctx.createLinearGradient(0, 0, 0, 400);
        g.addColorStop(0, hexColor);
        g.addColorStop(1, '#020617'); // Fade to dark background
        return g;
    });

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: sortedCategories.map(cat => categoryTotals[cat]),
                backgroundColor: chartBgColors,
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateScale: true, animateRotate: true, duration: 1500, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { family: "'Poppins', sans-serif", size: 14 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 15,
                    titleFont: { size: 14, family: "'Poppins', sans-serif" },
                    bodyFont: { size: 14, weight: 'bold', family: "'Poppins', sans-serif" },
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            if (context.parsed !== null) {
                                const amountStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed);
                                const pct = ((context.parsed / totalMonthlyExpenses) * 100).toFixed(1);
                                label += `${amountStr} (${pct}%)`;
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '65%', // Thin modern ring
            layout: {
                padding: 20
            }
        }
    });

});
