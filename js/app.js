/**
 * Steam Family Games - Main Application
 */

(function () {
    const STORAGE_KEY = 'steam_family_library_data';
    const CHUNK_SIZE = 40;

    // Steam & SteamDB Icons from assets folder for table links
    const STEAM_SVG = `<img src="assets/steam_logo.svg" class="ext-icon-img" alt="Steam" width="16" height="16">`;
    const STEAMDB_SVG = `<img src="assets/steamdb_logo.svg" class="ext-icon-img" alt="SteamDB" width="16" height="16">`;

    // State
    const state = {
        familyData: null,
        membersMap: new Map(),
        searchQuery: '',
        filters: {
            modes: {
                singleplayer: 'neutral',
                multiplayer: 'neutral',
                coop: 'neutral',
                local_mp: 'neutral',
                pvp: 'neutral'
            },
            owners: {},
            availability: {
                not_shareable: 'neutral',
                free: 'neutral'
            },
            minCopies: 1
        },
        sortColumn: 'copies',
        sortDirection: 'desc',
        filteredApps: [],
        renderedCount: 0
    };

    // DOM Elements
    const elements = {
        searchInput: document.getElementById('search-input'),
        searchClearBtn: document.getElementById('search-clear-btn'),
        filtersToggleBtn: document.getElementById('filters-toggle-btn'),
        filterBadgeCounter: document.getElementById('filter-badge-counter'),
        filtersPanel: document.getElementById('filters-panel'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        ownerFiltersContainer: document.getElementById('owner-filters-container'),
        activeFiltersSummary: document.getElementById('active-filters-summary'),
        statusBar: document.getElementById('status-bar'),
        familyGroupName: document.getElementById('family-group-name'),
        filteredCount: document.getElementById('filtered-count'),
        totalCount: document.getElementById('total-count'),
        familyMembersPillList: document.getElementById('family-members-pill-list'),
        tableCard: document.getElementById('table-card'),
        gamesTableBody: document.getElementById('games-table-body'),
        scrollSentinel: document.getElementById('scroll-sentinel'),
        emptyState: document.getElementById('empty-state'),
        emptySyncBtn: document.getElementById('empty-sync-btn'),
        loadDemoBtn: document.getElementById('load-demo-btn'),
        syncModalBtn: document.getElementById('sync-modal-btn'),
        syncBtnLabel: document.getElementById('sync-btn-label'),
        syncModal: document.getElementById('sync-modal'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        bookmarkletLink: document.getElementById('bookmarklet-link'),
        copyBookmarkletUrlBtn: document.getElementById('copy-bookmarklet-url-btn'),
        snippetCodeBox: document.getElementById('snippet-code-box'),
        copySnippetBtn: document.getElementById('copy-snippet-btn'),
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('file-input'),
        jsonPasteInput: document.getElementById('json-paste-input'),
        importPastedJsonBtn: document.getElementById('import-pasted-json-btn'),
        clearDataBtn: document.getElementById('clear-data-btn'),
        exportJsonBtn: document.getElementById('export-json-btn'),
        sortIconName: document.getElementById('sort-icon-name'),
        sortIconCopies: document.getElementById('sort-icon-copies')
    };

    // =========================================================================
    // Initialization
    // =========================================================================

    async function init() {
        setupEventListeners();
        setupBookmarkletData();

        // Initialize category dataset
        if (window.categoriesService) {
            await window.categoriesService.init();
        }

        // Check for URL hash import
        if (await checkUrlHashImport()) {
            return;
        }

        // Check local storage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                loadFamilyData(data);
                return;
            } catch (e) {
                console.error('Failed to parse saved family data:', e);
            }
        }

        // Show empty state if no data
        showEmptyState();
    }

    // =========================================================================
    // URL Hash Import with Gzip Decompression
    // =========================================================================

    async function decodeImportPayload(rawEncoded) {
        const decoded = decodeURIComponent(rawEncoded);
        if (decoded.startsWith('gz:')) {
            const b64 = decoded.substring(3);
            const binStr = atob(b64);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            const text = await new Response(stream).text();
            return JSON.parse(text);
        }
        if (decoded.startsWith('raw:')) {
            const b64 = decoded.substring(4);
            const jsonStr = decodeURIComponent(escape(atob(b64)));
            return JSON.parse(jsonStr);
        }
        // Fallback for legacy base64
        try {
            const binStr = atob(decoded);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
                const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
                const text = await new Response(stream).text();
                return JSON.parse(text);
            }
            return JSON.parse(decodeURIComponent(escape(binStr)));
        } catch(e) {
            return JSON.parse(decodeURIComponent(escape(atob(decoded))));
        }
    }

    async function checkUrlHashImport() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#import=')) {
            try {
                const rawEncoded = hash.substring(8);
                const data = await decodeImportPayload(rawEncoded);
                if (data && data.apps && Array.isArray(data.apps)) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    // Clean URL
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                    loadFamilyData(data);
                    alert(`✓ Successfully synced family library!\n${data.apps.length} games across ${data.members?.length || 0} members (${(data.members || []).map(m=>m.name).join(', ')})`);
                    return true;
                }
            } catch (err) {
                console.error('Error importing from URL hash:', err);
                alert('Could not import library from URL: ' + err.message);
            }
        }
        return false;
    }

    // =========================================================================
    // Data Loading & State Management
    // =========================================================================

    function mergeAppsByAppId(apps) {
        if (!Array.isArray(apps)) return [];
        const appMap = new Map();
        apps.forEach(app => {
            const id = Number(app.appid);
            if (!id) return;
            if (!appMap.has(id)) {
                appMap.set(id, {
                    ...app,
                    appid: id,
                    owner_steamids: new Set((app.owner_steamids || []).map(String)),
                    exclude_reason: app.exclude_reason || 0
                });
            } else {
                const existing = appMap.get(id);
                (app.owner_steamids || []).forEach(sid => existing.owner_steamids.add(String(sid)));
                // Prioritize shareable if any copy is shareable
                if (existing.exclude_reason !== 0 && app.exclude_reason === 0) {
                    existing.exclude_reason = 0;
                }
                if (!existing.capsule_url && app.capsule_url) {
                    existing.capsule_url = app.capsule_url;
                }
            }
        });

        return Array.from(appMap.values()).map(app => ({
            ...app,
            owner_steamids: Array.from(app.owner_steamids)
        }));
    }

    function loadFamilyData(data) {
        if (data && Array.isArray(data.apps)) {
            data.apps = mergeAppsByAppId(data.apps);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (e) {}
        }

        state.familyData = data;
        state.membersMap.clear();
        state.filters.owners = {};

        const members = data.members || [];
        members.forEach(m => {
            state.membersMap.set(String(m.steamid), m);
        });

        // Update Header & Status Bar
        elements.familyGroupName.textContent = data.name || 'Steam Family';
        elements.totalCount.textContent = (data.apps || []).length;
        elements.syncBtnLabel.textContent = `Family (${(data.apps || []).length})`;

        // Populate member avatars in status bar
        elements.familyMembersPillList.innerHTML = '';
        members.forEach(m => {
            const img = document.createElement('img');
            img.src = m.avatar_url || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';
            img.className = 'owner-pfp-img tooltip';
            img.style.width = '24px';
            img.style.height = '24px';
            img.style.cursor = 'pointer';
            img.setAttribute('data-tooltip', `${m.name} (Click to rename)`);
            img.addEventListener('click', () => {
                const newName = prompt(`Enter custom name for this member:`, m.name);
                if (newName && newName.trim()) {
                    m.name = newName.trim();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.familyData));
                    loadFamilyData(state.familyData);
                }
            });
            img.onerror = () => { img.src = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'; };
            elements.familyMembersPillList.appendChild(img);
        });

        // Build Owner Filter Options
        renderOwnerFilters(members);

        // Switch to Table View
        elements.emptyState.style.display = 'none';
        elements.statusBar.style.display = 'flex';
        elements.tableCard.style.display = 'block';

        applyFilters();
    }

    function showEmptyState() {
        elements.emptyState.style.display = 'block';
        elements.statusBar.style.display = 'none';
        elements.tableCard.style.display = 'none';
        elements.syncBtnLabel.textContent = 'Sync / Login';
    }

    function renderOwnerFilters(members) {
        const container = elements.ownerFiltersContainer;
        if (!container) return;
        container.innerHTML = '';

        if (!members.length) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No members</span>';
            return;
        }

        members.forEach(m => {
            const sid = String(m.steamid);
            const currentState = state.filters.owners[sid] || 'neutral';
            state.filters.owners[sid] = currentState;

            const row = document.createElement('div');
            row.className = 'tristate-row';
            row.setAttribute('data-type', 'owner');
            row.setAttribute('data-key', sid);

            const labelDiv = document.createElement('div');
            labelDiv.className = 'tristate-label';

            const img = document.createElement('img');
            img.src = m.avatar_url || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';
            img.className = 'owner-chip-avatar';
            img.onerror = () => { img.src = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'; };

            const span = document.createElement('span');
            span.className = 'owner-name-text';
            span.textContent = m.name;
            span.title = m.name;

            labelDiv.appendChild(img);
            labelDiv.appendChild(span);

            const switchDiv = document.createElement('div');
            switchDiv.className = 'tristate-switch';

            const btnExclude = document.createElement('button');
            btnExclude.type = 'button';
            btnExclude.className = 'tristate-btn btn-exclude' + (currentState === 'exclude' ? ' active' : '');
            btnExclude.setAttribute('data-state', 'exclude');
            btnExclude.title = `Do not show games owned by ${m.name}`;
            btnExclude.textContent = '✕';

            const btnNeutral = document.createElement('button');
            btnNeutral.type = 'button';
            btnNeutral.className = 'tristate-btn btn-neutral' + (currentState === 'neutral' ? ' active' : '');
            btnNeutral.setAttribute('data-state', 'neutral');
            btnNeutral.title = `Show normally`;
            btnNeutral.textContent = '—';

            const btnInclude = document.createElement('button');
            btnInclude.type = 'button';
            btnInclude.className = 'tristate-btn btn-include' + (currentState === 'include' ? ' active' : '');
            btnInclude.setAttribute('data-state', 'include');
            btnInclude.title = `Show games owned by ${m.name}`;
            btnInclude.textContent = '✓';

            const btnExclusive = document.createElement('button');
            btnExclusive.type = 'button';
            btnExclusive.className = 'tristate-btn btn-exclusive' + (currentState === 'exclusive' ? ' active' : '');
            btnExclusive.setAttribute('data-state', 'exclusive');
            btnExclusive.title = `Show games owned only by ${m.name}`;
            btnExclusive.textContent = '✓✓';

            switchDiv.appendChild(btnExclude);
            switchDiv.appendChild(btnNeutral);
            switchDiv.appendChild(btnInclude);
            switchDiv.appendChild(btnExclusive);

            row.appendChild(labelDiv);
            row.appendChild(switchDiv);
            container.appendChild(row);
        });
    }

    // =========================================================================
    // Filtering & Sorting
    // =========================================================================

    function applyFilters() {
        if (!state.familyData || !state.familyData.apps) return;

        const q = state.searchQuery.toLowerCase().trim();
        const f = state.filters;

        const excludeModes = Object.entries(f.modes).filter(([_, s]) => s === 'exclude').map(([k]) => k);
        const includeModes = Object.entries(f.modes).filter(([_, s]) => s === 'include').map(([k]) => k);
        const exclusiveModes = Object.entries(f.modes).filter(([_, s]) => s === 'exclusive').map(([k]) => k);

        const excludeOwners = Object.entries(f.owners).filter(([_, s]) => s === 'exclude').map(([k]) => k);
        const includeOwners = Object.entries(f.owners).filter(([_, s]) => s === 'include').map(([k]) => k);
        const exclusiveOwners = Object.entries(f.owners).filter(([_, s]) => s === 'exclusive').map(([k]) => k);

        const ALL_PLAYER_MODES = ['singleplayer', 'multiplayer', 'coop', 'local_mp', 'pvp'];

        let filtered = state.familyData.apps.filter(app => {
            // Search Query Filter
            if (q && !app.name.toLowerCase().includes(q)) {
                return false;
            }

            // Min Copies Filter
            const copiesCount = (app.owner_steamids || []).length;
            if (copiesCount < f.minCopies) {
                return false;
            }

            // Availability Filter
            const isNotShareable = app.exclude_reason === 1;
            const isFree = app.exclude_reason === 3;

            if (f.availability.not_shareable === 'exclude' && isNotShareable) return false;
            if (f.availability.not_shareable === 'include' && !isNotShareable) return false;

            if (f.availability.free === 'exclude' && isFree) return false;
            if (f.availability.free === 'include' && !isFree) return false;

            // Owners Filter
            const owners = (app.owner_steamids || []).map(String);
            if (excludeOwners.length > 0) {
                if (owners.some(sid => excludeOwners.includes(sid))) return false;
            }
            if (includeOwners.length > 0) {
                if (!owners.some(sid => includeOwners.includes(sid))) return false;
            }
            if (exclusiveOwners.length > 0) {
                if (owners.length === 0) return false;
                if (!owners.every(sid => exclusiveOwners.includes(sid))) return false;
            }

            // Player Modes Filter
            const tags = window.categoriesService ? window.categoriesService.getCategories(app.appid) : [];
            if (excludeModes.length > 0) {
                if (excludeModes.some(m => tags.includes(m))) return false;
            }
            if (includeModes.length > 0) {
                if (!includeModes.every(m => tags.includes(m))) return false;
            }
            if (exclusiveModes.length > 0) {
                const gameModes = tags.filter(m => ALL_PLAYER_MODES.includes(m));
                if (gameModes.length === 0) return false;
                if (!exclusiveModes.every(m => gameModes.includes(m))) return false;
                if (gameModes.some(m => !exclusiveModes.includes(m))) return false;
            }

            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            if (state.sortColumn === 'copies') {
                const countA = (a.owner_steamids || []).length;
                const countB = (b.owner_steamids || []).length;
                if (countA !== countB) {
                    return state.sortDirection === 'asc' ? countA - countB : countB - countA;
                }
                // Secondary sort by name
                return a.name.localeCompare(b.name);
            } else {
                const cmp = a.name.localeCompare(b.name);
                return state.sortDirection === 'asc' ? cmp : -cmp;
            }
        });

        state.filteredApps = filtered;
        state.renderedCount = 0;
        elements.filteredCount.textContent = filtered.length;
        elements.gamesTableBody.innerHTML = '';

        // Update Sort Headers UI
        updateSortHeaders();

        // Render first chunk
        renderNextChunk();
    }

    function updateSortHeaders() {
        const thName = document.querySelector('th[data-sort="name"]');
        const thCopies = document.querySelector('th[data-sort="copies"]');

        thName.classList.remove('sorted');
        thCopies.classList.remove('sorted');

        if (state.sortColumn === 'name') {
            thName.classList.add('sorted');
            elements.sortIconName.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
        } else {
            thCopies.classList.add('sorted');
            elements.sortIconCopies.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
        }
    }

    function updateFilterCounter() {
        const f = state.filters;
        let count = 0;

        Object.values(f.modes).forEach(s => { if (s !== 'neutral') count++; });
        Object.values(f.owners).forEach(s => { if (s !== 'neutral') count++; });
        Object.values(f.availability).forEach(s => { if (s !== 'neutral') count++; });
        if (f.minCopies > 1) count++;

        if (count > 0) {
            elements.filterBadgeCounter.textContent = count;
            elements.filterBadgeCounter.style.display = 'inline-block';
            elements.filtersToggleBtn.classList.add('active');
            if (elements.activeFiltersSummary) {
                elements.activeFiltersSummary.textContent = `${count} active filter${count > 1 ? 's' : ''}`;
                elements.activeFiltersSummary.style.color = 'var(--steam-blue)';
            }
        } else {
            elements.filterBadgeCounter.style.display = 'none';
            elements.filtersToggleBtn.classList.remove('active');
            if (elements.activeFiltersSummary) {
                elements.activeFiltersSummary.textContent = 'No filters active (showing all games)';
                elements.activeFiltersSummary.style.color = 'var(--text-muted)';
            }
        }
    }

    function resetFilters(keepSearch = false) {
        Object.keys(state.filters.modes).forEach(k => { state.filters.modes[k] = 'neutral'; });
        Object.keys(state.filters.owners).forEach(k => { state.filters.owners[k] = 'neutral'; });
        state.filters.availability.not_shareable = 'neutral';
        state.filters.availability.free = 'neutral';
        state.filters.minCopies = 1;

        if (!keepSearch) {
            state.searchQuery = '';
            if (elements.searchInput) elements.searchInput.value = '';
            if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'none';
        }

        if (elements.filtersPanel) {
            elements.filtersPanel.querySelectorAll('.tristate-row').forEach(row => {
                row.querySelectorAll('.tristate-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-state') === 'neutral');
                });
            });

            elements.filtersPanel.querySelectorAll('.copies-chip').forEach(chip => {
                chip.classList.toggle('active', chip.getAttribute('data-copies') === '1');
            });
        }

        updateFilterCounter();
        applyFilters();
    }

    // =========================================================================
    // Table Rendering (Lazy Loading / Infinite Scroll)
    // =========================================================================

    function renderNextChunk() {
        const total = state.filteredApps.length;
        if (state.renderedCount >= total) {
            elements.scrollSentinel.style.display = 'none';
            return;
        }

        const start = state.renderedCount;
        const end = Math.min(start + CHUNK_SIZE, total);
        const fragment = document.createDocumentFragment();

        for (let i = start; i < end; i++) {
            const app = state.filteredApps[i];
            const tr = createTableRow(app);
            fragment.appendChild(tr);
        }

        elements.gamesTableBody.appendChild(fragment);
        state.renderedCount = end;

        if (state.renderedCount < total) {
            elements.scrollSentinel.style.display = 'flex';
        } else {
            elements.scrollSentinel.style.display = 'none';
        }
    }

    function createTableRow(app) {
        const tr = document.createElement('tr');
        const copies = (app.owner_steamids || []).length;
        const categories = window.categoriesService ? window.categoriesService.getCategories(app.appid) : [];

        // 1. Column: Name & Capsule
        const tdName = document.createElement('td');
        tdName.className = 'col-name';
        const u1 = app.capsule_url || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${app.appid}/capsule_sm_120.jpg`;
        const u2 = `https://cdn.cloudflare.steamstatic.com/steam/apps/${app.appid}/capsule_231x87.jpg`;
        const u3 = `https://cdn.cloudflare.steamstatic.com/steam/apps/${app.appid}/header.jpg`;
        const u4 = `https://steamcdn-a.akamaihd.net/steam/apps/${app.appid}/header.jpg`;
        
        let excludeBadgeHtml = '';
        if (app.exclude_reason === 1) {
            excludeBadgeHtml = '<span class="tag-badge badge-warning" title="Publisher restricted this game from Steam Family Sharing">Not Shareable</span>';
        } else if (app.exclude_reason === 3) {
            excludeBadgeHtml = '<span class="tag-badge badge-free" title="Free to play">Free</span>';
        }

        tdName.innerHTML = `
            <div class="game-title-cell">
                <img class="game-capsule-img" 
                     src="${u1}" 
                     alt="${escapeHtml(app.name)}"
                     loading="lazy" 
                     data-fallback="1"
                     onerror="if (this.dataset.fallback === '1') { this.dataset.fallback = '2'; this.src = '${u2}'; } else if (this.dataset.fallback === '2') { this.dataset.fallback = '3'; this.src = '${u3}'; } else if (this.dataset.fallback === '3') { this.dataset.fallback = '4'; this.src = '${u4}'; } else { this.style.display='none'; this.nextElementSibling.style.display='inline-flex'; }">
                <div class="game-capsule-placeholder" style="display:none;" title="${escapeHtml(app.name)}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.704L.488 15.01C1.933 20.158 6.64 24 12.213 24c6.627 0 12-5.373 12-12S18.607 0 11.979 0z"/>
                    </svg>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <a class="game-name-link" href="https://store.steampowered.com/app/${app.appid}/" target="_blank" rel="noopener">
                        ${escapeHtml(app.name)}
                    </a>
                    ${excludeBadgeHtml ? `<div>${excludeBadgeHtml}</div>` : ''}
                </div>
            </div>
        `;
        tr.appendChild(tdName);

        // 2. Column: Players Tags
        const tdPlayers = document.createElement('td');
        tdPlayers.className = 'col-players';
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'badges-container';

        if (categories.length > 0) {
            categories.forEach(tag => {
                const info = CategoriesService.getBadgeInfo(tag);
                const badge = document.createElement('span');
                badge.className = `tag-badge ${info.className}`;
                badge.textContent = info.label;
                badgesContainer.appendChild(badge);
            });
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'tag-badge badge-default';
            placeholder.textContent = '—';
            badgesContainer.appendChild(placeholder);
        }
        tdPlayers.appendChild(badgesContainer);
        tr.appendChild(tdPlayers);

        // 3. Column: Owners Avatars
        const tdOwners = document.createElement('td');
        tdOwners.className = 'col-owners';
        const ownersContainer = document.createElement('div');
        ownersContainer.className = 'owners-avatars-row';

        (app.owner_steamids || []).forEach(sid => {
            const member = state.membersMap.get(String(sid)) || {
                name: 'Family Member',
                avatar_url: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg',
                profile_url: `https://steamcommunity.com/profiles/${sid}`
            };

            const a = document.createElement('a');
            a.className = 'owner-pfp-link tooltip';
            a.href = member.profile_url || `https://steamcommunity.com/profiles/${sid}`;
            a.target = '_blank';
            a.rel = 'noopener';
            a.setAttribute('data-tooltip', member.name);

            const img = document.createElement('img');
            img.src = member.avatar_url;
            img.alt = member.name;
            img.className = 'owner-pfp-img';
            img.loading = 'lazy';
            img.onerror = () => { img.src = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'; };

            a.appendChild(img);
            ownersContainer.appendChild(a);
        });
        tdOwners.appendChild(ownersContainer);
        tr.appendChild(tdOwners);

        // 4. Column: Copies
        const tdCopies = document.createElement('td');
        tdCopies.className = 'col-copies';
        tdCopies.innerHTML = `
            <span class="copies-badge ${copies > 1 ? 'multiple' : ''}">
                ${copies}
            </span>
        `;
        tr.appendChild(tdCopies);

        // 5. Column: Links (Steam + SteamDB)
        const tdLinks = document.createElement('td');
        tdLinks.className = 'col-links';
        tdLinks.innerHTML = `
            <div class="external-links">
                <a href="https://store.steampowered.com/app/${app.appid}/" target="_blank" rel="noopener" class="ext-icon-link" title="Open on Steam Store">
                    ${STEAM_SVG}
                </a>
                <a href="https://steamdb.info/app/${app.appid}/" target="_blank" rel="noopener" class="ext-icon-link" title="Open on SteamDB">
                    ${STEAMDB_SVG}
                </a>
            </div>
        `;
        tr.appendChild(tdLinks);

        return tr;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    // =========================================================================
    // Event Listeners & Interactive Handlers
    // =========================================================================

    function setupEventListeners() {
        // Search Input
        elements.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            elements.searchClearBtn.style.display = state.searchQuery ? 'block' : 'none';
            applyFilters();
        });

        elements.searchClearBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.searchQuery = '';
            elements.searchClearBtn.style.display = 'none';
            applyFilters();
            elements.searchInput.focus();
        });

        // Filter Toggle Button
        elements.filtersToggleBtn.addEventListener('click', () => {
            elements.filtersPanel.classList.toggle('open');
        });

        // Tri-state Filters and Copies Filter Delegation
        if (elements.filtersPanel) {
            elements.filtersPanel.addEventListener('click', (e) => {
                const tristateBtn = e.target.closest('.tristate-btn');
                if (tristateBtn) {
                    e.preventDefault();
                    const row = tristateBtn.closest('.tristate-row');
                    if (!row) return;

                    const type = row.getAttribute('data-type');
                    const key = row.getAttribute('data-key');
                    const targetState = tristateBtn.getAttribute('data-state');

                    if (type && key && targetState) {
                        if (type === 'mode') {
                            state.filters.modes[key] = targetState;
                        } else if (type === 'owner') {
                            state.filters.owners[key] = targetState;
                        } else if (type === 'availability') {
                            state.filters.availability[key] = targetState;
                        }

                        row.querySelectorAll('.tristate-btn').forEach(b => b.classList.remove('active'));
                        tristateBtn.classList.add('active');

                        updateFilterCounter();
                        applyFilters();
                    }
                    return;
                }

                const copiesChip = e.target.closest('.copies-chip');
                if (copiesChip) {
                    e.preventDefault();
                    elements.filtersPanel.querySelectorAll('.copies-chip').forEach(c => c.classList.remove('active'));
                    copiesChip.classList.add('active');

                    const val = parseInt(copiesChip.getAttribute('data-copies'), 10) || 1;
                    state.filters.minCopies = val;

                    updateFilterCounter();
                    applyFilters();
                    return;
                }
            });
        }

        // Reset Filters Button
        if (elements.resetFiltersBtn) {
            elements.resetFiltersBtn.addEventListener('click', () => {
                resetFilters();
            });
        }

        // Sort Headers
        document.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (state.sortColumn === col) {
                    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortColumn = col;
                    state.sortDirection = col === 'copies' ? 'desc' : 'asc';
                }
                applyFilters();
            });
        });

        // Infinite Scroll with IntersectionObserver
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                renderNextChunk();
            }
        }, { rootMargin: '300px' });
        observer.observe(elements.scrollSentinel);

        // Modal Open / Close
        elements.syncModalBtn.addEventListener('click', () => openModal());
        elements.emptySyncBtn.addEventListener('click', () => openModal());
        elements.modalCloseBtn.addEventListener('click', () => closeModal());
        elements.syncModal.addEventListener('click', (e) => {
            if (e.target === elements.syncModal) closeModal();
        });

        // Modal Tabs
        document.querySelectorAll('.modal-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
            });
        });

        // Bookmarklet Link Drag / Click Protection
        elements.bookmarkletLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            alert("📌 To use the bookmarklet: drag this button directly to your browser's Bookmarks bar, or click 'Copy Bookmarklet URL' below to add it manually.\n\nThen visit store.steampowered.com and click the bookmark to sync your family library!");
        });

        // Copy Bookmarklet URL
        if (elements.copyBookmarkletUrlBtn) {
            elements.copyBookmarkletUrlBtn.addEventListener('click', async () => {
                if (!generatedBookmarkletUrl) return;
                try {
                    await navigator.clipboard.writeText(generatedBookmarkletUrl);
                    elements.copyBookmarkletUrlBtn.innerHTML = '<span>✅ Copied Bookmarklet URL!</span>';
                    setTimeout(() => {
                        elements.copyBookmarkletUrlBtn.innerHTML = '<span>📋 Copy Bookmarklet URL</span>';
                    }, 2000);
                } catch (err) {
                    alert('Could not copy automatically. You can use the Console Snippet tab instead.');
                }
            });
        }

        // Copy Console Snippet
        elements.copySnippetBtn.addEventListener('click', async () => {
            const code = elements.snippetCodeBox.textContent;
            try {
                await navigator.clipboard.writeText(code);
                elements.copySnippetBtn.innerHTML = '<span>✅ Copied to Clipboard!</span>';
                setTimeout(() => {
                    elements.copySnippetBtn.innerHTML = '<span>📋 Copy Script to Clipboard</span>';
                }, 2000);
            } catch (err) {
                alert('Could not copy automatically. Please select and copy manually.');
            }
        });

        // Drag & Drop File Input
        elements.dropzone.addEventListener('click', () => elements.fileInput.click());
        elements.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropzone.classList.add('dragover');
        });
        elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('dragover'));
        elements.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleJsonFile(e.dataTransfer.files[0]);
            }
        });

        elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleJsonFile(e.target.files[0]);
            }
        });

        // Pasted JSON Button
        elements.importPastedJsonBtn.addEventListener('click', () => {
            const val = elements.jsonPasteInput.value.trim();
            if (!val) {
                alert('Please paste JSON data first.');
                return;
            }
            try {
                const parsed = JSON.parse(val);
                processImportedData(parsed);
            } catch (err) {
                alert('Invalid JSON format: ' + err.message);
            }
        });

        // Load Demo Data Button
        elements.loadDemoBtn.addEventListener('click', () => {
            if (window.DEMO_FAMILY_DATA) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(window.DEMO_FAMILY_DATA));
                loadFamilyData(window.DEMO_FAMILY_DATA);
            }
        });

        // Clear Data
        elements.clearDataBtn.addEventListener('click', () => {
            if (confirm('Clear saved family library from this browser?')) {
                localStorage.removeItem(STORAGE_KEY);
                state.familyData = null;
                resetFilters();
                showEmptyState();
                closeModal();
            }
        });

        // Export Backup JSON
        elements.exportJsonBtn.addEventListener('click', () => {
            if (!state.familyData) {
                alert('No family data currently loaded to export.');
                return;
            }
            const blob = new Blob([JSON.stringify(state.familyData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'steam_family_backup.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // =========================================================================
    // Bookmarklet Setup & File Handlers
    // =========================================================================

    let generatedBookmarkletUrl = '';

    function setupBookmarkletData() {
        if (!window.generateBookmarkletCode) return;
        const currentUrl = window.location.href.split('#')[0];
        const res = window.generateBookmarkletCode(currentUrl);

        generatedBookmarkletUrl = res.bookmarkletUrl;
        elements.bookmarkletLink.href = res.bookmarkletUrl;
        elements.snippetCodeBox.textContent = res.raw;

        elements.bookmarkletLink.addEventListener('dragstart', (e) => {
            if (generatedBookmarkletUrl) {
                e.dataTransfer.setData('text/plain', generatedBookmarkletUrl);
                e.dataTransfer.setData('text/uri-list', generatedBookmarkletUrl);
                e.dataTransfer.setData('text/html', '<a href="' + generatedBookmarkletUrl + '">Sync Steam Family</a>');
            }
        });
    }

    function handleJsonFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                processImportedData(parsed);
            } catch (err) {
                alert('Could not parse JSON file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function processImportedData(data) {
        if (!data || !Array.isArray(data.apps)) {
            alert('JSON data does not have the expected structure (missing "apps" array).');
            return;
        }

        data.apps = mergeAppsByAppId(data.apps);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        loadFamilyData(data);
        closeModal();
        alert(`Successfully imported ${data.apps.length} family games!`);
    }

    function openModal() {
        elements.syncModal.classList.add('open');
    }

    function closeModal() {
        elements.syncModal.classList.remove('open');
    }

    // Launch
    window.addEventListener('DOMContentLoaded', init);
})();
