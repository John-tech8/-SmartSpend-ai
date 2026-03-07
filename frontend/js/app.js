document.addEventListener('DOMContentLoaded', () => {
    // ---- Landing Page Form Logic ----
    const analyzeForm = document.getElementById('analyzeForm');
    const resultsCard = document.getElementById('resultsCard');

    // Result elements
    const resIncome = document.getElementById('resIncome');
    const resExpenses = document.getElementById('resExpenses');
    const resSavings = document.getElementById('resSavings');
    const resProgress = document.getElementById('resProgress');
    const resInsight = document.getElementById('resInsight');

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    if (analyzeForm) {
        analyzeForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent page reload

            // Capture values
            const income = parseFloat(document.getElementById('monthlyIncome').value) || 0;
            const expenses = parseFloat(document.getElementById('monthlyExpenses').value) || 0;
            const goal = parseFloat(document.getElementById('savingsGoal').value) || 0;
            const category = document.getElementById('primaryCategory').value;

            // Calculate metrics
            const savings = income - expenses;
            const savingsRate = income > 0 ? (savings / income) * 100 : 0;

            // Determine Financial Health Score
            let healthText = "Poor";
            let healthColor = "#ff3b30"; // Red
            let healthBg = "rgba(255, 59, 48, 0.2)";

            if (savingsRate >= 30) {
                healthText = "Excellent";
                healthColor = "#4cd964"; // Green
                healthBg = "rgba(76, 217, 100, 0.2)";
            } else if (savingsRate >= 15) {
                healthText = "Good";
                healthColor = "#34a853"; // Greenish-Blue/Blue
                healthBg = "rgba(52, 168, 83, 0.2)";
            } else if (savingsRate >= 5) {
                healthText = "Average";
                healthColor = "#ffcc00"; // Yellow
                healthBg = "rgba(255, 204, 0, 0.2)";
            }

            // Format currency helper
            const formatMoney = (amount) => {
                return new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR'
                }).format(amount);
            };

            // Update UI Elements
            document.getElementById('resIncome').textContent = formatMoney(income);
            document.getElementById('resExpenses').textContent = formatMoney(expenses);

            // Savings Amount
            resSavings.textContent = formatMoney(savings);
            resSavings.style.color = savings >= 0 ? '#4cd964' : '#ff3b30';

            // Savings Rate
            const resRate = document.getElementById('resRate');
            resRate.textContent = `${savingsRate.toFixed(1)}%`;
            resRate.style.color = healthColor;

            // Health Score Badge
            const resHealth = document.getElementById('resHealth');
            resHealth.textContent = healthText;
            resHealth.style.color = healthColor;
            resHealth.style.backgroundColor = healthBg;

            // Set dynamic AI Insight message based on the numbers
            if (savings < 0) {
                resInsight.innerHTML = `⚠️ <strong>Warning:</strong> You are spending more than you earn! Look closely at your <em>${category}</em> expenses to cut back immediately.`;
                resInsight.style.backgroundColor = "rgba(255, 59, 48, 0.2)";
                resInsight.style.color = "#ffb3b0";
                resInsight.style.borderLeft = "4px solid #ff3b30";
            } else if (savings >= goal) {
                resInsight.innerHTML = `🌟 <strong>Great Job!</strong> You are hitting your savings goal of ${formatMoney(goal)}! Your <em>${category}</em> spending is well managed.`;
                resInsight.style.backgroundColor = "rgba(76, 217, 100, 0.2)";
                resInsight.style.color = "#caffcc";
                resInsight.style.borderLeft = "4px solid #4cd964";
            } else {
                resInsight.innerHTML = `💡 <strong>Good progress.</strong> You are saving money, but falling short of your goal. Try reducing your <em>${category}</em> costs to reach ${formatMoney(goal)}.`;
                resInsight.style.backgroundColor = "rgba(255, 204, 0, 0.2)";
                resInsight.style.color = "#fff3cd";
                resInsight.style.borderLeft = "4px solid #ffcc00";
            }

            // Save data to localStorage for the AI Advisor context
            localStorage.setItem('smartspend_income', income);
            localStorage.setItem('smartspend_expenses', expenses);
            localStorage.setItem('smartspend_savings', savings);
            localStorage.setItem('smartspend_savingsRate', savingsRate.toFixed(1));

            // Show dashboard card
            resultsCard.style.display = 'block';

            // Scroll to results smoothly
            resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }
});
