import * as THREE from 'three';

/**
 * FighterAI: Authentic Autonomous EA Sports UFC 4 Combat Intelligence
 * 
 * Features:
 * 1. Elite Stamina Management:
 *    - Paced cardio control: AI tracks its gas tank. When stamina dips (< 45%),
 *      it steps back, circles along the Octagon, raises high guard, and breathes until gas returns (> 65%).
 *    - Never spams wild strikes with an empty tank.
 * 2. Range & Distance Management:
 *    - Long Range (> 2.4m): Composed stalking footwork, cuts off the Octagon, no wasted sprinting.
 *    - Kicking Range (1.65m - 2.4m): Strictly long-range weapons (Low Calf Kicks, Body Roundhouses, Teeps, Headkicks).
 *      NEVER throws short jabs or hooks into empty air!
 *    - Boxing Range (1.15m - 1.65m): Jabs to establish range, Cross down the pipe, Lead Hooks, multi-strike combos.
 *    - Pocket Range (< 1.15m): Uppercuts, short hooks, overhands, or reset check-steps.
 * 3. Fight IQ & Timing:
 *    - Reads player states: swarms aggressively if player is Rocked or Gassed.
 *    - Punishes player whiffs with step-in counters.
 *    - In-and-Out Footwork: strikes, then takes an exit angle to avoid straight return fire.
 */
export class FighterAI {
  constructor(aiFighter, playerFighter) {
    this.ai = aiFighter;
    this.player = playerFighter;

    // Archetypes: 'PRESSURE' | 'BRAWLER' | 'SNIPER' | 'KICKBOXER'
    this.archetype = 'BRAWLER';
    this.decisionTimer = 0;
    this.actionCooldown = 0;
    
    // AI Fight State: 'ENGAGE' | 'RECOVER_STAMINA' | 'SWARM_FINISH' | 'SPACE_CIRCLE'
    this.aiState = 'ENGAGE';
    this.circleDir = Math.random() > 0.5 ? 1 : -1;
    this.circleTimer = 0;

    this.setDifficulty('PRO');
  }

  get fighter() { return this.ai; }
  set fighter(val) { this.ai = val; }
  get opponent() { return this.player; }
  set opponent(val) { this.player = val; }

  setFighters(aiFighter, playerFighter) {
    this.ai = aiFighter;
    this.player = playerFighter;
  }

  setArchetype(type) {
    this.archetype = type || 'BRAWLER';
  }

  setDifficulty(level = 'PRO') {
    this.difficulty = level;
    const speedRatio = 90.0 / (this.ai?.statSpeed || 90);

    const diffConfigs = {
      ROOKIE: {
        reactionDelay: 0.30 * speedRatio,
        decisionInterval: 0.24 * speedRatio,
        blockChance: 0.40,
        slipChance: 0.20,
        comboChance: 0.45,
        maxCombo: 2,
        counterAccuracy: 0.45,
        staminaRecoveryTarget: 55, // Recovers to 55%
        staminaTrigger: 40,        // Backs off when under 40%
        advanceSpeed: 0.85,
      },
      PRO: {
        reactionDelay: 0.16 * speedRatio,
        decisionInterval: 0.14 * speedRatio,
        blockChance: 0.65,
        slipChance: 0.45,
        comboChance: 0.72,
        maxCombo: 3,
        counterAccuracy: 0.70,
        staminaRecoveryTarget: 68,
        staminaTrigger: 46,
        advanceSpeed: 1.0,
      },
      CHAMPION: {
        reactionDelay: 0.10 * speedRatio,
        decisionInterval: 0.09 * speedRatio,
        blockChance: 0.82,
        slipChance: 0.65,
        comboChance: 0.85,
        maxCombo: 4,
        counterAccuracy: 0.85,
        staminaRecoveryTarget: 72,
        staminaTrigger: 50,
        advanceSpeed: 1.12,
      },
      GOAT: {
        reactionDelay: 0.05 * speedRatio,
        decisionInterval: 0.05 * speedRatio,
        blockChance: 0.92,
        slipChance: 0.78,
        comboChance: 0.95,
        maxCombo: 4,
        counterAccuracy: 0.95,
        staminaRecoveryTarget: 75,
        staminaTrigger: 52,
        advanceSpeed: 1.25,
      },
    };

    this.cfg = diffConfigs[level] || diffConfigs.PRO;
  }

  update(delta) {
    if (!this.ai || !this.player) return;
    if (this.ai.isKnockedOut || this.player.isKnockedOut) return;
    if (this.ai.limp || this.ai.state === 'KO' || this.ai.state === 'FLASH_KD') return;

    if (this.actionCooldown > 0) {
      this.actionCooldown = Math.max(0, this.actionCooldown - delta);
    }
    if (this.decisionTimer > 0) {
      this.decisionTimer = Math.max(0, this.decisionTimer - delta);
    }
    if (this.circleTimer > 0) {
      this.circleTimer = Math.max(0, this.circleTimer - delta);
    } else {
      this.circleDir = Math.random() > 0.5 ? 1 : -1;
      this.circleTimer = 1.8 + Math.random() * 2.2;
    }

    // 1. SPATIAL CALCULATIONS & RANGE ZONES
    const aiPos = this.ai.getTorsoPosition();
    const playerPos = this.player.getTorsoPosition();
    const dx = playerPos.x - aiPos.x;
    const dz = playerPos.z - aiPos.z;
    const dist = Math.hypot(dx, dz);

    const dirX = dist > 0.01 ? dx / dist : 1.0;
    const dirZ = dist > 0.01 ? dz / dist : 0.0;

    // Perpendicular lateral vector for circling
    const perpX = -dirZ * this.circleDir;
    const perpZ = dirX * this.circleDir;

    // Stamina Metrics
    const aiStaminaPct = (this.ai.stamina / (this.ai.maxStamina || 100)) * 100;
    const playerStaminaPct = (this.player.stamina / (this.player.maxStamina || 100)) * 100;
    const isPlayerVulnerable = this.player.isRocked || this.player.state === 'STUMBLE' || playerStaminaPct < 25;

    // 2. DEFENSIVE REACTIONS (Slips, Pull-Counters, Guarding)
    if (this.player.state === 'STRIKING' && dist < 2.1 && this.ai.state !== 'STRIKING') {
      const roll = Math.random();
      if (roll < this.cfg.slipChance) {
        // High-level slip & rip counter
        const slipRoll = Math.random();
        if (slipRoll < 0.40) {
          this.ai.slipBack();
        } else {
          this.ai.slip(slipRoll > 0.70 ? 1 : -1);
        }

        // Instant counter-strike timing (~90-120ms)
        if (Math.random() < this.cfg.counterAccuracy && aiStaminaPct > 35) {
          setTimeout(() => {
            if (this.ai && !this.ai.isKnockedOut && !this.ai.limp && this.ai.state !== 'KO') {
              this.ai.setBlocking(false);
              const counterRoll = Math.random();
              if (counterRoll < 0.45) this.ai.throwCross();
              else if (counterRoll < 0.80) this.ai.throwHook();
              else this.ai.throwUppercut();
            }
          }, 100);
        }
        this.decisionTimer = this.cfg.reactionDelay;
        return;
      } else if (roll < (this.cfg.slipChance + this.cfg.blockChance * 0.75)) {
        this.ai.setBlocking(true);
        this.decisionTimer = this.cfg.reactionDelay;
        return;
      }
    }

    // 3. STAMINA MANAGEMENT STATE MACHINE (EA Sports UFC 4 Intelligence)
    // If AI is low on stamina and opponent is not currently rocked, enter tactical recovery
    if (aiStaminaPct < this.cfg.staminaTrigger && !isPlayerVulnerable) {
      this.aiState = 'RECOVER_STAMINA';
    } else if (aiStaminaPct >= this.cfg.staminaRecoveryTarget) {
      this.aiState = isPlayerVulnerable ? 'SWARM_FINISH' : 'ENGAGE';
    }

    // A. RECOVER STAMINA STATE (Spacing, Circling, Guarding, Catching Breath)
    if (this.aiState === 'RECOVER_STAMINA') {
      if (dist < 1.7) {
        // Player is close: back up with high guard to keep chin safe
        this.ai.move(-dirX * 0.90 + perpX * 0.35, -dirZ * 0.90 + perpZ * 0.35);
        this.ai.setBlocking(true);
      } else {
        // Safe distance: drop guard to maximize breath recovery speed (1.35x), circle laterally
        this.ai.move(perpX * 0.65, perpZ * 0.65);
        this.ai.setBlocking(false);
      }

      // If player blindly rushes in while AI is recovering, throw a stiff push teep or jab to maintain space
      if (dist < 1.4 && Math.random() < 0.25 && aiStaminaPct > 20) {
        this.ai.setBlocking(false);
        if (Math.random() < 0.5) this.ai.throwTeep();
        else this.ai.throwJab();
        this.decisionTimer = 0.35;
      } else {
        this.decisionTimer = 0.18;
      }
      return;
    }

    // Unblock before offensive action
    if (this.ai.isBlocking) {
      this.ai.setBlocking(false);
    }

    if (this.decisionTimer > 0) return;

    // B. SWARM FINISH STATE (Player is Rocked or Gassed -> Step on the Gas!)
    if (isPlayerVulnerable && aiStaminaPct > 30) {
      this.runSwarmFinishBehavior(dist, dirX, dirZ, perpX, perpZ);
      return;
    }

    // C. ARCHETYPE OFFENSIVE BEHAVIOR WITH DISTANCE DISCIPLINE
    switch (this.archetype) {
      case 'PRESSURE':
        this.runPressureBehavior(dist, dirX, dirZ, perpX, perpZ);
        break;
      case 'SNIPER':
        this.runSniperBehavior(dist, dirX, dirZ, perpX, perpZ);
        break;
      case 'KICKBOXER':
        this.runKickboxerBehavior(dist, dirX, dirZ, perpX, perpZ);
        break;
      case 'BRAWLER':
      default:
        this.runBrawlerBehavior(dist, dirX, dirZ, perpX, perpZ);
        break;
    }
  }

  // SWARM FINISH: Relentless accuracy when player is rocked
  runSwarmFinishBehavior(dist, dirX, dirZ, perpX, perpZ) {
    if (dist > 1.6) {
      // Close in fast
      this.ai.move(dirX * 1.25, dirZ * 1.25, true);
      this.decisionTimer = this.cfg.decisionInterval * 0.7;
    } else {
      // In range: unload heavy knockout strikes
      this.ai.move(dirX * 0.25, dirZ * 0.25);
      const roll = Math.random();
      if (roll < 0.35) {
        this.ai.throwCross();
        setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwHook(); }, 140);
      } else if (roll < 0.70) {
        this.ai.throwOverhand();
      } else {
        this.ai.throwUppercut();
        setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwCross(); }, 150);
      }
      this.decisionTimer = this.cfg.decisionInterval * 0.9;
    }
  }

  // 1. PRESSURE ARCHETYPE (Makhachev, Khabib): Stalking forward, hooks, body kicks, inside smother
  runPressureBehavior(dist, dirX, dirZ, perpX, perpZ) {
    if (dist > 2.4) {
      // Out of range: Stalk forward calmly (NO sprint stamina drain)
      this.ai.move(dirX * this.cfg.advanceSpeed * 0.85, dirZ * this.cfg.advanceSpeed * 0.85);
      this.decisionTimer = this.cfg.decisionInterval;
    } else if (dist >= 1.65 && dist <= 2.4) {
      // Kicking range: strictly use kicks (never whiff punches!)
      this.ai.move(dirX * this.cfg.advanceSpeed * 0.75, dirZ * this.cfg.advanceSpeed * 0.75);
      const roll = Math.random();
      if (roll < 0.50) {
        this.ai.throwLowKick();
      } else {
        this.ai.throwBodyKick();
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.2;
    } else if (dist >= 1.15 && dist < 1.65) {
      // Prime Boxing combination range
      this.ai.move(dirX * 0.35, dirZ * 0.35);
      const roll = Math.random();
      if (roll < 0.45) {
        this.ai.throwJab();
        if (this.cfg.maxCombo >= 2 && Math.random() < this.cfg.comboChance) {
          setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwCross(); }, 150);
        }
      } else if (roll < 0.80) {
        this.ai.throwHook();
        if (this.cfg.maxCombo >= 2 && Math.random() < this.cfg.comboChance) {
          setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwLowKick(); }, 180);
        }
      } else {
        this.ai.throwCross();
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.1;
    } else {
      // Inside pocket (< 1.15m)
      const roll = Math.random();
      if (roll < 0.50) {
        this.ai.throwUppercut();
      } else {
        this.ai.throwHook();
      }
      // Exit footwork: step out to angle
      setTimeout(() => {
        if (this.ai && !this.ai.isKnockedOut) {
          this.ai.move(-dirX * 0.4 + perpX * 0.5, -dirZ * 0.4 + perpZ * 0.5);
        }
      }, 160);
      this.decisionTimer = this.cfg.decisionInterval * 1.2;
    }
  }

  // 2. BRAWLER ARCHETYPE (Holloway, Poirier, Du Plessis): High volume, disciplined distance, power combos
  runBrawlerBehavior(dist, dirX, dirZ, perpX, perpZ) {
    if (dist > 2.4) {
      // Composed stalking without burning sprint
      this.ai.move(dirX * this.cfg.advanceSpeed * 0.90, dirZ * this.cfg.advanceSpeed * 0.90);
      this.decisionTimer = this.cfg.decisionInterval;
    } else if (dist >= 1.65 && dist <= 2.4) {
      // Kicking range: Leg kicks and teeps only
      this.ai.move(dirX * this.cfg.advanceSpeed * 0.70, dirZ * this.cfg.advanceSpeed * 0.70);
      const roll = Math.random();
      if (roll < 0.55) {
        this.ai.throwLowKick();
      } else if (roll < 0.85) {
        this.ai.throwBodyKick();
      } else {
        this.ai.throwTeep();
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.25;
    } else if (dist >= 1.15 && dist < 1.65) {
      // Phonebooth boxing combination range (1.15m - 1.65m)
      this.ai.move(dirX * 0.30, dirZ * 0.30);
      const roll = Math.random();
      if (roll < 0.40) {
        // Jab -> Cross
        this.ai.throwJab();
        if (this.cfg.maxCombo >= 2 && Math.random() < this.cfg.comboChance) {
          setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwCross(); }, 140);
        }
      } else if (roll < 0.75) {
        // Cross -> Lead Hook
        this.ai.throwCross();
        if (this.cfg.maxCombo >= 2 && Math.random() < this.cfg.comboChance) {
          setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwHook(); }, 150);
        }
      } else {
        // Overhand Bomb
        this.ai.throwOverhand();
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.15;
    } else {
      // Close pocket (< 1.15m)
      const roll = Math.random();
      if (roll < 0.45) {
        this.ai.throwUppercut();
      } else if (roll < 0.80) {
        this.ai.throwHook();
      } else {
        this.ai.throwOverhand();
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.1;
    }
  }

  // 3. SNIPER ARCHETYPE (McGregor, Topuria, Jones): Spacing, straight counters, pull-slips
  runSniperBehavior(dist, dirX, dirZ, perpX, perpZ) {
    if (dist > 2.5) {
      // Measured distance stalking
      this.ai.move(dirX * this.cfg.advanceSpeed * 0.80, dirZ * this.cfg.advanceSpeed * 0.80);
      this.decisionTimer = this.cfg.decisionInterval;
    } else if (dist >= 1.65 && dist <= 2.5) {
      // Sniper outside range: long push teeps, high headkicks, low calf chops
      this.ai.move(perpX * 0.50, perpZ * 0.50); // Circling laterally
      const roll = Math.random();
      if (roll < 0.35) {
        this.ai.throwTeep();
      } else if (roll < 0.65) {
        this.ai.throwHeadkick();
      } else {
        this.ai.throwLowKick();
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.3;
    } else if (dist >= 1.15 && dist < 1.65) {
      // Sniper sweet spot: Laser straight Cross & Pull-Counters
      const roll = Math.random();
      if (roll < 0.50) {
        this.ai.throwJab();
        if (this.cfg.maxCombo >= 2 && Math.random() < this.cfg.comboChance) {
          setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwCross(); }, 140);
        }
      } else {
        this.ai.throwCross();
        if (this.cfg.maxCombo >= 3 && Math.random() < this.cfg.comboChance) {
          setTimeout(() => { if (this.ai && !this.ai.isKnockedOut) this.ai.throwHook(); }, 160);
        }
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.15;
    } else {
      // Pocket: Step back check-hook
      this.ai.move(-dirX * 0.70 + perpX * 0.40, -dirZ * 0.70 + perpZ * 0.40);
      this.ai.throwHook();
      this.decisionTimer = this.cfg.decisionInterval * 1.1;
    }
  }

  // 4. KICKBOXER ARCHETYPE (Pereira, Adesanya): Low calf kicks, body kicks, high headkicks
  runKickboxerBehavior(dist, dirX, dirZ, perpX, perpZ) {
    if (dist > 2.5) {
      this.ai.move(dirX * this.cfg.advanceSpeed * 0.80, dirZ * this.cfg.advanceSpeed * 0.80);
      this.decisionTimer = this.cfg.decisionInterval;
    } else if (dist >= 1.60 && dist <= 2.5) {
      // Primary kicking domain
      this.ai.move(perpX * 0.55, perpZ * 0.55);
      const roll = Math.random();
      if (roll < 0.40) {
        this.ai.throwLowKick();
      } else if (roll < 0.70) {
        this.ai.throwBodyKick();
      } else {
        this.ai.throwHeadkick();
      }
      this.decisionTimer = this.cfg.decisionInterval * 1.25;
    } else {
      // Inside range: Lead hook & cross, then reset back to kicking range
      const roll = Math.random();
      if (roll < 0.50) {
        this.ai.throwHook();
      } else {
        this.ai.throwCross();
      }
      setTimeout(() => {
        if (this.ai && !this.ai.isKnockedOut) {
          this.ai.move(-dirX * 0.75, -dirZ * 0.75); // Push back to kicking range
        }
      }, 150);
      this.decisionTimer = this.cfg.decisionInterval * 1.2;
    }
  }
}
