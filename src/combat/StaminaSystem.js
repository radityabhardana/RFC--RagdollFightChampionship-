/**
 * EA Sports UFC 4 Two-Tier Stamina Engine (Arcade-Thrilling Pacing)
 * 
 * Optimized for maximum excitement, fluid combinations, and generous cardio:
 * 
 * 1. Generous Gas Tank (Short-Term Stamina):
 *    - Ample capacity (115 - 138+) so players can fire exciting 4 to 6-strike combinations.
 *    - Very low strike costs (Jabs 2.2, Cross 4.5, Hooks 5.5, Kicks 4.8 - 10.5).
 *    - Lightning-fast breath recovery (~28 stamina/sec) with brief 0.18s pause.
 *    - In ~1.5s after an exchange, stamina is completely refilled!
 * 
 * 2. High-Durability Permanent Max Stamina (Never Drains Rapidly):
 *    - Normal strikes thrown with gas have ZERO permanent max stamina decay!
 *    - Max stamina stays near 100% all fight long (high safety floor >= 85%).
 *    - Body strikes chip a balanced, realistic amount (~0.25 - 0.35 max stamina).
 *    - Round breaks recover temporary stamina to 100% and restore +4.0% lost capacity.
 * 
 * 3. Never Locked Out of Basic Strikes:
 *    - Players can always fire jabs and strikes without annoying input freezes.
 */

export class StaminaSystem {
  constructor(config = {}) {
    this.baseMax = config.baseMax || 120;
    this.costMultiplier = config.costMultiplier || 1.0;
    this.regenMultiplier = config.regenMultiplier || 1.0;
    this.maxStamina = this.baseMax; // Current permanent ceiling (stays rock-solid high)
    this.current = this.baseMax;     // Current temporary pool
    this.minCapFloor = config.minCapFloor || Math.round(this.baseMax * 0.85);

    this.regenDelay = 0.0;
    // Rapid, responsive UFC 4 breath recovery rate (~28 stamina/sec)
    this.baseRegenRate = 28.0 * this.regenMultiplier;

    // Generous, thrilling strike stamina costs (encourages high-action striking!)
    this.strikeCosts = {
      JAB: { cost: 2.2, isPower: false, isKick: false },
      CROSS: { cost: 4.5, isPower: true, isKick: false },
      HOOK: { cost: 5.5, isPower: true, isKick: false },
      UPPERCUT: { cost: 5.5, isPower: true, isKick: false },
      OVERHAND: { cost: 8.5, isPower: true, isKick: false },
      LOWKICK: { cost: 4.8, isPower: false, isKick: true },
      BODYKICK: { cost: 7.0, isPower: true, isKick: true },
      HEADKICK: { cost: 10.5, isPower: true, isKick: true },
      TEEP: { cost: 4.5, isPower: false, isKick: true },
    };
  }

  // Check if fighter can throw strike (Never locks player out of basic action!)
  canThrow(strikeType) {
    // If fighter has at least 1 point of gas, allow strike
    return this.current >= 1.0;
  }

  // Consume stamina on strike execution with zero premature max stamina loss
  consumeStrike(strikeType) {
    const data = this.strikeCosts[strikeType] || { cost: 4, isPower: false, isKick: false };
    const cost = data.cost * this.costMultiplier;

    // 1. Short-term stamina reduction
    this.current = Math.max(0, this.current - cost);

    // 2. Very snappy recovery delay (~180ms - 240ms)
    this.regenDelay = data.isKick ? 0.24 : (data.isPower ? 0.20 : 0.16);

    // 3. Permanent Max Stamina Cap:
    // In UFC 4, normal strikes with stamina in the tank produce ZERO permanent lung capacity loss!
    let capWear = 0;

    // Only extreme redline over-exhaustion (current < 12%) incurs tiny wear
    if (this.current < 12) {
      const exhaustionFactor = (12 - this.current) / 12;
      capWear = cost * 0.015 * exhaustionFactor;
    }

    this.maxStamina = Math.max(this.minCapFloor, this.maxStamina - capWear);
    this.current = Math.min(this.current, this.maxStamina);

    return cost;
  }

  // Consume stamina on defensive actions (slip, jump, block hit)
  consumeAction(cost, { isDefensive = true, delay = 0.18 } = {}) {
    const effectiveCost = cost * this.costMultiplier * 0.60;
    this.current = Math.max(0, this.current - effectiveCost);
    this.regenDelay = Math.max(this.regenDelay, delay);

    // Tiny redline wear only if critically gassed
    if (this.current < 10) {
      this.maxStamina = Math.max(this.minCapFloor, this.maxStamina - effectiveCost * 0.010);
    }
    this.current = Math.min(this.current, this.maxStamina);
  }

  // Body Trauma: Liver/rib punches and body kicks (tactical body work, calibrated to UFC 4)
  applyBodyTrauma(damage) {
    // Short-term drain (takes breath away for a moment)
    this.current = Math.max(0, this.current - damage * 0.28);

    // Subtle permanent degradation (~0.25 - 0.35 max stamina per heavy shot)
    const permanentLoss = damage * 0.014 * Math.min(1.0, this.costMultiplier);
    this.maxStamina = Math.max(this.minCapFloor, this.maxStamina - permanentLoss);
    this.current = Math.min(this.current, this.maxStamina);

    // Short winded delay
    this.regenDelay = Math.max(this.regenDelay, 0.40);
  }

  // Main frame update for delayed regen and locomotion costs
  update(delta, { isMoving = false, isSprinting = false, isBlocking = false } = {}) {
    // 1. Sprinting drains stamina gently
    if (isSprinting && isMoving) {
      this.current = Math.max(0, this.current - delta * 4.5 * this.costMultiplier);
      this.regenDelay = Math.max(this.regenDelay, 0.20);
    }

    // 2. Regeneration Delay Countdown
    if (this.regenDelay > 0) {
      this.regenDelay = Math.max(0, this.regenDelay - delta);
      return;
    }

    // 3. Fast Two-Tier Regeneration up to current maxStamina ceiling
    if (this.current < this.maxStamina) {
      let speedMult = 1.0;
      if (!isMoving && !isBlocking) {
        // Rest bonus when stationary in stance (fast breath recovery)
        speedMult = 1.45;
      } else if (isMoving && !isBlocking) {
        // Pacing while circling
        speedMult = 0.90;
      } else if (isBlocking) {
        // High guard allows 50% passive recovery
        speedMult = isMoving ? 0.35 : 0.50;
      }

      this.current = Math.min(this.maxStamina, this.current + delta * this.baseRegenRate * speedMult);
    }
  }

  // Returns true if fighter is heavily fatigued
  isGassed() {
    return this.current < 15;
  }

  // Damage multiplier based on current gas tank
  getFatigueDamageMultiplier() {
    if (this.current >= 25) return 1.0;
    if (this.current < 10) return 0.85; // Only 15% reduction when critically gassed
    return 0.85 + ((this.current - 10) / 15) * 0.15;
  }

  // Movement speed multiplier based on fatigue
  getFatigueSpeedMultiplier() {
    if (this.current >= 18) return 1.0;
    return 0.92 + (this.current / 18) * 0.08; // Only 8% reduction, stays agile!
  }

  // Authentic UFC 4 corner rest between rounds
  roundBreakRecover() {
    this.maxStamina = Math.min(this.baseMax, this.maxStamina + 4.0);
    this.current = this.maxStamina;
    this.regenDelay = 0;
  }

  // Restore for brand new bout / rematch
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
