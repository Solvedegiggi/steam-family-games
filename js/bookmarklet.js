/**
 * Bookmarklet Generator for Steam Family Games
 * Extracts family members and shared games directly from Steam session without CORS issues.
 */

window.generateBookmarkletCode = function(targetSiteUrl) {
    // Note: We avoid { credentials: 'include' } for api.steampowered.com because Steam's
    // CORS headers allow origin https://store.steampowered.com, but omit Access-Control-Allow-Credentials.
    const rawScript = `(async function() {
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
            hud.style.padding = '18px 22px';
            hud.style.borderRadius = '8px';
            hud.style.boxShadow = '0 10px 32px rgba(0,0,0,0.85), 0 0 0 1px #66c0f4';
            hud.style.fontFamily = 'system-ui, -apple-system, sans-serif';
            hud.style.fontSize = '14px';
            hud.style.maxWidth = '380px';
            document.body.appendChild(hud);
        }
        function updateHud(html) {
            hud.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><span style="font-size:20px;">🎮</span><strong style="color:#66c0f4;font-size:16px;">Steam Family Sync</strong></div><div>' + html + '</div>';
        }

        try {
            updateHud('Connecting to Steam session...');
            let token = window.g_session?.m_strOAuthToken;
            let currentSteamId = window.g_session?.m_steamid ? String(window.g_session.m_steamid) : null;
            let currentPersona = window.g_session?.m_strPersonaName || null;

            if (!token) {
                // Fetch WebAPI token from same-origin store config
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
            // DO NOT use { credentials: 'include' } here to prevent browser CORS credential blocking
            const guResp = await fetch(groupUserUrl);
            if (!guResp.ok) {
                throw new Error('Failed to retrieve Family Group (HTTP ' + guResp.status + ')');
            }
            const guData = await guResp.json();
            const familyGroupId = guData?.response?.family_groupid;

            if (!familyGroupId) {
                updateHud('<span style="color:#ffb86c;font-weight:600;">No Steam Family Group found.</span><br><small>This account is not currently a member of a Steam Family.</small>');
                return;
            }

            updateHud('Retrieving family members...');
            const groupUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroup/v1/?access_token=' + encodeURIComponent(token) + '&family_groupid=' + encodeURIComponent(familyGroupId);
            const gResp = await fetch(groupUrl);
            const gData = await gResp.json();
            
            // Steam returns response: { name: "...", members: [...] }
            const familyName = gData?.response?.name || 'Steam Family';
            const rawMembers = gData?.response?.members || [];

            // Detect names from page DOM if user is on /account/familymanagement
            const domProfiles = {};
            try {
                document.querySelectorAll('a[href*="/profiles/"], a[href*="/id/"]').forEach(a => {
                    const href = a.getAttribute('href') || '';
                    const img = a.querySelector('img');
                    const text = a.textContent?.trim();
                    const match = href.match(/profiles\\/(\\d+)/);
                    if (match && match[1]) {
                        domProfiles[match[1]] = {
                            name: text || null,
                            avatar: img?.src || null
                        };
                    }
                });
            } catch(e){}

            // Build member profiles
            const memberProfiles = rawMembers.map((m, idx) => {
                const sid = String(m.steamid);
                let pName = 'Family Member ' + (idx + 1);
                let pAvatar = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';

                if (sid === currentSteamId && currentPersona) {
                    pName = currentPersona;
                } else if (domProfiles[sid]?.name) {
                    pName = domProfiles[sid].name;
                }

                if (domProfiles[sid]?.avatar) {
                    pAvatar = domProfiles[sid].avatar;
                }

                return {
                    steamid: sid,
                    role: m.role || 1,
                    name: pName,
                    avatar_url: pAvatar,
                    profile_url: 'https://steamcommunity.com/profiles/' + sid
                };
            });

            updateHud('Downloading shared library apps...');
            const appsUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetSharedLibraryApps/v1/?access_token=' + encodeURIComponent(token) + '&family_groupid=' + encodeURIComponent(familyGroupId) + '&include_own=true&include_excluded=false&include_non_games=false';
            const aResp = await fetch(appsUrl);
            const aData = await aResp.json();
            const rawApps = aData?.response?.apps || [];

            const formattedApps = rawApps.map(app => ({
                appid: app.appid,
                name: app.name,
                owner_steamids: (app.owner_steamids || []).map(String)
            }));

            const finalPayload = {
                family_groupid: familyGroupId,
                name: familyName,
                members: memberProfiles,
                apps: formattedApps,
                exported_at: Date.now()
            };

            const jsonStr = JSON.stringify(finalPayload);
            const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
            const targetUrl = '${targetSiteUrl}';

            updateHud('<span style="color:#5cd273;font-weight:600;">✓ Synced Successfully!</span><br>' + formattedApps.length + ' games found across ' + memberProfiles.length + ' members.<br><br>Transferring back to dashboard...');

            // Always copy to clipboard as instant safe backup
            try {
                await navigator.clipboard.writeText(jsonStr);
            } catch(e){}

            // If under 25KB, pass through URL hash; otherwise download file & open dashboard
            if (b64.length < 24000) {
                setTimeout(() => {
                    window.open(targetUrl + '#import=' + encodeURIComponent(b64), '_blank');
                }, 800);
            } else {
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = 'family_games.json';
                a.click();
                URL.revokeObjectURL(blobUrl);

                setTimeout(() => {
                    window.open(targetUrl, '_blank');
                }, 800);
            }
        } catch (err) {
            console.error('Steam Family Sync Error:', err);
            updateHud('<span style="color:#ff6b6b;font-weight:600;">Sync Error:</span> ' + (err.message || 'Failed to sync. Make sure you are logged into store.steampowered.com'));
        }
    })();`;

    return {
        raw: rawScript,
        bookmarkletUrl: 'javascript:' + encodeURIComponent(rawScript.replace(/\s+/g, ' ').trim())
    };
};
