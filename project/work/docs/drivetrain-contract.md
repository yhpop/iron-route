# Campaign tank drivetrain contract — proposed first vertical slice
Scope: convincing game-scale tracked motion, not a real vehicle/weapon simulator; no cargo, rescue, campaign or progression rules.
Chosen approach: one deterministic planar differential-drive simulation plus injected 3D clearance queries and a thin Three.js rig adapter.
## Coordinates and boundaries
Metres, seconds, radians; +Y up; yaw=0 faces -Z; forward(yaw)=(-sin(yaw),0,-cos(yaw)); positive yaw turns left.
Positive input steer means RIGHT; positive throttle means FORWARD; reverse steering remains track-differential/pivot-consistent, not car auto-inversion.
Simulation owns all scalar state; renderer owns meshes/materials/camera/DOM; no Three objects, DOM, wall clock, global RNG or mission state in step.
First slice: flat ground with grounded height supplied by environment; no slope-climbing, suspension, airborne handling or destructible terrain claim.
## Plain-data schema (JS object equivalents of these types)
TankState = {pose:{x,y,z,yaw}, vL,vR, governor:'crawl'|'cruise'|'travel', trackL,trackR,
  turret:{yawRel,elevation,recoil,recoilVelocity}, blocked:{body,barrel,muzzle}, tick}; // speeds m/s, track totals m
TankInput = {throttle:[-1,1], steer:[-1,1], brake:boolean, boost:boolean,
  governor?:'crawl'|'cruise'|'travel', aim?:{worldPoint:{x,y,z}}, firePressed:boolean, paused:boolean};
TankConfig = {trackGauge, governorCaps, reverseCap, boostCap, accel, coastDecel, brakeDecel,
  maxYawRate, maxYawAccel, turretYawRate, elevationRate, elevationLimits, recoilDistance, recoilReturnSeconds, rig};
Rig = {hullProxy, turretProxy, barrelCapsule, turretPivot, barrelPivot, muzzleLocal, trackLoopMeters, wheelRadius};
stepTank(previous,input,1/60,env,config) -> {state:next, frame:TankFrame, events:TankEvent[]}; // no mutation of previous
TankFrame = {pose,turretYawRel,elevation,recoil,muzzleWorld,deltaTrackL,deltaTrackR,trackL,trackR,
  speedForward,yawRate,canFire,contacts,desiredSpeed,governor,boostActive};
TankEvent = {type:'fire',muzzle:{position:{x,y,z},direction:{x,y,z}}}|{type:'fire-blocked',reason};
Env = {sweepHullAndAttachedGun(from,to,rig), sweepTurretAtHull(hull,from,to,rig), muzzleClear(transform,rig)};
SweepResult = {accepted,forwardDistance:number,contacts:string[],blocked:boolean}; // signed accepted hull-arc metres (0 for aim); same read-only world snapshot
## Input mapping
Desktop W/S -> throttle +1/-1; A/D -> steer -1/+1; W+S -> brake, no throttle; Space -> brake; Shift -> boost held.
Governor keys 1/2/3 or compact DOM selector choose crawl/cruise/travel; selection changes a cap, NEVER assigns vL/vR or pose.
S while travelling forward brakes both tracks toward zero; only after |mean(vL,vR)|<0.05 may held S accelerate reverse; W mirrors this.
Neutral throttle applies coast drag, not an instant stop; brake overrides throttle/boost; A/D alone commands counter-rotating tracks and a pivot.
Mobile LEFT stick: screen-up/down -> signed throttle, left/right -> steer; it never requests a world-space movement direction.
Use radial deadzone 0.12 rescaled to [0,1], then throttle/steer soft response; retain analog magnitude; no horizontal-arrow button strip.
Mobile RIGHT drag/aim stick controls world aim point independently; separate fire button; use independent pointer IDs/capture, permit drive+aim+fire.
Resolve mouse/touch aim ray onto a bounded scene aim surface; retain last valid target; no hit must not reset turret toward hull forward.
Mouse click / mobile fire emits one pressed edge per simulation tick; held-repeat/cooldown belongs to later game rules, not input repeat events.
Blur, pointercancel, lost capture, pause/modal, visibility loss clear all held controls and queued fire edges; resume never retains boost/fire.
## Conservative starting tuning (proposal, not measured real-vehicle data)
Hull approx 1.9 m wide × 2.9 m long from existing chassis; track gauge 1.45 m [1.3–1.6]; use measured rig pivots/proxies, not full gun AABB.
Governor caps crawl=1.2, cruise=2.2 DEFAULT, travel=3.0 m/s [crawl 1.0–1.5; cruise 1.8–2.5; travel 2.6–3.4]; reverse cap 1.1 [0.8–1.4].
Shift only raises forward cap to 3.5 m/s [3.2–3.8], never acceleration/yaw; require throttle>0, |steer|<0.45; release returns smoothly to governor.
Drive accel 1.3 [0.9–1.6] m/s²; coast decel 1.2 [0.8–1.5]; brake decel 3.2 [2.5–4.0]; no instant direction flips.
Yaw cap 0.70 [0.55–0.85] rad/s at rest, taper toward 0.45 at travel speed; yaw accel cap 1.2 [0.8–1.6] rad/s²; boost never raises these.
Turret yaw rate 1.1 [0.8–1.5] rad/s; elevation rate 0.6 [0.4–0.8]; elevation [-8°,25°]; cosmetic recoil 0.08 m [0.04–0.12], return 0.20 s.
## One fixed-step sequence
1. Sanitize finite inputs; apply governor selection; pause produces unchanged motion state and no fire; caller freezes time, not a giant catch-up step.
2. Build base signed speed from throttle and active cap; choose braking/reverse interlock; desiredYawRate=-steer*speedDependentYawCap.
3. Track targets: L=base-trackGauge*desiredYawRate/2; R=base+trackGauge*desiredYawRate/2; common-scale if either exceeds track cap.
4. Slew actual vL/vR toward targets using drive/coast/brake limits; limit differential change so angular acceleration also stays bounded.
5. v=(vL+vR)/2; omega=(vR-vL)/trackGauge; integrate exact planar arc (straight limit for tiny omega); this forbids commanded strafing.
6. Sweep hull plus current attached turret/barrel along that body arc; keep only accepted motion prefix, never teleport to a clear endpoint.
7. Derive target turret world yaw/elevation from accepted pivot to aim point; subtract accepted hull yaw, wrap shortest yaw; rate-limit both axes.
8. Sweep turret/barrel from old to requested relative angles at accepted hull; retain accepted prefix; elevation/recoil cannot bypass clearance.
9. Use sweep's signed accepted arc distance d and wrapped hull yaw change a; accepted track travel is dL=d-trackGauge*a/2, dR=d+trackGauge*a/2.
10. Persist vL=dL/dt,vR=dR/dt after blocking (no stored wall-push surge); add dL/dR to track totals; expose contacts and blocked flags.
11. Recompute accepted muzzle world transform; fire only when barrel-to-tip capsule and short muzzle clearance are clear; emit accepted transform.
12. Start cosmetic barrel-axis recoil only for accepted fire; damp to zero; retracted/returning barrel envelope must remain collision-safe.
## Clearance and visual adapter
Queries must cover swept translation AND rotation, incl. turning beside walls; skin 0.015 m; conservative arc envelopes/subdivision <=2° with safe-prefix refinement.
Current physics offers useful casts/rotation sweeps, but turn-then-slide whole-tank moveTank is NOT an arc-prefix or joint-aware 3D gun sweep.
Use actual 3D hull/turret/barrel proxies; body sweep includes attached gun; aim sweep includes turret bulk and full barrel, not only a muzzle ray.
Rig graph: hullRoot -> turretYawPivot -> elevationPivot -> recoilSlide -> barrel; world muzzle derives from that same accepted transform chain.
Existing manifests expose TurretPivot/BarrelPivot; chassis includes static running gear: independent belts/wheels must be separated or visually rebuilt locally.
Track texture phase=trackMeters/rig.trackLoopMeters; wheel rotation=trackMeters/rig.wheelRadius; signs follow each side's accepted travel, not throttle/time.
Never spin the entire chassis mesh as a wheel; separate moving belt surfaces from fixed hull; phases stop at a wall and oppose during a pivot.
Accepted-track travel is kinematic odometry, NOT measured belt slip; no terrain deformation, track tension, suspension or true traction simulation is claimed.
## Loop and first-slice acceptance observations (targets, NOT test results)
60 Hz accumulator; retain prev/current snapshots; render pose and shortest-angle joints at alpha=accumulator/dt; phases interpolate accepted totals only.
Cap incoming frame time to 0.10 s/max 6 ticks; pause on visibility loss, clear accumulator on resume; report dropped time in diagnostics, no hidden catch-up jump.
Replay tick inputs at 30/60/120 render Hz: same accepted tick state; no render-frame-count-driven acceleration, track phase, aiming or firing.
From rest W at cruise needs ~1.7 s to cap; selecting travel or Shift changes target only; releasing Shift/governor down slows smoothly, not a speed snap.
W then S visibly brakes before reversing; neutral coasts briefly; A/D at rest turns ~90° in 2.5–3 s with opposing belts and no lateral slide.
Drive a curved arc while aiming at a fixed landmark: hull and tracks turn while turret independently holds target within its slew rate; gun visibly elevates/recoils.
At body/barrel walls and thin corners, boost/pivot/aim cannot tunnel or spawn a shot beyond obstruction; blocked tracks stop, no release-launch surge.
Two touch pointers drive+aim concurrently, third fire tap does not steal either; canceled touch/blur cannot leave a stuck throttle or unintended shot.
First runnable slice is one tank, flat pad, thin wall, corner and aim marker; implement/observe these controls BEFORE importing mission content.
Read-only specification only: no source changes, builds, browser/device tests, installation or publishing performed; real-device feel remains unvalidated.
