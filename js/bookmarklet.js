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
            hud.style.top = '20px';
            hud.style.right = '20px';
            hud.style.zIndex = '999999';
            hud.style.background = '#171a21';
            hud.style.color = '#c6d4df';
            hud.style.padding = '16px 20px';
            hud.style.borderRadius = '8px';
            hud.style.boxShadow = '0 8px 24px rgba(0,0,0,0.8), 0 0 0 1px #66c0f4';
            hud.style.fontFamily = 'system-ui, -apple-system, sans-serif';
            hud.style.fontSize = '14px';
            hud.style.maxWidth = '360px';
            document.body.appendChild(hud);
        }
        function updateHud(html) {
            hud.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;"><span style="font-size:18px;">🎮</span><strong style="color:#66c0f4;font-size:15px;">Steam Family Sync</strong></div><div>' + html + '</div>';
        }

        try {
            updateHud('Connecting to Steam session...');
            let token = window.g_session?.m_strOAuthToken;
            let currentSteamId = window.g_session?.m_steamid;

            if (!token) {
                const cfgResp = await fetch('/pointssummary/ajaxgetasyncconfig', { credentials: 'include' });
                if (cfgResp.ok) {
                    const cfgData = await cfgResp.json();
                    token = cfgData?.data?.webapi_token;
                    currentSteamId = cfgData?.data?.steamid;
                }
            }

            if (!token) {
                updateHud('<span style="color:#ff6b6b;">Error: Could not retrieve Steam session token.</span><br><small>Make sure you are logged in to store.steampowered.com!</small>');
                return;
            }

            updateHud('Fetching Steam Family Group details...');
            const groupUserUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/?access_token=' + encodeURIComponent(token);
            const guResp = await fetch(groupUserUrl, { credentials: 'include' });
            const guData = await guResp.json();
            const familyGroupId = guData?.response?.family_groupid;

            if (!familyGroupId) {
                updateHud('<span style="color:#ffb86c;">No Steam Family Group found for this account.</span>');
                return;
            }

            updateHud('Retrieving family members...');
            const groupUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroup/v1/?access_token=' + encodeURIComponent(token) + '&family_groupid=' + encodeURIComponent(familyGroupId);
            const gResp = await fetch(groupUrl, { credentials: 'include' });
            const gData = await gResp.json();
            const familyInfo = gData?.response?.family_group || {};
            const rawMembers = familyInfo.members || [];

            // Resolve player names & avatars
            const memberProfiles = [];
            for (const m of rawMembers) {
                const sid = String(m.steamid);
                let personaName = 'Family Member';
                let avatarUrl = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';

                // Try reading profile data from Steam page if present
                try {
                    const profileResp = await fetch('https://steamcommunity.com/profiles/' + sid + '/?xml=1', { credentials: 'include' });
                    if (profileResp.ok) {
                        const xmlText = await profileResp.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(xmlText, 'text/xml');
                        const pName = doc.querySelector('steamID')?.textContent;
                        const pAvatar = doc.querySelector('avatarMedium')?.textContent || doc.querySelector('avatarIcon')?.textContent;
                        if (pName) personaName = pName;
                        if (pAvatar) avatarUrl = pAvatar;
                    }
                } catch(e) {
                    console.warn('Could not fetch XML for ' + sid, e);
                }

                memberProfiles.push({
                    steamid: sid,
                    role: m.role,
                    name: personaName,
                    avatar_url: avatarUrl,
                    profile_url: 'https://steamcommunity.com/profiles/' + sid
                });
            }

            updateHud('Downloading shared library apps...');
            const appsUrl = 'https://api.steampowered.com/IFamilyGroupsService/GetSharedLibraryApps/v1/?access_token=' + encodeURIComponent(token) + '&family_groupid=' + encodeURIComponent(familyGroupId) + '&include_own=true&include_excluded=false&include_non_games=false';
            const aResp = await fetch(appsUrl, { credentials: 'include' });
            const aData = await aResp.json();
            const rawApps = aData?.response?.apps || [];

            const formattedApps = rawApps.map(app => ({
                appid: app.appid,
                name: app.name,
                owner_steamids: (app.owner_steamids || []).map(String)
            }));

            const finalPayload = {
                family_groupid: familyGroupId,
                name: familyInfo.name || 'Steam Family',
                members: memberProfiles,
                apps: formattedApps,
                exported_at: Date.now()
            };

            const jsonStr = JSON.stringify(finalPayload);
            const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
            const targetUrl = '${targetSiteUrl}';

            updateHud('<span style="color:#5cd273;font-weight:600;">Done!</span> Synced ' + formattedApps.length + ' games across ' + memberProfiles.length + ' members.<br><br>Transferring data back to your dashboard...');

            // If payload fits safely in URL hash, open automatically
            if (b64.length < 24000) {
                window.open(targetUrl + '#import=' + encodeURIComponent(b64), '_blank');
            } else {
                // Download file as fail-safe for huge libraries
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = 'family_games.json';
                a.click();
                URL.revokeObjectURL(blobUrl);

                // Also copy to clipboard
                try {
                    await navigator.clipboard.writeText(jsonStr);
                } catch(e){}

                updateHud('<span style="color:#5cd273;">Export complete!</span> Large library: <strong>family_games.json</strong> has been downloaded and copied to clipboard.<br><br><a href="' + targetUrl + '" target="_blank" style="color:#66c0f4;text-decoration:underline;">Click here to return to your dashboard and drop the file</a>');
            }
        } catch (err) {
            console.error('Steam Family Sync Error:', err);
            updateHud('<span style="color:#ff6b6b;">Error:</span> ' + (err.message || 'Failed to sync. Make sure you are logged in to Steam.'));
        }
    })();`;

    return {
        raw: rawScript,
        bookmarkletUrl: 'javascript:' + encodeURIComponent(rawScript.replace(/\s+/g, ' ').trim())
    };
};
