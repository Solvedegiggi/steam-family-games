/**
 * Steam Family Games - Main Application
 */

(function () {
    const STORAGE_KEY = 'steam_family_library_data';
    const CHUNK_SIZE = 40;

    // Steam & SteamDB SVG Icons for table links
    const STEAM_SVG = `<svg class="ext-icon-svg" viewBox="0 0 24 24"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.704L.488 15.01C1.933 20.158 6.64 24 12.213 24c6.627 0 12-5.373 12-12S18.607 0 11.979 0z"/></svg>`;
    const STEAMDB_SVG = `<svg class="ext-icon-svg" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.836 17.652l-3.32-1.915a3.793 3.793 0 0 1-2.516.943c-2.106 0-3.815-1.708-3.815-3.815 0-.46.082-.899.231-1.306l-2.613-1.51a5.952 5.952 0 0 0-.253 1.728c0 3.308 2.684 5.992 5.992 5.992 1.488 0 2.85-.544 3.901-1.442l2.393 1.325zm-.343-5.267a3.818 3.818 0 0 1-.223 1.294l2.617 1.512c.427-.852.673-1.808.673-2.825 0-3.308-2.684-5.992-5.992-5.992-1.503 0-2.879.555-3.937 1.47l2.399 1.328a3.81 3.81 0 0 1 2.502-.977c2.107 0 3.815 1.708 3.815 3.815a3.78 3.78 0 0 1-.854 2.375z"/></svg>`;

    // State
    const state = {
        familyData: null,
        membersMap: new Map(),
        searchQuery: '',
        selectedModes: new Set(),
        selectedOwners: new Set(),
        minCopies: 1,
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

    function loadFamilyData(data) {
        state.familyData = data;
        state.membersMap.clear();

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
        elements.ownerFiltersContainer.innerHTML = '';
        if (!members.length) {
            elements.ownerFiltersContainer.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No members</span>';
            return;
        }

        members.forEach(m => {
            const label = document.createElement('label');
            label.className = 'filter-chip';
            label.setAttribute('data-steamid', m.steamid);
            if (state.selectedOwners.has(String(m.steamid))) {
                label.classList.add('active');
            }

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = m.steamid;
            chk.checked = state.selectedOwners.has(String(m.steamid));

            const img = document.createElement('img');
            img.src = m.avatar_url || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';
            img.className = 'owner-chip-avatar';
            img.onerror = () => { img.src = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'; };

            const span = document.createElement('span');
            span.textContent = m.name;

            label.appendChild(chk);
            label.appendChild(img);
            label.appendChild(span);

            label.addEventListener('click', (e) => {
                e.preventDefault();
                const sid = String(m.steamid);
                if (state.selectedOwners.has(sid)) {
                    state.selectedOwners.delete(sid);
                    label.classList.remove('active');
                    chk.checked = false;
                } else {
                    state.selectedOwners.add(sid);
                    label.classList.add('active');
                    chk.checked = true;
                }
                updateFilterCounter();
                applyFilters();
            });

            elements.ownerFiltersContainer.appendChild(label);
        });
    }

    // =========================================================================
    // Filtering & Sorting
    // =========================================================================

    function applyFilters() {
        if (!state.familyData || !state.familyData.apps) return;

        const q = state.searchQuery.toLowerCase().trim();
        const hasModes = state.selectedModes.size > 0;
        const hasOwners = state.selectedOwners.size > 0;

        let filtered = state.familyData.apps.filter(app => {
            // Search Query Filter
            if (q && !app.name.toLowerCase().includes(q)) {
                return false;
            }

            // Min Copies Filter
            const copiesCount = (app.owner_steamids || []).length;
            if (copiesCount < state.minCopies) {
                return false;
            }

            // Owners Filter
            if (hasOwners) {
                const owns = (app.owner_steamids || []).some(sid => state.selectedOwners.has(String(sid)));
                if (!owns) return false;
            }

            // Player Modes Filter
            if (hasModes) {
                const tags = window.categoriesService ? window.categoriesService.getCategories(app.appid) : [];
                // Check if any selected mode matches the game's categories
                const matchesMode = Array.from(state.selectedModes).some(m => tags.includes(m));
                if (!matchesMode) return false;
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
        let count = 0;
        count += state.selectedModes.size;
        count += state.selectedOwners.size;
        if (state.minCopies > 1) count += 1;

        if (count > 0) {
            elements.filterBadgeCounter.textContent = count;
            elements.filterBadgeCounter.style.display = 'inline-block';
            elements.filtersToggleBtn.classList.add('active');
        } else {
            elements.filterBadgeCounter.style.display = 'none';
            elements.filtersToggleBtn.classList.remove('active');
        }
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
        const u1 = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${app.appid}/capsule_sm_120.jpg`;
        const u2 = `https://cdn.akamai.steamstatic.com/steam/apps/${app.appid}/capsule_231x87.jpg`;
        const u3 = `https://cdn.akamai.steamstatic.com/steam/apps/${app.appid}/header.jpg`;
        
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
                     onerror="if (this.dataset.fallback === '1') { this.dataset.fallback = '2'; this.src = '${u2}'; } else if (this.dataset.fallback === '2') { this.dataset.fallback = '3'; this.src = '${u3}'; } else { this.style.display='none'; this.nextElementSibling.style.display='inline-flex'; }">
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

        // Mode Filters
        document.querySelectorAll('.filter-chip[data-mode]').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                const mode = chip.getAttribute('data-mode');
                const chk = chip.querySelector('input');
                if (state.selectedModes.has(mode)) {
                    state.selectedModes.delete(mode);
                    chip.classList.remove('active');
                    if (chk) chk.checked = false;
                } else {
                    state.selectedModes.add(mode);
                    chip.classList.add('active');
                    if (chk) chk.checked = true;
                }
                updateFilterCounter();
                applyFilters();
            });
        });

        // Copies Filter
        document.querySelectorAll('.filter-chip[data-copies]').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.filter-chip[data-copies]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const val = chip.getAttribute('data-copies');
                state.minCopies = val === 'all' ? 1 : parseInt(val, 10);
                updateFilterCounter();
                applyFilters();
            });
        });

        // Reset Filters Button
        elements.resetFiltersBtn.addEventListener('click', () => {
            state.selectedModes.clear();
            state.selectedOwners.clear();
            state.minCopies = 1;
            state.searchQuery = '';
            elements.searchInput.value = '';
            elements.searchClearBtn.style.display = 'none';

            document.querySelectorAll('.filter-chip[data-mode]').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('#owner-filters-container .filter-chip').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.filter-chip[data-copies]').forEach(c => {
                c.classList.toggle('active', c.getAttribute('data-copies') === 'all');
            });

            updateFilterCounter();
            applyFilters();
        });

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
