import * as THREE from 'three';
import { FightingStyle } from './FightingStyle.js';
import { solve2BoneIK, safeLimbQuat, safeGloveQuat, solveArticulatedFoot } from '../kinematics/LimbKinematics.js';

/**
 * MMAStrikerStyle: Flagship UFC Striking System (Dustin Poirier / Alex Pereira Hybrid)
 * 
 * Biomechanical Features:
 * 1. Living Athlete Stance Rhythm:
 *    - Continuous dual-frequency weight transfer between balls of feet (1.2 Hz pendulum).
 *    - Diaphragm breathing: dynamic thoracic expansion and lumbar depression.
 *    - Tucked Chin & Head Angle: chin nestled deep in the collarbone pocket (-0.11 rad).
 *    - Active Lead-Hand Measuring: rhythmic hand-fighting and distance framing.
 *    - Elevated Lead Shoulder: natural protective jaw cover.
 * 
 * 2. 4-Phase Kinetic Chain Striking Engine:
 *    - Phase 1 (Coil / Load): 0.00 -> 0.16 (weight sink, hip pre-stretch, elastic cocking)
 *    - Phase 2 (Kinetic Wave Launch): 0.16 -> 0.46 (foot pivot -> hip snap -> chest torque -> shoulder thrust -> arm whip)
 *    - Phase 3 (Apex Impact & Pronation): 0.46 -> 0.58 (fist pronates horizontal, jaw sealed, penetration hold)
 *    - Phase 4 (Ballistic Snap Recoil): 0.58 -> 1.00 (crisp direct path retraction back to chin)
 * 
 * 3. Master Repertoire:
 *    - JAB (Lead Snap Jab)
 *    - CROSS (Rear Power Straight)
 *    - HOOK (90° High-Elbow Lead Hook)
 *    - UPPERCUT (Dipping Chin Scraper)
 *    - OVERHAND (Off-Centerline Loop Bomb)
 *    - LOWKICK (Chopping Calf Deadener)
 *    - BODYKICK (Rib-Shattering Liver Roundhouse)
 *    - HEADKICK (Highlight KO High Kick with Full Hip Turnover)
 *    - TEEP (Lead Push Kick with Knee Chamber)
 * 
 * 4. Slipping & Pull-Counter Defense:
 *    - Lateral slips load hip torque for counter-punching.
 *    - Pull-counter leans torso back 22cm out of danger while chambering the rear cross.
 */
export class MMAStrikerStyle extends FightingStyle {
  constructor() {
    super('MMA_STRIKER');
  }

  calculateCombatPose({ fighter, currentSpeed, delta, time }) {
    // -------------------------------------------------------------------------
    // 1. ROOT BASIS VECTORS & STANCE POLARITY
    // -------------------------------------------------------------------------
    const rootQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), fighter.facingAngle);
    const F = new THREE.Vector3(1, 0, 0).applyQuaternion(rootQuat); // Forward
    const R = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQuat); // Right
    const L = new THREE.Vector3(0, 0, -1).applyQuaternion(rootQuat); // Left
    const U = new THREE.Vector3(0, 1, 0); // Up

    // Stance Blend Factor: +1.0 = Orthodox (Left Lead), -1.0 = Southpaw (Right Lead)
    const stanceSign = THREE.MathUtils.lerp(1.0, -1.0, fighter.stanceTransition);
    const isOrthodox = stanceSign >= 0;

    // -------------------------------------------------------------------------
    // 2. DEFENSIVE SLIP & EVASION DYNAMICS
    // -------------------------------------------------------------------------
    let slipWeight = 0;
    if (fighter.slipTimer > 0 && fighter.slipDuration > 0) {
      const sp = Math.max(0, Math.min(1.0, 1.0 - (fighter.slipTimer / fighter.slipDuration)));
      slipWeight = Math.sin(sp * Math.PI);
    }
    const sDir = fighter.slipDirection;
    const isSlipBack = fighter.slipType === 'BACK';

    // -------------------------------------------------------------------------
    // 3. LIVING ATHLETE IDLE RHYTHM & MICRO-BIOMECHANICS
    // -------------------------------------------------------------------------
    // A. Weight-shifting pendulum bounce (rhythmic transfer between lead and rear feet)
    const idleOsc = !fighter.isMoving ? Math.sin(time * 2.6) : Math.sin(fighter.walkCycle * 2.0);
    const weightSway = !fighter.isMoving ? Math.cos(time * 2.6) * 0.024 : 0;
    const breath = Math.sin(time * 3.2) * 0.008;

    // B. Vertical center of gravity & crouch
    const crouchDrop = fighter.isCrouching ? 0.28 : 0;
    const slipDip = isSlipBack ? (slipWeight * 0.05) : (slipWeight * 0.11);
    const jumpDip = fighter.jumpCompression || 0;
    const baseHeight = 0.865 + fighter.rootPosition.y - crouchDrop - slipDip - jumpDip + idleOsc * 0.016;

    // C. Lead hand measuring / framing micro-oscillation (UFC hand fighting)
    const leadHandPump = !fighter.isMoving ? Math.sin(time * 3.8) * 0.032 : 0;

    // -------------------------------------------------------------------------
    // 4. SKELETAL ROTATION & POSITION VARIABLES
    // -------------------------------------------------------------------------
    // Pelvis (Base mass anchor)
    let pelvisPitch = 0.03 + idleOsc * 0.01;
    let pelvisYaw = 0.32 * stanceSign + (isSlipBack ? 0 : (sDir * 0.16 * slipWeight));
    let pelvisRoll = 0.0;
    let pelvisLift = 0.0;
    let pelvisFwd = weightSway;

    // Jump muscle coiling & landing shock absorption (hips hinge back, torso absorbs gravity)
    if (jumpDip > 0.001) {
      const dipRatio = Math.min(1.0, jumpDip / 0.15);
      pelvisPitch += 0.22 * dipRatio;
      pelvisFwd -= 0.06 * dipRatio;
      chestPitch += 0.26 * dipRatio;
    }

    // Lumbar (Core obliques)
    let lumbarPitch = 0.07 + breath;
    let lumbarYaw = 0.22 * stanceSign;
    let lumbarRoll = 0.0;

    // Chest (Thoracic ribcage)
    let chestPitch = 0.06 - breath;
    let chestYaw = 0.40 * stanceSign;
    let chestRoll = 0.0;
    let chestFwd = 0.05;

    // Scapular Shoulder Elevation & Drive
    let leftShoulderFwd = 0.0;
    let leftShoulderUp = isOrthodox ? 0.025 : 0.0; // Lead shoulder naturally tucked to jaw
    let rightShoulderFwd = 0.0;
    let rightShoulderUp = !isOrthodox ? 0.025 : 0.0;

    // Glove Target & Hint Overrides
    let leftGloveTarget = null;
    let rightGloveTarget = null;
    let leftGlovePronation = 0;
    let rightGlovePronation = 0;

    let plantFootYawL = 0.0;
    let plantFootYawR = 0.0;
    let footLiftL = 0.0;
    let footLiftR = 0.0;
    let footPitchL = 0.0;
    let footPitchR = 0.0;

    let customLeftKneeHint = null;
    let customRightKneeHint = null;
    let customLeftElbowHint = null;
    let customRightElbowHint = null;

    // -------------------------------------------------------------------------
    // 5. DEFENSIVE SLIP & PULL-COUNTER ANATOMICAL DEFORMATION
    // -------------------------------------------------------------------------
    if (slipWeight > 0) {
      if (isSlipBack) {
        // PULL SLIP / PULL COUNTER (Floyd Mayweather / McGregor / Adesanya lean-back)
        pelvisPitch -= 0.10 * slipWeight;
        pelvisFwd -= 0.18 * slipWeight;
        lumbarPitch -= 0.22 * slipWeight;
        chestPitch -= 0.32 * slipWeight;
        chestYaw -= 0.14 * stanceSign * slipWeight;

        if (isOrthodox) {
          leftShoulderUp += 0.04 * slipWeight;
          footLiftL = 0.035 * slipWeight;
          footPitchL = -0.18 * slipWeight;
        } else {
          rightShoulderUp += 0.04 * slipWeight;
          footLiftR = 0.035 * slipWeight;
          footPitchR = -0.18 * slipWeight;
        }
      } else {
        // LATERAL SLIPS (Slip outside the jab / cross)
        pelvisRoll -= sDir * 0.08 * slipWeight;
        pelvisYaw += sDir * 0.14 * slipWeight;
        lumbarPitch += 0.09 * slipWeight;
        lumbarYaw += sDir * 0.18 * slipWeight;
        lumbarRoll -= sDir * 0.22 * slipWeight;
        chestPitch += 0.12 * slipWeight;
        chestYaw += sDir * 0.24 * slipWeight;
        chestRoll -= sDir * 0.28 * slipWeight;
      }
    }

    // -------------------------------------------------------------------------
    // 6. TRUE 4-PHASE KINETIC CHAIN STRIKING ENGINE
    // -------------------------------------------------------------------------
    if (fighter.state === 'STRIKING') {
      const p = fighter.strikeProgress;
      const isPunch = ['JAB', 'CROSS', 'HOOK', 'UPPERCUT', 'OVERHAND'].includes(fighter.strikeType);

      // 4-Phase Kinetic Chain Curve:
      // Phase 1 (0.00 - 0.16): Coil / Load (hip pre-turns, weight shifts to power foot)
      // Phase 2 (0.16 - 0.46): Explosive Kinetic Wave (foot -> hip -> chest -> shoulder -> arm)
      // Phase 3 (0.46 - 0.58): Apex Impact Lockout & Pronation (penetration hold)
      // Phase 4 (0.58 - 1.00): High-speed ballistic snap recoil to guard
      let coil = 0;       // Phase 1 factor
      let kineticWave = 0; // Phase 2 factor
      let ext = 0;         // Full arm / leg extension
      let pronate = 0;     // Forearm pronation angle (radians)

      if (isPunch) {
        if (p < 0.16) {
          // Phase 1: Pre-stretch & Coil
          const t = p / 0.16;
          coil = Math.sin(t * Math.PI * 0.5);
          ext = -0.05 * coil; // Slight 3cm backward chamber cock
        } else if (p < 0.46) {
          // Phase 2: Explosive Launch
          const t = (p - 0.16) / 0.30;
          kineticWave = t;
          ext = 1.0 - Math.pow(1.0 - t, 3.2); // Explosive snap curve
          pronate = Math.pow(t, 2.2) * (Math.PI * 0.5); // Pronates near impact apex
        } else if (p < 0.56) {
          // Phase 3: Apex Penetration Hold
          ext = 1.0;
          kineticWave = 1.0;
          pronate = Math.PI * 0.5;
        } else {
          // Phase 4: Ballistic Snap Recoil
          const t = (p - 0.56) / 0.44;
          const ease = t * t * (3.0 - 2.0 * t);
          ext = 1.0 - ease;
          kineticWave = 1.0 - ease;
          pronate = (1.0 - ease) * (Math.PI * 0.5);
        }
      } else {
        // Kick whip curve: circular arc pendulum
        ext = Math.sin(p * Math.PI);
        kineticWave = ext;
      }

      // Default Pro Resting Guard Positions (Offsets from shoulder)
      const restLeadFwd = 0.44 + leadHandPump;
      const restLeadLat = isOrthodox ? -0.08 : 0.08;
      const restLeadUp = 0.06;

      const restRearFwd = 0.22;
      const restRearLat = isOrthodox ? 0.06 : -0.06;
      const restRearUp = 0.08;

      switch (fighter.strikeType) {
        // ---------------------------------------------------------------------
        // A. JAB: Snappy Lead Jab down the pipe (Long reach spear jab)
        // ---------------------------------------------------------------------
        case 'JAB': {
          pelvisFwd += 0.14 * kineticWave - 0.02 * coil;
          pelvisYaw -= 0.18 * kineticWave * stanceSign - 0.04 * coil * stanceSign;
          chestYaw -= 0.52 * kineticWave * stanceSign; // Rotates lead shoulder forward into the target!
          chestPitch += 0.04 * kineticWave;

          if (isOrthodox) {
            // Orthodox: Left Lead Jab
            leftShoulderFwd += 0.16 * kineticWave; // Heavy scapular protraction forward
            leftShoulderUp += 0.055 * kineticWave; // Shoulder elevates to seal and protect jaw
            leftGlovePronation = -pronate;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.74, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restLeadUp, 0.07, ext));

            // Rear Right Glove: Glued tight to right cheek in high shield
            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp + 0.02 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.65).addScaledVector(L, 0.45).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          } else {
            // Southpaw: Right Lead Jab
            rightShoulderFwd += 0.16 * kineticWave;
            rightShoulderUp += 0.055 * kineticWave;
            rightGlovePronation = pronate;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.74, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restLeadUp, 0.07, ext));

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp + 0.02 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.65).addScaledVector(R, 0.45).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // B. CROSS: Explosive Rear Power Straight Right (Full hip & shoulder drive)
        // ---------------------------------------------------------------------
        case 'CROSS': {
          // Phase 1 Coiling & Phase 2 Kinetic Wave
          pelvisFwd += 0.18 * kineticWave - 0.03 * coil;
          pelvisYaw += (0.38 * kineticWave - 0.08 * coil) * stanceSign;
          lumbarYaw += 0.52 * kineticWave * stanceSign;
          chestYaw += 0.88 * kineticWave * stanceSign; // Heavy forward thoracic drive!
          chestPitch += 0.08 * kineticWave;

          if (isOrthodox) {
            // Rear heel pivots out, driving power from canvas
            footLiftR = 0.045 * kineticWave;
            footPitchR = -0.48 * kineticWave;
            rightShoulderFwd += 0.20 * kineticWave; // Rear shoulder explodes forward
            rightShoulderUp += 0.065 * kineticWave;
            rightGlovePronation = pronate;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.75, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.06, ext));

            // Lead Left Glove: Shields left eye & jaw
            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.60)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.05 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.68).addScaledVector(R, 0.42).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          } else {
            footLiftL = 0.045 * kineticWave;
            footPitchL = -0.48 * kineticWave;
            leftShoulderFwd += 0.20 * kineticWave;
            leftShoulderUp += 0.065 * kineticWave;
            leftGlovePronation = -pronate;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.75, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.06, ext));

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.60)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.05 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.68).addScaledVector(L, 0.42).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // C. HOOK: 90° High-Elbow Lead Hook (Full Core Torque)
        // ---------------------------------------------------------------------
        case 'HOOK': {
          pelvisYaw += (0.36 * kineticWave - 0.08 * coil) * stanceSign;
          lumbarYaw += 0.48 * kineticWave * stanceSign;
          chestYaw += 0.86 * kineticWave * stanceSign;
          chestPitch += 0.05 * kineticWave;

          if (isOrthodox) {
            // Front heel spins outward, driving hip whip
            footLiftL = 0.035 * kineticWave;
            footPitchL = -0.38 * kineticWave;
            leftShoulderFwd += 0.12 * kineticWave;
            leftShoulderUp += 0.045 * kineticWave;
            leftGlovePronation = -pronate;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.54, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, 0.36, ext))
              .addScaledVector(U, restLeadUp + 0.02 * ext);

            // Rear hand glued tight to rear cheek
            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp);

            // Strict 90° horizontal elbow flare!
            customLeftElbowHint = new THREE.Vector3().addScaledVector(L, 0.94).addScaledVector(U, 0.22).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          } else {
            footLiftR = 0.035 * kineticWave;
            footPitchR = -0.38 * kineticWave;
            rightShoulderFwd += 0.12 * kineticWave;
            rightShoulderUp += 0.045 * kineticWave;
            rightGlovePronation = pronate;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.54, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, -0.36, ext))
              .addScaledVector(U, restLeadUp + 0.02 * ext);

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp);

            customRightElbowHint = new THREE.Vector3().addScaledVector(R, 0.94).addScaledVector(U, 0.22).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // D. UPPERCUT: Dipping Solar-Plexus & Chin Scraper
        // ---------------------------------------------------------------------
        case 'UPPERCUT': {
          // Level change drop on Phase 1, explosive upward push on Phase 2
          pelvisLift = 0.06 * kineticWave - 0.04 * coil;
          pelvisFwd += 0.12 * kineticWave;
          chestPitch -= 0.12 * kineticWave;
          lumbarYaw += 0.35 * kineticWave * stanceSign;
          chestYaw += 0.55 * kineticWave * stanceSign;

          if (isOrthodox) {
            footLiftR = 0.035 * kineticWave;
            rightShoulderFwd += 0.14 * kineticWave;
            rightShoulderUp += 0.085 * kineticWave;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.48, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.46, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext));

            // High lead guard covering temple
            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.60)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.06 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.94).addScaledVector(R, 0.14).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          } else {
            footLiftL = 0.035 * kineticWave;
            leftShoulderFwd += 0.14 * kineticWave;
            leftShoulderUp += 0.085 * kineticWave;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.48, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.46, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext));

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.60)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.06 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.94).addScaledVector(L, 0.14).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // E. OVERHAND: Looping Over-the-Guard Signature Knockout Punch
        // ---------------------------------------------------------------------
        case 'OVERHAND': {
          pelvisFwd += 0.18 * kineticWave;
          pelvisYaw += 0.45 * kineticWave * stanceSign;
          lumbarYaw += 0.58 * kineticWave * stanceSign;
          chestYaw += 0.95 * kineticWave * stanceSign;
          chestPitch += 0.16 * kineticWave; // Head dips forward and off-center
          chestRoll += (isOrthodox ? -0.22 : 0.22) * kineticWave;

          if (isOrthodox) {
            footLiftR = 0.05 * kineticWave;
            footPitchR = -0.52 * kineticWave;
            rightShoulderFwd += 0.22 * kineticWave;
            rightShoulderUp += 0.085 * kineticWave;
            rightGlovePronation = pronate * 1.25;

            // Arcs upward then loops downward
            const arcHeight = Math.sin(ext * Math.PI) * 0.12;
            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.74, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, -0.04, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.18, ext) + arcHeight);

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.55)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.08 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(R, 0.72).addScaledVector(U, 0.45).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          } else {
            footLiftL = 0.05 * kineticWave;
            footPitchL = -0.52 * kineticWave;
            leftShoulderFwd += 0.22 * kineticWave;
            leftShoulderUp += 0.085 * kineticWave;
            leftGlovePronation = -pronate * 1.25;

            const arcHeight = Math.sin(ext * Math.PI) * 0.12;
            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.74, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.04, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.18, ext) + arcHeight);

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.55)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.08 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(L, 0.72).addScaledVector(U, 0.45).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // F. HEADKICK: Championship High Roundhouse with Full Hip Turnover
        // ---------------------------------------------------------------------
        case 'HEADKICK': {
          // 1. Extreme 3D Pelvis Turnover: stacks kicking hip vertically above plant hip
          pelvisRoll = -1.25 * ext * stanceSign; // True lateral pelvic tilt (lifting kicking hip high)
          pelvisYaw = (0.35 + 0.72 * ext) * stanceSign; // Hip turns over towards opponent
          pelvisLift = 0.18 * ext;
          pelvisFwd = 0.16 * ext;
          pelvisPitch = -0.08 * ext;

          // 2. Spine C-curve & Deep Thoracic Counter-Lean
          lumbarRoll = -0.42 * ext * stanceSign;
          lumbarYaw = 0.38 * ext * stanceSign;
          lumbarPitch = -0.10 * ext;

          chestPitch = -0.36 * ext; // Leans back
          chestRoll = 0.82 * ext * stanceSign; // Counter-leans away from kick
          chestYaw = 0.44 * ext * stanceSign;
          chestFwd = -0.22 * ext;

          // 3. Muay Thai Arm Whip & Plant Foot 120° Pivot
          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, -0.08).addScaledVector(R, 0.32).addScaledVector(U, -0.46 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.22).addScaledVector(U, 0.22 * ext).addScaledVector(R, 0.05);
            plantFootYawL = 2.05 * ext; // 118° heel pivot towards target
            footLiftL = 0.04 * ext;
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, -0.08).addScaledVector(L, 0.32).addScaledVector(U, -0.46 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.22).addScaledVector(U, 0.22 * ext).addScaledVector(L, 0.05);
            plantFootYawR = -2.05 * ext;
            footLiftR = 0.04 * ext;
          }
          break;
        }

        // ---------------------------------------------------------------------
        // G. BODYKICK: Rib-Cracking Liver Roundhouse
        // ---------------------------------------------------------------------
        case 'BODYKICK': {
          pelvisRoll = -0.92 * ext * stanceSign;
          pelvisYaw = (0.28 + 0.62 * ext) * stanceSign;
          pelvisLift = 0.10 * ext;
          pelvisFwd = 0.15 * ext;
          pelvisPitch = -0.06 * ext;

          lumbarRoll = -0.30 * ext * stanceSign;
          lumbarYaw = 0.34 * ext * stanceSign;
          lumbarPitch = -0.06 * ext;

          chestPitch = -0.22 * ext;
          chestRoll = 0.62 * ext * stanceSign;
          chestYaw = 0.38 * ext * stanceSign;
          chestFwd = -0.16 * ext;

          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.02).addScaledVector(R, 0.26).addScaledVector(U, -0.32 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.26).addScaledVector(U, 0.16 * ext);
            plantFootYawL = 1.65 * ext; // 95° pivot
            footLiftL = 0.03 * ext;
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.02).addScaledVector(L, 0.26).addScaledVector(U, -0.32 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.26).addScaledVector(U, 0.16 * ext);
            plantFootYawR = -1.65 * ext;
            footLiftR = 0.03 * ext;
          }
          break;
        }

        // ---------------------------------------------------------------------
        // H. LOWKICK: Low Chopping Calf Deadener (Axe Chop)
        // ---------------------------------------------------------------------
        case 'LOWKICK': {
          pelvisRoll = -0.58 * ext * stanceSign;
          pelvisYaw = (0.25 + 0.52 * ext) * stanceSign;
          pelvisLift = 0.04 * ext;
          pelvisFwd = 0.18 * ext;

          lumbarRoll = -0.20 * ext * stanceSign;
          lumbarYaw = 0.28 * ext * stanceSign;

          chestPitch = -0.14 * ext;
          chestRoll = 0.42 * ext * stanceSign;
          chestYaw = 0.32 * ext * stanceSign;
          chestFwd = -0.10 * ext;

          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.06).addScaledVector(R, 0.24).addScaledVector(U, -0.26 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.28).addScaledVector(U, 0.12 * ext);
            plantFootYawL = 1.35 * ext; // 78° pivot
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.06).addScaledVector(L, 0.24).addScaledVector(U, -0.26 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.28).addScaledVector(U, 0.12 * ext);
            plantFootYawR = -1.35 * ext;
          }
          break;
        }

        // ---------------------------------------------------------------------
        // I. TEEP: Lead Front Push Kick (Knee Chambered Thrust)
        // ---------------------------------------------------------------------
        case 'TEEP': {
          pelvisFwd = 0.24 * ext;
          pelvisPitch = -0.26 * ext; // Hip thrust backwards tilt
          pelvisRoll = (isOrthodox ? 0.10 : -0.10) * ext;
          pelvisLift = 0.06 * ext;

          lumbarPitch = -0.18 * ext;
          chestPitch = -0.28 * ext;
          chestFwd = -0.18 * ext;

          if (isOrthodox) {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.30).addScaledVector(U, 0.14 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.22).addScaledVector(U, 0.08);
          } else {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.30).addScaledVector(U, 0.14 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.22).addScaledVector(U, 0.08);
          }
          break;
        }
      }
    }

    // -------------------------------------------------------------------------
    // 7. GOREBOX FLINCH & HIT DYNAMICS OVERLAY
    // -------------------------------------------------------------------------
    if (fighter.flinchTimer > 0) {
      const flinchProgress = Math.max(0, Math.min(1.0, fighter.flinchTimer / 0.38));
      const flinchCurve = Math.sin(flinchProgress * Math.PI) * fighter.flinchIntensity;
      if (!fighter.flinchIsHead) {
        lumbarPitch += 0.40 * flinchCurve;
        chestPitch += 0.48 * flinchCurve;
        pelvisPitch -= 0.15 * flinchCurve;
      }
    }

    if (fighter.stumbleTimer > 0) {
      const stumbleFactor = fighter.stumbleTimer / 0.65;
      const stumbleOsc = Math.sin(Date.now() * 0.014);
      pelvisRoll += stumbleOsc * 0.14 * stumbleFactor;
      pelvisYaw += Math.cos(Date.now() * 0.010) * 0.18 * stumbleFactor;
      chestRoll += stumbleOsc * 0.26 * stumbleFactor;
      chestPitch -= 0.16 * stumbleFactor;
      leftShoulderUp += 0.42 * stumbleFactor;
      rightShoulderUp += 0.42 * stumbleFactor;
    }

    // -------------------------------------------------------------------------
    // 8. HIERARCHICAL KINEMATIC SPINE CHAIN (100% GAP-FREE CONTINUITY)
    // -------------------------------------------------------------------------
    // Forward is +X, Up is +Y, Right is +Z.
    // In Three.js Euler(x, y, z):
    // - x rotates around X (Forward) = Roll (Lateral tilt / miring samping)
    // - y rotates around Y (Up) = Yaw (Turnover / putaran)
    // - z rotates around Z (Right) = Pitch (Flexion/extension / bungkuk-dongak)

    // A. Pelvis: Root core
    const pelvisSlipLateral = isSlipBack ? 0 : (sDir * 0.06 * slipWeight);
    const hipSway = fighter.isMoving ? Math.sin(fighter.walkCycle) * 0.03 : 0;
    const pelvisPos = new THREE.Vector3(
      fighter.rootPosition.x + R.x * (hipSway + pelvisSlipLateral) + F.x * pelvisFwd,
      baseHeight + pelvisLift,
      fighter.rootPosition.z + R.z * (hipSway + pelvisSlipLateral) + F.z * pelvisFwd
    );

    const pelvisRotEuler = new THREE.Euler(pelvisRoll, pelvisYaw, pelvisPitch, 'YXZ');
    const pelvisQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(pelvisRotEuler));

    // Hip Sockets
    const leftHip = pelvisPos.clone().add(new THREE.Vector3(0, -0.06, -0.15).applyQuaternion(pelvisQuat));
    const rightHip = pelvisPos.clone().add(new THREE.Vector3(0, -0.06, 0.15).applyQuaternion(pelvisQuat));

    // B. Abdomen (Lumbar)
    const pelvisTopJoint = pelvisPos.clone().add(new THREE.Vector3(0.01, 0.10, 0).applyQuaternion(pelvisQuat));
    const abdomenRotEuler = new THREE.Euler(lumbarRoll, lumbarYaw, lumbarPitch, 'YXZ');
    const abdomenQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(abdomenRotEuler));
    const abdomenPos = pelvisTopJoint.clone().add(new THREE.Vector3(0, 0.08, 0).applyQuaternion(abdomenQuat));

    // C. Chest (Thoracic Ribcage)
    const abdomenTopJoint = abdomenPos.clone().add(new THREE.Vector3(0.01, 0.08, 0).applyQuaternion(abdomenQuat));
    const chestRotEuler = new THREE.Euler(chestRoll, chestYaw, chestPitch, 'YXZ');
    const chestQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(chestRotEuler));
    const chestPos = abdomenTopJoint.clone().add(new THREE.Vector3(0.01, 0.11, 0).applyQuaternion(chestQuat));

    // D. Neck
    const chestTopJoint = chestPos.clone().add(new THREE.Vector3(0.02, 0.11, 0).applyQuaternion(chestQuat));
    let neckPitch = chestPitch * 0.5 - 0.05;
    let neckYaw = chestYaw * 0.5;
    let neckRoll = chestRoll * 0.5;
    if (slipWeight > 0) {
      if (isSlipBack) neckPitch += 0.18 * slipWeight;
      else neckRoll += sDir * 0.08 * slipWeight;
    }
    if (fighter.flinchTimer > 0 && fighter.flinchIsHead) {
      const flinchProgress = Math.max(0, Math.min(1.0, fighter.flinchTimer / 0.38));
      const flinchCurve = Math.sin(flinchProgress * Math.PI) * fighter.flinchIntensity;
      neckPitch -= 0.35 * flinchCurve;
      neckRoll += fighter.flinchSide * 0.28 * flinchCurve;
      neckYaw += fighter.flinchSide * 0.18 * flinchCurve;
    }
    const neckRotEuler = new THREE.Euler(neckRoll, neckYaw, neckPitch, 'YXZ');
    const neckQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(neckRotEuler));
    const neckPos = chestTopJoint.clone().add(new THREE.Vector3(0, 0.055, 0).applyQuaternion(neckQuat));

    // E. Head (Tucked chin looking up at opponent)
    const neckTopJoint = neckPos.clone().add(new THREE.Vector3(0, 0.055, 0).applyQuaternion(neckQuat));
    let headPitch = -0.11; // Tucked chin
    let headYaw = 0.0;
    let headRoll = 0.0;
    if (fighter.state === 'STRIKING' && fighter.strikeType === 'JAB') headPitch = -0.16;
    if (slipWeight > 0) {
      if (isSlipBack) headPitch += 0.22 * slipWeight;
      else {
        headYaw = sDir * 0.12 * slipWeight;
        headRoll = sDir * 0.16 * slipWeight;
      }
    }
    if (fighter.flinchTimer > 0 && fighter.flinchIsHead) {
      const flinchProgress = Math.max(0, Math.min(1.0, fighter.flinchTimer / 0.38));
      const flinchCurve = Math.sin(flinchProgress * Math.PI) * fighter.flinchIntensity;
      headPitch -= 0.58 * flinchCurve;
      headRoll += fighter.flinchSide * 0.44 * flinchCurve;
      headYaw += fighter.flinchSide * 0.32 * flinchCurve;
    }
    const headRotEuler = new THREE.Euler(headRoll, headYaw, headPitch, 'YXZ');
    const headQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(headRotEuler));
    const headPos = neckTopJoint.clone().add(new THREE.Vector3(0.02, 0.10, 0).applyQuaternion(headQuat));

    // -------------------------------------------------------------------------
    // 9. LEGS & ARTICULATED FEET SOLVERS
    // -------------------------------------------------------------------------
    const stepL = fighter.isMoving ? Math.sin(fighter.walkCycle) * 0.16 : 0;
    const stepR = fighter.isMoving ? -Math.sin(fighter.walkCycle) * 0.16 : 0;
    const liftL = fighter.isMoving ? Math.max(0, Math.cos(fighter.walkCycle)) * 0.08 : 0;
    const liftR = fighter.isMoving ? Math.max(0, -Math.cos(fighter.walkCycle)) * 0.08 : 0;

    const isAirborne = fighter.rootPosition.y > 0.04;
    const airProgress = Math.min(1.0, fighter.rootPosition.y / 0.52);
    // Mid-air athletic knee tuck: knees fold up in air, toes flex downward
    const midAirKneeTuck = isAirborne ? Math.sin(airProgress * Math.PI) * 0.16 : 0;

    // During squat wind-up or landing shock absorption, feet stay firmly on canvas (0.04) while knees and hips compress!
    const footGroundY = (fighter.jumpState === 'WINDUP' || fighter.jumpState === 'LAND')
      ? 0.04
      : (0.04 + fighter.rootPosition.y);

    const leadFwdL = 0.02 + 0.20 * stanceSign;
    const leadFwdR = 0.02 - 0.20 * stanceSign;
    const lateralOffsetL = 0.03 * stanceSign;
    const lateralOffsetR = -0.03 * stanceSign;

    const leftAnkle = leftHip.clone()
      .addScaledVector(F, leadFwdL + stepL)
      .addScaledVector(L, 0.03 + lateralOffsetL + strafeL);
    leftAnkle.y = footGroundY + liftL + footLiftL + midAirKneeTuck + 0.04;

    const rightAnkle = rightHip.clone()
      .addScaledVector(F, leadFwdR + stepR)
      .addScaledVector(R, 0.03 + lateralOffsetR + strafeR);
    rightAnkle.y = footGroundY + liftR + footLiftR + midAirKneeTuck + 0.04;

    if (isAirborne) {
      footPitchL += 0.38 * airProgress;
      footPitchR += 0.38 * airProgress;
    }

    // Kicking Target Trajectories
    if (fighter.state === 'STRIKING') {
      const p = fighter.strikeProgress;
      const ext = Math.sin(p * Math.PI);
      const groundLeftAnkle = leftAnkle.clone();
      const groundRightAnkle = rightAnkle.clone();

      if (fighter.strikeType === 'HEADKICK') {
        const kickingHip = isOrthodox ? rightHip : leftHip;
        const kickingAnkle = isOrthodox ? rightAnkle : leftAnkle;
        const groundPos = isOrthodox ? groundRightAnkle : groundLeftAnkle;
        const oppSideVec = isOrthodox ? L : R;
        const outSideVec = isOrthodox ? R : L;

        const apexKickTarget = kickingHip.clone().addScaledVector(F, 0.62).addScaledVector(oppSideVec, 0.28);
        apexKickTarget.y = 1.54;

        const kickDelta = new THREE.Vector3().subVectors(apexKickTarget, kickingHip);
        const kLen = kickDelta.length();
        if (kLen > 0.812) {
          kickDelta.multiplyScalar(0.812 / kLen);
          apexKickTarget.copy(kickingHip).add(kickDelta);
        }

        kickingAnkle.lerpVectors(groundPos, apexKickTarget, ext);
        const lateralChamber = Math.sin(p * Math.PI) * (1.0 - p) * 0.24;
        kickingAnkle.addScaledVector(outSideVec, lateralChamber);

        if (isOrthodox) {
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.72).addScaledVector(L, 0.68).addScaledVector(U, 0.10).normalize();
        } else {
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.72).addScaledVector(R, 0.68).addScaledVector(U, 0.10).normalize();
        }
      } else if (fighter.strikeType === 'BODYKICK') {
        const kickingHip = isOrthodox ? rightHip : leftHip;
        const kickingAnkle = isOrthodox ? rightAnkle : leftAnkle;
        const groundPos = isOrthodox ? groundRightAnkle : groundLeftAnkle;
        const oppSideVec = isOrthodox ? L : R;
        const outSideVec = isOrthodox ? R : L;

        const apexKickTarget = kickingHip.clone().addScaledVector(F, 0.60).addScaledVector(oppSideVec, 0.26);
        apexKickTarget.y = 1.05;

        const kickDelta = new THREE.Vector3().subVectors(apexKickTarget, kickingHip);
        const kLen = kickDelta.length();
        if (kLen > 0.812) {
          kickDelta.multiplyScalar(0.812 / kLen);
          apexKickTarget.copy(kickingHip).add(kickDelta);
        }

        kickingAnkle.lerpVectors(groundPos, apexKickTarget, ext);
        const lateralChamber = Math.sin(p * Math.PI) * (1.0 - p) * 0.20;
        kickingAnkle.addScaledVector(outSideVec, lateralChamber);

        if (isOrthodox) {
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.75).addScaledVector(L, 0.64).addScaledVector(U, 0.05).normalize();
        } else {
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.75).addScaledVector(R, 0.64).addScaledVector(U, 0.05).normalize();
        }
      } else if (fighter.strikeType === 'LOWKICK') {
        const kickingHip = isOrthodox ? rightHip : leftHip;
        const kickingAnkle = isOrthodox ? rightAnkle : leftAnkle;
        const groundPos = isOrthodox ? groundRightAnkle : groundLeftAnkle;
        const oppSideVec = isOrthodox ? L : R;
        const outSideVec = isOrthodox ? R : L;

        const apexKickTarget = kickingHip.clone().addScaledVector(F, 0.58).addScaledVector(oppSideVec, 0.22);
        apexKickTarget.y = 0.42;

        const kickDelta = new THREE.Vector3().subVectors(apexKickTarget, kickingHip);
        const kLen = kickDelta.length();
        if (kLen > 0.812) {
          kickDelta.multiplyScalar(0.812 / kLen);
          apexKickTarget.copy(kickingHip).add(kickDelta);
        }

        kickingAnkle.lerpVectors(groundPos, apexKickTarget, ext);
        const lateralChamber = Math.sin(p * Math.PI) * (1.0 - p) * 0.16;
        kickingAnkle.addScaledVector(outSideVec, lateralChamber);

        if (isOrthodox) {
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.80).addScaledVector(L, 0.55).addScaledVector(U, -0.22).normalize();
        } else {
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.80).addScaledVector(R, 0.55).addScaledVector(U, -0.22).normalize();
        }
      } else if (fighter.strikeType === 'TEEP') {
        const teepHip = isOrthodox ? leftHip : rightHip;
        const teepAnkle = isOrthodox ? leftAnkle : rightAnkle;
        const groundPos = isOrthodox ? groundLeftAnkle : groundRightAnkle;

        const apexKickTarget = teepHip.clone().addScaledVector(F, 0.72);
        apexKickTarget.y = 0.98;

        const kickDelta = new THREE.Vector3().subVectors(apexKickTarget, teepHip);
        const kLen = kickDelta.length();
        if (kLen > 0.812) {
          kickDelta.multiplyScalar(0.812 / kLen);
          apexKickTarget.copy(teepHip).add(kickDelta);
        }

        teepAnkle.lerpVectors(groundPos, apexKickTarget, ext);

        if (isOrthodox) {
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.92).addScaledVector(U, 0.38).normalize();
        } else {
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.92).addScaledVector(U, 0.38).normalize();
        }
      }
    }

    // 2-Bone Analytical IK on Legs
    const leftKneeHint = customLeftKneeHint || F;
    const rightKneeHint = customRightKneeHint || F;

    const leftKnee = solve2BoneIK(leftHip, leftAnkle, 0.42, 0.40, leftKneeHint);
    const rightKnee = solve2BoneIK(rightHip, rightAnkle, 0.42, 0.40, rightKneeHint);

    const leftThighPos = new THREE.Vector3().addVectors(leftHip, leftKnee).multiplyScalar(0.5);
    const rightThighPos = new THREE.Vector3().addVectors(rightHip, rightKnee).multiplyScalar(0.5);
    const leftShinPos = new THREE.Vector3().addVectors(leftKnee, leftAnkle).multiplyScalar(0.5);
    const rightShinPos = new THREE.Vector3().addVectors(rightKnee, rightAnkle).multiplyScalar(0.5);

    const leftThighQuat = safeLimbQuat(leftHip, leftKnee, leftKneeHint, U);
    const rightThighQuat = safeLimbQuat(rightHip, rightKnee, rightKneeHint, U);
    const leftShinQuat = safeLimbQuat(leftKnee, leftAnkle, leftKneeHint, U);
    const rightShinQuat = safeLimbQuat(rightKnee, rightAnkle, rightKneeHint, U);

    // Foot Solvers
    let kickExt = 0;
    let isKick = false;
    if (fighter.state === 'STRIKING') {
      kickExt = Math.sin(fighter.strikeProgress * Math.PI);
      isKick = ['HEADKICK', 'BODYKICK', 'LOWKICK', 'TEEP'].includes(fighter.strikeType);
    }

    const isKickingRight = isKick && kickExt > 0.001 && (
      ((fighter.strikeType === 'HEADKICK' || fighter.strikeType === 'BODYKICK' || fighter.strikeType === 'LOWKICK') && isOrthodox) ||
      (fighter.strikeType === 'TEEP' && !isOrthodox)
    );
    const isKickingLeft = isKick && kickExt > 0.001 && (
      ((fighter.strikeType === 'HEADKICK' || fighter.strikeType === 'BODYKICK' || fighter.strikeType === 'LOWKICK') && !isOrthodox) ||
      (fighter.strikeType === 'TEEP' && isOrthodox)
    );

    const leftGroundPos = leftAnkle.clone().addScaledVector(F, 0.04);
    leftGroundPos.y = footGroundY + liftL + footLiftL * 0.5;
    const leftGroundQuat = rootQuat.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(footPitchL, 0.12 * stanceSign + plantFootYawL, 0, 'YXZ'))
    );

    const rightGroundPos = rightAnkle.clone().addScaledVector(F, 0.04);
    rightGroundPos.y = footGroundY + liftR + footLiftR * 0.5;
    const rightGroundQuat = rootQuat.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(footPitchR, 0.22 * stanceSign + plantFootYawR, 0, 'YXZ'))
    );

    const leftFootSolved = solveArticulatedFoot(
      leftAnkle, leftKnee, leftShinQuat, leftGroundPos, leftGroundQuat,
      isKickingLeft, fighter.strikeType, kickExt, F, U
    );
    const rightFootSolved = solveArticulatedFoot(
      rightAnkle, rightKnee, rightShinQuat, rightGroundPos, rightGroundQuat,
      isKickingRight, fighter.strikeType, kickExt, F, U
    );

    // -------------------------------------------------------------------------
    // 10. ARMS & ARTICULATED GLOVE SOLVERS
    // -------------------------------------------------------------------------
    const safeLeftFwd = THREE.MathUtils.clamp(leftShoulderFwd, -0.04, 0.22);
    const safeLeftUp = THREE.MathUtils.clamp(leftShoulderUp, -0.02, 0.10);
    const safeRightFwd = THREE.MathUtils.clamp(rightShoulderFwd, -0.04, 0.22);
    const safeRightUp = THREE.MathUtils.clamp(rightShoulderUp, -0.02, 0.10);

    const leftShoulder = chestPos.clone().add(
      new THREE.Vector3(0.01 + safeLeftFwd, 0.06 + safeLeftUp, -0.21).applyQuaternion(chestQuat)
    );
    const rightShoulder = chestPos.clone().add(
      new THREE.Vector3(0.01 + safeRightFwd, 0.06 + safeRightUp, 0.21).applyQuaternion(chestQuat)
    );

    // Rest Positions
    let leftWristPos;
    let rightWristPos;

    if (isOrthodox) {
      leftWristPos = leftShoulder.clone()
        .addScaledVector(F, 0.44 + leadHandPump)
        .addScaledVector(L, 0.08)
        .addScaledVector(U, 0.06);
      rightWristPos = rightShoulder.clone()
        .addScaledVector(F, 0.22)
        .addScaledVector(R, 0.06)
        .addScaledVector(U, 0.08);
    } else {
      leftWristPos = leftShoulder.clone()
        .addScaledVector(F, 0.22)
        .addScaledVector(L, 0.06)
        .addScaledVector(U, 0.08);
      rightWristPos = rightShoulder.clone()
        .addScaledVector(F, 0.44 + leadHandPump)
        .addScaledVector(R, 0.08)
        .addScaledVector(U, 0.06);
    }

    const maxArmReach = 0.76;

    // Slip compensation (keeps strike on target when dodging)
    if (slipWeight > 0) {
      if (isSlipBack) {
        if (leftGloveTarget) leftGloveTarget.addScaledVector(F, 0.16 * slipWeight);
        if (rightGloveTarget) rightGloveTarget.addScaledVector(F, 0.20 * slipWeight);
      } else {
        const slipComp = sDir * 0.09 * slipWeight;
        if (leftGloveTarget) leftGloveTarget.addScaledVector(L, slipComp);
        if (rightGloveTarget) rightGloveTarget.addScaledVector(L, slipComp);
      }
    }

    if (leftGloveTarget) {
      const armTarget = leftGloveTarget.clone();
      const tLen = armTarget.length();
      if (tLen > maxArmReach) armTarget.multiplyScalar(maxArmReach / tLen);
      leftWristPos.copy(leftShoulder).add(armTarget);
    }
    if (rightGloveTarget) {
      const armTarget = rightGloveTarget.clone();
      const tLen = armTarget.length();
      if (tLen > maxArmReach) armTarget.multiplyScalar(maxArmReach / tLen);
      rightWristPos.copy(rightShoulder).add(armTarget);
    }

    const isHook = fighter.state === 'STRIKING' && fighter.strikeType === 'HOOK';
    const isUppercut = fighter.state === 'STRIKING' && fighter.strikeType === 'UPPERCUT';

    const leftElbowHint = customLeftElbowHint || (
      (isHook && isOrthodox)
        ? new THREE.Vector3().addScaledVector(L, 0.94).addScaledVector(U, 0.22).normalize()
        : isOrthodox
        ? new THREE.Vector3().addScaledVector(U, -0.75).addScaledVector(L, 0.55).addScaledVector(F, 0.25).normalize()
        : new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.35).addScaledVector(F, 0.10).normalize()
    );

    const rightElbowHint = customRightElbowHint || (
      (isHook && !isOrthodox)
        ? new THREE.Vector3().addScaledVector(R, 0.94).addScaledVector(U, 0.22).normalize()
        : (isUppercut && isOrthodox)
        ? new THREE.Vector3().addScaledVector(U, -0.94).addScaledVector(R, 0.14).normalize()
        : !isOrthodox
        ? new THREE.Vector3().addScaledVector(U, -0.75).addScaledVector(R, 0.55).addScaledVector(F, 0.25).normalize()
        : new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.35).addScaledVector(F, 0.10).normalize()
    );

    const leftElbowSolved = solve2BoneIK(leftShoulder, leftWristPos, 0.35, 0.31, leftElbowHint);
    const rightElbowSolved = solve2BoneIK(rightShoulder, rightWristPos, 0.35, 0.31, rightElbowHint);

    const leftUpperArmPos = new THREE.Vector3().addVectors(leftShoulder, leftElbowSolved).multiplyScalar(0.5);
    const rightUpperArmPos = new THREE.Vector3().addVectors(rightShoulder, rightElbowSolved).multiplyScalar(0.5);
    const leftForearmPos = new THREE.Vector3().addVectors(leftElbowSolved, leftWristPos).multiplyScalar(0.5);
    const rightForearmPos = new THREE.Vector3().addVectors(rightElbowSolved, rightWristPos).multiplyScalar(0.5);

    const leftUpperArmQuat = safeLimbQuat(leftShoulder, leftElbowSolved, leftElbowHint, F);
    const rightUpperArmQuat = safeLimbQuat(rightShoulder, rightElbowSolved, rightElbowHint, F);
    const leftForearmQuat = safeLimbQuat(leftElbowSolved, leftWristPos, leftElbowHint, F);
    const rightForearmQuat = safeLimbQuat(rightElbowSolved, rightWristPos, rightElbowHint, F);

    const leftGlovePos = leftWristPos.clone().addScaledVector(
      new THREE.Vector3().subVectors(leftWristPos, leftElbowSolved).normalize(),
      0.08
    );
    const rightGlovePos = rightWristPos.clone().addScaledVector(
      new THREE.Vector3().subVectors(rightWristPos, rightElbowSolved).normalize(),
      0.08
    );

    const leftGloveQuat = safeGloveQuat(leftElbowSolved, leftWristPos, F, leftGlovePronation);
    const rightGloveQuat = safeGloveQuat(rightElbowSolved, rightWristPos, F, rightGlovePronation);

    return {
      pelvis: { p: pelvisPos, q: pelvisQuat },
      abdomen: { p: abdomenPos, q: abdomenQuat },
      chest: { p: chestPos, q: chestQuat },
      neck: { p: neckPos, q: neckQuat },
      head: { p: headPos, q: headQuat },
      leftUpperArm: { p: leftUpperArmPos, q: leftUpperArmQuat },
      rightUpperArm: { p: rightUpperArmPos, q: rightUpperArmQuat },
      leftForearm: { p: leftForearmPos, q: leftForearmQuat },
      rightForearm: { p: rightForearmPos, q: rightForearmQuat },
      leftGlove: { p: leftGlovePos, q: leftGloveQuat },
      rightGlove: { p: rightGlovePos, q: rightGloveQuat },
      leftThigh: { p: leftThighPos, q: leftThighQuat },
      rightThigh: { p: rightThighPos, q: rightThighQuat },
      leftShin: { p: leftShinPos, q: leftShinQuat },
      rightShin: { p: rightShinPos, q: rightShinQuat },
      leftFoot: { p: leftFootSolved.p, q: leftFootSolved.q },
      rightFoot: { p: rightFootSolved.p, q: rightFootSolved.q },
    };
  }
}
