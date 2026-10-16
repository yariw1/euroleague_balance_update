# EuroLeague Balance

A small personal phone app that compares this season's EuroLeague results (2026-27) of **Hapoel Tel Aviv** and **Maccabi Tel Aviv** with the same games last season (2025-26).

It's a web app (PWA). You install it from Chrome on Android and it works like a regular app, including offline.

## How the balance works

Each team plays 38 regular-season games: every opponent once at home and once away. Each game entered this season is compared with last season's game against the same opponent at the same location:

| Last season | This season | Balance |
|---|---|---|
| Win | Win | 0 |
| Loss | Loss | 0 |
| Loss | Win | **+1** |
| Win | Loss | **−1** |

The team balance is the sum over all games played so far this season.

**Monaco/Besiktas:** Besiktas replaced Monaco in the league, so this season's Besiktas games are compared with last season's Monaco games. The app shows that opponent as "Monaco/Besiktas".

Only regular-season games are tracked. Play-in and playoff games aren't included.

## Screens

- **Balance**: each team's current balance and how many games were better, worse or the same. Also has the backup buttons.
- **Add**: choose team, opponent, home/away and win/loss (score optional). It shows last season's result and the effect on the balance before you save.
- **Look up**: pick any game to see both seasons side by side.
- **Table**: all 38 games for a team, sorted by opponent or by last season's date. Tap a row to add, edit or delete this season's result.

## Your data and privacy

- This season's results are saved **only on the phone**, in Chrome's storage for this site. They are never uploaded anywhere.
- Anyone else who opens the link gets an empty app and can't see or change your data.
- The code and last season's results are public on GitHub. They contain nothing personal.

### Backups

Clearing Chrome's data, uninstalling the app or changing phones deletes the saved results. To protect them:

- **Export backup** (Balance screen) creates a `.json` file. Save it to Google Drive from the share menu.
- **Import backup** restores a backup file. It replaces the results currently on the phone and asks you to confirm first.

The Balance screen shows how long ago the last backup was made.

## Installing on Android

1. Open the app's GitHub Pages address in **Chrome**.
2. Tap **⋮** → **Install app** (or **Add to Home screen**).
3. Open it from the new home-screen icon.

## Files

| File | Purpose |
|---|---|
| `index.html` | The app's screens |
| `app.js` | App logic: balance calculation, saving, backup |
| `style.css` | Look and layout (light and dark mode) |
| `data-2025-26.js` | Last season's 76 results and the Monaco → Besiktas mapping |
| `manifest.webmanifest` | App name, icon and colors for installing |
| `sw.js` | Keeps a copy of the app on the phone so it opens offline |
| `icons/` | App icons |

## Updating the app

After changing any file, change the version in `sw.js` (for example `elb-v3` → `elb-v4`) and upload the changed files to GitHub. Phones then pick up the new version the next time the app is opened with internet (sometimes it takes a second open). Saved results aren't affected.

## Data source

Last season's results come from Wikipedia's "2025–26 EuroLeague regular season" page. Home and away are taken from the official EuroLeague game links. The results were checked against the final standings (Hapoel 23-15, Maccabi 18-20) and reviewed by hand.
