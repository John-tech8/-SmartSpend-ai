/**
 * SmartSpend AI - Supabase Client & Authentication Layer
 * Manages Supabase connection, session persistence, auth state, and navigation guards.
 */

(function () {
    let supabase = null;
    let currentUser = null;
    let authInitialized = false;
    const authSubscribers = [];

    // Helper: Generate v4 UUID for fallback guest sessions
    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Helper: Compute initials from full name or email
    function getInitials(name, email) {
        if (name && typeof name === 'string' && name.trim()) {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return parts[0].slice(0, 2).toUpperCase();
        }
        if (email && typeof email === 'string') {
            return email.slice(0, 2).toUpperCase();
        }
        return 'SS';
    }

    /**
     * Get the active user ID.
     * Prioritizes the authenticated Supabase user's UUID.
     * Falls back to localStorage UUID only if unauthenticated.
     */
    function getUserId() {
        if (currentUser && currentUser.id) {
            return currentUser.id;
        }
        let storedId = localStorage.getItem('smartspend_user_id');
        if (!storedId || storedId.startsWith('user_')) {
            storedId = uuidv4();
            localStorage.setItem('smartspend_user_id', storedId);
        }
        return storedId;
    }

    /**
     * Get the current authenticated user object.
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Initialize the Supabase Client and restore persistent session.
     */
    async function initSupabase() {
        if (supabase && authInitialized) {
            return supabase;
        }

        try {
            // Fetch configuration from backend
            let supabaseUrl = null;
            let supabaseKey = null;

            try {
                const response = await fetch('/api/config');
                if (response.ok) {
                    const config = await response.json();
                    supabaseUrl = config.supabaseUrl;
                    supabaseKey = config.supabaseKey;
                }
            } catch (err) {
                console.warn("Could not fetch /api/config:", err.message);
            }

            // Fallback to window global if provided
            if (!supabaseUrl && window.SMARTSPEND_CONFIG) {
                supabaseUrl = window.SMARTSPEND_CONFIG.supabaseUrl;
                supabaseKey = window.SMARTSPEND_CONFIG.supabaseKey;
            }

            if (supabaseUrl && supabaseKey) {
                if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                    console.error("Supabase JS SDK is not loaded. Ensure CDN script is included.");
                    return null;
                }

                // Initialize client with persistent session in localStorage
                supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        storage: window.localStorage
                    }
                });

                // Restore active session
                const { data: { session } } = await supabase.auth.getSession();
                if (session && session.user) {
                    currentUser = session.user;
                    localStorage.setItem('smartspend_user_id', currentUser.id);
                    localStorage.setItem('smartspend_user_email', currentUser.email || '');
                    if (currentUser.user_metadata?.full_name) {
                        localStorage.setItem('smartspend_user_name', currentUser.user_metadata.full_name);
                    }
                } else {
                    currentUser = null;
                }

                // Listen to Auth State Changes
                supabase.auth.onAuthStateChange(async (event, session) => {
                    console.log("[SmartSpend Auth Event]:", event);
                    if (session && session.user) {
                        currentUser = session.user;
                        localStorage.setItem('smartspend_user_id', currentUser.id);
                        localStorage.setItem('smartspend_user_email', currentUser.email || '');
                        if (currentUser.user_metadata?.full_name) {
                            localStorage.setItem('smartspend_user_name', currentUser.user_metadata.full_name);
                        }
                    } else {
                        currentUser = null;
                    }

                    // Notify subscribers
                    authSubscribers.forEach(cb => {
                        try { cb(event, session); } catch (e) { console.error(e); }
                    });

                    // Update UI elements across the page
                    updateNavbarAuth();
                });

                authInitialized = true;
            } else {
                console.warn("Supabase credentials not configured in backend .env");
            }
        } catch (e) {
            console.error("Failed to initialize Supabase:", e);
        }

        // Update UI navbar state
        updateNavbarAuth();

        return supabase;
    }

    /**
     * Sign out the user and clear session state.
     */
    async function signOut() {
        try {
            if (supabase) {
                await supabase.auth.signOut();
            }
        } catch (e) {
            console.error("Error signing out:", e);
        } finally {
            currentUser = null;
            localStorage.removeItem('smartspend_user_id');
            localStorage.removeItem('smartspend_user_email');
            localStorage.removeItem('smartspend_user_name');
            localStorage.removeItem('smartspend_needs_user_insert');
            updateNavbarAuth();
            window.location.href = 'login.html';
        }
    }

    /**
     * Route guard: Requires user to be authenticated.
     * Redirects unauthenticated users to login.html.
     */
    async function requireAuth(targetRedirect) {
        await initSupabase();

        // Check active session
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user) {
                currentUser = session.user;
                return currentUser;
            }
        }

        // Unauthenticated -> redirect to login
        const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
        const redirectParam = targetRedirect || currentPath;
        window.location.href = `login.html?redirect=${encodeURIComponent(redirectParam)}`;
        return null;
    }

    /**
     * Route guard for auth pages (login.html, signup.html):
     * If user is already authenticated, redirect them to dashboard.html.
     */
    async function redirectIfAuthenticated(targetUrl = 'dashboard.html') {
        await initSupabase();

        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user) {
                // If there's a redirect query parameter, use it
                const params = new URLSearchParams(window.location.search);
                const redirect = params.get('redirect');
                window.location.href = redirect ? decodeURIComponent(redirect) : targetUrl;
                return true;
            }
        }
        return false;
    }

    /**
     * Updates navbar across pages:
     * - If logged in: displays avatar initials with dropdown (Name, Email, Logout), hides Login/Signup buttons.
     * - If logged out: displays Login and Signup buttons, hides avatar menu.
     */
    function updateNavbarAuth() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        // Login & Signup link elements
        const loginLinks = navLinks.querySelectorAll('a[href*="login.html"]');
        const signupLinks = navLinks.querySelectorAll('a[href*="signup.html"]');
        let profileContainer = navLinks.querySelector('.user-profile-menu');
        const legacyProfile = navLinks.querySelector('.user-profile:not(.menu-profile)');

        if (currentUser) {
            // User is LOGGED IN
            loginLinks.forEach(el => el.style.display = 'none');
            signupLinks.forEach(el => el.style.display = 'none');
            if (legacyProfile) legacyProfile.remove();

            const fullName = currentUser.user_metadata?.full_name || localStorage.getItem('smartspend_user_name') || 'User';
            const email = currentUser.email || localStorage.getItem('smartspend_user_email') || '';
            const initials = getInitials(fullName, email);

            // Update user name in welcome headers if element exists
            const welcomeHeader = document.querySelector('.page-header h2');
            if (welcomeHeader && welcomeHeader.textContent.includes('Welcome back')) {
                welcomeHeader.textContent = `Welcome back, ${fullName.split(' ')[0]}!`;
            }

            if (!profileContainer) {
                profileContainer = document.createElement('div');
                profileContainer.className = 'user-profile-menu';
                profileContainer.innerHTML = `
                    <div class="user-profile menu-profile" id="navbarUserAvatar" title="${fullName} (${email})">
                        ${initials}
                    </div>
                    <div class="user-dropdown" id="navbarUserDropdown">
                        <div class="user-dropdown-header">
                            <div class="user-dropdown-name">${fullName}</div>
                            <div class="user-dropdown-email">${email}</div>
                        </div>
                        <a href="dashboard.html" class="user-dropdown-item">
                            <i class="fas fa-th-large"></i> Dashboard
                        </a>
                        <a href="expenses.html" class="user-dropdown-item">
                            <i class="fas fa-receipt"></i> Expenses
                        </a>
                        <a href="goals.html" class="user-dropdown-item">
                            <i class="fas fa-bullseye"></i> Goals
                        </a>
                        <button type="button" class="user-dropdown-item logout-item" id="navbarLogoutBtn">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </button>
                    </div>
                `;
                navLinks.appendChild(profileContainer);

                // Toggle dropdown menu
                const avatar = profileContainer.querySelector('#navbarUserAvatar');
                const dropdown = profileContainer.querySelector('#navbarUserDropdown');
                const logoutBtn = profileContainer.querySelector('#navbarLogoutBtn');

                if (avatar && dropdown) {
                    avatar.addEventListener('click', (e) => {
                        e.stopPropagation();
                        dropdown.classList.toggle('active');
                    });

                    // Close on outside click
                    document.addEventListener('click', () => {
                        dropdown.classList.remove('active');
                    });

                    dropdown.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }

                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await signOut();
                    });
                }
            } else {
                // Update existing menu
                const avatar = profileContainer.querySelector('#navbarUserAvatar');
                const nameEl = profileContainer.querySelector('.user-dropdown-name');
                const emailEl = profileContainer.querySelector('.user-dropdown-email');
                if (avatar) avatar.textContent = initials;
                if (nameEl) nameEl.textContent = fullName;
                if (emailEl) emailEl.textContent = email;
            }
        } else {
            // User is LOGGED OUT
            loginLinks.forEach(el => el.style.display = '');
            signupLinks.forEach(el => el.style.display = '');
            if (profileContainer) {
                profileContainer.remove();
            }
        }
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initSupabase();
        });
    } else {
        initSupabase();
    }

    // Expose APIs globally
    window.initSupabase = initSupabase;
    window.getUserId = getUserId;
    window.getCurrentUser = getCurrentUser;
    window.signOut = signOut;
    window.requireAuth = requireAuth;
    window.redirectIfAuthenticated = redirectIfAuthenticated;
    window.updateNavbarAuth = updateNavbarAuth;
    window.supabaseClient = () => supabase;
    window.onAuthStateChange = (cb) => {
        if (typeof cb === 'function') authSubscribers.push(cb);
    };
})();
