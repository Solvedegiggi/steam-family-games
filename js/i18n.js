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
        const langSelect = document.getElementById('lang-select');
        if (langSelect && langSelect.value !== currentLang) {
            langSelect.value = currentLang;
        }
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

        // Bind language selector if present in DOM
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = currentLang;
            langSelect.addEventListener('change', (e) => {
                setLanguage(e.target.value);
            });
        }
    }

    // Expose public API
    window.i18n = {
        init,
        t,
        setLanguage,
        getLanguage: () => currentLang,
        applyDomTranslations,
        availableLanguages: AVAILABLE_LANGS
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
