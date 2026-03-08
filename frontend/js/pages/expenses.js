document.addEventListener('DOMContentLoaded', async () => {
    // Input fields
    const incomeInput = document.getElementById('monthlyIncome');
    const expenseInputs = document.querySelectorAll('.exp-field');

    // Display fields
    const dispIncome = document.getElementById('dispIncome');
    const dispExpenses = document.getElementById('dispExpenses');
    const dispBalance = document.getElementById('dispBalance');
    const aiInsight = document.getElementById('aiInsight');

    // Modal Elements
    const badHabitModal = document.getElementById('badHabitModal');
    const badHabitMessage = document.getElementById('badHabitMessage');
    const closeHabitModal = document.getElementById('closeHabitModal');

    // Initialize Supabase
    let supabase = null;
    let userId = null;
    try {
        if (window.initSupabase) {
            supabase = await window.initSupabase();
            userId = window.getUserId();
        }
    } catch (e) { console.error("Supabase init failed", e); }

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

    if (closeHabitModal) {
        closeHabitModal.addEventListener('click', () => {
            badHabitModal.style.display = 'none';
        });
    }

    // Handle Form Submission
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const income = parseFloat(incomeInput.value) || 0;
        if (income <= 0) return;

        const expenseData = {
            income: income,
            expenses: {}
        };

        expenseInputs.forEach(input => {
            if (input.value) {
                const category = input.id.replace('exp', '');
                expenseData.expenses[category] = parseFloat(input.value);
            }
        });

        // Bad Habit Intervention Logic
        let badPatternDetected = null;
        let warningMsg = "";

        const foodExp = expenseData.expenses['Food'] || 0;
        const shopExp = expenseData.expenses['Shopping'] || 0;
        const entExp = expenseData.expenses['Entertainment'] || 0;

        if (foodExp > income * 0.3) {
            badPatternDetected = "Excessive Food Spending";
            warningMsg = "You are spending more than 30% of your income on food. Try cooking at home more often to curb this habit!";
        } else if (shopExp > income * 0.15) {
            badPatternDetected = "Impulsive Shopping";
            warningMsg = "Your shopping expenses are over 15% of your income. Implement the 24-hour rule before making non-essential purchases.";
        } else if (entExp > income * 0.15) {
            badPatternDetected = "High Entertainment Cost";
            warningMsg = "You're spending heavily on entertainment. Consider free or low-cost hobbies to build your savings faster.";
        }

        if (badPatternDetected && supabase && userId) {
            // Save to Supabase
            const { error } = await supabase.from('habits').insert([{
                user_id: userId,
                pattern_description: badPatternDetected,
                warning_message: warningMsg
            }]);

            if (error) console.error("Error saving habit:", error);

            // Show In-App Alert Modal
            if (badHabitMessage && badHabitModal) {
                badHabitMessage.textContent = warningMsg;
                badHabitModal.style.display = 'flex';
            }
        }

        // --- NATIVE DATABASE SAVING ---
        if (supabase && userId) {
            try {
                // 1. Save Income
                await supabase.from('incomes').insert([{
                    user_id: userId,
                    amount: income
                }]);

                // 2. Save individual expenses
                const expenseInserts = [];
                for (const [cat, amt] of Object.entries(expenseData.expenses)) {
                    expenseInserts.push({
                        user_id: userId,
                        category: cat,
                        amount: amt
                    });
                }

                if (expenseInserts.length > 0) {
                    await supabase.from('expenses').insert(expenseInserts);
                }

                if (!badPatternDetected) {
                    alert('Expense data saved to your dashboard! Great job managing your variables!');
                } else {
                    alert('Expense data saved to your dashboard! Don\'t forget to check your warnings.');
                }

                // Redirect back to dashboard to see new score
                window.location.href = 'dashboard.html';

            } catch (err) {
                console.error("Failed to save financial data natively", err);
                alert('Failure saving to database. Are your tables created?');
            }
        } else {
            alert('Expense data processed locally.');
        }

        // Save for dashboard (legacy fallback)
        localStorage.setItem('smartspend_income', income);
        localStorage.setItem('smartspend_latest_expenses', JSON.stringify(expenseData.expenses));
    });

    // Initialize with zeros
    updateTotals();
});
