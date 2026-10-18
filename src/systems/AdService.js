/**
 * AdService.js
 * Rewarded-ad facade. In the browser build it plays a short simulated ad so
 * the "x2 bonus" flow is fully testable offline. For production, replace
 * `showRewardedAd` with a real provider, e.g. @capacitor-community/admob:
 *
 *   import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
 *   await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-xxx/yyy' });
 *   const reward = await AdMob.showRewardVideoAd(); // resolves on reward
 */
import { WIDTH, HEIGHT, IDLE } from '../config/GameConfig.js';
import { outlinedText, textStyle } from '../ui/UIKit.js';

/**
 * Shows a (simulated) rewarded ad on top of `scene`.
 * @returns {Promise<boolean>} true when the reward should be granted.
 */
export function showRewardedAd(scene) {
  return new Promise((resolve) => {
    if (!navigator.onLine) {
      resolve(false); // real ads need a connection; keep behaviour identical
      return;
    }
    const root = scene.add.container(0, 0).setDepth(5000);
    const bg = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x111111, 0.95).setInteractive();
    const title = outlinedText(scene, WIDTH / 2, HEIGHT / 2 - 60, 'Sponsored', 48, '#ffffff');
    const sub = scene.add.text(WIDTH / 2, HEIGHT / 2 + 10, 'Your reward is on its way…', textStyle(26, '#dddddd')).setOrigin(0.5);
    const count = outlinedText(scene, WIDTH / 2, HEIGHT / 2 + 90, '', 40, '#ffc93c');
    root.add([bg, title, sub, count]);
    let remaining = Math.ceil(IDLE.AD_SIMULATION_MS / 1000);
    count.setText(String(remaining));
    scene.time.addEvent({
      delay: 1000,
      repeat: remaining - 1,
      callback: () => {
        remaining -= 1;
        count.setText(String(remaining));
        if (remaining <= 0) {
          root.destroy();
          resolve(true);
        }
      }
    });
  });
}
