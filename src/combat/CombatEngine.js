import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Real-World Newtonian Combat Engine
// Applies conservation of momentum (p = mv), kinetic energy transfer (E = 0.5 * m * v^2),
// rotational head whiplash torque (tau = r x F), and biomedical concussion thresholds.

export class CombatEngine {
  constructor(world, cameraController, hud) {
    this.world = world;
    this.cameraController = cameraController;
    this.hud = hud;

    this.hitCooldowns = new Map();
    this.setupCollisionEvents();
  }

  setupCollisionEvents() {
    this.world.addEventListener('beginContact', (event) => {
      const bodyA = event.bodyA;
      const bodyB = event.bodyB;

      this.evaluatePhysicalContact(bodyA, bodyB);
      this.evaluatePhysicalContact(bodyB, bodyA);
    });
  }

  evaluatePhysicalContact(strikerBody, targetBody) {
    // Only check if striker is a glove, shin, or foot
    if (!strikerBody.isGlove && !strikerBody.isShin && !strikerBody.isFoot) return;
    if (!targetBody.ownerFighter) return;

    const attacker = strikerBody.ownerFighter;
    const defender = targetBody.ownerFighter;

    // Cannot hit yourself
    if (attacker === defender) return;
    if (defender.isKnockedOut) return;

    // Contact pair cooldown (prevent multi-frame duplicate impulses)
    const strikerPart = strikerBody.isGlove ? (strikerBody.armSide || 'glove') : (strikerBody.legSide ? `${strikerBody.legSide}_leg` : 'leg');
    const pairKey = `${attacker.corner}_${strikerPart}_to_${targetBody.id}`;
    const now = performance.now();
    if (this.hitCooldowns.has(pairKey) && now - this.hitCooldowns.get(pairKey) < 260) {
      return;
    }
    this.hitCooldowns.set(pairKey, now);

    // 1. RELATIVE IMPACT VELOCITY VECTOR: v_rel = v_striker - v_target
    const relVel = strikerBody.velocity.vsub(targetBody.velocity);
    const impactSpeed = relVel.length();

    // Minimum physical threshold to count as a genuine strike (m/s)
    if (impactSpeed < 2.4) return;

    // 2. CONTACT NORMAL & COLLISION DIRECTION
    let normal = targetBody.position.vsub(strikerBody.position);
    if (normal.lengthSquared() < 0.001) normal = new CANNON.Vec3(attacker.facingDir, 0, 0);
    normal.normalize();

    // Velocity along normal
    const vNormal = relVel.dot(normal);
    if (vNormal <= 0.5) return; // Must be closing in toward target

    // 3. NEWTONIAN IMPULSE TRANSFER (p = m * v)
    // Reduced mass: mu = (m1 * m2) / (m1 + m2)
    const m1 = strikerBody.mass;
    const m2 = targetBody.mass;
    const reducedMass = (m1 * m2) / (m1 + m2);

    // Coefficient of restitution (e ~ 0.22 for human glove/bone contact)
    const restitution = 0.22;
    const impulseMagnitude = (1.0 + restitution) * reducedMass * vNormal;

    // Physical Impulse Vector
    const impulseVec = normal.scale(impulseMagnitude * 1.8);

    // Apply action impulse to defender & reaction impulse to attacker (Newton's 3rd Law!)
    targetBody.applyImpulse(impulseVec, targetBody.position);
    strikerBody.applyImpulse(impulseVec.scale(-0.4), strikerBody.position); // Recoil resistance

    // 4. KINETIC ENERGY CALCULATION (Joules: E_k = 0.5 * m * v^2)
    const kineticEnergy = 0.5 * reducedMass * impactSpeed * impactSpeed;

    // 5. ROTATIONAL WHIPLASH & BRAIN CONCUSSION DYNAMICS
    const isHeadshot = targetBody.isHead === true;
    let rotationalTorque = 0;

    if (isHeadshot) {
      // Impact lever arm relative to skull center of mass
      const leverArm = new CANNON.Vec3(
        (Math.random() - 0.5) * 0.12,
        0.06,
        (Math.random() - 0.5) * 0.12
      );
      // Torque tau = r x F
      const torque = leverArm.cross(impulseVec);
      rotationalTorque = torque.length();

      // Apply violent rotational torque directly to cervical spine joint
      targetBody.applyTorque(torque.scale(3.5));

      // Also deliver impulse to upper torso to buckle posture
      defender.torso.applyImpulse(impulseVec.scale(0.65), defender.torso.position);
    } else {
      // Body strike pushes torso back and drains stamina
      defender.torso.applyImpulse(impulseVec.scale(0.85), defender.torso.position);
    }

    // 6. COUNTER VULNERABILITY MULTIPLIER
    // If defender was leaning forward, whiffing, or mid-swing, relative velocity is devastating!
    // Or if attacker lands a clean slip counter (slipping off-line or pulling back while punching)!
    const isSlip = attacker.slipTimer && attacker.slipTimer > 0;
    const isPullCounter = isSlip && attacker.slipType === 'BACK';
    const isCounter = defender.state === 'STRIKING' || defender.state === 'TAKEDOWN_SHOOT' || isSlip;
    const counterMultiplier = isCounter ? (isPullCounter ? 2.95 : (isSlip ? 2.65 : 2.35)) : 1.0;

    // 7. REALISTIC BIOMECHANICAL DAMAGE CALCULATION
    let damage = (kineticEnergy * 0.35 + impulseMagnitude * 0.45) * counterMultiplier;
    if (isHeadshot) damage *= 1.5;
    if (attacker.state === 'STRIKING') {
      if (attacker.strikeType === 'HEADKICK') damage *= 1.75;
      else if (attacker.strikeType === 'BODYKICK') damage *= 1.50;
      else if (attacker.strikeType === 'TEEP') {
        damage *= 1.35;
        // Teep delivers huge push impulse
        if (defender.torso) defender.torso.applyImpulse(impulseVec.scale(1.8), defender.torso.position);
        if (defender.pelvis) defender.pelvis.applyImpulse(impulseVec.scale(1.5), defender.pelvis.position);
      }
      else if (attacker.strikeType === 'LOWKICK') damage *= 1.30;
      else if (attacker.strikeType === 'HOOK') damage *= 1.40;
    }

    // Pass physical trauma to fighter
    defender.receivePhysicalHit({
      damage,
      isHeadshot,
      isCounter,
      impulseMagnitude,
      rotationalTorque,
      impactSpeed,
      kineticEnergy,
    });

    // 8. DYNAMIC CAMERA TRAUMA
    const trauma = Math.min(1.0, (damage / 45) + (isCounter ? 0.35 : 0.05));
    if (this.cameraController) {
      this.cameraController.addTrauma(trauma);
    }

    // 9. BROADCAST HUD IMPACT TELEMETRY
    if (this.hud) {
      const hitPos = new THREE.Vector3(targetBody.position.x, targetBody.position.y, targetBody.position.z);
      let hitText = `${Math.round(kineticEnergy)} J`;
      let hitType = 'NORMAL';

      if (defender.isKnockedOut) {
        hitText = isPullCounter ? '⚡ PULL-COUNTER KO!' : 'FLASH KNOCKOUT!';
        hitType = 'KO';
      } else if (isPullCounter) {
        hitText = `⚡ PULL COUNTER! ${Math.round(kineticEnergy * 2.8)}J`;
        hitType = 'COUNTER';
      } else if (isCounter && damage > 30) {
        hitText = `COUNTER! ${Math.round(kineticEnergy * 2.3)}J`;
        hitType = 'COUNTER';
      } else if (isHeadshot && damage > 24) {
        hitText = `HEAD SNAP! ${Math.round(damage)} DMG`;
        hitType = 'ROCKED';
      }

      this.hud.spawnHitText(hitText, hitPos, hitType);
    }
  }
}
