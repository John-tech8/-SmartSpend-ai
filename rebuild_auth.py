import os
import re

def update_auth_page(filepath, title_text, form_content, footer_links):
    # Extract just the filename to link correctly and set active nav state
    filename = os.path.basename(filepath)
    
    # We will inject the standard navbar and global imports
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title_text} - SmartSpend AI</title>
    <!-- Use standard global stylesheets -->
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/animations.css">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <!-- Standard Navigation -->
    <header class="navbar">
        <div class="container">
            <a href="index.html" class="logo"><i class="fas fa-chart-line"></i> SmartSpend</a>
            <nav class="nav-links">
                <select id="languageSelector" class="lang-select" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #ccc; font-size: 14px; background-color: white; color: #1a1a1a;">
                    <option value="en">English</option>
                    <option value="hi">हिंदी (Hindi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                </select>
                <div class="dropdown">
                    <a href="index.html#features" class="dropbtn" data-i18n="nav.features">Features <i class="fas fa-chevron-down" style="font-size: 10px; margin-left: 5px;"></i></a>
                    <div class="dropdown-content">
                        <a href="expenses.html">Expense Analysis</a>
                        <a href="dashboard.html">Financial Health Score</a>
                        <a href="goals.html">Goal Tracker</a>
                        <a href="monthlyreport.html">Monthly Report</a>
                    </div>
                </div>
                <a href="about.html" data-i18n="nav.about">About</a>
                <a href="aiagent.html" data-i18n="nav.aiadvisor">AI Advisor</a>
                <a href="login.html" class="{"active" if filename == "login.html" else ""}" data-i18n="nav.login">Login</a>
                <a href="signup.html" class="btn btn-primary" data-i18n="nav.signup">Sign Up</a>
            </nav>
        </div>
    </header>

    <div class="auth-wrapper">
        <div class="auth-card glass-card animate-on-scroll {"signup-card" if filename == "signup.html" else ""}">
            <h1 class="auth-title">{title_text}</h1>
            
{form_content}

            <div class="auth-link">
                {footer_links}
            </div>
        </div>
    </div>

    <!-- Initialization Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/supabaseClient.js"></script>
    <script src="locales/i18n.js"></script>
    <script src="js/app.js"></script> <!-- Required for intersections observers -->
"""

    if filename == "signup.html":
        html_template += '    <script src="js/pages/quiz.js"></script>\n'
        
    html_template += "</body>\n</html>"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_template)


# Rebuild Login Page
login_form = """            <form id="loginForm">
                <div class="input-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" required placeholder="Enter your email">
                </div>

                <div class="input-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" required placeholder="Enter your password">
                </div>

                <button type="submit" class="btn btn-primary">Login</button>
            </form>"""

update_auth_page('frontend/login.html', 'Login', login_form, "Don't have an account? <a href='signup.html'>Create Account</a>")


# Rebuild Signup Page
signup_form = """            <form id="signupForm">
                <div class="input-group">
                    <label for="name">Full Name</label>
                    <input type="text" id="name" required placeholder="John Doe">
                </div>

                <div class="input-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" required placeholder="name@example.com">
                </div>

                <div class="input-group">
                    <label>Phone Number</label>
                    <div class="phone-group">
                        <select id="countryCode">
                            <option value="+1">+1 (US/CA)</option>
                            <option value="+44">+44 (UK)</option>
                            <option value="+91">+91 (IN)</option>
                            <option value="+61">+61 (AU)</option>
                        </select>
                        <input type="tel" id="phone" required placeholder="9876543210">
                    </div>
                </div>

                <div class="input-group">
                    <label for="dob">Date of Birth</label>
                    <input type="date" id="dob" required>
                    <div id="dobError" class="error-message">You must be at least 18 years old to sign up.</div>
                </div>

                <div class="input-group">
                    <label for="gender">Gender</label>
                    <select id="gender" required>
                        <option value="" disabled selected>Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                </div>

                <div class="input-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" required placeholder="Create a password">
                </div>

                <button type="submit" class="btn btn-primary">Sign Up</button>
            </form>

            <form id="quizForm" style="display: none;">
                <p style="margin-bottom: 20px; color: var(--text-muted);">Let's customize your experience with a quick 5-question financial personality quiz!</p>

                <div class="input-group">
                    <label>1. When you receive money, what is your first instinct?</label>
                    <select id="q1" required>
                        <option value="" disabled selected>Select an option</option>
                        <option value="saver">Put a portion into savings</option>
                        <option value="spender">Buy something I've been wanting</option>
                        <option value="impulsive">Treat myself immediately without thinking</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>2. How do you feel about budgeting?</label>
                    <select id="q2" required>
                        <option value="" disabled selected>Select an option</option>
                        <option value="saver">I love it, I track every penny</option>
                        <option value="spender">I have a loose budget in my head</option>
                        <option value="impulsive">I try but always fail, or don't budget at all</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>3. If you see something you want but don't need, what do you do?</label>
                    <select id="q3" required>
                        <option value="" disabled selected>Select an option</option>
                        <option value="saver">Wait a few days to see if I still want it</option>
                        <option value="spender">Check if I have money, then maybe buy it</option>
                        <option value="impulsive">Buy it immediately</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>4. Do you have an emergency fund?</label>
                    <select id="q4" required>
                        <option value="" disabled selected>Select an option</option>
                        <option value="saver">Yes, with 3-6 months of expenses</option>
                        <option value="spender">Yes, but it's very small</option>
                        <option value="impulsive">No, I live paycheck to paycheck</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>5. How often do you exceed your monthly budget?</label>
                    <select id="q5" required>
                        <option value="" disabled selected>Select an option</option>
                        <option value="saver">Rarely</option>
                        <option value="spender">Sometimes</option>
                        <option value="impulsive">Often or Always</option>
                    </select>
                </div>

                <button type="submit" class="btn btn-primary" id="finishSignupBtn">Finish Profile</button>
            </form>

            <div id="quizResult" style="display: none; text-align: center;">
                <h2 id="personalityTitle" style="color: var(--highlight-blue); margin-bottom: 15px;"></h2>
                <p id="personalityDesc" style="color: var(--text-main); margin-bottom: 25px; font-size: 15px;"></p>
                <a href="index.html" class="btn btn-primary" style="text-decoration: none; padding: 12px 20px; display: inline-block;">Go to Home</a>
            </div>"""

update_auth_page('frontend/signup.html', 'Create Account', signup_form, 'Already have an account? <a href="login.html" id="loginLink">Login</a>')
print("Login and Signup pages completely rebuilt for the new Dark CSS theme!")
