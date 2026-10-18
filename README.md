# Labubu: Blind Box Run & Collect

An offline-first, cross-platform mobile game built with **Phaser 3**, **Vite** and **Capacitor**.
It combines an endless runner, a Pop Mart-style blind box gacha with pity, a wardrobe whose
costumes grant gameplay perks, an idle coin bank and a daily/weekly quest engine. When a
connection is available it syncs to **Supabase** or a **custom REST** backend.

Every sprite is drawn at runtime with Phaser Graphics and the Canvas 2D API, and every sound is
synthesized with the Web Audio API. The repo contains no image or audio files.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server (http://localhost:5173, also exposed on your LAN for phone testing)
npm run dev

# 3. Unit tests (gacha odds and pity, idle math, quests, sync conflict resolution, saves)
npm test

# 4. Production build -> dist/
npm run build
npm run preview
```

### Optional: cloud sync

```bash
cp .env.example .env
# Supabase: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, run supabase/schema.sql,
#           and enable "Allow anonymous sign-ins" under Authentication -> Providers.
# REST:     set VITE_SYNC_REST_URL, e.g. against the bundled reference server:
node server/rest-sync-server.js          # http://localhost:8787
```

If neither is configured, the game runs **100% locally** and the leaderboard shows your
personal bests.

### Packaging for Android and iOS (Capacitor)

```bash
npm run build
npx cap add android            # once
npx cap add ios                # once (macOS + Xcode)
npx cap sync                   # copy dist/ into the native projects
npx cap open android           # build/run from Android Studio
npx cap open ios               # build/run from Xcode

# shortcuts
npm run cap:android
npm run cap:ios
```

`vite.config.js` uses `base: './'` so the bundle loads from the native WebView scheme, and
`capacitor.config.json` points `webDir` at `dist`.

---

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Jump / double jump (Beaver Tail) | Tap or swipe up | Space / Up / W |
| Glide (Beaver Tail floaty fall) | Keep holding after the jump | Hold Space / Up |
| Slide (fast-fall when airborne) | Swipe down | Down / S |
| Pause | Pause button | Esc / P |

The controls also include coyote time (90 ms), jump buffering (130 ms) and a hold-to-jump
gesture (140 ms).

---

## Project structure

```text
labubu-game/
├── index.html
├── package.json
├── vite.config.js
├── capacitor.config.json
├── .env.example
├── supabase/schema.sql             # tables, RLS, timestamp + best-score triggers
├── server/rest-sync-server.js      # zero-dependency reference REST backend
├── tests/                          # Vitest unit tests for every system
└── src/
    ├── main.js                     # services + lifecycle hooks + Phaser config
    ├── config/
    │   ├── GameConfig.js           # dimensions, physics, economy, idle & sync tuning, event names
    │   ├── GachaDropTable.js       # rarity weights, pity thresholds, item catalog + perks
    │   └── QuestCatalog.js         # daily / weekly mission templates
    ├── scenes/
    │   ├── BootScene.js            # procedural texture generation
    │   ├── PreloaderScene.js       # progress bar while character sheets are baked
    │   ├── MainMenuScene.js        # hub: Play, Blind Box, Pop Bank, Quests, Leaderboard, Settings
    │   ├── RunnerScene.js          # core loop
    │   ├── UnboxingScene.js        # bounce -> foil swipe -> 3 shakes -> tiered reveal -> stats card
    │   ├── ShowroomScene.js        # wardrobe, live doll preview, stats inspector
    │   └── UIOverlayScene.js       # always-on-top toasts (quests, connectivity)
    ├── systems/
    │   ├── SaveManager.js          # localStorage CRUD, schema migration, dirty flag
    │   ├── SyncManager.js          # online/offline listeners, debounced sync, conflict resolution
    │   ├── sync/SupabaseAdapter.js # supabase-js v2 (anonymous auth, saves, leaderboard)
    │   ├── sync/RestAdapter.js     # custom REST adapter + NullAdapter (offline only)
    │   ├── QuestManager.js         # event-driven mission tracker, daily/weekly reset, inbox
    │   ├── IdleRewardManager.js    # time-elapsed coin generation
    │   ├── AudioController.js      # Web Audio synthesized SFX + chiptune loops
    │   ├── GachaSystem.js          # pure roll / pity / duplicate logic
    │   ├── PerkCalculator.js       # loadout -> gameplay modifiers
    │   ├── AdService.js            # rewarded-ad facade (simulated; AdMob hook documented)
    │   ├── EventBus.js             # shared emitter (Phaser-compatible API)
    │   └── Services.js             # service locator
    ├── entities/
    │   ├── Player.js               # state machine: RUN, JUMP, DOUBLE_JUMP, FALL, SLIDE, CRASH
    │   ├── ObstaclePool.js         # stumps, rocks, roots, logs, brambles, low branches, pits
    │   └── CollectiblePool.js      # Pop Coins, Tickets, Super Magnet
    ├── art/
    │   ├── CharacterRenderer.js    # Canvas-2D Labubu + accessories in every pose
    │   └── ProceduralTextures.js   # coins, obstacles, blind box, foil, particles, parallax
    └── ui/UIKit.js                 # buttons, modals, scroll list, currency bar, backdrop
```

The files outside the requested layout (`GachaSystem`, `PerkCalculator`, `EventBus`, `Services`,
`AdService`, `sync/*`, `art/*`, `ui/*`, `UIOverlayScene`) keep each module small. The pure-logic
systems don't import Phaser, which lets them run under the unit tests in Node.

---

## Systems

### Save data (offline-first)

`SaveManager` keeps one JSON document in memory and writes it to `localStorage` on every critical
mutation: currencies, gacha pulls, equips, run results, quest completions and claims. Quest
distance ticks are batched with a 1 s debounce. The document follows the requested schema and adds
a few fields:

- `equipped.shoes`: a fifth slot for the Canvas Sneakers.
- `quests.weeklyQuests`, `quests.weeklyRefreshKey`, `quests.inbox`: weekly missions and the inbox for rewards earned but not claimed before a reset.
- `settings`, `runHistory`: audio toggles, and the device's top 10 runs for the offline leaderboard.
- `meta`: `updatedAt` (the conflict-resolution timestamp), `isDirty`, `lastSyncedAt`, `lastSubmittedScore`.

`migrateSave()` repairs older, partial or tampered saves. It drops unknown items, fixes equips
that aren't owned or are in the wrong slot, and clamps negative currencies. A corrupt save never
crashes the game.

### Runner (`RunnerScene` + `Player`)

- Arcade physics with gravity 1200. The player stays at a fixed x and the world scrolls past.
- `speed = min(800, 300 + distanceMeters * 0.15)`, where 20 px = 1 m.
- 3 parallax layers: sky and clouds (0.08), forest canopy (0.35), running surface (1.0). The sky shifts to sunset at 1.5 km and to night at 3 km.
- Obstacles unlock gradually: stumps, rocks and roots from the start, low branches (slide) at 120 m, pit traps at 200 m, logs at 250 m, brambles at 350 m.
- Objects come from pools. Off-screen obstacles and pickups are deactivated and reused, never destroyed. Pickups are plain pooled images that use a circle-vs-rectangle test, which stays cheap with 100+ coins on screen.
- Perks from the loadout:
  - `beaver_paddle_tail`: double jump, and gravity is 35% lower while you hold jump on the way down.
  - `lumberjack_vest`: coin attraction radius +150 px.
  - `beaver_labubu_secret` (the "secret beaver chase"): a 1-hit shield each run (it also bounces you out of a pit) and +25% coin value.
  - Smaller perks on other items: jump boost, idle bonus, ticket luck, lower gravity, coin bonus.

### Gacha (`GachaDropTable` + `GachaSystem` + `UnboxingScene`)

| Tier | Weight | Items |
| --- | --- | --- |
| Common | 60% | Raincoat, Beanie, Canvas Sneakers, Lumberjack Vest, Beaver Cap, Beaver Paddle Tail |
| Rare | 29% | Macaron Pink, Sesame Grey, Toffee Brown |
| Epic | 10% | Zimomo King, Space Explorer |
| Secret Chase | 1% | Lumberjack Beaver Labubu |

- Pity: the 10th pull without an Epic is Epic or better, and the 50th pull without a Secret is a Secret.
- A duplicate converts to coins, plus golden keys for Epic and Secret duplicates. A golden key opens a box that is guaranteed Epic or better.
- The result is rolled and saved before the animation starts, so closing the app mid-reveal can't re-roll a pull or lose it.
- The reveal sequence: the box bounces in, you swipe to tear the foil (a tap or Space also tears a chunk, for accessibility), the box shakes 3 times with screen shake of 0.004, 0.009 and 0.018, and the glow takes on the tier color on the last shake. The burst uses tier-colored god rays and particles, and Epic and Secret add confetti rain. The stats card offers **Equip Now** or **Store in Collection**.

### Idle bank (`IdleRewardManager`)

```
elapsed              = clamp((now - lastIdleClaimTimestamp) / 1000, 0, 8h)
CollectionMultiplier = 1 + 0.05 × uniqueDollsOwned
ProgressMultiplier   = 1 + 0.10 × floor(highScore / 1000)
PerkMultiplier       = 1 + Σ idleBonus (e.g. Cozy Beanie +10%)
idleCoins            = floor(elapsed × 0.02 coins/s × Collection × Progress × Perk)
```

The idle formula in the spec was blank, so I filled it in as above. All the constants are in
`GameConfig.IDLE`. After 2 or more minutes away, a **Welcome Back!** dialog offers
**Collect**, **Watch Ad ×2** (a simulated rewarded ad; the AdMob integration is documented in
`AdService.js`) or **Use 1 Ticket ×2**. If the device clock moves backwards, the timer resets
instead of paying out.

### Quests (`QuestManager`)

The manager listens on the shared bus for `EVENT_DISTANCE_TICK`, `EVENT_COIN_COLLECTED`,
`EVENT_BOX_OPENED` and `EVENT_OBSTACLE_DODGED`, plus `EVENT_RUN_ENDED` and
`EVENT_TICKET_COLLECTED`. Templates use one of three progress modes: `sum`, `count`, or `max`
(best single run). Every quest event triggers the date check: when `lastRefreshDate !== today`
the daily board rolls over, and the weekly board rolls over on a new ISO week. Completed rewards
that weren't claimed move to the **inbox**, so a reset never takes away a reward the player
earned. Boards are seeded by `(date, playerId)`, so they stay the same all day.

### Sync (`SyncManager`)

- Connectivity comes from `navigator.onLine` plus `window` `online`/`offline` events. The app also syncs on resume.
- Offline, everything runs against localStorage and `meta.isDirty = true`.
- Online, saves are debounced (2.5 s) into a background sync: authenticate, download the cloud save, `resolveConflict()`, upload, submit the high score, then clear `isDirty`. Failures retry with exponential backoff (4 s up to 60 s). Updates are optimistic, so the UI never waits on the network.
- Conflict rule: the document with `Math.max(localTimestamp, cloudTimestamp)` wins. On top of that, data that only ever grows is unioned so no device loses progress: the inventory, the stats maxima and the run history. Supabase triggers enforce the same rules on the server.
- Leaderboard: the global top 50 when online. Offline it shows the last cached board, and with no backend configured it shows your personal bests. You can rename yourself from the leaderboard or the Settings screen.

### Audio (`AudioController`)

All audio is oscillators and filtered noise: jump and double-jump blips, coin dings that climb in
pitch as you chain coins, landing thuds, slide whooshes, the crash, foil crackle, box rattles at 3
intensity levels, a tiered reveal fanfare (the Secret Chase adds sparkles), the quest jingle, a
cash register sound and two chiptune loops. Playback starts on the first user gesture, which
mobile browsers require.

---

## Tuning cheat-sheet

| What | Where |
| --- | --- |
| Gravity, jump, speed ramp, magnet radius | `GameConfig.RUNNER` |
| Ticket price, duplicate refunds | `GameConfig.ECONOMY` |
| Idle rate, cap, multipliers | `GameConfig.IDLE` |
| Drop weights, pity, items and perks | `GachaDropTable.js` |
| Quest templates and rewards | `QuestCatalog.js` |
| Obstacle hitboxes and unlock distances | `entities/ObstaclePool.js` |
