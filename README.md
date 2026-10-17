# 🎮 Steam Family Games

A sleek, **SteamDB-inspired** web application to view, search, and filter games owned across your **Steam Family Group**.

🔗 **Live Website:** [https://solvedegiggi.github.io/steam-family-games/](https://solvedegiggi.github.io/steam-family-games/)

Hosted 100% statically on **GitHub Pages** with zero backends, zero external proxies, and complete privacy.

---

## ✨ Features

- **SteamDB-Style Interface:** Dark, high-contrast, clean responsive dashboard with game capsules, player mode tags, copies count, and instant Steam Store / SteamDB links.
- **Advanced Tri-State Filtering:**
  - **Player Modes:** Filter by *Single-player*, *Multiplayer*, *Co-op*, *Local MP*, *PvP*, and *Crossplay*.
  - **Availability:** Filter *Shareable* vs *Not Shareable* and *Free to Play* games.
  - **Tri-State Logic:** Supports **Include** (`✓`), **Exclude** (`✕`), **Default** (`—`), and **Exclusive** (`✓✓`) filter states.
- **Family Member Tracking & Customization:**
  - Owner profile pictures (pfps) for each copy owned with copy counts.
  - **Custom Member Nicknames:** Click any avatar in the top-right status bar to assign a custom nickname (stored in local browser storage).
  - **Active User Selection:** Right-click an avatar to designate your active profile.
  - Filter games owned by specific members with tri-state rules.
- **Copies Selector:**
  - Filter by minimum copies owned (*Any (1+)*, *2+*, *3+*, *4+*, *5+*, *6 copies*) to quickly spot games ready for group multiplayer sessions!
- **Fast Search & Sorting:**
  - Instant live search by title.
  - Sortable columns: Game Name (A–Z / Z–A) and Copies (High–Low / Low–High).
- **Multilingual Support (i18n):**
  - Full interface translation in **English** and **Italian**.
  - Flag dropdown switcher with automatic browser language detection.
- **Smooth Infinite Scrolling:**
  - Virtualized lazy-loading with `IntersectionObserver` maintaining 60fps performance across libraries with 2,000+ games.
- **Zero-Backend 1-Click Bookmarklet Sync:**
  - Drag the bookmarklet link directly to your browser's bookmarks bar.
  - Click it while logged into Steam (`store.steampowered.com`) to automatically sync your family library and redirect straight back with zero manual token hunting.
  - Includes Console Snippet and manual JSON file drag-and-drop / backup export.

---

## 🕹️ How to Sync Your Family Library

1. Visit the live site: [https://solvedegiggi.github.io/steam-family-games/](https://solvedegiggi.github.io/steam-family-games/)
2. Click **Sync / Login** in the top navigation bar.
3. Drag the **🔄 Sync Steam Family Games** button to your browser's Bookmarks Bar.
4. Navigate to [store.steampowered.com](https://store.steampowered.com) in your browser (make sure you are logged in).
5. Click your **Sync Steam Family Games** bookmark.
6. The bookmarklet securely reads your active Steam session, pulls the family group data and member profiles, and automatically redirects you back to the app with your entire library loaded!

> [!TIP]
> **Manual Import Fallback:** You can also copy the snippet from the *Console Snippet* tab into your browser console on Steam, or import a saved `family_games.json` backup file via the *Drop JSON File* tab.

---

## 🔒 Privacy & Security

- **100% Client-Side:** All computation, filtering, and rendering happens entirely within your web browser.
- **No External Servers or Databases:** No Steam credentials, session tokens, or personal library data are ever sent to external proxies or third-party servers.
- **Local Persistence:** Your family library and custom member nicknames are stored only in your browser's `localStorage`.
- **Easy Reset:** You can clear saved data at any time via the **Clear saved data** button in the sync modal.

---

## 🛠️ Project Structure

```
steam-family-games/
├── index.html                  # Main application markup & dashboard layout
├── css/
│   └── style.css               # SteamDB-inspired dark mode styling & responsive layout
├── js/
│   ├── app.js                  # Table rendering, filtering, sorting, infinite scroll & state
│   ├── bookmarklet.js          # Steam session sync bookmarklet generator
│   ├── categories-service.js   # Precompiled metadata service & local caching
│   ├── demo-data.js            # Sample family dataset for offline exploration
│   └── i18n.js                 # Multilingual translation engine (EN / IT)
├── lang/
│   ├── en.json                 # English translation dictionary
│   └── it.json                 # Italian translation dictionary
├── assets/
│   ├── steam_logo.svg          # Steam brand icon
│   ├── steamdb_logo.svg        # SteamDB external link icon
│   ├── sync logo.svg           # Bookmarklet & sync icon
│   └── flags/
│       ├── en.svg              # English language flag
│       └── it.svg              # Italian language flag
├── data/
│   └── categories.json         # Precompiled mapping of Steam AppIDs to multiplayer categories
├── scripts/
│   └── build_categories.py     # Python utility to expand/refresh the categories database
└── README.md                   # Project documentation
```
