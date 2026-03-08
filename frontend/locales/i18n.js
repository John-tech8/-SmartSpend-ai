const translations = {
    en: {
        "nav.features": "Features",
        "nav.about": "About",
        "nav.advisor": "AI Advisor",
        "nav.login": "Login",
        "nav.signup": "Sign Up",
        "nav.dashboard": "Dashboard",
        "nav.expenses": "Expenses",
        "nav.goals": "Goals",
        "hero.title": "SmartSpend – AI Financial Advisor",
        "hero.tagline": "AI Financial Coach for First-Time Earners",
        "hero.cta": "Start Analysis",
        "features.title": "Everything You Need to Master Your Money",
        "feature.expense.title": "Expense Analysis",
        "feature.expense.desc": "Automatically categorize and track your spending habits to see exactly where your money goes.",
        "feature.health.title": "Financial Health Score",
        "feature.health.desc": "Get a real-time health score based on your savings rate, debt, and spending patterns.",
        "feature.ai.title": "AI Financial Advice",
        "feature.ai.desc": "Receive personalized, actionable advice from your smart AI coach to improve your finances.",
        "feature.goal.title": "Goal-based Savings Tracker",
        "feature.goal.desc": "Set milestones and track your progress towards a new car, emergency fund, or vacation."
    },
    hi: {
        "nav.features": "विशेषताएं",
        "nav.about": "हमारे बारे में",
        "nav.advisor": "AI सलाहकार",
        "nav.login": "लॉग इन करें",
        "nav.signup": "साइन अप करें",
        "nav.dashboard": "डैशबोर्ड",
        "nav.expenses": "खर्चे",
        "nav.goals": "लक्ष्य",
        "hero.title": "स्मार्टस्पेंड - AI वित्तीय सलाहकार",
        "hero.tagline": "पहली बार कमाने वालों के लिए AI वित्तीय कोच",
        "hero.cta": "विश्लेषण शुरू करें",
        "features.title": "पैसे को मास्टर करने के लिए सब कुछ",
        "feature.expense.title": "व्यय विश्लेषण",
        "feature.expense.desc": "स्वचालित रूप से वर्गीकृत करें और अपने खर्च करने की आदतों को ट्रैक करें।",
        "feature.health.title": "वित्तीय स्वास्थ्य स्कोर",
        "feature.health.desc": "अपनी बचत दर, कर्ज और खर्च करने के पैटर्न के आधार पर रियल-टाइम स्वास्थ्य स्कोर प्राप्त करें।",
        "feature.ai.title": "AI वित्तीय सलाह",
        "feature.ai.desc": "अपने वित्त में सुधार के लिए अपने स्मार्ट AI कोच से व्यक्तिगत, कार्रवाई योग्य सलाह प्राप्त करें।",
        "feature.goal.title": "लक्ष्य-आधारित बचत ट्रैकर",
        "feature.goal.desc": "मील के पत्थर निर्धारित करें और अपनी प्रगति को ट्रैक करें।"
    },
    ta: {
        "nav.features": "அம்சங்கள்",
        "nav.about": "பற்றி",
        "nav.advisor": "AI ஆலோசகர்",
        "nav.login": "உள்நுழை",
        "nav.signup": "பதிவு செய்",
        "nav.dashboard": "முகப்புத் திரை",
        "nav.expenses": "செலவுகள்",
        "nav.goals": "இலக்குகள்",
        "hero.title": "ஸ்மார்ட்ஸ்பெண்ட் - AI நிதி ஆலோசகர்",
        "hero.tagline": "முதல் முறை சம்பாதிப்பவர்களுக்கான AI நிதி பயிற்சியாளர்",
        "hero.cta": "பகுப்பாய்வைத் தொடங்கு",
        "features.title": "உங்கள் பணத்தை நிர்வகிக்க தேவையான அனைத்தும்",
        "feature.expense.title": "செலவு பகுப்பாய்வு",
        "feature.expense.desc": "உங்கள் செலவு பழக்கங்களை தானாகவே வகைப்படுத்தி கண்காணிக்கவும்.",
        "feature.health.title": "நிதி சுகாதார மதிப்பெண்",
        "feature.health.desc": "உங்கள் சேமிப்பு விகிதம் அடிப்படையில் நிகழ்நேர சுகாதார மதிப்பெண்ணைப் பெறுங்கள்.",
        "feature.ai.title": "AI நிதி ஆலோசனை",
        "feature.ai.desc": "உங்கள் நிதியை மேம்படுத்த AI பயிற்சியாளரிடமிருந்து தனிப்பயனாக்கப்பட்ட ஆலோசனையைப் பெறுங்கள்.",
        "feature.goal.title": "இலக்கு அடிப்படையிலான சேமிப்பு",
        "feature.goal.desc": "புதிய கார் அல்லது விடுமுறைக்கான உங்கள் முன்னேற்றத்தை கண்காணிக்கவும்."
    }
};

let currentLang = localStorage.getItem('smartspend_lang') || 'en';

function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('smartspend_lang', lang);
        translatePage();
    }
}

function translatePage() {
    const defaultDict = translations['en'];
    const dict = translations[currentLang] || defaultDict;

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (dict[key]) {
            element.textContent = dict[key];
        } else if (defaultDict[key]) {
            element.textContent = defaultDict[key]; // fallback to english
        }
    });

    // Update the dropdown visually if it exists
    const langSelector = document.getElementById('languageSelector');
    if (langSelector) {
        langSelector.value = currentLang;
    }
}

// Global exposure
window.setLanguage = setLanguage;
window.getCurrentLanguage = () => currentLang;
window.translatePage = translatePage;

document.addEventListener('DOMContentLoaded', () => {
    translatePage();

    // Auto attach listener to selector if present
    const langSelector = document.getElementById('languageSelector');
    if (langSelector) {
        langSelector.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
});
