import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sounds } from '../audio/SoundManager.js';

/**
 * CombatEngine: Real-World Newtonian UFC Combat & Impact Physics Engine
 * 
 * Features:
 * 1. Solid Fighter-to-Fighter Push Collision:
 *    - Personal capsule collision prevents fighters from ghosting through each other during pocket clashes.
 *    - Pushes bodies apart with realistic mutual mass resistance.
 * 
 * 2. 100% Reliable Clean Shot Detection:
 *    - Dual-layer detection: Cannon-es physics contact + continuous frame-by-frame swept proximity.
 *    - Guarantees every visible connection triggers damage, hit telemetry, and sounds.
 * 
 * 3. Visceral Hit Audio:
 *    - Leather glove crack, sub-bass thump, and bone snap triggered on EVERY clean hit.
 *    - Dynamic volume and counter cheer escalation.
 * 
 * 4. Stun & Stagger Dynamics ("Clean Shot Stunt"):
 *    - Interrupts defender's active strike immediately.
 *    - Whiplash head snap, buckling knees, and staggered stumble backwards.
 *    - Direct physical knockback velocity applied to root position.
 */
export class CombatEngine {
  constructor(world, cameraController, hud) {
    this.world = world;
    this.cameraController = cameraController;
    this.hud = hud;
    this.crowd = null;

    this.hitCooldowns = new Map();
    this.setupCollisionEvents();
  }

  // ---------------------------------------------------------------------------
  // 1. SOLID FIGHTER INTERPENETRATION & CLINCH PUSH COLLISION
  // ---------------------------------------------------------------------------
  resolveFighterInterpenetration(fighterA, fighterB, delta) {
    if (!fighterA || !fighterB) return;
    // Don't push if one fighter is in passive ragdoll on the canvas
    if (fighterA.ragdollMode === 'PASSIVE' || fighterB.ragdollMode === 'PASSIVE') return;
    if (fighterA.limp || fighterB.limp) return;

    const posA = fighterA.rootPosition;
    const posB = fighterB.rootPosition;

    const dx = posB.x - posA.x;
    const dz = posB.z - posA.z;
    const dist = Math.hypot(dx, dz);
    const minDistance = 0.64; // Solid athletic personal capsule diameter (0.32m each)

    if (dist < minDistance && dist > 1e-4) {
      const overlap = minDistance - dist;
      const nx = dx / dist;
      const nz = dz / dist;

      // Relative velocity along collision normal
      const vRelX = fighterB.rootVelocity.x - fighterA.rootVelocity.x;
      const vRelZ = fighterB.rootVelocity.z - fighterA.rootVelocity.z;
      const vNorm = vRelX * nx + vRelZ * nz;

      // Solid push separation
      const pushFactor = overlap * 0.52;

      // Respect Octagon wire fence constraint so neither is pushed through cage
      const maxCageRadius = 4.18;
      const nextDistA = Math.hypot(posA.x - nx * pushFactor, posA.z - nz * pushFactor);
      const nextDistB = Math.hypot(posB.x + nx * pushFactor, posB.z + nz * pushFactor);

      if (nextDistA < maxCageRadius) {
        posA.x -= nx * pushFactor;
        posA.z -= nz * pushFactor;
      }
      if (nextDistB < maxCageRadius) {
        posB.x += nx * pushFactor;
        posB.z += nz * pushFactor;
      }

      // Cancel mutual closing velocity (feels like a solid human wall)
      if (vNorm < 0) {
        fighterA.rootVelocity.x += vNorm * nx * 0.5;
        fighterA.rootVelocity.z += vNorm * nz * 0.5;
        fighterB.rootVelocity.x -= vNorm * nx * 0.5;
        fighterB.rootVelocity.z -= vNorm * nz * 0.5;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. CONTINUOUS FRAME-BY-FRAME PROXIMITY HIT DETECTION
  // ---------------------------------------------------------------------------
  checkStrikesProximity(attacker, defender) {
    if (!attacker || !defender) return;
    if (attacker.state !== 'STRIKING' || defender.isKnockedOut || defender.ragdollMode === 'PASSIVE' || defender.limp) return;

    // Active strike window: during strike extension & apex impact (progress 0.20 to 0.68)
    const p = attacker.strikeProgress;
    if (p < 0.20 || p > 0.68) return;

    const isOrthodox = attacker.stanceTransition < 0.5;
    const isPunch = ['JAB', 'CROSS', 'HOOK', 'UPPERCUT', 'OVERHAND'].includes(attacker.strikeType);

    // Identify active striking body part
    let strikerBody = null;
    let strikerPartName = 'glove';

    if (isPunch) {
      if (attacker.strikeType === 'JAB' || attacker.strikeType === 'HOOK') {
        // Lead hand strike
        strikerBody = isOrthodox ? attacker.leftGlove : attacker.rightGlove;
        strikerPartName = isOrthodox ? 'leftGlove' : 'rightGlove';
      } else {
        // Rear hand strike (Cross, Uppercut, Overhand)
        strikerBody = isOrthodox ? attacker.rightGlove : attacker.leftGlove;
        strikerPartName = isOrthodox ? 'rightGlove' : 'leftGlove';
      }
    } else {
      // Kicking strike
      if (attacker.strikeType === 'HEADKICK' || attacker.strikeType === 'BODYKICK' || attacker.strikeType === 'LOWKICK') {
        strikerBody = isOrthodox ? attacker.rightFoot : attacker.leftFoot;
        strikerPartName = isOrthodox ? 'rightFoot' : 'leftFoot';
      } else if (attacker.strikeType === 'TEEP') {
        strikerBody = isOrthodox ? attacker.leftFoot : attacker.rightFoot;
        strikerPartName = isOrthodox ? 'leftFoot' : 'rightFoot';
      }
    }

    if (!strikerBody) return;

    // Contact pair cooldown (guarantees a single swing only registers once!)
    const pairKey = `${attacker.corner}_${strikerPartName}_strike_${attacker.strikeType}`;
    const now = performance.now();
    if (this.hitCooldowns.has(pairKey) && now - this.hitCooldowns.get(pairKey) < 320) {
      return;
    }

    // Check hit against defender's critical strike zones
    const targets = [
      { body: defender.head, isHead: true, radius: 0.26 },
      { body: defender.chest, isHead: false, radius: 0.32 },
    ];
    if (attacker.strikeType === 'LOWKICK') {
      targets.push(
        { body: defender.leftShin, isHead: false, radius: 0.22 },
        { body: defender.leftThigh, isHead: false, radius: 0.24 }
      );
    }

    const strikerPos = strikerBody.position;
    for (const target of targets) {
      const tPos = target.body.position;
      const dist = Math.hypot(strikerPos.x - tPos.x, strikerPos.y - tPos.y, strikerPos.z - tPos.z);
      if (dist <= target.radius) {
        // Clean Connection Hit!
        this.hitCooldowns.set(pairKey, now);
        this.executeCleanHit({
          attacker,
          defender,
          strikerBody,
          targetBody: target.body,
          strikerPart: strikerPartName,
          isHeadshot: target.isHead,
        });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. CANNON-ES PHYSICAL COLLISION EVENT LISTENER
  // ---------------------------------------------------------------------------
  setupCollisionEvents() {
    this.world.addEventListener('beginContact', (event) => {
      const bodyA = event.bodyA;
      const bodyB = event.bodyB;

      this.evaluatePhysicalContact(bodyA, bodyB);
      this.evaluatePhysicalContact(bodyB, bodyA);
    });
  }

  evaluatePhysicalContact(strikerBody, targetBody) {
    if (!strikerBody.isGlove && !strikerBody.isShin && !strikerBody.isFoot) return;
    if (!targetBody.ownerFighter) return;

    const attacker = strikerBody.ownerFighter;
    const defender = targetBody.ownerFighter;

    if (attacker === defender) return;
    if (defender.isKnockedOut || defender.limp) return;

    const strikerPart = strikerBody.isGlove ? (strikerBody.armSide || 'glove') : 'foot';
    const pairKey = `${attacker.corner}_${strikerPart}_contact_${targetBody.id}`;
    const now = performance.now();
    if (this.hitCooldowns.has(pairKey) && now - this.hitCooldowns.get(pairKey) < 320) {
      return;
    }

    const relVel = strikerBody.velocity.vsub(targetBody.velocity);
    const impactSpeed = relVel.length();

    // When attacker is striking, even modest velocities count as genuine hits!
    const minSpeedThreshold = attacker.state === 'STRIKING' ? 1.0 : 2.2;
    if (impactSpeed < minSpeedThreshold) return;

    this.hitCooldowns.set(pairKey, now);

    this.executeCleanHit({
      attacker,
      defender,
      strikerBody,
      targetBody,
      strikerPart,
      isHeadshot: targetBody.isHead === true,
      impactSpeedOverride: impactSpeed,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. UNIFIED CLEAN HIT EXECUTION (SOUND, DAMAGE, STUN & KNOCKBACK)
  // ---------------------------------------------------------------------------
  executeCleanHit({ attacker, defender, strikerBody, targetBody, strikerPart, isHeadshot, impactSpeedOverride }) {
    if (!attacker || !defender || defender.isKnockedOut || defender.limp) return;

    const relVel = strikerBody.velocity.vsub(targetBody.velocity);
    const impactSpeed = impactSpeedOverride || Math.max(3.5, relVel.length());

    // Contact Normal
    let normal = targetBody.position.vsub(strikerBody.position);
    if (normal.lengthSquared() < 0.001) normal = new CANNON.Vec3(attacker.facingDir, 0, 0);
    normal.normalize();

    // 1. Reduced Mass & Momentum
    const m1 = strikerBody.mass || 4.5;
    const m2 = targetBody.mass || 16.0;
    const reducedMass = (m1 * m2) / (m1 + m2);

    const restitution = 0.22;
    const vNormal = Math.max(1.5, Math.abs(relVel.dot(normal)) || impactSpeed * 0.7);
    const impulseMagnitude = (1.0 + restitution) * reducedMass * vNormal;

    // Physical Impulse
    const impulseVec = normal.scale(impulseMagnitude * 2.2);
    targetBody.applyImpulse(impulseVec, targetBody.position);
    strikerBody.applyImpulse(impulseVec.scale(-0.3), strikerBody.position);

    // 2. Rotational Whiplash Torque on Head
    let rotationalTorque = 0;
    if (isHeadshot) {
      const leverArm = new CANNON.Vec3(
        (Math.random() - 0.5) * 0.14,
        0.08,
        (Math.random() - 0.5) * 0.14
      );
      const torque = leverArm.cross(impulseVec);
      rotationalTorque = torque.length();
      targetBody.applyTorque(torque.scale(4.2));
    }

    // 3. Counter Vulnerability & Combo Multipliers
    const isSlip = attacker.slipTimer && attacker.slipTimer > 0;
    const isPullCounter = isSlip && attacker.slipType === 'BACK';
    const isDefenderVulnerable = defender.state === 'STRIKING' || (defender.slipTimer > 0 && !defender.isBlocking);
    const isCounter = isDefenderVulnerable || isSlip;
    const counterMultiplier = isCounter ? (isPullCounter ? 1.85 : (isSlip ? 1.60 : 1.40)) : 1.0;
    const comboMultiplier = (attacker.comboCount && attacker.comboCount > 1) ? (1.0 + (attacker.comboCount - 1) * 0.14) : 1.0;

    // 4. EA Sports UFC Calibrated Variable Damage Model
    const hitBodyPart = (targetBody.partName || '').toUpperCase();
    const isLegHit = hitBodyPart.includes('THIGH') || hitBodyPart.includes('SHIN') || hitBodyPart.includes('FOOT') || attacker.strikeType === 'LOWKICK';
    const isBodyHit = hitBodyPart.includes('ABDOMEN') || hitBodyPart.includes('CHEST') || attacker.strikeType === 'BODYKICK' || attacker.strikeType === 'TEEP';
    const isHeadTarget = !isLegHit && !isBodyHit;

    // Base damage by strike type (modest realistic numbers)
    let baseDamage = 2.5; // Non-striking incidental physical contact
    if (attacker.state === 'STRIKING') {
      const strikeTable = {
        JAB: 4.5,
        CROSS: 9.0,
        HOOK: 11.5,
        UPPERCUT: 13.0,
        OVERHAND: 15.5,
        LOWKICK: 8.5,
        BODYKICK: 11.5,
        TEEP: 7.0,
        HEADKICK: 18.5,
      };
      baseDamage = strikeTable[attacker.strikeType] || 7.0;
    }

    // Clean Shot Evaluation (Apex Impact Window + High Relative Velocity)
    const p = attacker.strikeProgress || 0.5;
    const isApexWindow = (p >= 0.28 && p <= 0.60);
    const isHighSpeed = impactSpeed >= 3.8;
    const isCleanShot = (attacker.state === 'STRIKING' && isApexWindow && isHighSpeed) || isCounter;

    // Clean connection bonus (+40%) vs Glancing contact (-35%)
    const cleanMultiplier = isCleanShot ? 1.40 : 0.65;

    // Subtle speed bonus (capped between 0 and 3.5)
    const speedBonus = Math.min(3.5, Math.max(0, (impactSpeed - 3.0) * 0.45));

    let damage = (baseDamage + speedBonus) * cleanMultiplier * counterMultiplier * comboMultiplier;
    if (isHeadshot) damage *= 1.25;

    // Big push impulse for teep
    if (attacker.state === 'STRIKING' && attacker.strikeType === 'TEEP') {
      const teepPush = normal.scale(impulseMagnitude * 3.5);
      if (defender.torso) defender.torso.applyImpulse(teepPush, defender.torso.position);
      if (defender.pelvis) defender.pelvis.applyImpulse(teepPush, defender.pelvis.position);
    }

    // UFC 4 Block System Verification
    let isBlocked = false;
    if (defender.isBlocking && !isCounter && (isHeadTarget || isBodyHit)) {
      isBlocked = true;
      const blockDamage = damage * 0.85;
      defender.blockHealth = Math.max(0, defender.blockHealth - blockDamage);
      damage *= 0.15; // 85% absorbed by guard, only 15% chip damage (1-3 damage)

      if (defender.blockHealth <= 0) {
        defender.blockHealth = 0;
        defender.isBlocking = false;
        defender.blockBrokenTimer = 1.0;
        if (this.hud) this.hud.spawnHitText('💥 BLOCK BROKEN!', defender.getHeadPosition(), 'ROCKED');
      } else {
        if (this.hud) this.hud.spawnHitText('🛡️ BLOCKED', defender.getHeadPosition(), 'NORMAL');
      }
    }

    const kineticEnergy = 0.5 * reducedMass * impactSpeed * impactSpeed;

    // Realistic Directional Knockout Metadata
    const koData = {
      targetBody,
      impactVec: impulseVec,
      impactPoint: targetBody.position,
      rotationalTorque,
      strikeType: attacker.strikeType,
      isHeadshot,
      isBodyHit,
      isLegHit,
      damage,
    };

    // Helper for handling vital bar depletion: Flash Knockdown vs Full KO
    const handleVitalBarDepletion = () => {
      if (defender.flashKdCount < 1 && !defender.isKnockedOut) {
        defender.triggerFlashKnockdown();
        if (this.hud) {
          this.hud.spawnHitText('⚡ FLASH KNOCKDOWN!', defender.getHeadPosition(), 'ROCKED');
          this.hud.showEventBanner('⚡ FLASH KNOCKDOWN! SCRAMBLING TO FEET...');
        }
        if (this.crowd) this.crowd.triggerExcitement(0.85);
      } else if (!defender.isKnockedOut) {
        defender.knockout(koData);
        if (this.hud) {
          this.hud.spawnHitText('KNOCKOUT!', defender.getHeadPosition(), 'ROCKED');
          this.hud.showEventBanner('⚡ KNOCKOUT (OUT COLD)!');
        }
        if (this.crowd) this.crowd.triggerExcitement(1.0);
      }
    };

    // Apply Anatomical Health Deductions and reset EA Sports recovery delay timer
    if (isLegHit) {
      defender.legHealth = Math.max(0, defender.legHealth - damage);
      defender.legDamageTimer = isCleanShot ? 1.2 : 0.75;
      if (defender.legHealth <= 0) handleVitalBarDepletion();
    } else if (isBodyHit) {
      defender.bodyHealth = Math.max(0, defender.bodyHealth - damage);
      defender.bodyDamageTimer = isCleanShot ? 1.1 : 0.70;
      defender.stamina = Math.max(0, defender.stamina - (damage * 0.45));
      if (defender.bodyHealth <= 0) handleVitalBarDepletion();
    } else {
      defender.headHealth = Math.max(0, defender.headHealth - damage);
      defender.headDamageTimer = isCleanShot ? 1.25 : 0.80;
      if (defender.headHealth <= 0) handleVitalBarDepletion();
    }

    defender.health = (defender.headHealth + defender.bodyHealth + defender.legHealth) / 3;

    // Trigger Screen Edge Red Danger Flash HANYA ketika darah sudah mau habis (<= 25) atau saat KO
    const isDefenderNearKO = (defender.headHealth <= 25) || (defender.bodyHealth <= 25) || (defender.legHealth <= 25) || defender.isKnockedOut;
    if (isDefenderNearKO && this.hud && this.hud.triggerScreenDangerFlash) {
      const side = defender.isPlayer ? 'player' : 'enemy';
      this.hud.triggerScreenDangerFlash(side, 1.0, 0.85);
    }

    // -------------------------------------------------------------------------
    // 5. VISCERAL IMPACT SOUND TRIGGERED ON EVERY SINGLE HIT!
    // -------------------------------------------------------------------------
    if (defender.headHealth <= 0 || defender.bodyHealth <= 0 || defender.legHealth <= 0 || defender.isKnockedOut) {
      sounds.playKnockout();
    } else if (isBlocked) {
      sounds.playPunch(0.65, false);
    } else if (isHeadshot || isCounter || damage > 18 || attacker.strikeType === 'OVERHAND' || attacker.strikeType === 'HEADKICK') {
      sounds.playHeavyImpact(isCounter);
    } else {
      sounds.playPunch(Math.min(1.4, Math.max(0.75, damage / 16)), isCounter);
    }

    // -------------------------------------------------------------------------
    // 6. CLEAN SHOT STUN, STAGGER & KNOCKBACK ("STUNT" DYNAMICS)
    // -------------------------------------------------------------------------
    // A. Interrupt active strike of defender (Hit Interruption!)
    if (defender.state === 'STRIKING') {
      defender.state = 'STUMBLE';
      defender.strikeType = null;
      defender.strikeCooldown = 0.55;
    }

    // B. Direct Root Position Physical Pushback / Stumble
    const myPos = defender.rootPosition;
    const oppPos = attacker.rootPosition;
    const pushDirX = myPos.x - oppPos.x;
    const pushDirZ = myPos.z - oppPos.z;
    const pushDist = Math.hypot(pushDirX, pushDirZ) || 1;
    const pushSpeed = Math.min(5.2, Math.max(1.8, impulseMagnitude * 0.16 + damage * 0.08));

    defender.rootVelocity.x += (pushDirX / pushDist) * pushSpeed;
    defender.rootVelocity.z += (pushDirZ / pushDist) * pushSpeed;

    // C. Deliver physical trauma & Stun Stagger State
    defender.receivePhysicalHit({
      damage,
      isHeadshot,
      isCounter,
      impulseMagnitude,
      rotationalTorque,
      impactSpeed,
      kineticEnergy,
    });

    // Stagger / Stumble Stun State Trigger (Wobble & Jelly Legs)
    if (!defender.isKnockedOut) {
      const shouldRock = isCleanShot || isCounter || damage >= 12;
      defender.isRocked = true;
      defender.rockTimer = shouldRock ? (isCounter ? 2.4 : 1.8) : 1.2;
      defender.stumbleTimer = Math.min(0.95, 0.45 + damage * 0.02);
      defender.state = 'STUMBLE';
      defender.flinchTimer = 0.44;
      defender.flinchIntensity = Math.min(3.0, Math.max(1.2, damage / 10));
      defender.flinchIsHead = isHeadshot;
      defender.flinchSide = attacker.facingDir;
      defender.stamina = Math.max(0, defender.stamina - (damage * 0.65));
    }

    // 7. Dynamic Camera Screen Trauma Shake
    const trauma = Math.min(1.0, (damage / 42) + (isCounter ? 0.40 : 0.08));
    if (this.cameraController) {
      this.cameraController.addTrauma(trauma);
    }

    // 8. Broadcast HUD Telemetry Popup Text
    if (this.hud) {
      const hitPos = new THREE.Vector3(targetBody.position.x, targetBody.position.y + 0.15, targetBody.position.z);
      let hitText = `${Math.round(damage)} DMG`;
      let hitType = 'NORMAL';

      if (defender.isKnockedOut) {
        hitText = isPullCounter ? '⚡ PULL-COUNTER KO!' : '💥 FLASH KNOCKOUT!';
        hitType = 'KO';
      } else if (isPullCounter) {
        hitText = `⚡ PULL COUNTER! ${Math.round(damage)} DMG`;
        hitType = 'COUNTER';
      } else if (isCounter && damage >= 16) {
        hitText = `⚡ COUNTER STUN! ${Math.round(damage)} DMG`;
        hitType = 'COUNTER';
      } else if (isCleanShot && damage >= 15) {
        hitText = isHeadshot ? `⚡ CLEAN HEAD SHOT! ${Math.round(damage)} DMG` : `💥 CLEAN SHOT! ${Math.round(damage)} DMG`;
        hitType = 'ROCKED';
      } else if (damage >= 18) {
        hitText = `HEAVY IMPACT! ${Math.round(damage)} DMG`;
        hitType = 'ROCKED';
      } else {
        hitText = isBlocked ? '🛡️ CHIP 1 DMG' : `${Math.round(damage)} DMG`;
        hitType = 'NORMAL';
      }

      this.hud.spawnHitText(hitText, hitPos, hitType);
    }

    // 9. Arena Crowd Excitement & Flash Flurry
    if (this.crowd) {
      const excitement = defender.isKnockedOut ? 1.0 : (damage > 24 ? 0.80 : 0.45);
      this.crowd.triggerExcitement(excitement);
    }
  }
}
