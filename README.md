# segue

A gentle transition timer for moving from one activity to the next.

It runs three phases back to back:

1. **Wind down**: finish up and put things down.
2. **Rest**: a pause with nothing to do.
3. **Start up**: one small step into what's next.

Each phase defaults to 5 minutes and can be set from 1 to 60. You can say what you're moving on to, and start up will suggest a two-minute first step for it.

## Running locally

It's a static site with no build step. Serve the folder with anything, for example:

```sh
python3 -m http.server 4173
```

Then open http://localhost:4173.

## First steps

Suggestions come from templates in `steps.js`, with no server or AI involved. The task is matched to one of 15 kinds of task (email, calls, writing, cleaning and so on) by keyword, with a catch-all for anything else. Each kind has 20 steps (the catch-all has 40). Steps are drawn from a shuffled bag that's remembered in `localStorage`, so every step in a pool is shown before any repeats. "Another idea" draws the next one.

To add steps, add lines to a category's `steps` list. To add a kind of task, add a category above `general`; the first category whose pattern matches wins.

## Notes

- Settings and any running session are saved to `localStorage`, so a reload picks up where you left off.
- The timer works from end timestamps, so it stays accurate when the tab is in the background.
- A soft chime (Web Audio, no files) plays as rest and start up begin. It can be turned off. There is deliberately no chime when start up ends, so nobody who has got into the flow is interrupted.
- The screen is kept awake during a session where the Wake Lock API is supported.
- Press Space to pause or resume.

## Deploying

Hosted on GitHub Pages from the `main` branch root.
