document.addEventListener('DOMContentLoaded', async () => {
    // Attempt to load the user's latest financial health score from Supabase
    const supabase = await window.initSupabase();
    const userId = window.getUserId();

    const scoreElement = document.getElementById('indexHealthScore');
    const actionElement = document.getElementById('indexHealthAction');

    if (!supabase) {
        scoreElement.innerHTML = '85/100'; // fallback
        return;
    }

    try {
        const { data: reports, error } = await supabase
            .from('reports')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (reports && reports.length > 0) {
            // User has a report, apply the new grading logic explicitly for display natively
            const latest = reports[0];
            let grade = 'D';
            if (latest.health_score >= 60) grade = 'A';
            else if (latest.health_score >= 40) grade = 'B';
            else if (latest.health_score >= 20) grade = 'C';

            // Display "Financial Health Score: 67% (Grade A)" as requested
            scoreElement.innerHTML = `<span style="font-size: 24px;">${latest.health_score}%</span> <span style="font-size: 16px; opacity: 0.9;">(Grade ${grade})</span>`;

            // Optional: You could add a button to go see full details
            actionElement.innerHTML = `<a href="dashboard.html" class="btn btn-outline" style="padding: 5px 15px; font-size: 13px; border-color: white; color: white;">View Details</a>`;

        } else {
            // User has no report yet
            scoreElement.innerHTML = '-';
            actionElement.innerHTML = `<a href="dashboard.html" class="btn btn-primary" style="padding: 8px 16px; font-size: 14px; background: white; color: #2B61FF; border: none; font-weight: 600;">Check Your Financial Health Score</a>`;
        }

    } catch (e) {
        console.error("Error fetching latest report for index:", e);
        scoreElement.innerHTML = '85/100'; // fallback
    }
});
