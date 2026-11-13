document.addEventListener('DOMContentLoaded', async () => {
    // Attempt init
    let supabase = null;
    let userId = null;
    try {
        if (window.initSupabase) {
            supabase = await window.initSupabase();
            userId = window.getUserId();
        }
        if (window.requireAuth && supabase) {
            const authUser = await window.requireAuth();
            if (!authUser) return;
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

    // Editorial Finance Palette Mapping
    const colorMap = {
        'Food': '#52765D',
        'Transport': '#52749A',
        'Shopping': '#A47B35',
        'Entertainment': '#B65C4B',
        'Rent': '#182820',
        'EMI': '#8E9990',
        'Bills': '#367A53',
        'Misc': '#C4B9A7',
        'Others': '#C4B9A7'
    };

    const fallbackPalette = ['#182820', '#52765D', '#B65C4B', '#A47B35', '#52749A', '#367A53', '#8E9990', '#C4B9A7'];

    // Sort categories by amount descending
    const sortedCategories = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]);
    const chartData = sortedCategories.map(cat => categoryTotals[cat]);
    const bgColors = sortedCategories.map((label, i) => colorMap[label] || fallbackPalette[i % fallbackPalette.length]);

    // ---- RENDER SUMMARY TABLE ----
    const tableBody = document.getElementById('summaryTableBody');
    tableBody.innerHTML = '';

    sortedCategories.forEach((category, index) => {
        const amount = categoryTotals[category];
        const percentage = ((amount / totalMonthlyExpenses) * 100).toFixed(1);
        const color = bgColors[index];

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="category-bullet" style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; display: inline-block;"></span>
                    <span style="font-weight: 500; color: var(--text-primary);">${category}</span>
                </div>
            </td>
            <td style="text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary);">${formatCurrency(amount)}</td>
            <td style="text-align: right; color: var(--text-secondary); font-variant-numeric: tabular-nums;">${percentage}%</td>
        `;
        tableBody.appendChild(tr);
    });

    // ---- RENDER PIE CHART ----
    const ctx = document.getElementById('monthlyChart').getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: chartData,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateScale: true, animateRotate: true, duration: 600, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 8,
                        boxHeight: 8,
                        color: '#69746B',
                        font: { family: "'Inter', sans-serif", size: 12, weight: 500 }
                    }
                },
                tooltip: {
                    backgroundColor: '#182820',
                    titleColor: '#FFFFFF',
                    bodyColor: '#E7EEE7',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 12, family: "'Inter', sans-serif", weight: 600 },
                    bodyFont: { size: 12, family: "'Inter', sans-serif" },
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
            cutout: '72%',
            layout: {
                padding: 12
            }
        }
    });

});
