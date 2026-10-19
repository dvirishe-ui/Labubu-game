/**
 * TextPrompt.js
 * In-page text entry dialog (HTML overlay on top of the canvas). Used instead
 * of window.prompt(), which sandboxed WebViews and embedded pages often block.
 */

/**
 * Shows a small modal with a text field.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.value]      initial text
 * @param {number} [opts.maxLength]
 * @param {boolean} [opts.multiline] big text box (save codes)
 * @param {string} [opts.okLabel]
 * @returns {Promise<string|null>}  the entered text, or null when cancelled
 */
export function askText({ title, value = '', maxLength = 18, multiline = false, okLabel = 'Save' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(26,16,36,0.6);padding:16px;font-family:Trebuchet MS,Verdana,system-ui,sans-serif;';
    overlay.innerHTML = `
      <form style="background:#fff4e6;border:4px solid #3d2a52;border-radius:22px;padding:22px;width:min(360px,100%);
                   display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 0 rgba(0,0,0,0.2)">
        <label for="labubu-text-input" style="font-weight:bold;font-size:20px;color:#3d2a52"></label>
        ${
          multiline
            ? '<textarea id="labubu-text-input" rows="6" spellcheck="false" style="font:13px monospace;padding:10px 12px;border:3px solid #3d2a52;border-radius:12px;color:#3d2a52;background:#fff;word-break:break-all;resize:none"></textarea>'
            : '<input id="labubu-text-input" type="text" autocomplete="off" style="font:inherit;font-size:20px;padding:10px 12px;border:3px solid #3d2a52;border-radius:12px;color:#3d2a52;background:#fff" />'
        }
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" data-cancel style="font:inherit;font-weight:bold;font-size:18px;padding:10px 18px;border-radius:14px;border:3px solid #3d2a52;background:#e8dccb;color:#3d2a52">Cancel</button>
          <button type="submit" style="font:inherit;font-weight:bold;font-size:18px;padding:10px 18px;border-radius:14px;border:3px solid #3d2a52;background:#ff8fb1;color:#fff" data-ok></button>
        </div>
      </form>`;
    const form = overlay.querySelector('form');
    const input = overlay.querySelector('#labubu-text-input');
    overlay.querySelector('label').textContent = title;
    overlay.querySelector('[data-ok]').textContent = okLabel;
    input.value = value;
    input.maxLength = maxLength;

    const done = (result) => {
      overlay.remove();
      resolve(result);
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      done(input.value);
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => done(null));
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) done(null);
    });
    // Keep game keyboard shortcuts (space, arrows) out of the text field.
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') done(null);
    });

    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}
