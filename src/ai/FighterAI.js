import * as THREE from 'three';

export class FighterAI {
  constructor(aiFighter, playerFighter) {
    this.ai = aiFighter;
    this.player = playerFighter;

    // Archetypes: 'DAGISTANI', 'BRAWLER', 'SNIPER'
    this.archetype = 'DAGISTANI';
    this.decisionTimer = 0;
    this.comboStep = 0;
    this.reactionDelay = 0.22; // Human-like reaction time
    this.takedownCooldown = 3.5; // Start round with standup striking first!
  }

  setArchetype(type) {
    this.archetype = type;
    this.takedownCooldown = 3.0;
    if (type === 'DAGISTANI') {
      this.ai.name = 'ISLAM "THE SMESH"';
    } else if (type === 'BRAWLER') {
      this.ai.name = 'JUSTIN "THE HIGHLIGHT"';
    } else if (type === 'SNIPER') {
      this.ai.name = 'IZZY "THE LAST SNIPER"';
    }
  }

  update(delta) {
    if (this.ai.isKnockedOut || this.player.isKnockedOut) return;

    if (this.takedownCooldown > 0) {
      this.takedownCooldown = Math.max(0, this.takedownCooldown - delta);
    }

    this.decisionTimer -= delta;
    if (this.decisionTimer > 0) return;

    // Evaluate state and distances
    const aiPos = this.ai.getTorsoPosition();
    const playerPos = this.player.getTorsoPosition();
    const dist = Math.hypot(aiPos.x - playerPos.x, aiPos.z - playerPos.z);
    const facing = playerPos.x > aiPos.x ? 1 : -1;

    // Ground Fight Decision (Ground & Pound)
    if (this.ai.isGrounded) {
      if (this.ai.groundRole === 'TOP') {
        // Rain down punches
        this.ai.groundAndPoundStrike();
        this.decisionTimer = 0.45;
      }
      return;
    }

    // Standing Decision based on Archetype
    switch (this.archetype) {
      case 'DAGISTANI':
        this.runDagestaniBehavior(dist, facing, delta);
        break;
      case 'BRAWLER':
        this.runBrawlerBehavior(dist, facing, delta);
        break;
      case 'SNIPER':
        this.runSniperBehavior(dist, facing, delta);
        break;
      default:
        this.runBrawlerBehavior(dist, facing, delta);
    }
  }

  // 1. DAGISTANI SMESH: Aggressive level change, Double Leg Takedowns, Top Control
  runDagestaniBehavior(dist, facing, delta) {
    if (dist > 2.2) {
      // Advance forward aggressively
      this.ai.move(facing * 0.9, 0);
      this.decisionTimer = 0.15;
    } else if (dist <= 2.2 && dist >= 1.0) {
      // Prime takedown zone!
      const rand = Math.random();
      if (this.takedownCooldown === 0 && rand < 0.55 && this.ai.stamina > 30) {
        // Shoot explosive takedown
        this.ai.shootTakedown();
        this.takedownCooldown = 6.5; // Wait before shooting another takedown
        this.decisionTimer = 1.1;
      } else if (rand < 0.8) {
        // Set up with jab / overhand
        this.ai.throwJab();
        this.decisionTimer = 0.35;
      } else {
        // Close the pocket
        this.ai.move(facing * 0.7, 0);
        this.decisionTimer = 0.2;
      }
    } else {
      // In the clinch pocket: throw dirty boxing hook or takedown
      if (this.takedownCooldown === 0 && Math.random() < 0.4) {
        this.ai.shootTakedown();
        this.takedownCooldown = 6.5;
      } else {
        this.ai.throwHook();
      }
      this.decisionTimer = 0.4;
    }
  }

  // 2. THE BRAWLER: Stand & Bang, High volume hooks, Relentless pressure
  runBrawlerBehavior(dist, facing, delta) {
    if (dist > 1.6) {
      // Close in to throw bombs
      this.ai.move(facing * 0.85, (Math.random() - 0.5) * 0.3);
      this.decisionTimer = 0.18;
    } else {
      // Inside pocket: lethal striking combinations
      const strikeRoll = Math.random();
      if (strikeRoll < 0.3) {
        this.ai.throwJab();
        this.decisionTimer = 0.25;
      } else if (strikeRoll < 0.6) {
        this.ai.throwCross();
        this.decisionTimer = 0.38;
      } else if (strikeRoll < 0.85) {
        this.ai.throwHook();
        this.decisionTimer = 0.45;
      } else {
        this.ai.throwHeadkick();
        this.decisionTimer = 0.6;
      }
    }
  }

  // 3. THE SNIPER: Distance control, Slip & Sway, Precision Counter-Striking
  runSniperBehavior(dist, facing, delta) {
    // If player is attacking, execute a slip / sway
    if (this.player.state === 'STRIKING' && dist < 2.0 && Math.random() < 0.65) {
      this.ai.slip(Math.random() > 0.5 ? 1 : -1);
      // Immediate counter after slip!
      setTimeout(() => {
        if (!this.ai.isKnockedOut) {
          this.ai.throwCross();
        }
      }, 160);
      this.decisionTimer = 0.5;
      return;
    }

    if (dist < 1.8) {
      // Back up to maintain sniper range (out-fighting)
      this.ai.move(-facing * 0.75, (Math.random() - 0.5) * 0.6);
      this.decisionTimer = 0.22;
    } else if (dist >= 1.8 && dist <= 2.8) {
      // Sniper sweet spot: Snappy Jabs, Head Kicks, Leg Kicks
      const roll = Math.random();
      if (roll < 0.4) {
        this.ai.throwJab();
        this.decisionTimer = 0.32;
      } else if (roll < 0.75) {
        this.ai.throwHeadkick();
        this.decisionTimer = 0.65;
      } else {
        // Lateral circle step
        this.ai.move(0, (Math.random() - 0.5) * 0.8);
        this.decisionTimer = 0.3;
      }
    } else {
      // Inch forward into sniper range
      this.ai.move(facing * 0.6, 0);
      this.decisionTimer = 0.25;
    }
  }
}
