# Turn on the Sprunkee leaderboard + shared jams (about 5 minutes, one time)

1. Make a new Google Sheet (name it **Sprunkee Online**).
2. In the sheet: **Extensions → Apps Script**.
3. Delete what's there, paste all of `apps-script/Code.gs`, and click **Save**.
4. **Deploy → New deployment** → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then **Authorize access**. Google warns the app is "unverified". That's normal for your own script: **Advanced → Go to (project) → Allow**.
5. Copy the **Web app URL** (ends in `/exec`).
6. Send that URL to Claude, or paste it into `config.js`:
   ```js
   window.SPRUNKEE_CLOUD_URL = 'https://script.google.com/macros/s/XXXX/exec';
   ```
   and push. The game switches to online mode on its own.

The sheet gets two tabs, `scores` and `jams`. Delete a row to remove a score or a jam.
Players only ever type 3-letter initials. Jam names come from a kid-safe word list, so nobody can type anything gross.
