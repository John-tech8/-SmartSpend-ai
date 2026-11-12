/**
 * SmartSpend AI - Authentication Logic
 * Handles registration, login, password validation, password recovery, and profile synchronization.
 */

(function () {
    // -------------------------------------------------------------------------
    // 1. VALIDATION UTILITIES
    // -------------------------------------------------------------------------

    const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

    function validateEmail(email) {
        if (!email || typeof email !== 'string') return false;
        return EMAIL_REGEX.test(email.trim());
    }

    function checkPasswordCriteria(password) {
        const pwd = password || '';
        return {
            length: pwd.length >= 8,
            uppercase: /[A-Z]/.test(pwd),
            lowercase: /[a-z]/.test(pwd),
            number: /[0-9]/.test(pwd),
            special: SPECIAL_CHAR_REGEX.test(pwd)
        };
    }

    function isPasswordStrong(password) {
        const c = checkPasswordCriteria(password);
        return c.length && c.uppercase && c.lowercase && c.number && c.special;
    }

    // -------------------------------------------------------------------------
    // 2. UI HELPERS: Password Visibility & Alerts
    // -------------------------------------------------------------------------

    function setupPasswordToggle(inputId, toggleBtnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(toggleBtnId);
        if (!input || !btn) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
            }
        });
    }

    function showAlert(containerId, type, message) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const iconClass = type === 'success'
            ? 'fa-check-circle'
            : type === 'info'
                ? 'fa-info-circle'
                : 'fa-exclamation-circle';

        container.className = `auth-alert auth-alert-${type}`;
        container.innerHTML = `<i class="fas ${iconClass}"></i> <div>${message}</div>`;
        container.style.display = 'flex';
    }

    function hideAlert(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
    }

    function setButtonLoading(button, isLoading, loadingText = 'Processing...') {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.classList.add('btn-loading');
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        } else {
            button.disabled = false;
            button.classList.remove('btn-loading');
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    // -------------------------------------------------------------------------
    // 3. REGISTRATION CONTROLLER (signup.html)
    // -------------------------------------------------------------------------

    async function initSignup() {
        const signupForm = document.getElementById('signupForm');
        if (!signupForm) return;

        // Redirect away if already authenticated
        if (window.redirectIfAuthenticated) {
            await window.redirectIfAuthenticated('dashboard.html');
        }

        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const submitBtn = signupForm.querySelector('button[type="submit"]');

        // Setup password visibility toggles
        setupPasswordToggle('password', 'togglePassword');
        setupPasswordToggle('confirmPassword', 'toggleConfirmPassword');

        // Password requirements checklist elements
        const reqLength = document.getElementById('req-length');
        const reqUpper = document.getElementById('req-upper');
        const reqLower = document.getElementById('req-lower');
        const reqNumber = document.getElementById('req-number');
        const reqSpecial = document.getElementById('req-special');
        const matchStatus = document.getElementById('passwordMatchStatus');

        function updateChecklist(element, isValid) {
            if (!element) return;
            const icon = element.querySelector('i');
            if (isValid) {
                element.className = 'requirement-item valid';
                if (icon) icon.className = 'fas fa-check-circle';
            } else {
                element.className = 'requirement-item invalid';
                if (icon) icon.className = 'far fa-circle';
            }
        }

        // Live validation on password typing
        if (passwordInput) {
            passwordInput.addEventListener('input', () => {
                const criteria = checkPasswordCriteria(passwordInput.value);
                updateChecklist(reqLength, criteria.length);
                updateChecklist(reqUpper, criteria.uppercase);
                updateChecklist(reqLower, criteria.lowercase);
                updateChecklist(reqNumber, criteria.number);
                updateChecklist(reqSpecial, criteria.special);

                // Update match status if confirm field has input
                if (confirmPasswordInput && confirmPasswordInput.value) {
                    checkMatch();
                }
            });
        }

        // Live check password matching
        function checkMatch() {
            if (!matchStatus || !confirmPasswordInput) return;
            if (!confirmPasswordInput.value) {
                matchStatus.style.display = 'none';
                return;
            }
            matchStatus.style.display = 'flex';
            if (passwordInput.value === confirmPasswordInput.value) {
                matchStatus.className = 'password-match-status match';
                matchStatus.innerHTML = '<i class="fas fa-check"></i> Passwords match';
            } else {
                matchStatus.className = 'password-match-status mismatch';
                matchStatus.innerHTML = '<i class="fas fa-times"></i> Passwords do not match';
            }
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', checkMatch);
        }

        // Handle Registration Submit
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert('authAlert');

            const fullName = nameInput ? nameInput.value.trim() : '';
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

            // 1. Mandatory Field Checks
            if (!fullName) {
                showAlert('authAlert', 'error', 'Please enter your Full Name.');
                if (nameInput) nameInput.focus();
                return;
            }

            if (!email) {
                showAlert('authAlert', 'error', 'Please enter your Email Address.');
                if (emailInput) emailInput.focus();
                return;
            }

            if (!validateEmail(email)) {
                showAlert('authAlert', 'error', 'Please enter a valid email address (e.g. name@example.com).');
                if (emailInput) emailInput.focus();
                return;
            }

            // 2. Password Strength Check
            if (!isPasswordStrong(password)) {
                showAlert('authAlert', 'error', 'Password must meet all 5 security requirements listed below.');
                if (passwordInput) passwordInput.focus();
                return;
            }

            // 3. Confirm Password Match Check
            if (password !== confirmPassword) {
                showAlert('authAlert', 'error', 'Password and Confirm Password do not match.');
                if (confirmPasswordInput) confirmPasswordInput.focus();
                return;
            }

            // 4. Initialize Supabase Client
            setButtonLoading(submitBtn, true, 'Creating Account...');
            const supabase = await window.initSupabase();

            if (!supabase) {
                setButtonLoading(submitBtn, false);
                showAlert('authAlert', 'error', 'Authentication service is not configured. Please check backend server.');
                return;
            }

            try {
                // Get preferred language from selector if present
                const langSelect = document.getElementById('languageSelector');
                const preferredLanguage = langSelect ? langSelect.value : 'en';

                // Call Supabase Auth signUp
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: fullName,
                            preferred_language: preferredLanguage
                        }
                    }
                });

                if (error) {
                    setButtonLoading(submitBtn, false);
                    console.error("Sign up error:", error);
                    // Safe error messages
                    if (error.message.includes('already registered') || error.status === 422) {
                        showAlert('authAlert', 'error', 'An account with this email already exists. <a href="login.html" style="color: inherit; text-decoration: underline; font-weight: 600;">Log in here</a>.');
                    } else if (error.message.includes('Password')) {
                        showAlert('authAlert', 'error', error.message);
                    } else {
                        showAlert('authAlert', 'error', 'Registration failed. Please check your details and try again.');
                    }
                    return;
                }

                // Profile creation / sync in public.profiles table
                if (data.user) {
                    try {
                        await supabase.from('profiles').upsert({
                            id: data.user.id,
                            full_name: fullName,
                            email: email,
                            preferred_language: preferredLanguage,
                            updated_at: new Date().toISOString()
                        });
                    } catch (profErr) {
                        console.warn("Direct profile sync note (may be handled by DB trigger):", profErr);
                    }
                }

                // Handle session state
                if (data.session) {
                    // Auto-confirmed session -> proceed to dashboard
                    showAlert('authAlert', 'success', 'Account created successfully! Redirecting to your dashboard...');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1200);
                } else {
                    // Confirmation email required
                    setButtonLoading(submitBtn, false);
                    signupForm.reset();
                    showAlert('authAlert', 'info', `
                        <strong>Registration Successful!</strong><br>
                        We've sent a verification email to <strong>${email}</strong>.<br>
                        Please check your inbox and confirm your email before logging in.
                        <div style="margin-top: 10px;">
                            <a href="login.html" class="btn btn-primary" style="display: inline-block; padding: 8px 16px; font-size: 13px;">Proceed to Login</a>
                        </div>
                    `);
                }

            } catch (err) {
                setButtonLoading(submitBtn, false);
                console.error("Sign up exception:", err);
                showAlert('authAlert', 'error', 'An unexpected error occurred. Please check your network and try again.');
            }
        });
    }

    // -------------------------------------------------------------------------
    // 4. LOGIN CONTROLLER (login.html)
    // -------------------------------------------------------------------------

    async function initLogin() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return;

        // Redirect away if already authenticated
        if (window.redirectIfAuthenticated) {
            await window.redirectIfAuthenticated('dashboard.html');
        }

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const rememberCheckbox = document.getElementById('rememberMe');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // Setup password visibility toggle
        setupPasswordToggle('password', 'togglePassword');

        // Check if there was an email verification message in URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('verified') === 'true') {
            showAlert('authAlert', 'success', 'Your email has been verified! You can now log in.');
        } else if (urlParams.get('reset') === 'success') {
            showAlert('authAlert', 'success', 'Password successfully reset! Please log in with your new password.');
        }

        // Handle Login Submit
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert('authAlert');

            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            // Client Validation
            if (!email) {
                showAlert('authAlert', 'error', 'Please enter your email address.');
                if (emailInput) emailInput.focus();
                return;
            }

            if (!validateEmail(email)) {
                showAlert('authAlert', 'error', 'Please enter a valid email format.');
                if (emailInput) emailInput.focus();
                return;
            }

            if (!password) {
                showAlert('authAlert', 'error', 'Please enter your password.');
                if (passwordInput) passwordInput.focus();
                return;
            }

            setButtonLoading(submitBtn, true, 'Logging in...');
            const supabase = await window.initSupabase();

            if (!supabase) {
                setButtonLoading(submitBtn, false);
                showAlert('authAlert', 'error', 'Authentication service is not configured. Please check backend server.');
                return;
            }

            try {
                // Supabase Auth signInWithPassword
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    setButtonLoading(submitBtn, false);
                    console.error("Sign in error:", error);

                    // Security: Never reveal whether an email exists
                    if (error.message.includes('Email not confirmed')) {
                        showAlert('authAlert', 'error', 'Please verify your email address before logging in. Check your inbox for the confirmation link.');
                    } else if (error.message.includes('Invalid login credentials') || error.status === 400) {
                        showAlert('authAlert', 'error', 'Invalid email or password. Please try again.');
                    } else if (error.status === 429) {
                        showAlert('authAlert', 'error', 'Too many failed login attempts. Please wait a few minutes and try again.');
                    } else {
                        showAlert('authAlert', 'error', 'Authentication failed. Please verify your credentials.');
                    }
                    return;
                }

                if (data.session && data.user) {
                    // Remember me preference
                    if (rememberCheckbox && !rememberCheckbox.checked) {
                        // If user unchecked remember me, session remains until browser close
                        sessionStorage.setItem('smartspend_session_only', 'true');
                    } else {
                        sessionStorage.removeItem('smartspend_session_only');
                    }

                    showAlert('authAlert', 'success', 'Login successful! Redirecting...');

                    // Check for redirect query param
                    const redirectTarget = urlParams.get('redirect')
                        ? decodeURIComponent(urlParams.get('redirect'))
                        : 'dashboard.html';

                    setTimeout(() => {
                        window.location.href = redirectTarget;
                    }, 800);
                }

            } catch (err) {
                setButtonLoading(submitBtn, false);
                console.error("Login exception:", err);
                showAlert('authAlert', 'error', 'Network failure. Please check your internet connection.');
            }
        });

        // Forgot Password Modal / View Setup
        setupForgotPassword();
    }

    // -------------------------------------------------------------------------
    // 5. FORGOT PASSWORD CONTROLLER
    // -------------------------------------------------------------------------

    function setupForgotPassword() {
        const forgotLink = document.getElementById('forgotPasswordLink');
        const forgotModal = document.getElementById('forgotPasswordModal');
        const closeModalBtn = document.getElementById('closeForgotModal');
        const forgotForm = document.getElementById('forgotPasswordForm');
        const forgotEmailInput = document.getElementById('forgotEmail');
        const forgotSubmitBtn = forgotForm ? forgotForm.querySelector('button[type="submit"]') : null;

        if (!forgotLink || !forgotModal) return;

        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideAlert('forgotAlert');
            if (forgotEmailInput && document.getElementById('email')) {
                forgotEmailInput.value = document.getElementById('email').value.trim();
            }
            forgotModal.style.display = 'flex';
        });

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                forgotModal.style.display = 'none';
            });
        }

        // Close on backdrop click
        forgotModal.addEventListener('click', (e) => {
            if (e.target === forgotModal) {
                forgotModal.style.display = 'none';
            }
        });

        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                hideAlert('forgotAlert');

                const email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
                if (!email || !validateEmail(email)) {
                    showAlert('forgotAlert', 'error', 'Please enter a valid email address.');
                    return;
                }

                setButtonLoading(forgotSubmitBtn, true, 'Sending Reset Link...');
                const supabase = await window.initSupabase();

                if (!supabase) {
                    setButtonLoading(forgotSubmitBtn, false);
                    showAlert('forgotAlert', 'error', 'Service unavailable. Please check your connection.');
                    return;
                }

                try {
                    // Redirect URL where user enters their new password
                    const redirectUrl = window.location.origin + '/reset-password.html';

                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: redirectUrl
                    });

                    setButtonLoading(forgotSubmitBtn, false);

                    if (error) {
                        console.error("Reset password error:", error);
                    }

                    // Security: Always display positive confirmation without revealing email existence
                    showAlert('forgotAlert', 'success', `
                        If an account is associated with <strong>${email}</strong>, a password reset link has been sent.<br>
                        Please check your inbox (and spam folder).
                    `);
                    forgotForm.reset();

                } catch (err) {
                    setButtonLoading(forgotSubmitBtn, false);
                    console.error("Forgot password exception:", err);
                    showAlert('forgotAlert', 'error', 'Failed to send reset link. Please try again later.');
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // 6. RESET PASSWORD CONTROLLER (reset-password.html)
    // -------------------------------------------------------------------------

    async function initResetPassword() {
        const resetForm = document.getElementById('resetPasswordForm');
        if (!resetForm) return;

        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmNewPassword');
        const submitBtn = resetForm.querySelector('button[type="submit"]');

        setupPasswordToggle('newPassword', 'toggleNewPassword');
        setupPasswordToggle('confirmNewPassword', 'toggleConfirmNewPassword');

        const reqLength = document.getElementById('req-length');
        const reqUpper = document.getElementById('req-upper');
        const reqLower = document.getElementById('req-lower');
        const reqNumber = document.getElementById('req-number');
        const reqSpecial = document.getElementById('req-special');
        const matchStatus = document.getElementById('passwordMatchStatus');

        function updateChecklist(element, isValid) {
            if (!element) return;
            const icon = element.querySelector('i');
            if (isValid) {
                element.className = 'requirement-item valid';
                if (icon) icon.className = 'fas fa-check-circle';
            } else {
                element.className = 'requirement-item invalid';
                if (icon) icon.className = 'far fa-circle';
            }
        }

        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', () => {
                const criteria = checkPasswordCriteria(newPasswordInput.value);
                updateChecklist(reqLength, criteria.length);
                updateChecklist(reqUpper, criteria.uppercase);
                updateChecklist(reqLower, criteria.lowercase);
                updateChecklist(reqNumber, criteria.number);
                updateChecklist(reqSpecial, criteria.special);

                if (confirmPasswordInput && confirmPasswordInput.value) {
                    checkMatch();
                }
            });
        }

        function checkMatch() {
            if (!matchStatus || !confirmPasswordInput) return;
            if (!confirmPasswordInput.value) {
                matchStatus.style.display = 'none';
                return;
            }
            matchStatus.style.display = 'flex';
            if (newPasswordInput.value === confirmPasswordInput.value) {
                matchStatus.className = 'password-match-status match';
                matchStatus.innerHTML = '<i class="fas fa-check"></i> Passwords match';
            } else {
                matchStatus.className = 'password-match-status mismatch';
                matchStatus.innerHTML = '<i class="fas fa-times"></i> Passwords do not match';
            }
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', checkMatch);
        }

        // Initialize Supabase and verify recovery token in URL
        const supabase = await window.initSupabase();

        // Listen for recovery state or active session
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert('authAlert');

            const newPassword = newPasswordInput ? newPasswordInput.value : '';
            const confirmNewPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

            if (!isPasswordStrong(newPassword)) {
                showAlert('authAlert', 'error', 'Password must satisfy all 5 requirements.');
                return;
            }

            if (newPassword !== confirmNewPassword) {
                showAlert('authAlert', 'error', 'Passwords do not match.');
                return;
            }

            setButtonLoading(submitBtn, true, 'Updating Password...');

            try {
                // Update password for currently authenticated user / recovery session
                const { error } = await supabase.auth.updateUser({
                    password: newPassword
                });

                setButtonLoading(submitBtn, false);

                if (error) {
                    console.error("Update password error:", error);
                    showAlert('authAlert', 'error', error.message || 'Failed to update password. The reset link may have expired.');
                    return;
                }

                showAlert('authAlert', 'success', 'Password updated successfully! Redirecting to login...');
                setTimeout(() => {
                    window.location.href = 'login.html?reset=success';
                }, 1500);

            } catch (err) {
                setButtonLoading(submitBtn, false);
                console.error("Reset password exception:", err);
                showAlert('authAlert', 'error', 'An error occurred while updating your password. Please try again.');
            }
        });
    }

    // Auto-initialize based on which page is active
    document.addEventListener('DOMContentLoaded', () => {
        initSignup();
        initLogin();
        initResetPassword();
    });

    // Expose helpers globally for testing
    window.SmartSpendAuth = {
        validateEmail,
        checkPasswordCriteria,
        isPasswordStrong
    };
})();
