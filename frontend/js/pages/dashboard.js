import { calculateSavings, calculateSavingsRate, calculateFinancialHealthScore } from '../calculator.js';

document.addEventListener('DOMContentLoaded', () => {
    // ---- MOCK DATA ----
    // In a real app, this would be fetched from the backend API
    const monthlyIncome = 4500.00;
    const expenseBreakdown = {
        Rent: 1200,
        Food: 600,
        Transport: 300,
        Shopping: 400,
        Entertainment: 250,
        EMI: 500,
        Misc: 150
    };

    // Calculate totals and metrics
    const totalExpenses = Object.values(expenseBreakdown).reduce((sum, val) => sum + val, 0);
    const savings = calculateSavings(monthlyIncome, expenseBreakdown);
    const savingsRate = calculateSavingsRate(monthlyIncome, totalExpenses);
    const healthData = calculateFinancialHealthScore(monthlyIncome, savingsRate, expenseBreakdown);

    // ---- UPDATE UI ELEMENTS ----
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    // Score & Grade
    document.getElementById('healthScoreDisplay').textContent = Math.round(healthData.score);
    document.getElementById('healthGradeDisplay').textContent = healthData.grade;

    // Messages based on Grade
    const messageEl = document.getElementById('healthMessageDisplay');
    if (healthData.grade === 'A') {
        messageEl.textContent = "Excellent! You have a highly sustainable financial profile.";
    } else if (healthData.grade === 'B') {
        messageEl.textContent = "Good job! You are saving a healthy amount of your income.";
    } else if (healthData.grade === 'C') {
        messageEl.textContent = "Fair. Look for areas to cut back on discretionary spending.";
    } else {
        messageEl.textContent = "Warning ⚠️ Your expenses are too high relative to your income.";
    }

    // Top Metrics
    const formattedRate = savingsRate.toFixed(1) + '%';
    document.getElementById('savingsRateDisplay').textContent = formattedRate;
    document.getElementById('savingsRateBar').style.width = Math.min(savingsRate, 100) + '%';

    document.getElementById('incomeDisplay').textContent = formatCurrency(monthlyIncome);
    document.getElementById('balanceDisplay').textContent = formatCurrency(savings);

    // Summary Details
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

    // AI Warning Logic (Example)
    const foodRate = (expenseBreakdown.Food / monthlyIncome) * 100;
    if (foodRate > 30) {
        const alertBox = document.getElementById('aiWarningAlert');
        alertBox.style.display = 'block';
        alertBox.innerHTML = `<strong>AI Insight:</strong> You spent <strong>${foodRate.toFixed(1)}%</strong> of your income on Food. Trying meal-prepping could improve your Savings Rate!`;
    }

    // ---- RENDER PIE CHART ----
    const ctx = document.getElementById('expenseChart').getContext('2d');

    const chartLabels = Object.keys(expenseBreakdown);
    const chartData = Object.values(expenseBreakdown);

    // Modern Fintech Color Palette
    const bgColors = [
        '#FF6384', // Rent (Pink)
        '#36A2EB', // Food (Blue)
        '#FFCE56', // Transport (Yellow)
        '#4BC0C0', // Shopping (Teal)
        '#9966FF', // Entertainment (Purple)
        '#FF9F40', // EMI (Orange)
        '#C9CBCF'  // Misc (Grey)
    ];

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
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            family: "'Inter', sans-serif",
                            size: 13
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 15,
                    titleFont: { size: 14 },
                    bodyFont: { size: 14, weight: 'bold' },
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            if (context.parsed !== null) {
                                label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '70%' // Creates a nice modern ring chart
        }
    });
});
