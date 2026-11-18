# Manual test sheet for what could not be tested automatically (checklist H)

Tick each item on the real device or browser named. Note the browser and version for any failure.

## 1. Python lab (real Pyodide, needs internet)
Open Practice & Games > Coding Lab > "Python: even or odd". Run with `def is_even(n): return n % 2 == 0`. Expect "All tests pass" within about 30 seconds the first time (about 10 MB download) and about 1 second afterwards. Then run `while True: pass` and expect "Timed out after 3 seconds". Then run correct code again.

## 2. Browsers
Open `lumio.html` (double-click) in Safari (iOS 15, 16 and 17 if possible), Firefox desktop and Firefox Android, Samsung Internet. Complete onboarding, finish one quiz, open Focus and start a block, open the Coding Lab. A blank page means a script error: open the console and note the message. (A regex that Safari before 16.4 cannot parse was removed on the last pass.)

## 3. Notifications
Study reminder (Study area) and Focus > "Notify me when a block or break ends". Allow notifications when asked. Use Custom 1 / 1 minute blocks. Keep the tab open: expect a notification at the end. Check that denying permission shows a clear message and the setting switches itself off. Note: browsers do not deliver these when the tab is closed, and some phones delay them in background tabs.

## 4. Screen readers
VoiceOver (iPhone Safari), TalkBack (Android Chrome), NVDA with Firefox or Chrome. Check: bottom or side navigation announces names and the current page; quiz options read as buttons; correct and wrong feedback is announced; the Focus timer and block-complete message are understandable; the owl tip can be toggled; forms have labels.

## 5. Phones
Real Android and iPhone: open the Focus screen, start a block, switch to another app for a minute and come back (expect the kind "you were away" message); try Strict Mode; check the bottom navigation and the owl bubble do not cover buttons; try landscape; try Play focus sound with the volume keys.

## 6. Leaderboard server
Run `node server.js` on a computer, open the page from a phone on the same network using the computer's address and port 3000, press Sync on two devices and check both names appear.

## Not testable by this project at all
Native Android or iOS app blocking, website blocking and YouTube Study Mode do not exist in this web app (they need native apps or browser extensions), so there is nothing to test.

## 7. Added checks for the third pass (do these on real devices)
- Read-aloud: on an Android phone and an iPhone, open a chapter, press Listen, then Pause, Resume, change speed to Fast and Slow, and Stop. Confirm a Hindi sentence is read with a Hindi voice (the voice must be installed on the device).
- Scheduler: set a plan, wait until a session time has passed, open the Study Area, press Reschedule, and confirm the new times avoid school, dinner and bedtime.
- Quests: finish a quiz, press Claim on the daily quest, confirm XP rises once and the button becomes Claimed. Check again after midnight and after Monday that the daily and weekly quests reset.
- Study Video: paste a real YouTube link (needs internet), confirm the video plays and notes are saved after reload.
- Circuit Lab: reach a target current in series and in parallel on a phone.
- Server behind a proxy: set `TRUST_PROXY=1`, open the site over HTTPS, and confirm the response has `Strict-Transport-Security`. Check that `/healthz` returns `{"ok":true}`. Confirm that after about 10 signups from one network in an hour the next one is refused.
- Backups: wait for the first backup (5 seconds after start), confirm a folder appears in `backups/` with accounts data, and copy it off the machine.
- Several users at once: open three browsers with three accounts, sync all three, and confirm each sees only its own data.
- Browsers: repeat the main flow (onboarding, a quiz, a game, Settings) in Chrome, Firefox, Safari and Samsung Internet on a phone.
