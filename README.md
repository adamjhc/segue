# segue

A gentle transition timer for moving from one activity to the next.

It runs three phases back to back:

1. **Wind down**: finish up and put things down.
2. **Rest**: a pause with nothing to do.
3. **Start up**: one small step into what's next.

Each phase defaults to 5 minutes and can be set from 1 to 60. You can name the small first step and it will show during start up.

## Running locally

It's a static site with no build step. Serve the folder with anything, for example:

```sh
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Notes

- Settings and any running session are saved to `localStorage`, so a reload picks up where you left off.
- The timer works from end timestamps, so it stays accurate when the tab is in the background.
- A soft chime (Web Audio, no files) plays as rest and start up begin. It can be turned off. There is deliberately no chime when start up ends, so nobody who has got into the flow is interrupted.
- The screen is kept awake during a session where the Wake Lock API is supported.
- Press Space to pause or resume.

## Deploying

Hosted on GitHub Pages from the `main` branch root.
