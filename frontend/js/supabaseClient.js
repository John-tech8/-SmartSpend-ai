// supabaseClient.js
let supabase = null;

// Generate valid v4 UUID
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Generate a unique user ID for this browser session and store it in localStorage
function getUserId() {
    let userId = localStorage.getItem('smartspend_user_id');
    // If it's the old 'user_xyz' format or doesn't exist, create a new UUID
    if (!userId || userId.startsWith('user_')) {
        userId = uuidv4();
        localStorage.setItem('smartspend_user_id', userId);
        localStorage.setItem('smartspend_needs_user_insert', 'true');
    }
    return userId;
}

async function initSupabase() {
    if (supabase) return supabase;

    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        if (config.supabaseUrl && config.supabaseKey) {
            // we assume @supabase/supabase-js is loaded via CDN in index.html
            supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
            console.log("Supabase initialized");

            // Ensure guest user exists in the DB if newly generated
            const userId = getUserId();
            if (localStorage.getItem('smartspend_needs_user_insert') === 'true') {
                const { error } = await supabase.from('users').insert([{ id: userId, name: 'Guest User' }]);
                if (!error || error.code === '23505') { // 23505 is unique violation, meaning it exists
                    localStorage.removeItem('smartspend_needs_user_insert');
                } else {
                    console.error("Failed to insert guest user:", error);
                }
            }
        } else {
            console.error("Supabase config is missing");
        }
    } catch (e) {
        console.error("Failed to fetch config", e);
    }
    return supabase;
}

window.initSupabase = initSupabase;
window.getUserId = getUserId;
window.supabaseClient = () => supabase;
