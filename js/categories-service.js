/**
 * Categories Service
 * Handles static category metadata, local caching, and dynamic fallback resolution.
 */
class CategoriesService {
    constructor() {
        this.cache = new Map();
        this.isLoaded = false;
        this.storageKey = 'steam_family_app_categories_cache';
        this.loadLocalCache();
    }

    loadLocalCache() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                for (const [appid, tags] of Object.entries(parsed)) {
                    this.cache.set(String(appid), tags);
                }
            }
        } catch (e) {
            console.warn('Failed to load local categories cache:', e);
        }
    }

    saveLocalCache() {
        try {
            const obj = {};
            for (const [appid, tags] of this.cache.entries()) {
                obj[appid] = tags;
            }
            localStorage.setItem(this.storageKey, JSON.stringify(obj));
        } catch (e) {
            console.warn('Failed to save local categories cache:', e);
        }
    }

    async init() {
        if (this.isLoaded) return;
        try {
            const resp = await fetch('data/categories.json');
            if (resp.ok) {
                const staticData = await resp.json();
                for (const [appid, tags] of Object.entries(staticData)) {
                    this.cache.set(String(appid), tags);
                }
            }
        } catch (e) {
            console.warn('Failed to fetch data/categories.json, continuing with local cache:', e);
        }
        // Reapply any user-saved local cache entries
        this.loadLocalCache();
        this.isLoaded = true;
    }

    getCategories(appid) {
        return this.cache.get(String(appid)) || [];
    }

    hasCategories(appid) {
        return this.cache.has(String(appid));
    }

    setCategories(appid, tags) {
        if (!Array.isArray(tags) || !tags.length) return;
        this.cache.set(String(appid), tags);
        this.saveLocalCache();
    }

    setCategoriesBatch(entries) {
        if (!entries) return;
        const items = Array.isArray(entries) ? entries : Object.entries(entries);
        let changed = false;
        for (const [appid, tags] of items) {
            if (Array.isArray(tags) && tags.length > 0) {
                this.cache.set(String(appid), tags);
                changed = true;
            }
        }
        if (changed) {
            this.saveLocalCache();
        }
    }

    /**
     * Map category code to human-readable UI label and badge styling
     */
    static getBadgeInfo(tag) {
        const tr = (k, def) => (window.i18n ? window.i18n.t(k) : def);
        switch (tag) {
            case 'singleplayer':
                return { label: tr('mode_singleplayer', 'Single-player'), className: 'badge-single' };
            case 'multiplayer':
                return { label: tr('mode_multiplayer', 'Multiplayer'), className: 'badge-multi' };
            case 'coop':
                return { label: tr('mode_coop', 'Co-op'), className: 'badge-coop' };
            case 'local_mp':
                return { label: tr('mode_local_mp', 'Local MP'), className: 'badge-local' };
            case 'pvp':
                return { label: tr('mode_pvp', 'PvP'), className: 'badge-pvp' };
            case 'crossplay':
                return { label: tr('mode_crossplay', 'Crossplay'), className: 'badge-crossplay' };
            default:
                return { label: tag, className: 'badge-default' };
        }
    }
}

window.categoriesService = new CategoriesService();
