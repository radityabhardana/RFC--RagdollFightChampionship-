/**
 * UFC Two-Tier Stamina Engine
 * 
 * Implements the authentic EA Sports UFC Stamina Management System:
 * 1. Short-Term Stamina:
 *    - Depleted rapidly by strikes, combinations, slips, sprints, and jumps.
 *    - Has a recovery delay (0.5 - 0.7s) before regeneration starts.
 *    - Takes real time to recover (~8s to fully refill from zero).
 *    - Recovers faster when stationary / resting, slower while walking, and halts while blocking.
 * 
 * 2. Permanent / Long-Term Stamina Cap (Max Stamina Reduction):
 *    - In early rounds, max stamina is 100%.
 *    - As a fighter gasses out, misses heavy strikes, redlines in exhaustion, or takes body shots,
 *      the maximum stamina ceiling permanently shrinks (e.g. from 100% -> 85% -> 70% -> 50%).
 *    - The fighter's short-term stamina can never recover beyond this reduced ceiling.
 * 
 * 3. Exhaustion & Gassed Penalties:
 *    - When stamina drops below 22% (Fatigue Zone), strikes deal less damage and locomotion slows down.
 */

export class StaminaSystem {
  constructor(config = {}) {
    this.baseMax = config.baseMax || 100;
    this.costMultiplier = config.costMultiplier || 1.0;
    this.regenMultiplier = config.regenMultiplier || 1.0;
    this.maxStamina = this.baseMax; // Current permanent ceiling
    this.current = this.baseMax;     // Current short-term pool
    this.minCapFloor = config.minCapFloor || 32;

    this.regenDelay = 0.0;
    this.baseRegenRate = 12.5 * this.regenMultiplier; // Stamina per second scaled by athlete cardio

    // Strike Stamina Costs (noticeably draining, authentic to UFC)
    this.strikeCosts = {
      JAB: { cost: 6, isPower: false, isKick: false },
      CROSS: { cost: 11, isPower: true, isKick: false },
      HOOK: { cost: 14, isPower: true, isKick: false },
      UPPERCUT: { cost: 13, isPower: true, isKick: false },
      OVERHAND: { cost: 19, isPower: true, isKick: false },
      LOWKICK: { cost: 13, isPower: false, isKick: true },
      BODYKICK: { cost: 17, isPower: true, isKick: true },
      HEADKICK: { cost: 23, isPower: true, isKick: true },
      TEEP: { cost: 11, isPower: false, isKick: true },
    };
  }

  // Check if fighter has enough gas to initiate strike
  canThrow(strikeType) {
    const data = this.strikeCosts[strikeType] || { cost: 8 };
    // Require at least 45% of the strike cost to execute
    return this.current >= data.cost * 0.45;
  }

  // Consume stamina on strike execution with permanent cap wear
  consumeStrike(strikeType) {
    const data = this.strikeCosts[strikeType] || { cost: 8, isPower: false, isKick: false };
    const cost = data.cost * this.costMultiplier;

    // 1. Short-term stamina reduction
    this.current = Math.max(0, this.current - cost);

    // 2. Pause regeneration
    this.regenDelay = data.isKick ? 0.65 : (data.isPower ? 0.58 : 0.48);

    // 3. Permanent Max Stamina Cap Decay:
    // Heavy strikes naturally produce slight athletic wear
    let capWear = (data.isKick ? 0.45 : (data.isPower ? 0.30 : 0.08)) * this.costMultiplier;

    // Redline Penalty: Throwing strikes while exhausted (current < 25) heavily burns permanent lung capacity!
    if (this.current < 25) {
      const exhaustionFactor = (25 - this.current) / 25; // 0 to 1.0
      capWear += cost * 0.16 * exhaustionFactor;
    }

    // Zero Gas-Out Penalty: Hitting absolute zero stamina causes an immediate sharp lung burn
    if (this.current <= 0) {
      capWear += 1.2 * this.costMultiplier;
    }

    this.maxStamina = Math.max(this.minCapFloor, this.maxStamina - capWear);
    this.current = Math.min(this.current, this.maxStamina);

    return cost;
  }

  // Consume stamina on defensive actions (slip, jump, block hit)
  consumeAction(cost, { isDefensive = true, delay = 0.4 } = {}) {
    const effectiveCost = cost * this.costMultiplier;
    this.current = Math.max(0, this.current - effectiveCost);
    this.regenDelay = Math.max(this.regenDelay, delay);

    // Redline wear if gassed
    if (this.current < 20) {
      this.maxStamina = Math.max(this.minCapFloor, this.maxStamina - effectiveCost * 0.10);
    }
    this.current = Math.min(this.current, this.maxStamina);
  }

  // Body Trauma: Liver/rib punches and body kicks directly reduce permanent max capacity
  applyBodyTrauma(damage) {
    // Short-term drain
    this.current = Math.max(0, this.current - damage * 0.35);

    // Permanent lung/rib degradation (high stamina fighters resist permanent degradation)
    const permanentLoss = damage * 0.22 * Math.min(1.2, this.costMultiplier);
    this.maxStamina = Math.max(this.minCapFloor, this.maxStamina - permanentLoss);
    this.current = Math.min(this.current, this.maxStamina);

    // Extended winded delay (cannot catch breath for ~0.85s)
    this.regenDelay = Math.max(this.regenDelay, 0.85);
  }

  // Main frame update for delayed regen and locomotion costs
  update(delta, { isMoving = false, isSprinting = false, isBlocking = false } = {}) {
    // 1. Sprinting drains stamina
    if (isSprinting && isMoving) {
      this.current = Math.max(0, this.current - delta * 9.5 * this.costMultiplier);
      this.regenDelay = Math.max(this.regenDelay, 0.35);
      if (this.current < 20) {
        this.maxStamina = Math.max(this.minCapFloor, this.maxStamina - delta * 1.5 * this.costMultiplier);
      }
    }

    // 2. Holding guard drains small stamina and completely prevents regeneration
    if (isBlocking) {
      this.current = Math.max(0, this.current - delta * 2.8 * this.costMultiplier);
      this.regenDelay = Math.max(this.regenDelay, 0.25);
    }

    // 3. Regeneration Delay Countdown
    if (this.regenDelay > 0) {
      this.regenDelay = Math.max(0, this.regenDelay - delta);
      return;
    }

    // 4. Smooth Two-Tier Regeneration up to current maxStamina ceiling
    if (this.current < this.maxStamina) {
      let speedMult = 1.0;
      if (!isMoving && !isBlocking) {
        // Rest bonus when stationary in stance
        speedMult = 1.25;
      } else if (isMoving) {
        // Pacing penalty when moving around
        speedMult = 0.75;
      }

      this.current = Math.min(this.maxStamina, this.current + delta * this.baseRegenRate * speedMult);
    }
  }

  // Returns true if fighter is heavily fatigued
  isGassed() {
    return this.current < 22;
  }

  // Damage multiplier based on current gas tank (Gassed fighters punch with less power)
  getFatigueDamageMultiplier() {
    if (this.current >= 45) return 1.0;
    if (this.current < 20) return 0.68; // 32% damage reduction when exhausted
    return 0.68 + ((this.current - 20) / 25) * 0.32;
  }

  // Movement speed multiplier based on fatigue
  getFatigueSpeedMultiplier() {
    if (this.current >= 30) return 1.0;
    return 0.78 + (this.current / 30) * 0.22; // up to 22% movement sluggishness when gassed
  }

  // Restore for new round / reset
  reset() {
    this.maxStamina = this.baseMax;
    this.current = this.baseMax;
    this.regenDelay = 0;
  }

  // Full telemetry payload
  getStats() {
    return {
      current: this.current,
      maxStamina: this.maxStamina,
      baseMax: this.baseMax,
      currentPct: Math.max(0, Math.min(100, (this.current / this.baseMax) * 100)),
      maxCapPct: Math.max(0, Math.min(100, (this.maxStamina / this.baseMax) * 100)),
      isGassed: this.isGassed(),
    };
  }
}
