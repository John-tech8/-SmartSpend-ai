document.addEventListener('DOMContentLoaded', () => {

    // --- State & DOM Elements ---
    const startQuizBtn = document.getElementById('startQuizBtn');
    const quizModal = document.getElementById('quizModal');
    const closeQuizBtn = document.getElementById('closeQuizBtn');

    // Question UI
    const quizQuestionContainer = document.getElementById('quizQuestionContainer');
    const quizQuestionText = document.getElementById('quizQuestionText');
    const quizOptionsContainer = document.getElementById('quizOptionsContainer');
    const quizProgressText = document.getElementById('quizProgressText');
    const quizProgressBar = document.getElementById('quizProgressBar');

    // Result UI
    const quizResultContainer = document.getElementById('quizResultContainer');
    const quizResultIcon = document.getElementById('quizResultIcon');
    const quizStageTitle = document.getElementById('quizStageTitle');
    const quizReasonsList = document.getElementById('quizReasonsList');
    const quizSuggestionsList = document.getElementById('quizSuggestionsList');
    const quizGoodMessage = document.getElementById('quizGoodMessage');

    let currentQuestionIndex = 0;
    let totalScore = 0;

    // --- Quiz Data ---
    const questions = [
        {
            question: "How much of your income do you usually save?",
            options: [
                { text: "Less than 5% or nothing", score: 0 },
                { text: "About 10% - 15%", score: 2 },
                { text: "20% or more", score: 4 }
            ]
        },
        {
            question: "How often do you track your expenses?",
            options: [
                { text: "Never, I just spend until I run out", score: 0 },
                { text: "Occasionally, when I feel tight on money", score: 1 },
                { text: "Regularly (weekly or monthly)", score: 3 }
            ]
        },
        {
            question: "Before making a non-essential purchase, you usually:",
            options: [
                { text: "Buy it immediately if I want it", score: 0 },
                { text: "Wait a day or two to see if I still need it", score: 2 },
                { text: "Check my budget and plan for it", score: 3 }
            ]
        },
        {
            question: "Do you maintain a monthly budget?",
            options: [
                { text: "No, I find them too restrictive", score: 0 },
                { text: "I have a rough mental idea of what I can spend", score: 1 },
                { text: "Yes, I use an app or spreadsheet", score: 3 }
            ]
        },
        {
            question: "Do you have clear financial goals? (e.g. emergency fund, vacation)",
            options: [
                { text: "Not really, I just try to survive the month", score: 0 },
                { text: "Yes, but they are vague ('buy a house someday')", score: 1 },
                { text: "Yes, specific goals with amount and dates", score: 3 }
            ]
        }
    ];

    // Max score = 4 + 3 + 3 + 3 + 3 = 16

    // --- Functions ---
    const initQuiz = () => {
        currentQuestionIndex = 0;
        totalScore = 0;
        quizResultContainer.style.display = 'none';
        quizQuestionContainer.style.display = 'block';
        loadQuestion();
        quizModal.style.display = 'flex';
    };

    const loadQuestion = () => {
        const q = questions[currentQuestionIndex];
        quizQuestionText.textContent = q.question;

        quizOptionsContainer.innerHTML = '';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.padding = '15px 20px';
            btn.style.fontSize = '15px';
            btn.style.marginBottom = '10px';
            btn.textContent = opt.text;

            btn.addEventListener('click', () => {
                totalScore += opt.score;
                nextQuestion();
            });

            quizOptionsContainer.appendChild(btn);
        });

        // Update progress
        const qNum = currentQuestionIndex + 1;
        quizProgressText.textContent = `Question ${qNum} of ${questions.length}`;
        quizProgressBar.style.width = `${(qNum / questions.length) * 100}%`;
    };

    const nextQuestion = () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            loadQuestion();
        } else {
            showResults();
        }
    };

    const showResults = async () => {
        quizQuestionContainer.style.display = 'none';

        // --- Calculate Stage ---
        // Score range: 0 - 16
        // 12+ = Saver
        // 7 - 11 = Balanced 
        // 4 - 6 = Basic Financial Knowledge
        // 0 - 3 = Spender

        let stageName = '';
        let iconClass = '';
        let reasons = [];
        let suggestions = [];
        let isGoodHabit = false;

        if (totalScore >= 12) {
            stageName = "Saver";
            iconClass = "fa-piggy-bank";
            isGoodHabit = true;
            reasons = [
                "You regularly track your expenses and budget.",
                "You save a healthy portion of your income.",
                "You plan purchases carefully and avoid impulses."
            ];
            suggestions = [
                "Consider investing your surplus savings for compound growth.",
                "Expand and solidify your long-term financial goals."
            ];
        } else if (totalScore >= 7) {
            stageName = "Balanced";
            iconClass = "fa-balance-scale";
            isGoodHabit = true;
            reasons = [
                "You have a general sense of where your money goes.",
                "You exercise some restraint on non-essential purchases.",
                "You manage to save, though it could be optimized."
            ];
            suggestions = [
                "Start using a strict budget to maximize your savings rate.",
                "Set specific dates and amounts for your financial goals.",
                "Try tracking every expense for one full month."
            ];
        } else if (totalScore >= 4) {
            stageName = "Basic Financial Knowledge";
            iconClass = "fa-book-open";
            isGoodHabit = false;
            reasons = [
                "You occasionally think about budgeting, but lack a system.",
                "Your savings are minimal or inconsistent.",
                "You are prone to some impulsive spending."
            ];
            suggestions = [
                "Use our Expense Tracker to see exactly where your money goes.",
                "Implement the 50/30/20 rule (50% needs, 30% wants, 20% savings).",
                "Wait 48 hours before buying anything you 'want'."
            ];
        } else {
            stageName = "Spender";
            iconClass = "fa-shopping-cart";
            isGoodHabit = false;
            reasons = [
                "You rarely track expenses and spend impulsively.",
                "You do not actively save a portion of your income.",
                "Your financial goals are currently undefined."
            ];
            suggestions = [
                "Immediately start tracking every rupee you spend.",
                "Focus on building a small emergency fund first.",
                "Use our Goal Tracker to visualize why saving is important."
            ];
        }

        // Render UI
        quizStageTitle.textContent = stageName;
        quizResultIcon.className = `fas ${iconClass}`;

        quizReasonsList.innerHTML = '';
        reasons.forEach(r => {
            const li = document.createElement('li');
            li.style.marginBottom = '10px';
            li.innerHTML = r;
            quizReasonsList.appendChild(li);
        });

        quizSuggestionsList.innerHTML = '';
        suggestions.forEach(s => {
            const li = document.createElement('li');
            li.style.marginBottom = '10px';
            li.innerHTML = s;
            quizSuggestionsList.appendChild(li);
        });

        if (isGoodHabit) {
            quizGoodMessage.style.display = 'block';
            if (stageName === "Saver") quizGoodMessage.textContent = 'Awesome! You are ready to go.';
            else quizGoodMessage.textContent = 'Great! You have good financial awareness.';
        } else {
            quizGoodMessage.style.display = 'none';
        }

        quizResultContainer.style.display = 'block';

        // --- Save to Supabase ---
        try {
            if (window.initSupabase) {
                const supabase = await window.initSupabase();
                const userId = window.getUserId();
                if (supabase && userId) {

                    // First ensure the table exists or handle error silently if missing
                    // Table schema expected: id, user_id, financial_stage, quiz_score, created_at

                    await supabase.from('financial_stages').insert([{
                        user_id: userId,
                        financial_stage: stageName,
                        quiz_score: totalScore
                    }]);
                    console.log("Quiz result saved.");
                }
            }
        } catch (err) {
            console.error("Could not save quiz to db.", err);
        }

    };

    // --- Event Listeners ---
    if (startQuizBtn) {
        startQuizBtn.addEventListener('click', (e) => {
            e.preventDefault();
            initQuiz();
        });
    }

    if (closeQuizBtn) {
        closeQuizBtn.addEventListener('click', () => {
            quizModal.style.display = 'none';
        });
    }

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === quizModal) {
            quizModal.style.display = 'none';
        }
    });

});
