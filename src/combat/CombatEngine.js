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
    this.gameMenuManager = null;

    this.fightStartTime = performance.now();
    this.stats = {
      playerStrikes: 0,
      opponentStrikes: 0,
      playerDamage: 0,
      opponentDamage: 0,
    };
    this.koHandled = false;

    this.ruleMode = 'RFC_STANDARD';
    this.hitCooldowns = new Map();
    this.setupCollisionEvents();
  }

  resetStats() {
    this.fightStartTime = performance.now();
    this.stats = {
      playerStrikes: 0,
      opponentStrikes: 0,
      playerDamage: 0,
      opponentDamage: 0,
    };
    this.koHandled = false;
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
      const maxCageRadius = 3.96;
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

    // Check hit against defender's critical strike zones (scaled by athlete's REACH advantage)
    const reachFactor = attacker.reachMultiplier || 1.0;
    const targets = [
      { body: defender.head, isHead: true, radius: 0.26 * reachFactor },
      { body: defender.chest, isHead: false, radius: 0.32 * reachFactor },
    ];
    if (attacker.strikeType === 'LOWKICK') {
      targets.push(
        { body: defender.leftShin, isHead: false, radius: 0.22 * reachFactor },
        { body: defender.leftThigh, isHead: false, radius: 0.24 * reachFactor }
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

    // CRITICAL: NEVER deal damage or trigger hit impacts on casual walking or incidental body contact!
    // Hits are ONLY valid when the attacker is actively performing a strike.
    if (attacker.state !== 'STRIKING') return;

    // Strike must be within the active delivery/impact window (not early windup or late recovery)
    if (attacker.strikeProgress < 0.16 || attacker.strikeProgress > 0.82) return;

    // Verify the striking limb matches the active strike type to prevent stray limbs from registering phantom hits
    const isPunch = ['JAB', 'CROSS', 'HOOK', 'UPPERCUT', 'OVERHAND'].includes(attacker.strikeType);
    const isKick = ['LOWKICK', 'BODYKICK', 'HEADKICK', 'TEEP'].includes(attacker.strikeType);
    if (isPunch && !strikerBody.isGlove) return;
    if (isKick && !strikerBody.isShin && !strikerBody.isFoot) return;

    const strikerPart = strikerBody.isGlove ? (strikerBody.armSide || 'glove') : 'foot';
    const pairKey = `${attacker.corner}_${strikerPart}_contact_${targetBody.id}`;
    const now = performance.now();
    if (this.hitCooldowns.has(pairKey) && now - this.hitCooldowns.get(pairKey) < 320) {
      return;
    }

    const relVel = strikerBody.velocity.vsub(targetBody.velocity);
    const impactSpeed = relVel.length();

    // In striking state, require genuine physical impact velocity
    const minSpeedThreshold = 1.0;
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

    // Physical Impulse (scaled by athlete POWER stat)
    const powerMult = attacker.powerMultiplier || 1.0;
    const impulseVec = normal.scale(impulseMagnitude * 2.2 * powerMult);
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
      targetBody.applyTorque(torque.scale(4.2 * powerMult));
    }

    // 3. Counter Vulnerability & Combo Multipliers
    const isSlip = attacker.slipTimer && attacker.slipTimer > 0;
    const isPullCounter = isSlip && attacker.slipType === 'BACK';
    const isDefenderVulnerable = defender.state === 'STRIKING' || (defender.slipTimer > 0 && !defender.isBlocking);
    const isCounter = isDefenderVulnerable || isSlip;
    const counterMultiplier = isCounter ? (isPullCounter ? 1.45 : (isSlip ? 1.30 : 1.20)) : 1.0;
    const comboMultiplier = (attacker.comboCount && attacker.comboCount > 1) ? (1.0 + (attacker.comboCount - 1) * 0.12) : 1.0;

    // 4. EA Sports UFC Calibrated Variable Damage Model
    const hitBodyPart = (targetBody.partName || '').toUpperCase();
    const isLegHit = hitBodyPart.includes('THIGH') || hitBodyPart.includes('SHIN') || hitBodyPart.includes('FOOT') || attacker.strikeType === 'LOWKICK';
    const isBodyHit = hitBodyPart.includes('ABDOMEN') || hitBodyPart.includes('CHEST') || attacker.strikeType === 'BODYKICK' || attacker.strikeType === 'TEEP';
    const isHeadTarget = !isLegHit && !isBodyHit;

    // Base damage by strike type (authentic UFC pacing - tactical and competitive)
    const strikeTable = {
      JAB: 3.2,
      CROSS: 6.5,
      HOOK: 8.2,
      UPPERCUT: 9.0,
      OVERHAND: 12.0,
      LOWKICK: 6.5,
      BODYKICK: 8.5,
      TEEP: 5.2,
      HEADKICK: 14.5,
    };
    const baseDamage = strikeTable[attacker.strikeType] || 6.0;

    // Clean Shot Evaluation (Apex Impact Window + High Relative Velocity)
    const p = attacker.strikeProgress || 0.5;
    const isApexWindow = (p >= 0.28 && p <= 0.62);
    const isHighSpeed = impactSpeed >= 3.5;
    const isCleanShot = (attacker.state === 'STRIKING' && isApexWindow && isHighSpeed) || isCounter;

    // Clean connection bonus (+25%) vs Glancing contact (-25%)
    const cleanMultiplier = isCleanShot ? 1.25 : 0.75;

    // Subtle speed bonus (capped between 0 and 2.5)
    const speedBonus = Math.min(2.5, Math.max(0, (impactSpeed - 3.0) * 0.35));

    let damage = (baseDamage + speedBonus) * cleanMultiplier * counterMultiplier * comboMultiplier;
    if (isHeadshot) damage *= 1.15;

    // Athlete POWER stat scaling (Power 96-99 delivers heavy knockout payload)
    damage *= powerMult;

    // EA Sports UFC Fatigue Power Scaling (Gassed fighters strike with noticeably diminished power)
    const fatigueMult = attacker.staminaSystem ? attacker.staminaSystem.getFatigueDamageMultiplier() : 1.0;
    damage *= fatigueMult;

    // Dynamic Camera Trauma based on clean shot & power
    if (this.cameraController && isCleanShot) {
      this.cameraController.addTrauma(0.32 * powerMult);
    }

    // Track Fight Telemetry
    if (attacker.isPlayer) {
      this.stats.playerStrikes++;
      this.stats.playerDamage += damage;
    } else {
      this.stats.opponentStrikes++;
      this.stats.opponentDamage += damage;
    }

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
      if (defender.staminaSystem) {
        defender.staminaSystem.consumeAction(damage * 0.40, { isDefensive: true, delay: 0.32 });
      }

      if (defender.blockHealth <= 0) {
        defender.blockHealth = 0;
        defender.isBlocking = false;
        defender.blockBrokenTimer = 1.0;
        if (this.hud) this.hud.spawnHitText('BLOCK BROKEN!', defender.getHeadPosition(), 'ROCKED');
      } else {
        if (this.hud) this.hud.spawnHitText('BLOCKED', defender.getHeadPosition(), 'NORMAL');
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
      if (this.ruleMode !== 'SUDDEN_DEATH' && defender.flashKdCount < 2 && !defender.isKnockedOut) {
        defender.triggerFlashKnockdown();
        if (this.hud) {
          const countText = defender.flashKdCount === 1 ? 'FLASH KNOCKDOWN (1/2)!' : 'HEAVY KNOCKDOWN (2/2)!';
          this.hud.spawnHitText(countText, defender.getHeadPosition(), 'ROCKED');
          this.hud.showEventBanner(countText + ' SCRAMBLING TO FEET...');
        }
        if (this.crowd) this.crowd.triggerExcitement(0.85);
      } else if (!defender.isKnockedOut || !this.koHandled) {
        this.koHandled = true;
        const method = isPullCounter ? 'PULL-COUNTER KNOCKOUT' : (isHeadshot ? 'HEADKICK KNOCKOUT' : 'KNOCKOUT (OUT COLD)');
        if (!defender.isKnockedOut) {
          defender.knockout({ ...koData, method });
        }
        if (this.hud) {
          this.hud.spawnHitText('KNOCKOUT!', defender.getHeadPosition(), 'ROCKED');
          this.hud.showEventBanner('KNOCKOUT (OUT COLD)!');
        }
        if (this.crowd) this.crowd.triggerExcitement(1.0);

        if (this.gameInstance && this.gameInstance.handleMatchKnockout) {
          this.gameInstance.handleMatchKnockout(defender, method);
        }
      }
    };

    // Apply Anatomical Health Deductions and reset EA Sports recovery delay timer
    if (isLegHit) {
      defender.legHealth = Math.max(0, defender.legHealth - damage);
      defender.legDamageTimer = isCleanShot ? 1.1 : 0.70;
      if (defender.legHealth <= 0) handleVitalBarDepletion();
    } else if (isBodyHit) {
      defender.bodyHealth = Math.max(0, defender.bodyHealth - damage);
      defender.bodyDamageTimer = isCleanShot ? 1.0 : 0.65;
      if (defender.staminaSystem) {
        defender.staminaSystem.applyBodyTrauma(damage);
      } else {
        defender.stamina = Math.max(0, defender.stamina - (damage * 0.35));
      }
      if (defender.bodyHealth <= 0) handleVitalBarDepletion();
    } else {
      defender.headHealth = Math.max(0, defender.headHealth - damage);
      defender.headDamageTimer = isCleanShot ? 1.15 : 0.75;
      if (defender.headHealth <= 0) handleVitalBarDepletion();
    }

    defender.health = (defender.headHealth + defender.bodyHealth + defender.legHealth) / 3;

    // Trigger Screen Edge Red Danger Flash ONLY when vitals are critically low (<= 25) or upon knockout
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
      defender.stamina = Math.max(0, defender.stamina - Math.min(6, damage * 0.15));
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
        hitText = isPullCounter ? 'PULL-COUNTER KO!' : 'FLASH KNOCKOUT!';
        hitType = 'KO';
      } else if (isPullCounter) {
        hitText = `PULL COUNTER! ${Math.round(damage)} DMG`;
        hitType = 'COUNTER';
      } else if (isCounter && damage >= 16) {
        hitText = `COUNTER STUN! ${Math.round(damage)} DMG`;
        hitType = 'COUNTER';
      } else if (isCleanShot && damage >= 15) {
        hitText = isHeadshot ? `CLEAN HEAD SHOT! ${Math.round(damage)} DMG` : `CLEAN SHOT! ${Math.round(damage)} DMG`;
        hitType = 'ROCKED';
      } else if (damage >= 18) {
        hitText = `HEAVY IMPACT! ${Math.round(damage)} DMG`;
        hitType = 'ROCKED';
      } else {
        hitText = isBlocked ? 'CHIP 1 DMG' : `${Math.round(damage)} DMG`;
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
