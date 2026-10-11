# 🎮 steamgames — Steam Family Library Explorer

A sleek, **SteamDB-inspired** web application to view, search, and filter games owned across your **Steam Family Group**.

Hosted 100% statically on **GitHub Pages** with zero backends, zero external proxies, and complete privacy.

---

## ✨ Features

- **SteamDB-Style Interface:** Dark, high-contrast, clean responsive dashboard.
- **Multiplayer & Mode Badges:** Instant tags for *Single-player*, *Multiplayer*, *Co-op*, *Local MP*, and *PvP*.
- **Family Member Tracking:**
  - Owner profile pictures (pfps) for each copy owned.
  - Hover tooltip displays the member's Steam name.
  - Clicking an avatar opens their official Steam profile in a new tab.
- **Copy Counts & Sorting:** 
  - Easily see how many copies your family group owns.
  - Sort by game title (A–Z / Z–A) and number of copies.
  - Filter by minimum copies (e.g. $\ge 2$ copies) to find games you can play together!
- **Fast Search & Multi-Filters:** Instant search by title, filter by player modes, and filter by specific family members.
- **Smooth Infinite Scrolling:** Lazy-loads rows as you scroll, maintaining 60fps performance even for libraries with thousands of games.
- **1-Click Bookmarklet Sync:**
  - Drag the bookmark link to your browser's bookmarks bar.
  - Click it while on Steam (`store.steampowered.com`) to automatically sync your family library with 0 manual token hunting!
  - Also supports manual JSON drag-and-drop / paste backup.

---

## 🚀 How to Host on GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<your-username>/steam-family-games.git
   git push -u origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** &rarr; **Pages**.
   - Under **Build and deployment** &rarr; **Source**, select **Deploy from a branch**.
   - Choose branch **`main`** and folder **`/ (root)`**.
   - Click **Save**.
3. Your site will be live at:
   `https://<your-username>.github.io/steam-family-games/`

---

## 🕹️ How to Sync Your Family Library

1. Open your hosted site (or local server).
2. Click **Sync / Login** in the top navigation bar.
3. Drag the **⭐ Sync Steam Family** button to your browser's Bookmarks Bar.
4. Navigate to [store.steampowered.com](https://store.steampowered.com) (make sure you are logged in).
5. Click your **Sync Steam Family** bookmark.
6. The script will securely fetch your family group details and redirect you straight back with your complete library loaded!

---

## 🛠️ Project Structure

```
steam-family-games/
├── index.html                  # Main application markup & UI wireframe
├── css/
│   └── style.css               # SteamDB-inspired dark mode styling
├── js/
│   ├── app.js                  # Table rendering, infinite scroll, filtering & sorting
│   ├── bookmarklet.js          # Steam Family API sync bookmarklet generator
│   ├── categories-service.js   # Precompiled metadata service & local caching
│   └── demo-data.js            # Offline preview data for testing
├── data/
│   └── categories.json         # Precompiled mapping of AppIDs to player modes
├── scripts/
│   └── build_categories.py     # Utility to refresh/expand popular games metadata
└── README.md
```
