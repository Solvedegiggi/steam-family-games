/**
 * Bookmarklet & Console Snippet Generator for Steam Family Games
 * Extracts family members, avatars, and shared games directly from Steam session.
 */

window.generateBookmarkletCode = function(targetSiteUrl) {
    const rawScript = `(async function() {
    if (!location.hostname.includes('steampowered.com')) {
        if (confirm('👉 To sync your Steam Family library, this bookmark runs on store.steampowered.com where your Steam session is active.\n\nClick OK to go to store.steampowered.com now, then click this bookmark again to sync!')) {
            window.location.href = 'https://store.steampowered.com';
        }
        return;
    }

    const HUD_ID = 'steam-family-sync-hud';
    let hud = document.getElementById(HUD_ID);
    if (!hud) {
        hud = document.createElement('div');
        hud.id = HUD_ID;
        hud.style.position = 'fixed';
        hud.style.top = '24px';
        hud.style.right = '24px';
        hud.style.zIndex = '9999999';
        hud.style.background = '#171a21';
        hud.style.color = '#c6d4df';
        hud.style.padding = '18px 24px';
        hud.style.borderRadius = '8px';
        hud.style.boxShadow = '0 10px 36px rgba(0,0,0,0.85), 0 0 0 1px #66c0f4';
        hud.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        hud.style.fontSize = '14px';
        hud.style.maxWidth = '400px';
        hud.style.lineHeight = '1.5';
        document.body.appendChild(hud);
    }
    function updateHud(html) {
        hud.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><svg width="22" height="22" viewBox="0 0 24 24" fill="#66c0f4" style="flex-shrink:0;"><path d="M12,4L12,1L8,5L12,9L12,6C15.31,6 18,8.69 18,12C18,13.01 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12C20,7.58 16.42,4 12,4ZM12,18C8.69,18 6,15.31 6,12C6,10.99 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12C4,16.42 7.58,20 12,20L12,23L16,19L12,15L12,18Z"/></svg><strong style="color:#66c0f4;font-size:16px;">Steam Family Games — Sync</strong></div><div>' + html + '</div>';
    }

    try {
        updateHud('Connecting to Steam session...');
        let token = window.g_session?.m_strOAuthToken;
        let currentSteamId = window.g_session?.m_steamid ? String(window.g_session.m_steamid) : null;

        if (!token) {
            const cfgResp = await fetch('/pointssummary/ajaxgetasyncconfig');
            if (cfgResp.ok) {
                const cfgData = await cfgResp.json();
                token = cfgData?.data?.webapi_token;
                if (!currentSteamId) currentSteamId = cfgData?.data?.steamid ? String(cfgData.data.steamid) : null;
            }
        }

        if (!token) {
            updateHud('<span style="color:#ff6b6b;font-weight:600;">Error: Could not retrieve Steam session.</span><br><small>Please log into <a href="/login" style="color:#66c0f4;">store.steampowered.com</a> and try again.</small>');
            return;
        }

        updateHud('Fetching Steam Family Group details...');
        const groupUserUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/?access_token=' + encodeURIComponent(token);
        const guResp = await fetch(groupUserUrl);
        if (!guResp.ok) {
            throw new Error('Failed to retrieve Family Group (HTTP ' + guResp.status + ')');
        }
        const guData = await guResp.json();
        const familyGroupId = guData?.response?.family_groupid;

        if (!familyGroupId) {
            updateHud('<span style="color:#ffb86c;font-weight:600;">No Steam Family Group found.</span><br><small>This account is not in a Steam Family.</small>');
            return;
        }

        updateHud('Retrieving family members &amp; avatars...');
        const groupUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroup/v1/?access_token=' + encodeURIComponent(token) + '&family_groupid=' + encodeURIComponent(familyGroupId);
        const gResp = await fetch(groupUrl);
        const gData = await gResp.json();
        
        const familyName = gData?.response?.name || 'Steam Family';
        const rawMembers = gData?.response?.members || [];
        const memberIds = rawMembers.map(m => String(m.steamid));

        let playerSummariesMap = {};
        if (memberIds.length > 0) {
            try {
                const summariesUrl = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=&access_token=' + encodeURIComponent(token) + '&steamids=' + encodeURIComponent(memberIds.join(','));
                const sumResp = await fetch(summariesUrl);
                if (sumResp.ok) {
                    const sumData = await sumResp.json();
                    (sumData?.response?.players || []).forEach(p => {
                        playerSummariesMap[String(p.steamid)] = {
                            name: p.personaname,
                            avatar: p.avatarfull || p.avatarmedium || p.avatar,
                            profileurl: p.profileurl
                        };
                    });
                }
            } catch(e) {
                console.warn('Could not fetch player summaries:', e);
            }
        }

        const memberProfiles = rawMembers.map((m, idx) => {
            const sid = String(m.steamid);
            const info = playerSummariesMap[sid] || {};
            return {
                steamid: sid,
                role: m.role || 1,
                name: info.name || ('Family Member ' + (idx + 1)),
                avatar_url: info.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg',
                profile_url: info.profileurl || ('https://steamcommunity.com/profiles/' + sid),
                is_current_user: sid === currentSteamId
            };
        });

        updateHud('Downloading shared library apps...');
        const appsUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetSharedLibraryApps/v1/?access_token=' + encodeURIComponent(token) + '&family_groupid=' + encodeURIComponent(familyGroupId) + '&include_own=true&include_excluded=true&include_free=true&include_non_games=false';
        const aResp = await fetch(appsUrl);
        const aData = await aResp.json();
        const rawApps = aData?.response?.apps || [];

        updateHud('Resolving official game capsule art &amp; player tags...');
        let assetMap = {};
        let categoriesMap = {};
        if (rawApps.length > 0) {
            try {
                const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
                const uniqueAppIds = Array.from(new Set(rawApps.map(a => Number(a.appid)).filter(Boolean)));
                const chunks = chunkArray(uniqueAppIds, 80);
                await Promise.all(chunks.map(async (chunk) => {
                    const payload = {
                        ids: chunk.map(id => ({ appid: id })),
                        context: { language: 'english', country_code: 'US' },
                        data_request: { include_assets: true, include_categories: true }
                    };
                    const url = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?access_token=' + encodeURIComponent(token) + '&input_json=' + encodeURIComponent(JSON.stringify(payload));
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        (data?.response?.store_items || []).forEach(item => {
                            const assets = item.assets;
                            if (assets) {
                                const relPath = assets.small_capsule || assets.header || assets.main_capsule;
                                if (relPath) {
                                    assetMap[item.id] = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + item.id + '/' + relPath;
                                }
                            }
                            if (item.categories) {
                                const cIds = new Set([
                                    ...(item.categories.supported_player_categoryids || []),
                                    ...(item.categories.feature_categoryids || [])
                                ]);
                                const tags = [];
                                if (cIds.has(2)) tags.push('singleplayer');
                                if (cIds.has(1) || cIds.has(36) || cIds.has(38) || cIds.has(49) || cIds.has(9) || cIds.has(24) || cIds.has(37) || cIds.has(39)) tags.push('multiplayer');
                                if (cIds.has(9) || cIds.has(38) || cIds.has(39) || cIds.has(48)) tags.push('coop');
                                if (cIds.has(24) || cIds.has(37) || cIds.has(39) || cIds.has(44) || cIds.has(47) || cIds.has(48)) tags.push('local_mp');
                                if (cIds.has(49) || cIds.has(36) || cIds.has(37) || cIds.has(47)) tags.push('pvp');
                                if (cIds.has(27)) tags.push('crossplay');
                                if (tags.length > 0) {
                                    categoriesMap[item.id] = tags;
                                }
                            }
                        });
                    }
                }));
            } catch(e) {
                console.warn('Could not fetch store assets/categories:', e);
            }
        }

        /* Deduplicate and merge multiple license records by appid (unions all owners) */
        const appMap = new Map();
        rawApps.forEach(app => {
            const id = Number(app.appid);
            if (!appMap.has(id)) {
                appMap.set(id, {
                    appid: id,
                    name: app.name,
                    owner_steamids: new Set((app.owner_steamids || []).map(String)),
                    exclude_reason: app.exclude_reason || 0,
                    capsule_url: assetMap[id] || null,
                    categories: categoriesMap[id] || []
                });
            } else {
                const existing = appMap.get(id);
                (app.owner_steamids || []).forEach(sid => existing.owner_steamids.add(String(sid)));
                if (existing.exclude_reason !== 0 && app.exclude_reason === 0) {
                    existing.exclude_reason = 0;
                }
                if (!existing.capsule_url && assetMap[id]) {
                    existing.capsule_url = assetMap[id];
                }
                if ((!existing.categories || existing.categories.length === 0) && categoriesMap[id]) {
                    existing.categories = categoriesMap[id];
                }
            }
        });

        const formattedApps = Array.from(appMap.values()).map(app => ({
            ...app,
            owner_steamids: Array.from(app.owner_steamids)
        }));

        const finalPayload = {
            family_groupid: familyGroupId,
            name: familyName,
            current_user_steamid: currentSteamId,
            members: memberProfiles,
            apps: formattedApps,
            categories: categoriesMap,
            exported_at: Date.now()
        };

        const jsonStr = JSON.stringify(finalPayload);
        const targetUrl = '${targetSiteUrl}';

        let encodedPayload = '';
        try {
            if (typeof CompressionStream !== 'undefined') {
                const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
                const buffer = await new Response(stream).arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                encodedPayload = 'gz:' + btoa(binary);
            } else {
                encodedPayload = 'raw:' + btoa(unescape(encodeURIComponent(jsonStr)));
            }
        } catch(e) {
            encodedPayload = 'raw:' + btoa(unescape(encodeURIComponent(jsonStr)));
        }

        try {
            await navigator.clipboard.writeText(jsonStr);
        } catch(e){}

        const redirectUrl = targetUrl + '#import=' + encodeURIComponent(encodedPayload);

        updateHud(
            '<div style="color:#5cd273;font-weight:700;font-size:15px;margin-bottom:6px;">✓ Synced ' + formattedApps.length + ' Games!</div>' +
            '<div style="color:#c6d4df;font-size:13px;margin-bottom:12px;">Across ' + memberProfiles.length + ' family members (' + memberProfiles.map(m => m.name).join(', ') + ').</div>' +
            '<a id="steam-sync-open-btn" href="' + redirectUrl + '" style="display:inline-block;width:100%;box-sizing:border-box;text-align:center;padding:10px 16px;background:linear-gradient(135deg,#1a9fff,#0d47a1);color:#ffffff;font-weight:700;font-size:14px;border-radius:6px;text-decoration:none;box-shadow:0 4px 12px rgba(26,159,255,0.4);">' +
                '🚀 Returning to Steam Family Games...' +
            '</a>'
        );

        try {
            window.location.href = redirectUrl;
        } catch(e){}

    } catch (err) {
        console.error('Steam Family Sync Error:', err);
        updateHud('<span style="color:#ff6b6b;font-weight:600;">Sync Error:</span> ' + (err.message || 'Failed to sync. Make sure you are logged into store.steampowered.com'));
    }
})();`;

    // Strip comments defensively before flattening whitespace
    const sanitizedScript = rawScript
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//')) return '';
            return line;
        })
        .join('\n');

    return {
        raw: rawScript,
        bookmarkletUrl: 'javascript:' + encodeURIComponent(sanitizedScript.replace(/\s+/g, ' ').trim())
    };
};
