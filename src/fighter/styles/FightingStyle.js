/**
 * FightingStyle: Base class for modular UFC fighting style implementations.
 * Enables complex, character-specific fighting styles (e.g. MMA Striker, Dutch Kickboxer, Karate Blitz, Sambo Wrestler).
 */
export class FightingStyle {
  constructor(name = 'DEFAULT_STYLE') {
    this.name = name;
  }

  getName() {
    return this.name;
  }

  /**
   * Main pose generator called every frame.
   * @param {Object} context { fighter, currentSpeed, delta, time }
   * @returns {Object} 17-segment anatomical pose descriptor
   */
  calculateCombatPose(context) {
    throw new Error('FightingStyle.calculateCombatPose() must be implemented by subclass.');
  }
}
