/**
 * SmartSpend – Expense Analysis
 * Handles: input validation, live calculation, page-load data restore,
 *          save & analyze with upsert (overwrite confirmation), bad-habit detection.
 *
 * Uses ES module imports from calculator.js for all shared financial logic.
 */

import {
    safeParseFloat,
    safeParseFloatOrZero,
    formatCurrency,
    calculateTotalExpenses,
    calculateSavings,
    calculateSavingsRate
} from './calculator.js';

// NOTE: Emergency Fund has been removed from the scoring model per design decision.
// Financial Health Score uses 3 components: Savings Rate, Expense-to-Income, Debt-to-Income.

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns current month string in YYYY-MM format.
 */
function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Returns today's date in YYYY-MM-DD format.
 */
function getTodayDateStr() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Shows a status banner message.
 * @param {'success'|'error'|'info'} type
 * @param {string} message
 */
function showStatus(type, message) {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
    banner.className = `status-banner ${type}`;
    banner.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${message}`;
    banner.style.display = 'flex';
    if (type === 'success') {
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
    }
}

/**
 * Hides the status banner.
 */
function hideStatus() {
    const banner = document.getElementById('statusBanner');
    if (banner) banner.style.display = 'none';
}

/**
 * Shows an inline field error.
 * @param {string} fieldId - The input element id (e.g. 'expRent')
 * @param {string} message
 */
function showFieldError(fieldId, message) {
    const errEl = document.getElementById(`err-${fieldId}`);
    const inputEl = document.getElementById(fieldId);
    if (errEl) {
        errEl.textContent = message;
        errEl.classList.add('visible');
    }
    if (inputEl) inputEl.classList.add('input-error');
}

/**
 * Clears an inline field error.
 * @param {string} fieldId
 */
function clearFieldError(fieldId) {
    const errEl = document.getElementById(`err-${fieldId}`);
    const inputEl = document.getElementById(fieldId);
    if (errEl) {
        errEl.textContent = '';
        errEl.classList.remove('visible');
    }
    if (inputEl) inputEl.classList.remove('input-error');
}

/**
 * Clears all field errors.
 */
function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('visible');
    });
    document.querySelectorAll('.form-control').forEach(el => {
        el.classList.remove('input-error');
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY MAP (input id → Supabase category name)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_MAP = {
    expRent:          'Rent',
    expFood:          'Food',
    expTransport:     'Transport',
    expShopping:      'Shopping',
    expEntertainment: 'Entertainment',
    expEmi:           'Emi',
    expFamily:        'Family',
    expMisc:          'Misc'
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

    // ── DOM References ──────────────────────────────────────────────────────
    const incomeInput   = document.getElementById('monthlyIncome');
    const debtInput     = document.getElementById('outstandingDebt');
    const expenseInputs = document.querySelectorAll('.exp-field');

    const dispIncome      = document.getElementById('dispIncome');
    const dispExpenses    = document.getElementById('dispExpenses');
    const dispBalance     = document.getElementById('dispBalance');
    const dispSavingsRate = document.getElementById('dispSavingsRate');
    const aiInsight       = document.getElementById('aiInsight');

    const badHabitModal   = document.getElementById('badHabitModal');
    const badHabitMessage = document.getElementById('badHabitMessage');
    const closeHabitModal = document.getElementById('closeHabitModal');

    const submitBtn       = document.getElementById('submitBtn');
    const overwriteNotice = document.getElementById('overwriteNotice');
    const overwriteMonthEl = document.getElementById('overwriteMonth');
    const confirmOverwrite = document.getElementById('confirmOverwrite');
    const cancelOverwrite  = document.getElementById('cancelOverwrite');

    // ── Supabase Init ───────────────────────────────────────────────────────
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

    const currentMonth = getCurrentMonth();

    // ── Page Load: Restore Saved Data ───────────────────────────────────────
    if (supabase && userId) {
        await loadSavedData();
    }

    // ── Live Calculation ─────────────────────────────────────────────────────

    /**
     * Reads current input values and updates the right-panel summary.
     * Handles zero income, deficits, and all edge cases without NaN/Infinity.
     */
    function updateTotals() {
        const incomeRaw = incomeInput.value;
        const income    = safeParseFloatOrZero(incomeRaw); // null = invalid (negative/non-numeric)

        // Build expenses object from valid inputs
        const expensesObj = {};
        let hasInvalidExpense = false;
        expenseInputs.forEach(input => {
            const val = input.value;
            if (val === '' || val === null) return; // empty = skip (not 0, just omitted)
            const parsed = safeParseFloat(val);
            if (parsed === null) {
                hasInvalidExpense = true;
            } else {
                const catName = CATEGORY_MAP[input.id] || input.id;
                expensesObj[catName] = parsed;
            }
        });

        // If income input is invalid (negative), show nothing useful
        if (income === null) {
            dispIncome.textContent = '—';
            dispExpenses.textContent = '—';
            dispBalance.className = 'summary-value';
            dispBalance.textContent = '—';
            dispSavingsRate.textContent = '—';
            aiInsight.textContent = 'Please enter a valid (non-negative) income amount.';
            aiInsight.style.backgroundColor = 'rgba(255, 59, 48, 0.2)';
            return;
        }

        const totalExpenses = calculateTotalExpenses(expensesObj);
        const balance       = calculateSavings(income, totalExpenses); // Can be null or negative
        const savingsRate   = calculateSavingsRate(income, totalExpenses); // Can be null or negative

        // Update displays
        dispIncome.textContent   = formatCurrency(income);
        dispExpenses.textContent = formatCurrency(totalExpenses);

        // Balance display
        dispBalance.className = 'summary-value';
        if (balance === null) {
            dispBalance.textContent = '—';
        } else {
            dispBalance.textContent = formatCurrency(balance);
            if (balance > 0)        dispBalance.classList.add('balance-positive');
            else if (balance < 0)   dispBalance.classList.add('balance-negative');
            else                    dispBalance.classList.add('balance-warning');
        }

        // Savings rate display
        if (savingsRate === null) {
            dispSavingsRate.textContent = income === 0 ? 'No income' : '—';
        } else {
            dispSavingsRate.textContent = savingsRate.toFixed(1) + '%';
            dispSavingsRate.style.color = savingsRate >= 0 ? '#4cd964' : '#ff3b30';
        }

        // AI insight
        if (income === 0 && totalExpenses === 0) {
            aiInsight.textContent = 'Enter your monthly figures to see your projected financial health score and savings rate.';
            aiInsight.style.backgroundColor = 'rgba(255,255,255,0.1)';
        } else if (income === 0 && totalExpenses > 0) {
            aiInsight.innerHTML = `⚠️ <strong>No Income Recorded.</strong> You have ₹${totalExpenses.toLocaleString('en-IN')} in expenses but no income. Please enter your monthly income.`;
            aiInsight.style.backgroundColor = 'rgba(255, 59, 48, 0.2)';
        } else if (balance !== null && balance < 0) {
            const deficit = Math.abs(balance);
            aiInsight.innerHTML = `🚨 <strong>Deficit of ${formatCurrency(deficit)}.</strong> Your expenses exceed your income by this amount. Identify categories to reduce immediately.`;
            aiInsight.style.backgroundColor = 'rgba(255, 59, 48, 0.2)';
        } else if (balance === 0) {
            aiInsight.innerHTML = `⚖️ You are breaking exactly even. Try to save even a small amount — aim for at least 5% of your income as an emergency cushion.`;
            aiInsight.style.backgroundColor = 'rgba(255, 204, 0, 0.2)';
        } else if (savingsRate !== null && savingsRate >= 20) {
            aiInsight.innerHTML = `🌟 <strong>Great job!</strong> Your savings rate is ${savingsRate.toFixed(1)}%. This puts you on track toward your financial goals. Keep it up!`;
            aiInsight.style.backgroundColor = 'rgba(76, 217, 100, 0.2)';
        } else if (savingsRate !== null) {
            aiInsight.innerHTML = `💡 Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20% by reducing variable expenses. Even small cuts add up!`;
            aiInsight.style.backgroundColor = 'rgba(255, 204, 0, 0.2)';
        }
    }

    // Attach live listeners
    incomeInput.addEventListener('input', () => {
        clearFieldError('monthlyIncome');
        updateTotals();
    });
    expenseInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearFieldError(input.id);
            updateTotals();
        });
    });
    if (debtInput) debtInput.addEventListener('input', () => clearFieldError('outstandingDebt'));

    // Modal close
    if (closeHabitModal) {
        closeHabitModal.addEventListener('click', () => {
            badHabitModal.style.display = 'none';
        });
    }

    // Initialize display
    updateTotals();

    // ── Load Saved Data ──────────────────────────────────────────────────────

    /**
     * Fetches existing income and expense data for the current month from Supabase.
     * If found, populates the form fields and updates the live summary.
     */
    async function loadSavedData() {
        try {
            // Calculate date range for current month
            const year  = new Date().getFullYear();
            const month = new Date().getMonth() + 1;
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

            // Fetch current month's income
            const { data: incomeData, error: incErr } = await supabase
                .from('incomes')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            // Fetch current month's expenses
            const { data: expData, error: expErr } = await supabase
                .from('expenses')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            if (incErr || expErr) {
                console.warn('Could not load saved data:', incErr, expErr);
                return;
            }

            // Restore income
            if (incomeData && incomeData.length > 0) {
                // Sum all income entries for the month
                const totalIncome = incomeData.reduce((sum, r) => sum + Number(r.amount), 0);
                incomeInput.value = totalIncome > 0 ? totalIncome : '';

                // Restore optional debt field if stored
                const withExt = incomeData.find(r => r.outstanding_debt !== null && r.outstanding_debt !== undefined);
                if (withExt && debtInput && withExt.outstanding_debt != null) {
                    debtInput.value = withExt.outstanding_debt;
                }

                showStatus('info', `Loaded your saved data for ${getMonthName(currentMonth)}. You can edit and re-save.`);
            }

            // Restore expenses
            if (expData && expData.length > 0) {
                // Build reverse map from category name → input id
                const reverseCatMap = {};
                for (const [inputId, catName] of Object.entries(CATEGORY_MAP)) {
                    reverseCatMap[catName] = inputId;
                }

                expData.forEach(exp => {
                    const inputId = reverseCatMap[exp.category];
                    if (inputId) {
                        const el = document.getElementById(inputId);
                        if (el) el.value = Number(exp.amount);
                    }
                });
            }

            // Update live totals after restoring
            updateTotals();

        } catch (err) {
            console.error('Failed to load saved data', err);
        }
    }

    // ── Validation ───────────────────────────────────────────────────────────

    /**
     * Validates all form inputs. Shows inline errors for invalid fields.
     * @returns {{ valid: boolean, income: number, expensesObj: Object, emergencyFund: number|null, outstandingDebt: number|null }}
     */
    function validateForm() {
        clearAllErrors();
        let isValid = true;

        // Validate income
        const incomeRaw = incomeInput.value;
        let income = null;

        if (incomeRaw === '' || incomeRaw === null) {
            showFieldError('monthlyIncome', 'Monthly income is required.');
            isValid = false;
        } else {
            income = safeParseFloat(incomeRaw);
            if (income === null) {
                if (parseFloat(incomeRaw) < 0) {
                    showFieldError('monthlyIncome', 'Income cannot be negative.');
                } else {
                    showFieldError('monthlyIncome', 'Please enter a valid number for income.');
                }
                isValid = false;
            }
        }

        // Validate expense fields
        const expensesObj = {};
        expenseInputs.forEach(input => {
            const val = input.value;
            if (val === '' || val === null) return; // Optional fields — empty = 0
            const parsed = safeParseFloat(val);
            if (parsed === null) {
                const label = input.previousElementSibling?.querySelector('.input-prefix')?.parentElement?.previousElementSibling?.textContent || input.id;
                if (parseFloat(val) < 0) {
                    showFieldError(input.id, 'Expense cannot be negative.');
                } else {
                    showFieldError(input.id, 'Please enter a valid number.');
                }
                isValid = false;
            } else {
                expensesObj[CATEGORY_MAP[input.id] || input.id] = parsed;
            }
        });

        // Validate optional debt field
        let outstandingDebt = null;
        if (debtInput && debtInput.value !== '') {
            outstandingDebt = safeParseFloat(debtInput.value);
            if (outstandingDebt === null) {
                showFieldError('outstandingDebt', parseFloat(debtInput.value) < 0 ? 'Cannot be negative.' : 'Please enter a valid number.');
                isValid = false;
            }
        }

        return { valid: isValid, income, expensesObj, outstandingDebt };
    }

    // ── Bad Habit Detection ───────────────────────────────────────────────────

    /**
     * Checks for spending pattern issues and returns a warning object if found.
     * Only triggers when income > 0 and the specific category exceeds threshold.
     * @param {number} income
     * @param {Object} expensesObj - category → amount
     * @returns {{ pattern: string, message: string }|null}
     */
    function detectBadHabit(income, expensesObj) {
        if (!income || income <= 0) return null;

        const foodExp  = expensesObj['Food']          || 0;
        const shopExp  = expensesObj['Shopping']       || 0;
        const entExp   = expensesObj['Entertainment']  || 0;

        if (foodExp > 0 && foodExp > income * 0.3) {
            return {
                pattern: 'Excessive Food Spending',
                message: `You are spending more than 30% of your income (${((foodExp / income) * 100).toFixed(1)}%) on food. Try cooking at home more often to curb this habit!`
            };
        }
        if (shopExp > 0 && shopExp > income * 0.15) {
            return {
                pattern: 'Impulsive Shopping',
                message: `Your shopping expenses are over 15% of your income (${((shopExp / income) * 100).toFixed(1)}%). Implement the 24-hour rule before making non-essential purchases.`
            };
        }
        if (entExp > 0 && entExp > income * 0.15) {
            return {
                pattern: 'High Entertainment Cost',
                message: `You're spending ${((entExp / income) * 100).toFixed(1)}% of income on entertainment. Consider free or low-cost hobbies to build your savings faster.`
            };
        }
        return null;
    }

    // ── Check Existing Month Data ─────────────────────────────────────────────

    /**
     * Checks if the user already has saved data for the current month.
     * @returns {boolean} true if data exists
     */
    async function hasExistingMonthData() {
        try {
            const year  = new Date().getFullYear();
            const month = new Date().getMonth() + 1;
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

            const { data, error } = await supabase
                .from('incomes')
                .select('id')
                .eq('user_id', userId)
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59')
                .limit(1);

            if (error) return false;
            return data && data.length > 0;
        } catch (e) {
            return false;
        }
    }

    // ── Save to Database (Upsert = Delete + Insert) ───────────────────────────

    /**
     * Saves income and expense data for the current month.
     * Deletes existing month's records first (upsert pattern).
     * @param {number} income
     * @param {Object} expensesObj
     * @param {number|null} emergencyFund
     * @param {number|null} outstandingDebt
     * @param {string|null} badPattern
     * @returns {boolean} true if save succeeded
     */
    async function saveData(income, expensesObj, outstandingDebt, badPattern) {
        const year  = new Date().getFullYear();
        const month = new Date().getMonth() + 1;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
        const todayDate = getTodayDateStr();

        try {
            // 1. Delete existing this-month income records
            await supabase
                .from('incomes')
                .delete()
                .eq('user_id', userId)
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            // 2. Insert fresh income record (with optional extra fields)
            const incomeRecord = {
                user_id: userId,
                amount: income,
                date: todayDate
            };
            // Conditionally add outstanding_debt if column exists in schema
            if (outstandingDebt !== null) incomeRecord.outstanding_debt = outstandingDebt;

            const { error: incomeErr } = await supabase
                .from('incomes')
                .insert([incomeRecord]);

            if (incomeErr) {
                // If extra columns don't exist in schema, retry without them
                if (incomeErr.code === '42703') {
                    const basicRecord = { user_id: userId, amount: income, date: todayDate };
                    const { error: basicErr } = await supabase.from('incomes').insert([basicRecord]);
                    if (basicErr) throw basicErr;
                    // Store debt as localStorage fallback
                    if (outstandingDebt !== null) localStorage.setItem('smartspend_outstanding_debt', outstandingDebt);
                } else {
                    throw incomeErr;
                }
            }

            // 3. Delete existing this-month expense records
            await supabase
                .from('expenses')
                .delete()
                .eq('user_id', userId)
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            // 4. Insert fresh expense records
            const expenseInserts = [];
            for (const [cat, amt] of Object.entries(expensesObj)) {
                expenseInserts.push({
                    user_id: userId,
                    category: cat,
                    amount: amt,
                    date: todayDate
                });
            }

            if (expenseInserts.length > 0) {
                const { error: expErr } = await supabase.from('expenses').insert(expenseInserts);
                if (expErr) {
                    // Try without date if column doesn't exist
                    if (expErr.code === '42703') {
                        const basicInserts = expenseInserts.map(({ date, ...rest }) => rest);
                        const { error: basicExpErr } = await supabase.from('expenses').insert(basicInserts);
                        if (basicExpErr) throw basicExpErr;
                    } else {
                        throw expErr;
                    }
                }
            }

            // 5. Save bad habit if detected
            if (badPattern && supabase && userId) {
                await supabase.from('habits').insert([{
                    user_id: userId,
                    pattern_description: badPattern.pattern,
                    warning_message: badPattern.message
                }]);
            }

            // 6. Write localStorage fallback
            localStorage.setItem('smartspend_income', income);
            localStorage.setItem('smartspend_latest_expenses', JSON.stringify(expensesObj));
            localStorage.setItem('smartspend_month', currentMonth);
            if (outstandingDebt !== null) localStorage.setItem('smartspend_outstanding_debt', outstandingDebt);

            return true;

        } catch (err) {
            console.error('Failed to save financial data:', err);
            return false;
        }
    }

    // ── Form Submit Handler ───────────────────────────────────────────────────

    let pendingFormData = null; // Stores validated data while user confirms overwrite

    async function doSave(formData) {
        const { income, expensesObj, outstandingDebt } = formData;

        // Disable button, show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        submitBtn.classList.add('btn-loading');
        hideStatus();

        // Detect bad habits (before saving)
        const badHabit = detectBadHabit(income, expensesObj);

        if (!supabase || !userId) {
            // Offline / no Supabase: use localStorage only
            localStorage.setItem('smartspend_income', income);
            localStorage.setItem('smartspend_latest_expenses', JSON.stringify(expensesObj));
            localStorage.setItem('smartspend_month', currentMonth);
            if (outstandingDebt !== null) localStorage.setItem('smartspend_outstanding_debt', outstandingDebt);

            submitBtn.disabled = false;
            submitBtn.textContent = 'Save & Analyze';
            submitBtn.classList.remove('btn-loading');

            showStatus('info', 'Data saved locally (Supabase unavailable). Connect to a database for full functionality.');

            if (badHabit) {
                badHabitMessage.textContent = badHabit.message;
                badHabitModal.style.display = 'flex';
            }

            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
            return;
        }

        const success = await saveData(income, expensesObj, outstandingDebt, badHabit);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Save & Analyze';
        submitBtn.classList.remove('btn-loading');

        if (!success) {
            showStatus('error', '❌ Failed to save data. Please check your connection and try again.');
            return;
        }

        // Show bad habit modal ONLY after successful save
        if (badHabit) {
            badHabitMessage.textContent = badHabit.message;
            badHabitModal.style.display = 'flex';
            // Redirect after user dismisses modal
            closeHabitModal.onclick = () => {
                badHabitModal.style.display = 'none';
                window.location.href = 'dashboard.html';
            };
        } else {
            showStatus('success', `✅ Financial data saved for ${getMonthName(currentMonth)}! Redirecting to your dashboard...`);
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        }
    }

    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const result = validateForm();
        if (!result.valid) {
            showStatus('error', 'Please fix the highlighted errors before saving.');
            return;
        }

        // Check if data already exists for this month
        if (supabase && userId) {
            const exists = await hasExistingMonthData();
            if (exists) {
                // Show overwrite confirmation
                overwriteMonthEl.textContent = getMonthName(currentMonth);
                overwriteNotice.style.display = 'block';
                pendingFormData = result;
                overwriteNotice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
        }

        await doSave(result);
    });

    // Confirm overwrite
    if (confirmOverwrite) {
        confirmOverwrite.addEventListener('click', async () => {
            overwriteNotice.style.display = 'none';
            if (pendingFormData) {
                await doSave(pendingFormData);
                pendingFormData = null;
            }
        });
    }

    // Cancel overwrite
    if (cancelOverwrite) {
        cancelOverwrite.addEventListener('click', () => {
            overwriteNotice.style.display = 'none';
            pendingFormData = null;
        });
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    /**
     * Returns human-readable month name from YYYY-MM string.
     * @param {string} monthStr - e.g. '2026-11'
     * @returns {string} e.g. 'November 2026'
     */
    function getMonthName(monthStr) {
        try {
            const [year, month] = monthStr.split('-').map(Number);
            const d = new Date(year, month - 1, 1);
            return d.toLocaleString('default', { month: 'long', year: 'numeric' });
        } catch {
            return monthStr;
        }
    }

});
