/**
 * i18n Translation Service for Steam Family Games
 * Supports dynamic language switching with persistent storage.
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'steam_language';
    const DEFAULT_LANG = 'en';
    const AVAILABLE_LANGS = ['en', 'it'];

    let currentLang = DEFAULT_LANG;
    let dictionaries = {};

    /**
     * Determines user's preferred language
     */
    function detectLanguage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && AVAILABLE_LANGS.includes(saved)) {
            return saved;
        }
        const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
        if (browserLang.startsWith('it')) {
            return 'it';
        }
        return DEFAULT_LANG;
    }

    /**
     * Loads a translation dictionary from lang/{code}.json
     */
    async function loadDictionary(lang) {
        if (dictionaries[lang]) {
            return dictionaries[lang];
        }

        try {
            const resp = await fetch(`lang/${lang}.json`);
            if (resp.ok) {
                const data = await resp.json();
                dictionaries[lang] = data;
                return data;
            }
        } catch (e) {
            console.warn(`Could not fetch lang/${lang}.json, falling back:`, e);
        }

        return dictionaries[lang] || {};
    }

    /**
     * Translates a key with optional parameter substitution
     * e.g. t('showing_games', { shown: 5, total: 10 })
     */
    function t(key, params = {}) {
        const dict = dictionaries[currentLang] || dictionaries[DEFAULT_LANG] || {};
        let text = dict[key];

        if (text === undefined) {
            const fallback = dictionaries[DEFAULT_LANG] || {};
            text = fallback[key] !== undefined ? fallback[key] : key;
        }

        if (typeof text === 'string' && params && typeof params === 'object') {
            for (const [k, v] of Object.entries(params)) {
                text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            }
        }

        return text;
    }

    /**
     * Translates all DOM elements containing data-i18n attributes
     */
    function applyDomTranslations() {
        document.documentElement.lang = currentLang;

        // Text Content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                if (el.hasAttribute('data-i18n-html')) {
                    el.innerHTML = t(key);
                } else {
                    el.textContent = t(key);
                }
            }
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.placeholder = t(key);
            }
        });

        // Titles / Tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.title = t(key);
            }
        });

        // Update language selector dropdown if rendered
        updateLanguageUI();
    }

    const LANG_DATA = {
        en: { name: 'English', flag: 'assets/flags/en.svg' },
        it: { name: 'Italiano', flag: 'assets/flags/it.svg' }
    };

    function updateLanguageUI() {
        const langSelect = document.getElementById('lang-select');
        if (langSelect && langSelect.value !== currentLang) {
            langSelect.value = currentLang;
        }

        const info = LANG_DATA[currentLang] || LANG_DATA[DEFAULT_LANG];
        const flagImg = document.getElementById('current-lang-flag');
        const textSpan = document.getElementById('current-lang-text');
        const menu = document.getElementById('lang-dropdown-menu');

        if (flagImg) {
            flagImg.src = info.flag;
            flagImg.alt = info.name;
        }
        if (textSpan) {
            textSpan.textContent = info.name;
        }
        if (menu) {
            menu.querySelectorAll('.lang-option-item').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
            });
        }
    }

    function setupCustomDropdown() {
        const btn = document.getElementById('lang-dropdown-btn');
        const menu = document.getElementById('lang-dropdown-menu');
        const wrapper = document.getElementById('lang-dropdown-wrapper');
        if (!btn || !menu) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen);
        });

        menu.querySelectorAll('.lang-option-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetLang = item.getAttribute('data-lang');
                menu.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
                if (targetLang && targetLang !== currentLang) {
                    setLanguage(targetLang);
                }
            });
        });

        document.addEventListener('click', (e) => {
            if (wrapper && !wrapper.contains(e.target)) {
                menu.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    /**
     * Sets the active language and re-translates the UI
     */
    async function setLanguage(lang) {
        if (!AVAILABLE_LANGS.includes(lang)) {
            lang = DEFAULT_LANG;
        }

        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);

        await loadDictionary(lang);
        applyDomTranslations();

        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    let initPromise = null;

    /**
     * Initializes the i18n module
     */
    async function init() {
        const detected = detectLanguage();
        // Pre-load default language as fallback and user language
        await loadDictionary(DEFAULT_LANG);
        if (detected !== DEFAULT_LANG) {
            await loadDictionary(detected);
        }

        currentLang = detected;
        applyDomTranslations();
        setupCustomDropdown();

        // Bind hidden native language selector if present in DOM
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = currentLang;
            langSelect.addEventListener('change', (e) => {
                setLanguage(e.target.value);
            });
        }
    }

    // Auto-init when DOM is ready and track promise
    if (document.readyState === 'loading') {
        initPromise = new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', async () => {
                await init();
                resolve();
            });
        });
    } else {
        initPromise = init();
    }

    // Expose public API
    window.i18n = {
        init,
        initPromise,
        t,
        setLanguage,
        getLanguage: () => currentLang,
        applyDomTranslations,
        availableLanguages: AVAILABLE_LANGS
    };
})();
