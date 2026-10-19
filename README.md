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

| Action | Touch (portrait or landscape) | Keyboard |
| --- | --- | --- |
| Change lane | Swipe left / right | ← → / A D |
| Jump | Tap or swipe up | Space / ↑ / W |
| Double jump (everyone) / triple jump (Beaver Tail) | Tap again in the air | Press again in the air |
| Glide (Beaver Tail) | Keep your finger down after the jump | Hold Space / ↑ |
| Roll under gates (slams down when airborne) | Swipe down (hold to keep rolling) | Hold ↓ / S |
| Use held item | Tap the item bubble | E / Shift / Enter |
| Rocket start | Tap exactly on "GO!" | Space on "GO!" |
| Pause | Pause button | Esc / P |

Swipes fire as soon as your finger has moved about 26 px. A quick tap jumps on release, and jump
buffering lets a tap just before landing still count.

### Phones: full screen in both orientations

- The short screen side is always 720 logical px and the long side follows the phone (1280 to 1600). The game fills the screen in **portrait and landscape** with no black bars.
- Rotating the phone re-lays out the game live:
  - Menus rebuild for the new orientation.
  - A run in progress just re-projects its 3D camera and keeps going.
- The canvas renders at up to 1.5× (`GameConfig.RES`) and every camera zooms back, so text and art stay sharp on high-DPI screens.
- Where the browser allows it (Android, desktop), a menu button enters true fullscreen.

### Pseudo-3D lane runner

- A camera behind Labubu looks down a three-lane forest road.
  - `RunnerScene.project(x, y, z)` does the perspective divide.
  - The road is repainted every frame as about 60 slabs: candy-coloured sections, rainbow kerbs, lane dashes and a pink haze toward the horizon.
  - The road curves gently left and right, and the mountains, hills and forest band pan with each curve.
- Billboards scale with depth: obstacles, coins, pickups, and roadside pines, oaks, giant lollipops, mushrooms, bushes and flowers.
- The runner is drawn from behind with a dedicated back-view sprite sheet. On a crash it turns round to face the camera, dazed.
- Obstacles:
  - Stumps, rocks, logs and brambles: jump over them.
  - Log gates: roll under them.
  - Giant toadstool houses: change lane. Swerving into the side of one just bumps you back ("BONK!").
- Pace is fast from the first second: 16 m/s, ramping to 34 m/s. A score multiplier grows by one every 300 m, up to ×6.

### Shop (`ShopScene` + `ShopSystem` + `PurchaseService`)

The store is laid out like Brawl Stars:

- **Deals:** a free daily gift, a featured skin at 30% off, and ticket and key bundles. They rotate at midnight, and each can be bought once per day.
- **Boxes:** the three blind boxes with their odds and pity counters.
- **Skins:** every Common, Rare, Epic and Legendary skin, sold for gems (Common and Rare also for coins). Mystery skins are box-exclusive.
- **Gems:** a free daily video reward, plus gem packs. Real-money packs only work in the store builds. On the web the game says to ask a grown-up and charges nothing. `PurchaseService.js` documents where to plug in RevenueCat or another billing plugin. Put it behind a parental gate to meet the store family policies.

### Difficulty that grows (Subway Surfers-style)

Runs start gentle (11 m/s) and speed up steadily toward 34 m/s. The track also gets trickier stage by stage (`ProgressionConfig.STAGES`):

| Stage | From | What's new |
| --- | --- | --- |
| 1 Warm-up Meadow | 0 m | Single hazards, wide gaps |
| 2 Tricky Trail | 350 m | **Crate towers you must double-jump**, pairs, full rows |
| 3 Wild Woods | 900 m | **Charging carts** that race at you, jump-then-roll combos |
| 4 Thunder Canyon | 1,800 m | Tighter gaps, more combos and carts |
| 5 Monster Mountain | 3,000 m | Rows of crate towers in every lane |
| 6 Rainbow Inferno | 4,500 m | Everything, tightest gaps |

### Special zones

A rainbow gate announces each zone. The first zone comes at 450 m, then one roughly every 400–550 m, and each lasts 240 m:

- **Low Gravity:** jumps float sky-high over crate towers, with coins up in the stars.
- **Turbo Zone:** extra speed and double score.
- **Gold Rush:** coins everywhere, worth double.
- **Bounce Zone:** springs launch you over walls of crates.

### Boosts, upgrades, levels and the Labubu Pass

- **Head Start:** ride a rocket to 1,000 m (more with upgrades).
- **Score Booster:** +2 to the score multiplier for the whole run.
- Both are offered for the first seconds of a run. You get them from boxes, the pass and level-ups, or buy them in the Shop's **Boosts** tab.
- **Upgrades:** spend coins to make Magnet, Star and Dash last longer, and to make Head Start go further (5 levels each).
- **XP and player level:** XP comes from runs, boxes and quests. Every level-up pays a reward.
- **Labubu Pass:** a monthly season pass with 30 tiers. Every tier has a free reward and a Gold reward. The Gold track unlocks for 250 gems and includes exclusive skins.
- **Blind boxes:** every box also holds bonus loot (coins, plus a chance of Head Starts, Score Boosters, gems, tickets or keys). You can open **5 at once** for a card-flip reveal, and **SKIP** works at any moment.

### Login & cloud saves

The game opens on a start screen that signs the player in and brings back their progress:

- **As a claude.ai Artifact:** the save lives in the player's private space in the page's `db` storage, tied to their Claude account (`ClaudeAdapter`). Any phone or computer signed in to Claude gets the same coins, skins and level back.
  - The leaderboard is a shared `scores` collection, and each player writes only their own row.
  - Viewers who may only view see "view only" and keep progress on the device.
- **In the store app:** the Supabase or REST backends described above.
- **Guests:** progress stays on the device. The Settings menu has **Copy save code** and **Load save code**, which move the whole save to any device as one copy-paste code.
- A brand-new, untouched device never overwrites real progress when it first syncs.

### Wardrobe

There are 75 collectibles across six slots: skins, outfits, hats, tails, shoes and **wings & packs** (angel, fairy, butterfly and bat wings, capes, backpacks, a jetpack). Clothing is data-driven: each item has a `look` (kind + colours), and `art/Wardrobe.js` draws it from the front and from behind. Adding an item is one line in `GachaDropTable.js`.

### Keeping kids coming back

- **Praise pop-ups:** NICE! → GREAT! → AWESOME! → … → LEGENDARY!, with confetti, for dodge streaks and coin combos.
- **L-A-B-U-B-U word hunt:** letters appear on the road one at a time. Spell the word in a day for 300 coins + 1 ticket.
- **Daily Lucky Spin:** one free spin of a prize wheel each day (coins, tickets, a rare Golden Key).
- **Mario Kart-style extras:**
  - Countdown with a rocket start.
  - Item boxes with a roulette: Dash Mushroom, Super Star, Super Magnet, Coin Rain, Bubble Shield.
  - Boost pads with warp-star streaks.
  - Coin combos and close calls.
  - A one-ticket "Second Chance" revive.

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
    │   ├── ProgressionConfig.js    # stages, zones, boosts, upgrades, levels, season pass
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
    │   ├── ShopScene.js            # Deals / Boxes / Skins / Boosts / Gems store
    │   ├── PassScene.js            # Labubu Pass: free + Gold reward tracks
    │   └── UIOverlayScene.js       # always-on-top toasts (quests, connectivity)
    ├── systems/
    │   ├── SaveManager.js          # localStorage CRUD, schema migration, dirty flag
    │   ├── SyncManager.js          # online/offline listeners, debounced sync, conflict resolution
    │   ├── sync/SupabaseAdapter.js # supabase-js v2 (anonymous auth, saves, leaderboard)
    │   ├── sync/RestAdapter.js     # custom REST adapter + NullAdapter (offline only)
    │   ├── QuestManager.js         # event-driven mission tracker, daily/weekly reset, inbox
    │   ├── IdleRewardManager.js    # time-elapsed coin generation
    │   ├── AudioController.js      # Web Audio synthesized SFX + chiptune loops
    │   ├── GachaSystem.js          # per-box rolls, pity, duplicates, skin purchases
    │   ├── ShopSystem.js           # daily rotating deals
    │   ├── RunDirector.js          # speed curve, difficulty stages, zone schedule
    │   ├── Progression.js          # XP, levels, season pass
    │   ├── Boosts.js               # Head Start / Score Booster + upgrades
    │   ├── Rewards.js              # grants any reward (currencies, boosts, items)
    │   ├── PurchaseService.js      # real-money gem packs (native billing hook)
    │   ├── PerkCalculator.js       # loadout -> gameplay modifiers
    │   ├── RunnerItems.js          # item-box roulette table
    │   ├── DailyRewards.js         # L-A-B-U-B-U word hunt + daily Lucky Spin
    │   ├── AdService.js            # rewarded-ad facade (simulated; AdMob hook documented)
    │   ├── EventBus.js             # shared emitter (Phaser-compatible API)
    │   └── Services.js             # service locator
    ├── entities/
    │   ├── Player.js               # state machine: RUN, JUMP, DOUBLE_JUMP, FALL, SLIDE, CRASH
    │   ├── ObstaclePool.js         # 3D lane hazards: stumps, rocks, logs, brambles, gates, toadstool houses
    │   ├── CollectiblePool.js      # coins, tickets, magnets, item boxes, boost pads, letters
    │   └── World3D.js              # depth sorting + billboard placement
    ├── art/
    │   ├── CharacterRenderer.js    # Canvas-2D Labubu + accessories, front and back views
    │   └── ProceduralTextures.js   # coins, obstacles, blind box, foil, particles, parallax
    └── ui/
        ├── UIKit.js                # buttons, modals, scroll list, currency bar, backdrop
        ├── Skin.js                 # painted glossy buttons, textured panels, rarity cards
        ├── Display.js              # high-DPI camera zoom plugin + pointer mapping
        ├── Fullscreen.js           # fullscreen + landscape lock
        └── TextPrompt.js           # in-page text dialog (rename)
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

### Runner (`RunnerScene` + `Player` + pools)

- `Player` is a small state machine (RUN / JUMP / FALL / DUCK / CRASH), simulated in metres: lane x, height y, gravity 34 m/s². Squash and stretch, lean, cartwheels, star rainbow and after-images are visual only.
- `ObstaclePool` and `CollectiblePool` pool billboards at depth z and recycle them once they pass the camera. Collisions are lane/height/depth overlap tests.
- Rows are placed at absolute track positions, so the road is already full to the horizon when the run starts. Every row leaves a passable lane.
- All gameplay timers (rolls, boosts, magnet, star) run on a game clock that advances with the same capped frame delta as the world. They stay fair when a phone drops frames.
- Perks from the loadout:
  - `beaver_paddle_tail`: triple jump (everyone has a double jump), and gravity is 35% lower while you hold on the way down.
  - `lumberjack_vest`: +3 m coin reach, which pulls in coins from neighbouring lanes.
  - `beaver_labubu_secret` (the "secret beaver chase"): a 1-hit shield each run, plus the Mystery ×2 run bonus.

### Skins, rarities and run multipliers

Every skin has a rarity. The rarer the skin you wear, the more you earn while running:

| Rarity | Run bonus (score & coins) | Shop price | Example skins |
| --- | --- | --- | --- |
| Common | ×1.0 | 30 gems / 900 coins | Classic Labubu, Mint Cream, Lemon Fizz, Cotton Candy |
| Rare | ×1.15 | 80 gems / 2,500 coins | Macaron Pink, Sesame Grey, Toffee Brown, Matcha Latte |
| Epic | ×1.3 | 170 gems | Zimomo King, Space Explorer, Pirate Captain, Strawberry Bunny |
| Legendary | ×1.5 | 350 gems | Golden Labubu, Dragon Labubu, Unicorn Dream, Ice Queen |
| Mystery | ×2.0 | boxes only | Lumberjack Beaver, Galaxy Labubu |

The bonus shows on the HUD ("LEGENDARY ×1.5"), in the Showroom stats and on the results screen.

### Blind boxes (`GachaDropTable.PACKS` + `GachaSystem` + `UnboxingScene`)

Like a real Pop Mart series, each box shows its **Regular vs Mystery** odds up front, plus the full table:

| Box | Pay with | Common | Rare | Epic | Legendary | Mystery | Pity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Forest Friends | 1 ticket or 300 coins | 58% | 28% | 10% | 3.5% | 0.5% | Epic+ in 10, Legendary+ in 40, Mystery in 150 |
| Sparkle | 1 golden key or 60 gems | – | 52% | 33% | 13% | 2% | Legendary+ in 15, Mystery in 60 |
| Mega Mystery | 150 gems | – | – | 60% | 33% | 7% | Legendary+ in 4, Mystery in 20 |

- Each box has its own pity counters (`save.pity.<box>`).
- A duplicate converts to coins, plus golden keys (Epic+) and gems (Legendary+).
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
| Box odds, pity, prices, rarity multipliers, items and perks | `GachaDropTable.js` |
| Daily deals | `systems/ShopSystem.js` |
| Quest templates and rewards | `QuestCatalog.js` |
| Obstacle hitboxes and unlock distances | `entities/ObstaclePool.js` |
