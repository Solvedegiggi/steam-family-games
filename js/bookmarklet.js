/**
 * Bookmarklet Generator for Steam Family Games
 * Extracts family members, avatars, and shared games directly from Steam session.
 */

window.generateBookmarkletCode = function(targetSiteUrl) {
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
            hud.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:22px;">🎮</span><strong style="color:#66c0f4;font-size:16px;">Steam Family Sync</strong></div><div>' + html + '</div>';
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

            // Fetch member personas & avatars using ISteamUser/GetPlayerSummaries with access token
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

            // Build member list
            const memberProfiles = rawMembers.map((m, idx) => {
                const sid = String(m.steamid);
                const info = playerSummariesMap[sid] || {};
                return {
                    steamid: sid,
                    role: m.role || 1,
                    name: info.name || ('Family Member ' + (idx + 1)),
                    avatar_url: info.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg',
                    profile_url: info.profileurl || ('https://steamcommunity.com/profiles/' + sid)
                };
            });

            updateHud('Downloading shared library apps...');
            const appsUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetSharedLibraryApps/v1/?access_token=' + encodeURIComponent(token) + '&family_groupid=' + encodeURIComponent(familyGroupId) + '&include_own=true&include_excluded=true&include_non_games=false';
            const aResp = await fetch(appsUrl);
            const aData = await aResp.json();
            const rawApps = aData?.response?.apps || [];

            const formattedApps = rawApps.map(app => ({
                appid: app.appid,
                name: app.name,
                owner_steamids: (app.owner_steamids || []).map(String),
                exclude_reason: app.exclude_reason || 0
            }));

            const finalPayload = {
                family_groupid: familyGroupId,
                name: familyName,
                members: memberProfiles,
                apps: formattedApps,
                exported_at: Date.now()
            };

            const jsonStr = JSON.stringify(finalPayload);
            const targetUrl = '${targetSiteUrl}';

            // Compress payload using native browser gzip compression
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

            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(jsonStr);
            } catch(e){}

            const redirectUrl = targetUrl + '#import=' + encodeURIComponent(encodedPayload);

            updateHud(
                '<div style="color:#5cd273;font-weight:700;font-size:15px;margin-bottom:6px;">✓ Synced ' + formattedApps.length + ' Games!</div>' +
                '<div style="color:#c6d4df;font-size:13px;margin-bottom:12px;">Across ' + memberProfiles.length + ' family members (' + memberProfiles.map(m => m.name).join(', ') + ').</div>' +
                '<a id="steam-sync-open-btn" href="' + redirectUrl + '" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;text-align:center;padding:10px 16px;background:linear-gradient(135deg,#1a9fff,#0d47a1);color:#ffffff;font-weight:700;font-size:14px;border-radius:6px;text-decoration:none;box-shadow:0 4px 12px rgba(26,159,255,0.4);">' +
                    '🚀 Open Steam Family Games Dashboard' +
                '</a>'
            );

            // Attempt automatic open
            try {
                window.open(redirectUrl, '_blank');
            } catch(e){}

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
