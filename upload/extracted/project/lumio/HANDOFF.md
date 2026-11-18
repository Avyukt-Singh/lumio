# Handoff: continue building Lumio

Lumio is an AI-free gamified learning app for school students, droppers and above-Class-12 learners. Read `README.md` first (what is built, what is not, tests done, limitations).

## Layout
- `lumio.html`: the entire app (HTML, CSS, JS, embedded owl and logo images). Open it in a browser.
- `server.js`: optional leaderboard and social server (`node server.js`, then open http://localhost:3000).
- `assets/original/`: the original owl and brand reference images (l.png, l1.png, l2.png, l3.png) and the first uploaded lumio.zip. The app embeds a small 160 px WebP of the owl; swap in higher-resolution art from here if wanted.
- `tests/`: Playwright scripts used for testing (see `tests/README.md`).

## Working rules
- Be honest: no fake features, invented curriculum, fake rankings or made-up official links. Label sample or made-up content.
- Test every change in a real browser before calling it done. Edit the existing file with Python patches; after each patch run `node --check` on the extracted script.
- Avoid backslash-heavy regexes in patches (a mistyped one once broke an achievement).
- Official CBSE PDFs cannot be fetched automatically (site disallows it); do not invent chapter lists or marks.

## Checklist status (user's A to H list)
- A Academic content: source lines on all chapters; CBSE Class 11 Physics official facts card. Official notes, question banks, previous-year papers, other-state mapping still not possible without official access.
- B AI-powered learning: read-aloud done (browser speech). Everything else needs paid AI or external services: not built.
- C Revision and practice: DONE as far as honestly possible (see README, Checklist C). Not possible: a verified question-paper library (no licensed or official access); only official links and a self-reported log exist.
- D Games and labs: DONE (see README, Checklist D). Open-ended: more advanced class-specific games.
- E Social features: DONE as far as possible (see README, Checklist E). Real identity comes from F accounts.
- F Accounts and online infrastructure: DONE as far as possible locally (see README, Checklist F). Real SMS delivery, a managed database, HTTPS hosting and true server-side XP verification need external services.
- G Digital wellbeing (LOCK-IN): DONE as far as a web app can (see README, Checklist G): Focus screen, strict mode, mascot blocking screen, auto-focus at timetable slots, notifications, focus sounds, screen-time analytics inside Lumio. Native Android/iOS app blocking, website blocking, YouTube Study Mode, per-app limits and shared focus groups need native apps or extensions and are not built.
- H Testing and reliability: DONE as far as this environment allows (see README Checklist H and TESTING.md): compatibility scan (one real Safari bug fixed), automated contrast, accessible-name and heading audit (several fixes), regression tests. The rest needs real devices, Safari, Firefox, screen readers and internet; use TESTING.md.

## Preferences of the user
Keep working through the checklist one item at a time without asking whether to continue; give details only when asked; send the zip only when asked.


## Second checklist (user's A to M list), in order
- A Onboarding and learner profile: DONE (see README, "Checklist A of the second list"; tests/onboarding.js).
- B Subject catalogue and board awareness: DONE as far as honestly possible (README, "Checklist B of the second list"; tests/catalogue.js). Per-board official syllabus mapping is checklist L.
- C Scheduler and planning: NEXT. D Learning content and lesson structure. E Language support. F Spaceship simulation. G Coding, AI and technical labs. H Progress and motivation. I Complementary subjects. J Interface states and assets. K Architecture and security. L Needs official access or licences (cannot be done honestly). M Testing and reliability.
- Note: Sharp Eyes already uses the data-ob attribute, so the onboarding wizard uses data-obw. Check for attribute clashes before adding new click handlers (the app uses many document-level click listeners).

## Third checklist ("remaining work" sections 1 to 10), status
Done and tested: sections 2 (remedial lesson, mind maps, read-aloud), 3 (scheduler: reschedule, week/month plan, adaptive target), 4 (mistake notebook), 5 (Circuit Lab), 6 (Study Video), 7 (server hardening), 8 (quests and achievements), 9 (UI sweep and button-click audit).
Not possible here: official content, AI features, native blocking, SMS, hosting, real-device and other-browser testing. See README "Still not built".
Tests: `tests/_ob.js` is a shared helper that walks the current onboarding wizard (older tests used a one-step "Start learning" button). New tests: remedial, readaloud, mindmap, scheduler, mistakes, circuit, studyvideo, quests, hardening (starts its own server), sweep, clickall.
Known stale tests (fail on the original zip too, cause not yet found): t8, t9, t33, t34, t35, t37, t50, focus_persist_mobile, focus_music_auto_screentime. t5 and t6 need a server started on ports 3112 and 3113. Some tests print "failed" on purpose to test failure cases (legend_mixed_drill_error, t12, t30, t52, t56); judge them by reading the output, not by grepping for "FAIL".
Gotcha: do not use `pkill -f "node server.js"` in a shell command that itself contains that text; kill by PID.
