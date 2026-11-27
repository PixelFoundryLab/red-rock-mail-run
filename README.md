# Red Rock Mail Run — a 3D flight game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/PixelFoundryLab/red-rock-mail-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/PixelFoundryLab/red-rock-mail-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D flight game built for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

A bush pilot's sunset mail run through Red Rock Canyon. Fly the **8 glowing gates** down the river canyon, drop the mail low over the **Cedar, Juniper and Coyote outposts**, then land on the far runway. Three lives. Mind the walls — and the fuel gauge.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server — `node serve.ts` serves it on http://localhost:8080). No build step, no network requests: every file the game loads lives under `game/`.

- **Mouse / Arrows / WASD** — steer (bank and pitch)
- **Shift** — throttle up, **Ctrl** — throttle down
- **Space** — afterburner
- **P** — pause, **M** — mute

The HUD shows altitude (AGL/MSL), speed in knots, compass heading, score, the mail route in order, lives, throttle, fuel, hull, wind and an artificial horizon. A pointer at the screen edge always shows the way to the next job.

Fuel burns with throttle and twice as fast on the afterburner — a careful pilot reaches the far runway with fuel to spare. Rough handling bends the hull and costs speed. Land on either runway to refuel and repair. Finish a day to earn a pilot rank; the next day blows harder and the clock tightens.

## Tech

- Three.js r187 (vendored as `game/vendor/three.bundle.min.js`), no other libraries
- Procedural canyon terrain (seeded value noise), river, runways, outposts, instanced trees and rocks, golden-hour sky
- Systems, each its own file: `flightPhysics.js`, `terrainGen.js`, `missionList.js`, `damageFuel.js`, `weatherWind.js`, `pilotRank.js`, `terrainRender.js`, `skyRender.js`, `planeModel.js`, `ringRender.js`, `hudInstruments.js`
- WebAudio engine hum, gate chimes, mail-drop notes, crash and landing sounds — all synthesised, no audio files
- Screenshots in `screenshots/` are real renders of the game (`?shot=cover|takeoff|drop|landing`)

## License

MIT — see [LICENSE](LICENSE).
