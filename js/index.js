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

            // Display institutional health score
            scoreElement.innerHTML = `<span style="font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary);">${latest.health_score}</span><span style="font-size: 16px; color: var(--text-secondary); margin-right: 8px;">/100</span> <span class="health-badge" style="background: var(--color-light-green); color: var(--color-primary-forest); padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">Grade ${grade}</span>`;

            // Clean institutional link
            actionElement.innerHTML = `<a href="dashboard.html" class="btn btn-outline" style="font-size: 13px; padding: 6px 14px;">View Score Telemetry <i class="fas fa-arrow-right" style="font-size: 11px; margin-left: 4px;"></i></a>`;

        } else {
            // User has no report yet
            scoreElement.innerHTML = `<span style="font-size: 28px; font-weight: 600; color: var(--text-secondary);">&mdash;</span>`;
            actionElement.innerHTML = `<a href="dashboard.html" class="btn btn-primary" style="font-size: 13px; padding: 8px 16px;">Calculate Health Score</a>`;
        }

    } catch (e) {
        console.error("Error fetching latest report for index:", e);
        scoreElement.innerHTML = '85/100'; // fallback
    }
});
