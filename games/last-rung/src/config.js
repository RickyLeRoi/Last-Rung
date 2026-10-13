'use strict';
// Units: pixels and frames (60 frames = 1 second); accelerations in px/frame².
const CONFIG = (() => {
  const physics = {
    gravity: 0.03,
    thrust: 0.075,
    downAcc: 0.035,
    hAcc: 0.045,          // horizontal acceleration
    drag: 0.988,          // air drag (per-frame multiplier)
    hBrake: 0.975,        // automatic horizontal brake when no lateral input
    maxV: 2.4,            // top speed when empty
    loadGravity: 0.003,   // extra weight per person aboard
    windForce: 0.012,
    fireLift: 0.014,      // hot air column above flames
    fireTurb: 0.035,
    smokeShake: 0.05,     // smoke turbulence (scaled by intensity)
    waterDepth: 11,       // immersion depth (px) for maximum drag
    waterDrag: 0.05,
    waterDragDepth: 0.13,
    ceiling: 12,          // highest reachable altitude (min y)
    personGravity: 0.1,
  };
  const topSpeed = physics.maxV;
  const hook = topSpeed * 0.2;

  return {
    W: 384, H: 216, WORLD_W: 1152,
    phys: physics,
    load: { max: 8, minSpeedFactor: 0.3 },     // 8 aboard -> 30% of top speed
    speed: {
      hook,                  // hooking: max 20% of top speed
      crushLadder: topSpeed * 0.5,  // above: the bucket crushes and nobody jumps onto the ladder (the ladder itself never kills)
      crushBody: topSpeed * 0.3,    // above: the fuselage crushes
      land: topSpeed * 0.5,         // landing: max vertical speed
      landH: topSpeed * 0.35,       // landing: max horizontal speed
      hard: topSpeed * 0.8,         // side impact: below = hull damage, above = explosion
      hardLand: topSpeed * 0.7,     // descent: up to here hard landing (damage), above = crash
      fallKill: 3.2,         // a person falling faster than this dies
    },
    stab: { cap: hook * 0.9, hardCap: hook * 0.95, k: 0.1 },
    // castaways stay away from walls and edges (otherwise the central ladder cannot reach them)
    swim: { avoid: 26, avoidForce: 0.05, wash: 0.1, washRadius: 34, washPeak: 12, washDead: 3, toLadder: 0.03, toLadderRange: 8, washHeight: 40 },
    ladder: { swing: 4, spring: 0.06, damping: 0.9, accel: 4, wind: 0.02 },
    blood: { drops: 14, maxSolid: 160, maxHeli: 120 },
    // winch: ladder length (px), unwind speed, climb frames per extra px
    winch: { min: 4, max: 40, speed: 0.5, climb: 3 },
    // chain of hanging people: frames tolerated in water after hooking, frames before they can grab again
    chain: { grace: 60, noHook: 60 },
    injured: { walk: 0.3, share: 1 },       // injured walk at 30%; one per level from level 2
    panic: { run: 0.9, hesitate: 70, reach: 20, reachUp: 14, reachDown: 36, jumpVx: 0.9, jumpVy: 1.1 },
    night: { cone: 0.36, coneLen: 140, halo: 22, safe: 30, fire: 22 },
    fog: { from: 10, clear: 60, thin: 96, fire: 16 },   // fog from level 10: clear radius and radius beyond which almost nothing is visible
    // parallax ridges (px): tops between horizon - lowest - amplitude and horizon - lowest; period is a multiple of step
    backdrop: {
      seaMountains: { period: 768, step: 64, lowest: 14, amplitude: 36, roughness: 0.25 },
      seaCoast: { period: 576, step: 48, lowest: 6, amplitude: 14, roughness: 0.35 },
      villages: 3,
      stormCoast: { period: 768, step: 64, lowest: 2, amplitude: 18, roughness: 0.3 },
      city: {
        mountains: { period: 768, step: 96, lowest: 46, amplitude: 44, roughness: 0.2 },
        hills: { period: 576, step: 48, lowest: 18, amplitude: 28, roughness: 0.3 },
      },
      fire: {
        mountains: { period: 768, step: 96, lowest: 56, amplitude: 50, roughness: 0.2 },
        hills: { period: 576, step: 48, lowest: 24, amplitude: 30, roughness: 0.3 },
      },
    },
    // turning: flips when already flying in the new direction, or when held (immediately on the ground)
    turn: { moving: 0.15, hold: 36 },
    // ladder snagged on cables and pylons: pull force, frames until it tears free
    snag: { pull: 0.025, tear: 45 },
    buoy: { count: 3, extra: 1800, grab: 6, lure: 44, swim: 0.08 },   // buoys: how many aboard, extra lifetime frames
    bucket: { rope: 22, fillRate: 0.02, weight: 2, hit: 0.025, drops: 40, score: 50 },   // water bucket (fires only)
    crew: { reach: 70, climb: 0.45, walk: 0.5, carry: 0.35 },
    kinds: { kid: { weight: 0.5, run: 1 }, old: { weight: 1, run: 0.5 }, dog: { weight: 0.3, run: 1.2 } },
    fireWash: { range: 40, height: 70, spread: 6, flatten: 0.55 },
    rescue: { ladderSlots: 2, boardAfter: 100, runSpeed: 0.55, safeNearX: 8, safeNearAbove: 18, safeNearBelow: 3, stepUp: 24 },
    fuel: {
      max: 100,
      base: 0.011,       // in-flight burn per frame (~2'30" on a full tank)
      thrust: 0.006,
      stab: 0.012,
      perPerson: 0.0008,
      idle: 0.003,       // engine running, idle on a rooftop
      refuel: 0.5,       // in the safe zone, per frame
      low: 20,           // low-fuel threshold
      restart: 10,       // minimum fuel to restart the engine
      stranded: 120,     // frames out of fuel on a rooftop before game over
    },
    hull: { max: 3, invuln: 40, repair: 120, controlLoss: 0.15, jitter: 0.012 },
    score: { save: 100, dog: 150, dogKill: -50, playerKill: -150, starBonus: [0, 0, 100, 250], twoStars: 0.75 },
    timers: { float: [3000, 4200], fire: [3600, 4800], fallFloat: 3000, fallFire: 2400, perLoop: 0.85 },
    input: { deadzone: 0.18, stickRadius: 46 },
    maxParticles: 1200,
    touchGutter: 84,   // px reserved on each side of the canvas for the touch buttons
  };
})();
