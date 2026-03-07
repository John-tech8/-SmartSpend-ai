document.addEventListener('DOMContentLoaded', () => {
    // Input fields
    const incomeInput = document.getElementById('monthlyIncome');
    const expenseInputs = document.querySelectorAll('.exp-field');

    // Display fields
    const dispIncome = document.getElementById('dispIncome');
    const dispExpenses = document.getElementById('dispExpenses');
    const dispBalance = document.getElementById('dispBalance');
    const balanceContainer = document.querySelector('.total-balance');
    const aiInsight = document.getElementById('aiInsight');

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const updateTotals = () => {
        // Calculate Total Income
        const income = parseFloat(incomeInput.value) || 0;

        // Calculate Total Expenses
        let totalExpenses = 0;
        expenseInputs.forEach(input => {
            totalExpenses += parseFloat(input.value) || 0;
        });

        // Calculate Remaining Balance
        const balance = income - totalExpenses;

        // Update UI Display
        dispIncome.textContent = formatCurrency(income);
        dispExpenses.textContent = formatCurrency(totalExpenses);
        dispBalance.textContent = formatCurrency(balance);

        // Update Balance Styling
        dispBalance.className = 'summary-value'; // Reset

        // Dynamic feedback
        if (income === 0 && totalExpenses === 0) {
            aiInsight.textContent = "Enter your monthly figures to see your projected financial health score and savings rate.";
            aiInsight.style.backgroundColor = "rgba(255,255,255,0.1)";
        } else if (balance > 0) {
            dispBalance.classList.add('balance-positive');
            const savingsRate = ((balance / income) * 100).toFixed(1);
            if (savingsRate >= 20) {
                aiInsight.innerHTML = `🌟 <strong>Great Job!</strong> Your projected savings rate is ${savingsRate}%. This puts you well on track for your financial goals.`;
                aiInsight.style.backgroundColor = "rgba(76, 217, 100, 0.2)";
            } else {
                aiInsight.innerHTML = `💡 Good start. Your savings rate is ${savingsRate}%. Try to aim for at least 20% by reducing some variable expenses.`;
                aiInsight.style.backgroundColor = "rgba(255, 204, 0, 0.2)";
            }
        } else if (balance < 0) {
            dispBalance.classList.add('balance-negative');
            aiInsight.innerHTML = `⚠️ <strong>Warning:</strong> You are spending more than you earn. Take a close look at 'Shopping' or 'Entertainment' to cut back.`;
            aiInsight.style.backgroundColor = "rgba(255, 59, 48, 0.2)";
        } else {
            dispBalance.classList.add('balance-warning');
            aiInsight.innerHTML = `⚖️ You are breaking exactly even. Start building an emergency fund by saving even a small amount.`;
            aiInsight.style.backgroundColor = "rgba(255, 204, 0, 0.2)";
        }
    };

    // Add Event Listeners for Live Calculation
    incomeInput.addEventListener('input', updateTotals);
    expenseInputs.forEach(input => {
        input.addEventListener('input', updateTotals);
    });

    // Handle Form Submission
    document.getElementById('expenseForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const expenseData = {
            income: parseFloat(incomeInput.value) || 0,
            expenses: {}
        };

        expenseInputs.forEach(input => {
            if (input.value) {
                const category = input.id.replace('exp', '');
                expenseData.expenses[category] = parseFloat(input.value);
            }
        });

        console.log('Sending data to API:', expenseData);
        alert('Expense data saved! Processing your AI insights...');
        // Here we would typically call our API via api.js
    });

    // Initialize with zeros
    updateTotals();
});
