document.addEventListener('DOMContentLoaded', async () => {
    const signupForm = document.getElementById('signupForm');
    const quizForm = document.getElementById('quizForm');
    const authTitle = document.querySelector('.auth-title');
    const loginLink = document.getElementById('loginLink');
    const quizResult = document.getElementById('quizResult');

    // Elements for result
    const personalityTitle = document.getElementById('personalityTitle');
    const personalityDesc = document.getElementById('personalityDesc');

    // Initialize Supabase
    const supabase = await window.initSupabase();
    const userId = window.getUserId();

    // Signup form submit -> Show Quiz
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Age validation (18+)
        const dobInput = document.getElementById('dob').value;
        const dob = new Date(dobInput);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }

        const errorMsg = document.getElementById('dobError');
        if (age < 18) {
            errorMsg.style.display = 'block';
            return;
        } else {
            errorMsg.style.display = 'none';
        }

        // Hide signup, show quiz
        signupForm.style.display = 'none';
        authTitle.textContent = 'Financial Personality Quiz';
        loginLink.style.display = 'none';
        quizForm.style.display = 'block';
    });

    // Quiz form submit -> Calculate -> Save to Supabase -> Show Result
    quizForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        let scores = {
            saver: 0,
            spender: 0,
            impulsive: 0
        };

        // Count answers
        for (let i = 1; i <= 5; i++) {
            const val = document.getElementById(`q${i}`).value;
            if (val) scores[val]++;
        }

        // Determine personality
        let maxScore = 0;
        let personality = 'saver';
        for (const [key, value] of Object.entries(scores)) {
            if (value > maxScore) {
                maxScore = value;
                personality = key;
            }
        }

        let title = "";
        let desc = "";

        if (personality === 'saver') {
            title = "You are a Saver! 🛡️";
            desc = "Great job! You prioritize financial security and plan ahead. We'll help you optimize your savings and start investing.";
        } else if (personality === 'spender') {
            title = "You are a Spender! 🛍️";
            desc = "You enjoy the money you make, which is great! We'll help you build a budget that allows for fun while still hitting your financial goals.";
        } else {
            title = "You are an Impulsive Buyer! ⚡";
            desc = "You tend to live in the moment with your purchases. We'll help you put guardrails in place to protect your wealth and curb impulse buying.";
        }

        quizForm.style.display = 'none';

        // Save to Supabase
        if (supabase) {
            // Delete existing result for this user if any
            await supabase.from('quiz_results').delete().eq('user_id', userId);

            const { error } = await supabase
                .from('quiz_results')
                .insert([
                    {
                        user_id: userId,
                        personality_type: personality
                    }
                ]);

            if (error) {
                console.error("Error saving quiz result:", error);
            }

            // Also store in LS for quick frontend access
            localStorage.setItem('smartspend_personality', personality);
        }

        // Show outcome
        authTitle.textContent = 'Your Results';
        personalityTitle.textContent = title;
        personalityDesc.textContent = desc;
        quizResult.style.display = 'block';
    });
});
