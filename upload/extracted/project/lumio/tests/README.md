# Browser tests (Playwright)
These are the scripts used to test Lumio in headless Chromium. They are working notes, not a polished test suite.
- Run with Node and a global Playwright install: `node tXX.js` (they load `file:///home/claude/lumio/lumio.html`; edit that path to where you unzipped the project).
- Many scripts set up a learner by clicking through onboarding, then check one area (quiz, themes, labs, leaderboard, mobile layout and so on).
- `t5.js`, `t6.js` need `node server.js` running on ports 3112 and 3113. `t52.js`, `t53.js` need `python3 pysrv.py` (a stand-in for Pyodide that runs real local Python on port 3199).
- `bf.js`, `bf2.js` brute-force the spaceship missions to check each is winnable.
- Some scripts assume the exact on-screen text at the time they were written and may need small updates.

Checklist C tests (run: node tests/<file> $(npm root -g), from the project folder; they open lumio.html with file://):
- srs.js: spaced-repetition scheduling, XP once per day, persistence.
- adaptive_weak.js: weak-topic ranking, adaptive level up and down, no repeated questions, XP once per day.
- legend_mixed_drill_error.js: legendary fail and win, mixed-topic sequence, drills, error lab.
- papers.js: question-paper log validation, delete, persistence, official links.

- section_d.js: all Section D games (wrong answer, five correct, XP, 390 px layout, listing per band).

- social.js: three-browser social test. First start the server with a throwaway data file: SOCDB=/tmp/soc_test.json PORT=3123 node server.js &  then run: node tests/social.js $(npm root -g)
- accounts_api.js (46 checks, no browser): start the server with ACCDB=/tmp/acc_test.json SOCDB=/tmp/soc_t.json OTP_GAP_MS=300 PORT=3124 node server.js > /tmp/acc.log 2>&1 &  then node tests/accounts_api.js
- accounts_ui.js (four browsers): start the server with ACCDB=/tmp/acc_ui.json SOCDB=/tmp/soc_ui.json OTP_GAP_MS=300 PORT=3125 node server.js > /tmp/acc_ui.log 2>&1 &  then node tests/accounts_ui.js $(npm root -g)

- onboarding.js (checklist A of the second list): every onboarding path, validation, guardian logic, plan building, edit mode keeping progress, 390 px layout. Run from the project folder: node tests/onboarding.js $(npm root -g)
- catalogue.js (checklist B of the second list): board and class aware subject lists, book names, honest notes, onboarding and Settings use, custom subjects, stale-subject cleanup, guide, 390 px. Run: node tests/catalogue.js $(npm root -g)
