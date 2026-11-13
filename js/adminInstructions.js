// js/adminInstructions.js
document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBase = isLocal ? '' : (window.SMARTSPEND_API_URL || 'https://smartspend-ai-1-q37g.onrender.com');

    // DOM Elements
    const authGate = document.getElementById('adminAuthGate');
    const mainWorkspace = document.getElementById('adminMainWorkspace');
    const authForm = document.getElementById('adminAuthForm');
    const adminKeyInput = document.getElementById('adminKeyInput');
    const gateAlert = document.getElementById('gateAlert');
    const statusAlert = document.getElementById('adminStatusAlert');
    const logoutBtn = document.getElementById('adminLogoutBtn');

    const promptForm = document.getElementById('adminPromptForm');
    const titleInput = document.getElementById('instructionTitle');
    const promptArea = document.getElementById('systemPromptArea');
    const resetBtn = document.getElementById('resetDefaultBtn');
    const charCount = document.getElementById('charCount');
    const lastUpdated = document.getElementById('lastUpdated');
    const updatedBy = document.getElementById('updatedBy');

    let currentAdminKey = sessionStorage.getItem('smartspend_admin_key') || '';

    // Update character counter
    const updateCharCount = () => {
        if (promptArea && charCount) {
            charCount.textContent = `${promptArea.value.length} characters`;
        }
    };
    if (promptArea) {
        promptArea.addEventListener('input', updateCharCount);
    }

    const showAlert = (el, type, msg) => {
        el.className = `alert-box ${type}`;
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => {
            el.style.display = 'none';
        }, 5000);
    };

    // Check authorization
    const checkAuthAndLoad = async (key) => {
        try {
            const res = await fetch(`${apiBase}/api/admin/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': key
                }
            });

            if (res.ok) {
                currentAdminKey = key;
                sessionStorage.setItem('smartspend_admin_key', key);
                authGate.style.display = 'none';
                mainWorkspace.style.display = 'block';
                await loadInstructions();
            } else {
                sessionStorage.removeItem('smartspend_admin_key');
                authGate.style.display = 'block';
                mainWorkspace.style.display = 'none';
                showAlert(gateAlert, 'error', 'Invalid admin key. Access denied.');
            }
        } catch (e) {
            showAlert(gateAlert, 'error', 'Could not connect to backend server. Make sure backend is running.');
        }
    };

    // Load active instructions from backend
    const loadInstructions = async () => {
        try {
            const res = await fetch(`${apiBase}/api/admin/instructions`, {
                headers: {
                    'x-admin-key': currentAdminKey
                }
            });

            if (res.ok) {
                const data = await res.json();
                const instruction = data.instruction;
                if (instruction) {
                    titleInput.value = instruction.title || 'Default Financial Coach Instructions';
                    promptArea.value = instruction.system_prompt || '';
                    updateCharCount();

                    if (instruction.updated_at) {
                        lastUpdated.textContent = `Last updated: ${new Date(instruction.updated_at).toLocaleString()}`;
                    }
                    if (instruction.updated_by) {
                        updatedBy.textContent = `Updated by: ${instruction.updated_by}`;
                    }
                }
            } else {
                showAlert(statusAlert, 'error', 'Failed to retrieve active instructions from database.');
            }
        } catch (err) {
            showAlert(statusAlert, 'error', 'Error fetching instructions: ' + err.message);
        }
    };

    // Handle Auth form submit
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = adminKeyInput.value.trim();
        if (key) {
            await checkAuthAndLoad(key);
        }
    });

    // Handle Logout / Lock
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('smartspend_admin_key');
        currentAdminKey = '';
        mainWorkspace.style.display = 'none';
        authGate.style.display = 'block';
        adminKeyInput.value = '';
    });

    // Handle Save Prompt
    promptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        const systemPrompt = promptArea.value.trim();

        if (!systemPrompt) {
            showAlert(statusAlert, 'error', 'Instructions cannot be empty.');
            return;
        }

        try {
            const res = await fetch(`${apiBase}/api/admin/instructions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': currentAdminKey
                },
                body: JSON.stringify({
                    title,
                    systemPrompt,
                    updatedBy: 'admin'
                })
            });

            const data = await res.json();
            if (res.ok) {
                showAlert(statusAlert, 'success', '✅ Active Mini Buddy instructions saved to PostgreSQL successfully!');
                await loadInstructions();
            } else {
                showAlert(statusAlert, 'error', 'Error: ' + (data.error || 'Failed to save instructions.'));
            }
        } catch (err) {
            showAlert(statusAlert, 'error', 'Network error while saving instructions.');
        }
    });

    // Handle Reset Prompt to Default
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reset Mini Buddy instructions to the default personal finance coach prompt?')) {
            return;
        }

        try {
            const res = await fetch(`${apiBase}/api/admin/instructions/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': currentAdminKey
                },
                body: JSON.stringify({ updatedBy: 'admin' })
            });

            const data = await res.json();
            if (res.ok) {
                showAlert(statusAlert, 'success', '✅ Instructions reset to default successfully!');
                await loadInstructions();
            } else {
                showAlert(statusAlert, 'error', 'Error resetting: ' + (data.error || 'Failed to reset'));
            }
        } catch (err) {
            showAlert(statusAlert, 'error', 'Network error while resetting instructions.');
        }
    });

    // Auto-login if key already in session
    if (currentAdminKey) {
        checkAuthAndLoad(currentAdminKey);
    }
});
