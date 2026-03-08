document.addEventListener('DOMContentLoaded', async () => {
    // Select DOM elements
    const costInput = document.getElementById('goalCost');
    const savingInput = document.getElementById('monthlySaving');
    const monthsInput = document.getElementById('goalMonths');
    const goalForm = document.getElementById('goalForm');

    // Error Elements
    const errMonthly = document.getElementById('errMonthly');
    const errMonths = document.getElementById('errMonths');

    // Result Elements
    const resultCard = document.getElementById('resultCard');
    const resName = document.getElementById('resName');
    const resCost = document.getElementById('resCost');
    const resSaving = document.getElementById('resSaving');
    const resTime = document.getElementById('resTime');

    // Saved Goals container
    const savedGoalsList = document.getElementById('savedGoalsList');

    // Status trackers to prevent circular events
    let activeInput = null;

    // Formatter for currency
    const formatINR = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Initialize Supabase
    const supabase = await window.initSupabase();
    const userId = window.getUserId();

    // Fetch and display active goals
    async function fetchGoals() {
        if (!supabase) return;

        savedGoalsList.innerHTML = '<p>Loading your goals...</p>';
        const { data: goals, error } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching goals:", error);
            savedGoalsList.innerHTML = '<p>Error loading goals.</p>';
            return;
        }

        if (!goals || goals.length === 0) {
            savedGoalsList.innerHTML = '<p>You have no active goals yet.</p>';
            return;
        }

        savedGoalsList.innerHTML = '';
        goals.forEach(goal => {
            const percentage = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
            const isCompleted = percentage >= 100;
            const targetDateStr = new Date(goal.target_date).toLocaleDateString();

            const goalEl = document.createElement('div');
            goalEl.className = 'card';
            goalEl.style.padding = '20px';

            goalEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="font-size: 18px; margin: 0;">${goal.name}</h3>
                    <span style="font-size: 14px; color: ${isCompleted ? '#4cd964' : '#ffcc00'}; font-weight: 600;">
                        ${isCompleted ? 'Completed' : 'In Progress'}
                    </span>
                </div>
                <div style="margin-bottom: 5px; font-size: 14px; color: #4A5568;">
                    <strong>Target:</strong> ${formatINR(goal.target_amount)} by ${targetDateStr}
                </div>
                <div style="margin-bottom: 15px; font-size: 14px; color: #4A5568;">
                    <strong>Saved:</strong> ${formatINR(goal.current_amount)}
                </div>
                <div style="width: 100%; background: #E2E8F0; border-radius: 8px; height: 12px; margin-bottom: 15px; overflow: hidden;">
                    <div style="width: ${percentage}%; background: ${isCompleted ? '#4cd964' : '#2B61FF'}; height: 100%; border-radius: 8px; transition: width 0.3s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 14px; font-weight: 600;">${percentage}% Complete</span>
                    ${!isCompleted ? `<button class="add-funds-btn" data-id="${goal.id}" style="padding: 6px 12px; background: #2B61FF; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Add Funds</button>` : ''}
                </div>
            `;
            savedGoalsList.appendChild(goalEl);
        });

        // Attach event listeners to Add Funds buttons
        document.querySelectorAll('.add-funds-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const goalId = e.target.getAttribute('data-id');
                const amount = prompt("Enter amount to add (₹):");
                if (amount && !isNaN(amount) && Number(amount) > 0) {
                    await addFundsToGoal(goalId, Number(amount));
                }
            });
        });
    }

    async function addFundsToGoal(goalId, amountToAdd) {
        if (!supabase) return;

        // First get the current goal
        const { data: goal, error: fetchError } = await supabase
            .from('goals')
            .select('*')
            .eq('id', goalId)
            .single();

        if (fetchError || !goal) {
            alert("Error finding goal.");
            return;
        }

        const newAmount = Number(goal.current_amount) + amountToAdd;

        const { error: updateError } = await supabase
            .from('goals')
            .update({ current_amount: newAmount })
            .eq('id', goalId);

        if (updateError) {
            console.error(updateError);
            alert("Failed to add funds.");
        } else {
            await fetchGoals();
        }
    }

    // Call fetchGoals initially
    fetchGoals();

    // Handle when User types in Monthly Savings
    savingInput.addEventListener('input', () => {
        activeInput = 'saving';
        calculateValues();
    });

    // Handle when User types in Months
    monthsInput.addEventListener('input', () => {
        activeInput = 'months';
        calculateValues();
    });

    // Handle when User changes the Goal Cost (updates whichever was last active)
    costInput.addEventListener('input', () => {
        calculateValues();
    });

    // Core Calculation Logic
    function calculateValues() {
        const cost = parseFloat(costInput.value) || 0;

        // Reset Errors
        errMonthly.style.display = 'none';
        errMonths.style.display = 'none';

        if (cost <= 0) return; // Wait for valid cost

        if (activeInput === 'saving') {
            // Case 1: User enters Monthly Saving -> Calculate Months
            const saving = parseFloat(savingInput.value);
            if (saving > 0) {
                let calcMonths = Math.ceil(cost / saving); // Round up to full months

                if (calcMonths > 120) {
                    errMonths.style.display = 'block';
                    errMonths.textContent = `Required time is ${calcMonths} months. Max allowed is 120.`;
                    monthsInput.value = '';
                } else {
                    monthsInput.value = calcMonths;
                }
            } else if (savingInput.value !== '') {
                errMonthly.style.display = 'block';
                monthsInput.value = '';
            }

        } else if (activeInput === 'months') {
            // Case 2: User enters Months -> Calculate Monthly Saving
            const months = parseFloat(monthsInput.value);
            if (months >= 1 && months <= 120) {
                let calcSaving = cost / months;
                savingInput.value = calcSaving.toFixed(2);
            } else if (monthsInput.value !== '') {
                errMonths.style.display = 'block';
                errMonths.textContent = 'Months must be between 1 and 120';
                savingInput.value = '';
            }
        }
    }

    // Handle Form Submissions
    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('goalName').value;
        const cost = parseFloat(costInput.value);
        const saving = parseFloat(savingInput.value);
        const months = parseInt(monthsInput.value);

        // Final Validations before showing UI
        let isValid = true;

        if (!saving || saving <= 0) {
            errMonthly.style.display = 'block';
            isValid = false;
        }

        if (!months || months < 1 || months > 120) {
            errMonths.style.display = 'block';
            errMonths.textContent = 'Months must be between 1 and 120';
            isValid = false;
        }

        if (!isValid) return;

        // Calculate Target Date (today + months)
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + months);
        const targetDateString = targetDate.toISOString().split('T')[0];

        if (supabase) {
            // Save to Supabase
            const { error } = await supabase
                .from('goals')
                .insert([
                    {
                        user_id: userId,
                        name: name,
                        target_amount: cost,
                        current_amount: 0,
                        target_date: targetDateString
                    }
                ]);

            if (error) {
                console.error("Error saving goal:", error);
                alert("Failed to save goal.");
            } else {
                goalForm.reset();
                resultCard.style.display = 'none';
                await fetchGoals();

                // Show a success message briefly
                resName.textContent = name;
                resCost.textContent = formatINR(cost);
                resSaving.textContent = formatINR(saving);
                resTime.textContent = `${months} month${months > 1 ? 's' : ''}`;
                resultCard.style.display = 'block';
                resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } else {
            alert("Database connection is not working. Try again later.");
        }
    });
});
