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

    // -------------------------------------------------------------------------
    // B. ROCK / STAGGER / WOBBLY SURVIVAL STRUGGLE (JELLY LEGS BUT STAYING UPRIGHT)
    // -------------------------------------------------------------------------
    let rockIntensity = 0;
    if (fighter.isRocked || (fighter.rockTimer && fighter.rockTimer > 0)) {
      rockIntensity = Math.max(rockIntensity, Math.min(1.0, (fighter.rockTimer || 1.0) / 1.5));
    }
    if (fighter.stumbleTimer && fighter.stumbleTimer > 0) {
      rockIntensity = Math.max(rockIntensity, Math.min(1.2, fighter.stumbleTimer * 1.8));
    }

    // Critical low-health zones (< 30) trigger continuous wobbly survival struggle
    const headCrit = (fighter.headHealth !== undefined && fighter.headHealth < 30) ? (30 - fighter.headHealth) / 30 : 0;
    const bodyCrit = (fighter.bodyHealth !== undefined && fighter.bodyHealth < 30) ? (30 - fighter.bodyHealth) / 30 : 0;
    const legCrit = (fighter.legHealth !== undefined && fighter.legHealth < 30) ? (30 - fighter.legHealth) / 30 : 0;
    const damageCrit = Math.max(headCrit, bodyCrit, legCrit);
    if (damageCrit > 0) {
      rockIntensity = Math.max(rockIntensity, 0.35 + damageCrit * 0.65);
    }

    // Dynamic jelly legs & balance recovery variables
    let jellyLegsDrop = 0;
    let wobblePelvisX = 0;
    let wobblePelvisZ = 0;
    let wobblePelvisYaw = 0;
    let wobbleChestRoll = 0;
    let wobbleChestPitch = 0;
    let wobbleHeadPitch = 0;
    let wobbleHeadRoll = 0;
    let wobbleHeadYaw = 0;
    let emergencyFootSpread = 0;

    if (rockIntensity > 0.02) {
      // 1. Jelly legs micro-buckle: lutut lemas melorot turun lalu otot refleks menahan agar tidak jatuh
      const buckleSin = Math.sin(time * 7.2);
      jellyLegsDrop = Math.pow(Math.max(0, buckleSin), 3.2) * 0.075 * rockIntensity;

      // 2. Multi-frequency unsteady wobble: tubuh bergoyang oleng limbung
      wobblePelvisX = (Math.sin(time * 8.5) * 0.045 + Math.cos(time * 14.2) * 0.025) * rockIntensity;
      wobblePelvisZ = (Math.cos(time * 6.5) * 0.055 + Math.sin(time * 11.8) * 0.030) * rockIntensity;
      wobblePelvisYaw = (Math.sin(time * 5.8) * 0.20 + Math.cos(time * 9.5) * 0.08) * rockIntensity;

      // 3. Vestibular balance righting reflex: dada & pinggang mengkompensasi ke arah berlawanan
      wobbleChestRoll = -wobblePelvisZ * 1.35;
      wobbleChestPitch = (Math.sin(time * 7.5) * 0.15 - 0.04) * rockIntensity;

      // 4. Heavy loose head wobble
      wobbleHeadPitch = (Math.cos(time * 9.0) * 0.18) * rockIntensity;
      wobbleHeadRoll = (Math.sin(time * 8.2) * 0.22) * rockIntensity;
      wobbleHeadYaw = (Math.cos(time * 7.0) * 0.20) * rockIntensity;

      // 5. Emergency wide footing: memperlebar tumpuan kaki agar tidak tumbang
      emergencyFootSpread = 0.09 * rockIntensity;

      // Specific regional trauma posture
      if (bodyCrit > 0.15) {
        wobbleChestPitch += 0.24 * bodyCrit;
        jellyLegsDrop += 0.035 * bodyCrit;
      }
      if (headCrit > 0.15) {
        wobbleHeadPitch += 0.18 * headCrit;
        wobbleHeadRoll += Math.sin(time * 4.2) * 0.26 * headCrit;
      }
      if (legCrit > 0.15) {
        jellyLegsDrop += Math.sin(time * 8.5) * 0.03 * legCrit;
      }
    }

    // C. Vertical center of gravity & deep athletic combat stance
    const crouchDrop = fighter.isCrouching ? 0.22 : 0;
    const slipDip = isSlipBack ? (slipWeight * 0.10) : (slipWeight * 0.22); // Deep knee bend under punches
    const jumpDip = fighter.jumpCompression || 0;
    // Deep combat stance with dynamic jelly legs buckling:
    const baseHeight = 0.782 + fighter.rootPosition.y - crouchDrop - slipDip - jumpDip - jellyLegsDrop + idleOsc * 0.016;

    // D. Lead hand measuring / framing micro-oscillation (UFC hand fighting)
    const leadHandPump = (!fighter.isMoving && rockIntensity < 0.3) ? Math.sin(time * 3.8) * 0.032 : 0;

    // -------------------------------------------------------------------------
    // 4. SKELETAL ROTATION & POSITION VARIABLES
    // -------------------------------------------------------------------------
    // Pelvis (Base mass anchor)
    let pelvisPitch = 0.03 + idleOsc * 0.01;
    let pelvisYaw = 0.32 * stanceSign + (isSlipBack ? 0 : (sDir * 0.28 * slipWeight)) + wobblePelvisYaw;
    let pelvisRoll = wobblePelvisZ;
    let pelvisLift = 0.0;
    let pelvisFwd = weightSway + wobblePelvisX;

    // Lumbar (Core obliques)
    let lumbarPitch = 0.07 + breath;
    let lumbarYaw = 0.22 * stanceSign;
    let lumbarRoll = 0.0;

    // Chest (Thoracic ribcage)
    let chestPitch = 0.06 - breath + wobbleChestPitch;
    let chestYaw = 0.40 * stanceSign;
    let chestRoll = wobbleChestRoll;
    let chestFwd = 0.05;

    // Jump muscle coiling & landing shock absorption (hips hinge back, torso absorbs gravity)
    if (jumpDip > 0.001) {
      const dipRatio = Math.min(1.0, jumpDip / 0.15);
      pelvisPitch += 0.22 * dipRatio;
      pelvisFwd -= 0.06 * dipRatio;
      chestPitch += 0.26 * dipRatio;
    }

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
    // 5. DEFENSIVE SLIP & PULL-COUNTER ANATOMICAL DEFORMATION (DEEP ATHLETIC SLIPS)
    // -------------------------------------------------------------------------
    if (slipWeight > 0) {
      if (isSlipBack) {
        // AUTHENTIC EA SPORTS UFC 4 PULL SLIP (<kbd>R</kbd>):
        // Seluruh badan (pinggul, pinggang, dada, leher, dan kepala) condong mundur ~30 derajat!
        pelvisFwd -= 0.18 * slipWeight;     // Hips shift back deeply onto rear plant foot
        pelvisPitch += 0.14 * slipWeight;   // Backward pelvic hinge
        pelvisLift -= 0.06 * slipWeight;    // Rear knee flexes down to absorb mass
        lumbarPitch += 0.34 * slipWeight;   // Core arches backward (+Pitch is lean back)
        lumbarYaw -= 0.14 * stanceSign * slipWeight;
        chestPitch += 0.54 * slipWeight;    // Upper thoracic torso leans back ~31 deg out of danger!
        chestFwd -= 0.20 * slipWeight;      // Chest translates physically backward
        chestYaw -= 0.18 * stanceSign * slipWeight; // Lead shoulder turns inside protecting jaw
        if (isOrthodox) {
          leftShoulderUp += 0.09 * slipWeight; // Lead shoulder covers chin
          leftShoulderFwd += 0.05 * slipWeight;
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.75).addScaledVector(R, 0.45).normalize();
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.95).addScaledVector(L, 0.10).normalize();
        } else {
          rightShoulderUp += 0.09 * slipWeight;
          rightShoulderFwd += 0.05 * slipWeight;
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.75).addScaledVector(L, 0.45).normalize();
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.95).addScaledVector(R, 0.10).normalize();
        }
      } else {
        // DEEP LATERAL SLIPS (<kbd>Q</kbd> / <kbd>E</kbd>) (Slip cleanly outside the punch trajectory)
        pelvisRoll -= sDir * 0.28 * slipWeight;
        pelvisYaw += sDir * 0.28 * slipWeight;
        lumbarPitch += 0.14 * slipWeight;
        lumbarYaw += sDir * 0.32 * slipWeight;
        lumbarRoll -= sDir * 0.45 * slipWeight;
        chestPitch += 0.26 * slipWeight; // Torso dips under the punch
        chestYaw += sDir * 0.38 * slipWeight;
        chestRoll -= sDir * 0.65 * slipWeight; // Deep ~37° lateral head and torso displacement!
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

      // Authentic Human Proportions: Resting Guard at chest level
      const restLeadFwd = 0.24 + leadHandPump;
      const restLeadLat = isOrthodox ? -0.08 : 0.08;
      const restLeadUp = -0.08; // Mid-chest level

      const restRearFwd = 0.14;
      const restRearLat = isOrthodox ? 0.08 : -0.08;
      const restRearUp = -0.05; // Upper-chest level protecting chin

      switch (fighter.strikeType) {
        // ---------------------------------------------------------------------
        // A. JAB: Snappy Lead Jab down the pipe (Natural Human 70cm Reach)
        // ---------------------------------------------------------------------
        case 'JAB': {
          pelvisFwd += 0.07 * kineticWave - 0.02 * coil;
          pelvisYaw -= 0.14 * kineticWave * stanceSign - 0.03 * coil * stanceSign;
          chestYaw -= 0.38 * kineticWave * stanceSign; // Rotates lead shoulder cleanly forward
          chestPitch += 0.03 * kineticWave;

          if (isOrthodox) {
            // Orthodox: Left Lead Jab
            leftShoulderFwd += 0.08 * kineticWave; // Natural anatomical scapular glide
            leftShoulderUp += 0.05 * kineticWave;
            leftGlovePronation = -pronate;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.58, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restLeadUp, 0.05, ext));

            // Rear Right Glove: Glued tight to right cheek in high shield
            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp + 0.03 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.65).addScaledVector(L, 0.45).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          } else {
            // Southpaw: Right Lead Jab
            rightShoulderFwd += 0.08 * kineticWave;
            rightShoulderUp += 0.05 * kineticWave;
            rightGlovePronation = pronate;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.58, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restLeadUp, 0.05, ext));

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp + 0.03 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.65).addScaledVector(R, 0.45).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // B. CROSS: Explosive Rear Power Straight Right (Full hip & shoulder drive)
        // ---------------------------------------------------------------------
        // ---------------------------------------------------------------------
        // B. CROSS: Explosive Rear Power Straight Right (Natural Human 74cm Reach)
        // ---------------------------------------------------------------------
        case 'CROSS': {
          pelvisFwd += 0.08 * kineticWave - 0.02 * coil;
          pelvisYaw += (0.28 * kineticWave - 0.06 * coil) * stanceSign;
          lumbarYaw += 0.38 * kineticWave * stanceSign;
          chestYaw += 0.65 * kineticWave * stanceSign; // Rotational thoracic drive
          chestPitch += 0.05 * kineticWave;

          if (isOrthodox) {
            footLiftR = 0.035 * kineticWave;
            footPitchR = -0.38 * kineticWave;
            rightShoulderFwd += 0.09 * kineticWave;
            rightShoulderUp += 0.06 * kineticWave;
            rightGlovePronation = pronate;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.60, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.05, ext));

            // Lead Left Glove: Shields left eye & jaw
            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.70)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.04 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.68).addScaledVector(R, 0.42).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          } else {
            footLiftL = 0.035 * kineticWave;
            footPitchL = -0.38 * kineticWave;
            leftShoulderFwd += 0.09 * kineticWave;
            leftShoulderUp += 0.06 * kineticWave;
            leftGlovePronation = -pronate;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.60, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.05, ext));

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.70)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.04 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.68).addScaledVector(L, 0.42).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // C. HOOK: Compact 90° Bent-Arm Lead Hook (Rotational Pocket Strike)
        // ---------------------------------------------------------------------
        case 'HOOK': {
          pelvisFwd += 0.04 * kineticWave;
          pelvisYaw += (0.28 * kineticWave - 0.06 * coil) * stanceSign;
          lumbarYaw += 0.38 * kineticWave * stanceSign;
          chestYaw += 0.62 * kineticWave * stanceSign;
          chestPitch += 0.04 * kineticWave;

          if (isOrthodox) {
            footLiftL = 0.03 * kineticWave;
            footPitchL = -0.32 * kineticWave;
            leftShoulderFwd += 0.06 * kineticWave;
            leftShoulderUp += 0.04 * kineticWave;
            leftGlovePronation = -pronate;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.34, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, 0.20, ext))
              .addScaledVector(U, restLeadUp + 0.06 * ext);

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp + 0.02 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(L, 0.94).addScaledVector(U, 0.22).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          } else {
            footLiftR = 0.03 * kineticWave;
            footPitchR = -0.32 * kineticWave;
            rightShoulderFwd += 0.06 * kineticWave;
            rightShoulderUp += 0.04 * kineticWave;
            rightGlovePronation = pronate;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restLeadFwd, 0.34, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restLeadLat, -0.20, ext))
              .addScaledVector(U, restLeadUp + 0.06 * ext);

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restRearFwd)
              .addScaledVector(R, restRearLat)
              .addScaledVector(U, restRearUp + 0.02 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(R, 0.94).addScaledVector(U, 0.22).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // D. UPPERCUT: Compact Inside Chin Scoop
        // ---------------------------------------------------------------------
        case 'UPPERCUT': {
          pelvisLift = 0.05 * kineticWave - 0.03 * coil;
          pelvisFwd += 0.04 * kineticWave;
          chestPitch -= 0.08 * kineticWave;
          lumbarYaw += 0.28 * kineticWave * stanceSign;
          chestYaw += 0.42 * kineticWave * stanceSign;

          if (isOrthodox) {
            footLiftR = 0.03 * kineticWave;
            rightShoulderFwd += 0.06 * kineticWave;
            rightShoulderUp += 0.07 * kineticWave;

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.26, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.30, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext));

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.70)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.04 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.94).addScaledVector(R, 0.14).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          } else {
            footLiftL = 0.03 * kineticWave;
            leftShoulderFwd += 0.06 * kineticWave;
            leftShoulderUp += 0.07 * kineticWave;

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.26, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.30, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.0, ext));

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.70)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.04 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.94).addScaledVector(L, 0.14).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // E. OVERHAND: Looping Over-the-Guard Power Punch (Human Reach)
        // ---------------------------------------------------------------------
        case 'OVERHAND': {
          pelvisFwd += 0.09 * kineticWave;
          pelvisYaw += 0.34 * kineticWave * stanceSign;
          lumbarYaw += 0.44 * kineticWave * stanceSign;
          chestYaw += 0.72 * kineticWave * stanceSign;
          chestPitch += 0.12 * kineticWave;
          chestRoll += (isOrthodox ? -0.16 : 0.16) * kineticWave;

          if (isOrthodox) {
            footLiftR = 0.04 * kineticWave;
            footPitchR = -0.42 * kineticWave;
            rightShoulderFwd += 0.09 * kineticWave;
            rightShoulderUp += 0.07 * kineticWave;
            rightGlovePronation = pronate * 1.25;

            const arcHeight = Math.sin(ext * Math.PI) * 0.10;
            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.54, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, -0.04, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.12, ext) + arcHeight);

            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.65)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.05 * ext);

            customRightElbowHint = new THREE.Vector3().addScaledVector(R, 0.72).addScaledVector(U, 0.45).normalize();
            customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(L, 0.25).normalize();
          } else {
            footLiftL = 0.04 * kineticWave;
            footPitchL = -0.42 * kineticWave;
            leftShoulderFwd += 0.09 * kineticWave;
            leftShoulderUp += 0.07 * kineticWave;
            leftGlovePronation = -pronate * 1.25;

            const arcHeight = Math.sin(ext * Math.PI) * 0.10;
            leftGloveTarget = new THREE.Vector3()
              .addScaledVector(F, THREE.MathUtils.lerp(restRearFwd, 0.54, ext))
              .addScaledVector(R, THREE.MathUtils.lerp(restRearLat, 0.04, ext))
              .addScaledVector(U, THREE.MathUtils.lerp(restRearUp, 0.12, ext) + arcHeight);

            rightGloveTarget = new THREE.Vector3()
              .addScaledVector(F, restLeadFwd * 0.65)
              .addScaledVector(R, restLeadLat)
              .addScaledVector(U, restLeadUp + 0.05 * ext);

            customLeftElbowHint = new THREE.Vector3().addScaledVector(L, 0.72).addScaledVector(U, 0.45).normalize();
            customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.88).addScaledVector(R, 0.25).normalize();
          }
          break;
        }

        // ---------------------------------------------------------------------
        // F. HEADKICK: Championship High Roundhouse with Full Hip Turnover & Deep Torso Lean
        // ---------------------------------------------------------------------
        case 'HEADKICK': {
          // 1. Extreme 3D Pelvis Turnover: stacks kicking hip vertically above plant hip
          pelvisRoll = -0.78 * ext * stanceSign; // True lateral pelvic tilt (lifting kicking hip high)
          pelvisYaw = (0.42 + 0.88 * ext) * stanceSign; // Hip turns over completely towards opponent
          pelvisLift = 0.14 * ext;
          pelvisFwd = 0.12 * ext;
          pelvisPitch = 0.14 * ext; // Backward pelvic tilt

          // 2. Spine C-curve & Deep Thoracic Counter-Lean (Tilts away from kick towards plant leg)
          lumbarRoll = -0.62 * ext * stanceSign; // Lumbar rolls away from kicking leg
          lumbarYaw = 0.45 * ext * stanceSign;
          lumbarPitch = 0.18 * ext;

          chestPitch = 0.42 * ext; // Leans back 24° out of danger
          chestRoll = -0.85 * ext * stanceSign; // Deep 49° lateral lean away from the kick!
          chestYaw = 0.52 * ext * stanceSign;
          chestFwd = -0.26 * ext; // Translates chest backwards

          // 3. Muay Thai Arm Whip & Plant Foot 120° Pivot
          if (isOrthodox) {
            // Right arm whips down past hip for rotational counter-torque
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, -0.22).addScaledVector(R, 0.34).addScaledVector(U, -0.48 * ext);
            // Left arm frames high temple shield protecting chin and cheek
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.18).addScaledVector(U, 0.24 * ext).addScaledVector(L, 0.08);
            plantFootYawL = 2.15 * ext; // 123° heel pivot towards target
            footLiftL = 0.04 * ext;
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, -0.22).addScaledVector(L, 0.34).addScaledVector(U, -0.48 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.18).addScaledVector(U, 0.24 * ext).addScaledVector(R, 0.08);
            plantFootYawR = -2.15 * ext;
            footLiftR = 0.04 * ext;
          }
          break;
        }

        // ---------------------------------------------------------------------
        // G. BODYKICK: Rib-Cracking Liver Roundhouse
        // ---------------------------------------------------------------------
        case 'BODYKICK': {
          pelvisRoll = -0.65 * ext * stanceSign;
          pelvisYaw = (0.35 + 0.78 * ext) * stanceSign;
          pelvisLift = 0.10 * ext;
          pelvisFwd = 0.12 * ext;
          pelvisPitch = 0.10 * ext;

          lumbarRoll = -0.50 * ext * stanceSign;
          lumbarYaw = 0.38 * ext * stanceSign;
          lumbarPitch = 0.12 * ext;

          chestPitch = 0.30 * ext; // Leans back
          chestRoll = -0.68 * ext * stanceSign; // Leans away from kick
          chestYaw = 0.44 * ext * stanceSign;
          chestFwd = -0.18 * ext;

          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, -0.12).addScaledVector(R, 0.30).addScaledVector(U, -0.38 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.22).addScaledVector(U, 0.18 * ext).addScaledVector(L, 0.06);
            plantFootYawL = 1.75 * ext; // 100° pivot
            footLiftL = 0.03 * ext;
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, -0.12).addScaledVector(L, 0.30).addScaledVector(U, -0.38 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.22).addScaledVector(U, 0.18 * ext).addScaledVector(R, 0.06);
            plantFootYawR = -1.75 * ext;
            footLiftR = 0.03 * ext;
          }
          break;
        }

        // ---------------------------------------------------------------------
        // H. LOWKICK: Low Chopping Calf Deadener (Axe Chop)
        // ---------------------------------------------------------------------
        case 'LOWKICK': {
          pelvisRoll = -0.45 * ext * stanceSign;
          pelvisYaw = (0.28 + 0.62 * ext) * stanceSign;
          pelvisLift = 0.04 * ext;
          pelvisFwd = 0.14 * ext;

          lumbarRoll = -0.32 * ext * stanceSign;
          lumbarYaw = 0.30 * ext * stanceSign;

          chestPitch = 0.18 * ext;
          chestRoll = -0.46 * ext * stanceSign;
          chestYaw = 0.36 * ext * stanceSign;
          chestFwd = -0.12 * ext;

          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, -0.05).addScaledVector(R, 0.26).addScaledVector(U, -0.28 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.25).addScaledVector(U, 0.14 * ext);
            plantFootYawL = 1.45 * ext; // 83° pivot
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, -0.05).addScaledVector(L, 0.26).addScaledVector(U, -0.28 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.25).addScaledVector(U, 0.14 * ext);
            plantFootYawR = -1.45 * ext;
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
    const pelvisSlipLateral = isSlipBack ? 0 : (sDir * 0.24 * slipWeight); // Deep 24cm lateral hip displacement
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
    const chestPos = abdomenTopJoint.clone().add(new THREE.Vector3(0.01 + chestFwd, 0.11, 0).applyQuaternion(chestQuat));

    // D. Neck (Chained seamlessly to Chest)
    const chestTopJoint = chestPos.clone().add(new THREE.Vector3(0.02, 0.11, 0).applyQuaternion(chestQuat));
    let neckPitch = chestPitch * 0.4 - 0.05;
    let neckYaw = chestYaw * 0.5;
    let neckRoll = chestRoll * 0.5;
    if (slipWeight > 0) {
      if (isSlipBack) neckPitch += 0.22 * slipWeight; // Follows chest backward arch seamlessly
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
    const neckPos = chestTopJoint.clone()
      .add(new THREE.Vector3(0, 0.055, 0).applyQuaternion(neckQuat));

    // E. Head (Chained seamlessly to Neck, eyes locked forward)
    const neckTopJoint = neckPos.clone().add(new THREE.Vector3(0, 0.055, 0).applyQuaternion(neckQuat));
    let headPitch = -0.11; // Tucked chin
    let headYaw = 0.0;
    let headRoll = 0.0;
    if (fighter.state === 'STRIKING' && fighter.strikeType === 'JAB') headPitch = -0.16;
    if (slipWeight > 0) {
      if (isSlipBack) headPitch -= 0.38 * slipWeight; // EA Sports UFC 4: Chin tucked deep into chest/clavicle, eyes locked forward
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

    // Dynamic Concussion Wobble & Groggy Disorientation
    headPitch += wobbleHeadPitch;
    headRoll += wobbleHeadRoll;
    headYaw += wobbleHeadYaw;

    const headRotEuler = new THREE.Euler(headRoll, headYaw, headPitch, 'YXZ');
    const headQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(headRotEuler));
    const headPos = neckTopJoint.clone()
      .add(new THREE.Vector3(0.02, 0.10, 0).applyQuaternion(headQuat));

    // -------------------------------------------------------------------------
    // 9. LEGS & ARTICULATED FEET SOLVERS
    // -------------------------------------------------------------------------
    const stepL = fighter.isMoving ? Math.sin(fighter.walkCycle) * 0.16 : 0;
    const stepR = fighter.isMoving ? -Math.sin(fighter.walkCycle) * 0.16 : 0;
    const liftL = fighter.isMoving ? Math.max(0, Math.cos(fighter.walkCycle)) * 0.08 : 0;
    const liftR = fighter.isMoving ? Math.max(0, -Math.cos(fighter.walkCycle)) * 0.08 : 0;

    const lateralVel = fighter.isMoving ? (fighter.rootVelocity.x * R.x + fighter.rootVelocity.z * R.z) : 0;
    const strafeL = fighter.isMoving ? Math.sin(fighter.walkCycle) * (lateralVel * 0.04) : 0;
    const strafeR = fighter.isMoving ? -Math.sin(fighter.walkCycle) * (lateralVel * 0.04) : 0;

    const isAirborne = fighter.rootPosition.y > 0.04;
    const airProgress = Math.min(1.0, fighter.rootPosition.y / 0.52);
    // Mid-air athletic knee tuck: knees fold up in air, toes flex downward
    const midAirKneeTuck = isAirborne ? Math.sin(airProgress * Math.PI) * 0.16 : 0;

    // During squat wind-up or landing shock absorption, feet stay firmly on canvas (0.04) while knees and hips compress!
    const footGroundY = (fighter.jumpState === 'WINDUP' || fighter.jumpState === 'LAND')
      ? 0.04
      : (0.04 + fighter.rootPosition.y);

    // Deep Combat Stance (Kuda-kuda dalam & lebar kokoh ala UFC / Boxing)
    const leadFwdL = 0.02 + 0.32 * stanceSign;
    const leadFwdR = 0.02 - 0.26 * stanceSign;
    const lateralOffsetL = 0.06 * stanceSign;
    const lateralOffsetR = -0.12 * stanceSign;

    const leftAnkle = leftHip.clone()
      .addScaledVector(F, leadFwdL + stepL)
      .addScaledVector(L, 0.06 + lateralOffsetL + strafeL + emergencyFootSpread);
    leftAnkle.y = footGroundY + liftL + footLiftL + midAirKneeTuck + 0.04;

    const rightAnkle = rightHip.clone()
      .addScaledVector(F, leadFwdR + stepR)
      .addScaledVector(R, 0.08 + lateralOffsetR + strafeR + emergencyFootSpread);
    rightAnkle.y = footGroundY + liftR + footLiftR + midAirKneeTuck + 0.04 + (isOrthodox ? 0.012 : 0);

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

        const apexKickTarget = teepHip.clone().addScaledVector(F, 0.62);
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

    // 2-Bone Analytical IK on Legs with Authentic Athletic Knee Flare
    const defaultLeadKnee = F.clone().addScaledVector(isOrthodox ? L : R, 0.06).normalize();
    const defaultRearKnee = F.clone().addScaledVector(isOrthodox ? R : L, 0.22).normalize();

    const leftKneeHint = customLeftKneeHint || (isOrthodox ? defaultLeadKnee : defaultRearKnee);
    const rightKneeHint = customRightKneeHint || (isOrthodox ? defaultRearKnee : defaultLeadKnee);

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
      new THREE.Quaternion().setFromEuler(new THREE.Euler(footPitchL, (isOrthodox ? 0.16 : 0.65) * stanceSign + plantFootYawL, 0, 'YXZ'))
    );

    const rightGroundPos = rightAnkle.clone().addScaledVector(F, 0.04);
    rightGroundPos.y = footGroundY + liftR + footLiftR * 0.5;
    const rightGroundQuat = rootQuat.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(footPitchR, (isOrthodox ? 0.65 : 0.16) * stanceSign + plantFootYawR, 0, 'YXZ'))
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

    // Rest / Defense Positions
    let leftWristPos;
    let rightWristPos;

    if (fighter.isBlocking) {
      // UFC 4 High Double-Shield Guard (Hands up tight to temples, elbows tucked protecting ribs)
      leftWristPos = leftShoulder.clone()
        .addScaledVector(F, 0.22)
        .addScaledVector(L, isOrthodox ? 0.05 : -0.05)
        .addScaledVector(U, 0.10);

      rightWristPos = rightShoulder.clone()
        .addScaledVector(F, 0.22)
        .addScaledVector(R, isOrthodox ? 0.05 : -0.05)
        .addScaledVector(U, 0.10);

      // Guarded Slip Dynamics (Hands stay locked to head and temples while slipping)
      if (slipWeight > 0) {
        if (isSlipBack) {
          // Guard pulls backward naturally with shoulders and chest
          leftWristPos.addScaledVector(U, 0.02 * slipWeight);
          rightWristPos.addScaledVector(U, 0.02 * slipWeight);
        } else {
          // Guard tilts and dips with lateral slips (Peek-a-boo guarded slip)
          if (sDir < 0) {
            leftWristPos.addScaledVector(U, 0.05 * slipWeight).addScaledVector(L, 0.04 * slipWeight);
            rightWristPos.addScaledVector(F, 0.03 * slipWeight).addScaledVector(L, 0.05 * slipWeight);
          } else {
            rightWristPos.addScaledVector(U, 0.05 * slipWeight).addScaledVector(R, 0.04 * slipWeight);
            leftWristPos.addScaledVector(F, 0.03 * slipWeight).addScaledVector(R, 0.05 * slipWeight);
          }
        }
      }

      customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.85).addScaledVector(F, 0.35).addScaledVector(L, 0.15).normalize();
      customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.85).addScaledVector(F, 0.35).addScaledVector(R, 0.15).normalize();
    } else {
      // Authentic UFC Striking Stance: Hands held up at chest/sternum level protecting the chest
      if (isOrthodox) {
        leftWristPos = leftShoulder.clone()
          .addScaledVector(F, 0.24 + leadHandPump)
          .addScaledVector(L, 0.08)
          .addScaledVector(U, -0.08); // Mid-chest / sternum level
        rightWristPos = rightShoulder.clone()
          .addScaledVector(F, 0.14)
          .addScaledVector(R, 0.08)
          .addScaledVector(U, -0.05); // Upper-chest level protecting chin & ribs
      } else {
        leftWristPos = leftShoulder.clone()
          .addScaledVector(F, 0.14)
          .addScaledVector(L, 0.08)
          .addScaledVector(U, -0.05); // Upper-chest level
        rightWristPos = rightShoulder.clone()
          .addScaledVector(F, 0.24 + leadHandPump)
          .addScaledVector(R, 0.08)
          .addScaledVector(U, -0.08); // Mid-chest level
      }

      // Authentic EA Sports UFC 4 Pull Slip Arm Pose (Dustin Poirier Style)
      if (slipWeight > 0 && isSlipBack) {
        if (isOrthodox) {
          // Lead hand (Left) frames forward towards incoming punch to measure distance & parry
          leftWristPos.addScaledVector(F, 0.10 * slipWeight)
            .addScaledVector(U, -0.02 * slipWeight)
            .addScaledVector(R, 0.03 * slipWeight);
          // Rear hand (Right) cocked tight against right jaw/chin, coiled ready to throw counter cross
          rightWristPos.addScaledVector(F, -0.04 * slipWeight)
            .addScaledVector(U, 0.06 * slipWeight)
            .addScaledVector(R, 0.02 * slipWeight);
          customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.85).addScaledVector(R, 0.35).addScaledVector(F, 0.05).normalize();
          customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.70).addScaledVector(F, 0.40).addScaledVector(L, 0.20).normalize();
        } else {
          rightWristPos.addScaledVector(F, 0.10 * slipWeight)
            .addScaledVector(U, -0.02 * slipWeight)
            .addScaledVector(L, 0.03 * slipWeight);
          leftWristPos.addScaledVector(F, -0.04 * slipWeight)
            .addScaledVector(U, 0.06 * slipWeight)
            .addScaledVector(L, 0.02 * slipWeight);
          customLeftElbowHint = new THREE.Vector3().addScaledVector(U, -0.85).addScaledVector(L, 0.35).addScaledVector(F, 0.05).normalize();
          customRightElbowHint = new THREE.Vector3().addScaledVector(U, -0.70).addScaledVector(F, 0.40).addScaledVector(R, 0.20).normalize();
        }
      }
    }

    // Unsteady Windmilling & Reflexive Balance-Catching Arm Dynamics
    if (rockIntensity > 0.02 && fighter.state !== 'STRIKING') {
      leftWristPos.addScaledVector(L, (0.07 + Math.sin(time * 8.8) * 0.05) * rockIntensity);
      rightWristPos.addScaledVector(R, (0.07 + Math.cos(time * 8.8) * 0.05) * rockIntensity);
      leftWristPos.addScaledVector(U, (Math.sin(time * 7.4) * 0.07) * rockIntensity);
      rightWristPos.addScaledVector(U, (Math.cos(time * 7.4) * 0.07) * rockIntensity);

      // Trembling micro-jitter
      leftWristPos.addScaledVector(F, (Math.sin(time * 18.0) * 0.02) * rockIntensity);
      rightWristPos.addScaledVector(F, (Math.cos(time * 18.0) * 0.02) * rockIntensity);

      if (bodyCrit > 0.25) {
        // Rear hand automatically clutches hurting abdomen/ribs
        const rearWrist = isOrthodox ? rightWristPos : leftWristPos;
        const tuckTarget = pelvisPos.clone().addScaledVector(F, 0.16).addScaledVector(U, 0.06);
        rearWrist.lerp(tuckTarget, Math.min(0.70, bodyCrit * 0.85));
      }
    }

    // Strict Anatomical Human Lockout Limit (Upper arm 0.35m + Forearm 0.31m = 0.66m max straight)
    const maxArmReach = 0.63;

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
