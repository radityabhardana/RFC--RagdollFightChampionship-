import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sounds } from '../audio/SoundManager.js';
import { HumanFighterMesh } from './HumanFighterMesh.js';

// Collision Filter Groups to prevent self-collision jitter
export const COLLISION_GROUP_OCTAGON = 1;
export const COLLISION_GROUP_FIGHTER = 2;
export const COLLISION_GROUP_OPPONENT = 4;

/**
 * GoreBox-Style Hybrid Ragdoll UFC Fighter
 * 
 * Features 3 Integrated Ragdoll Architectures:
 * 1. HYBRID (Default Combat & Movement):
 *    - Kinematic Orthodox Fighter Stance (Kuda-kuda)
 *    - Smooth tactical step-and-drag footwork (Jalan pelan-pelan)
 *    - Indestructible joints (collideConnected: false, zero self-collision glitching)
 *    - Active physical colliders carrying real mass & momentum for strikes
 * 
 * 2. ACTIVE (Dynamic Balance & Impact Wrestling):
 *    - Physics-driven upright spring & PD torque balance
 *    - Real flinching, stumbling, and recovery upon impact
 * 
 * 3. PASSIVE (100% Limp Ragdoll):
 *    - Complete loss of motor tone for Knockouts & Slams
 *    - True gravity collapse with anatomical joint limits (knees only bend back, elbows only bend in)
 *    - Smooth get-up transition back to stance
 */
export class RagdollFighter {
  constructor(scene, world, config = {}) {
    this.scene = scene;
    this.world = world;

    // Config options
    this.isPlayer = config.isPlayer !== false;
    this.name = config.name || (this.isPlayer ? 'ALEX "THE VIPER"' : 'ISLAM "THE SMESH"');
    this.corner = config.corner || (this.isPlayer ? 'RED' : 'BLUE');
    this.shortsColor = config.shortsColor || (this.isPlayer ? 0xd4af37 : 0xd20a0a);
    this.skinColor = config.skinColor || (this.isPlayer ? 0xd99b7d : 0xc68662);

    // GoreBox Stylized Mesh Builder
    this.humanMesh = new HumanFighterMesh({
      skinColor: this.skinColor,
      shortsColor: this.shortsColor,
      corner: this.corner,
      isPlayer: this.isPlayer,
    });

    // Ragdoll States: 'HYBRID', 'ACTIVE', 'PASSIVE'
    this.ragdollMode = 'HYBRID';

    // Combat & Physiological Stats
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.isRocked = false;
    this.isGrounded = false;
    this.isCrouching = false;
    this.stumbleTimer = 0;
    this.getUpTimer = 0;

    // Combat action states
    this.state = 'STAND_IDLE'; // 'STAND_IDLE', 'STRIKING', 'SLIPPING', 'STUMBLE', 'KO', 'GET_UP'
    this.strikeType = null;
    this.strikeProgress = 0;
    this.strikeDuration = 0.35;
    this.strikeCooldown = 0;
    this.slipDirection = 0;
    this.guardUp = true;

    // Root World Transform & Locomotion Kinematics
    this.rootPosition = new THREE.Vector3(config.startX || 0, 0, config.startZ || 0);
    this.rootVelocity = new THREE.Vector3(0, 0, 0);
    this.targetMoveVelocity = new THREE.Vector3(0, 0, 0);
    this.facingAngle = this.isPlayer ? 0 : Math.PI; // Yaw in radians
    this.targetFacingAngle = this.facingAngle;
    this.facingDir = this.isPlayer ? 1 : -1;
    this.targetOpponent = null;

    // Footwork & Gait Cycle
    this.walkCycle = 0;
    this.isMoving = false;
    this.idleTimer = 0;

    // Mesh container & physics collections
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);
    this.bodies = [];
    this.constraints = [];

    // Build GoreBox Physics Bodies & Joint Hierarchy
    this.initGoreBoxRagdoll(this.rootPosition.x, this.rootPosition.z);
  }

  setOpponent(opponent) {
    this.targetOpponent = opponent;
  }

  // Set Ragdoll Mode: 'HYBRID' | 'ACTIVE' | 'PASSIVE'
  setRagdollMode(newMode) {
    if (this.ragdollMode === newMode) return;
    this.ragdollMode = newMode;

    if (newMode === 'PASSIVE') {
      this.enablePassiveRagdoll();
    } else if (newMode === 'ACTIVE') {
      this.enableActiveRagdoll();
    } else {
      this.enableHybridRagdoll();
    }
  }

  // Helper to configure body collision filters
  configureBody(body) {
    body.collisionFilterGroup = COLLISION_GROUP_FIGHTER;
    // Only collide with Octagon environment and opponent, NEVER with self body parts!
    body.collisionFilterMask = COLLISION_GROUP_OCTAGON | COLLISION_GROUP_OPPONENT;
    body.ownerFighter = this;
    this.world.addBody(body);
    this.bodies.push(body);
  }

  // --- INITIALIZE GOREBOX ANATOMICAL BODIES & CONSTRAINTS ---
  initGoreBoxRagdoll(x, z) {
    const fighterPhysMat = new CANNON.Material({ friction: 0.65, restitution: 0.1 });
    const glovePhysMat = new CANNON.Material({ friction: 0.5, restitution: 0.25 });

    // 1. Pelvis (Root Base ~16 kg)
    const pelvisShape = new CANNON.Box(new CANNON.Vec3(0.15, 0.12, 0.20));
    this.pelvis = new CANNON.Body({
      mass: 16.0,
      position: new CANNON.Vec3(x, 0.98, z),
      material: fighterPhysMat,
      angularDamping: 0.9,
      linearDamping: 0.5,
    });
    this.pelvis.addShape(pelvisShape);
    this.configureBody(this.pelvis);

    this.pelvisMesh = this.humanMesh.buildPelvisMesh();
    this.meshGroup.add(this.pelvisMesh);

    // 2. Torso (Ribcage / Chest ~24 kg)
    const torsoShape = new CANNON.Box(new CANNON.Vec3(0.16, 0.23, 0.22));
    this.torso = new CANNON.Body({
      mass: 24.0,
      position: new CANNON.Vec3(x, 1.35, z),
      material: fighterPhysMat,
      angularDamping: 0.85,
      linearDamping: 0.45,
    });
    this.torso.addShape(torsoShape);
    this.configureBody(this.torso);

    this.torsoMesh = this.humanMesh.buildTorsoMesh();
    this.meshGroup.add(this.torsoMesh);

    // 3. Head (Cranium & Jaw ~4.5 kg)
    const headShape = new CANNON.Sphere(0.15);
    this.head = new CANNON.Body({
      mass: 4.5,
      position: new CANNON.Vec3(x, 1.76, z),
      material: fighterPhysMat,
      angularDamping: 0.75,
      linearDamping: 0.35,
    });
    this.head.addShape(headShape);
    this.head.isHead = true;
    this.configureBody(this.head);

    this.headMesh = this.humanMesh.buildHeadMesh(this.facingDir);
    this.meshGroup.add(this.headMesh);

    // 4. Arms (Upper Arms & 4oz UFC Gloves)
    this.initGoreBoxArms(x, z, glovePhysMat);

    // 5. Legs (Thighs & Shins with Combat Soles)
    this.initGoreBoxLegs(x, z, fighterPhysMat);

    // 6. Connect Anatomical Joint Constraints (Indestructible anchors)
    this.setupJointConstraints();

    // Start in Hybrid Mode
    this.enableHybridRagdoll();
    this.updateHybridStanceAndFootwork(0.016);
    this.updateMeshTransforms();
  }

  initGoreBoxArms(x, z, glovePhysMat) {
    const sides = [
      { side: 'left', offsetZ: 0.30, sign: 1 },
      { side: 'right', offsetZ: -0.30, sign: -1 },
    ];

    sides.forEach(({ side, offsetZ }) => {
      // Upper arm
      const upperShape = new CANNON.Cylinder(0.08, 0.07, 0.26, 10);
      const upperBody = new CANNON.Body({
        mass: 2.4,
        position: new CANNON.Vec3(x, 1.40, z + offsetZ),
        angularDamping: 0.8,
        linearDamping: 0.4,
      });
      upperBody.addShape(upperShape);
      this.configureBody(upperBody);

      const upperMesh = this.humanMesh.buildUpperArmMesh();
      this.meshGroup.add(upperMesh);

      // Glove & Forearm
      const gloveShape = new CANNON.Sphere(0.12);
      const gloveBody = new CANNON.Body({
        mass: 2.0,
        position: new CANNON.Vec3(x + 0.28 * this.facingDir, 1.42, z + offsetZ * 0.6),
        material: glovePhysMat,
        angularDamping: 0.7,
        linearDamping: 0.3,
      });
      gloveBody.addShape(gloveShape);
      gloveBody.isGlove = true;
      gloveBody.armSide = side;
      this.configureBody(gloveBody);

      const gloveMesh = this.humanMesh.buildGloveMesh(this.facingDir);
      this.meshGroup.add(gloveMesh);

      if (side === 'left') {
        this.leftUpperArm = upperBody;
        this.leftUpperArmMesh = upperMesh;
        this.leftGlove = gloveBody;
        this.leftGloveMesh = gloveMesh;
      } else {
        this.rightUpperArm = upperBody;
        this.rightUpperArmMesh = upperMesh;
        this.rightGlove = gloveBody;
        this.rightGloveMesh = gloveMesh;
      }
    });
  }

  initGoreBoxLegs(x, z, fighterPhysMat) {
    const sides = [
      { side: 'left', offsetZ: 0.16 },
      { side: 'right', offsetZ: -0.16 },
    ];

    sides.forEach(({ side, offsetZ }) => {
      // Thigh
      const thighShape = new CANNON.Cylinder(0.10, 0.09, 0.36, 10);
      const thighBody = new CANNON.Body({
        mass: 6.8,
        position: new CANNON.Vec3(x, 0.68, z + offsetZ),
        material: fighterPhysMat,
        angularDamping: 0.85,
        linearDamping: 0.45,
      });
      thighBody.addShape(thighShape);
      this.configureBody(thighBody);

      const thighMesh = this.humanMesh.buildThighMesh();
      this.meshGroup.add(thighMesh);

      // Shin / Foot
      const shinShape = new CANNON.Cylinder(0.08, 0.07, 0.38, 10);
      const shinBody = new CANNON.Body({
        mass: 3.6,
        position: new CANNON.Vec3(x, 0.22, z + offsetZ),
        material: fighterPhysMat,
        angularDamping: 0.75,
        linearDamping: 0.4,
      });
      shinBody.addShape(shinShape);
      shinBody.isShin = true;
      shinBody.legSide = side;
      this.configureBody(shinBody);

      const shinMesh = this.humanMesh.buildShinMesh();
      this.meshGroup.add(shinMesh);

      if (side === 'left') {
        this.leftThigh = thighBody;
        this.leftThighMesh = thighMesh;
        this.leftShin = shinBody;
        this.leftShinMesh = shinMesh;
      } else {
        this.rightThigh = thighBody;
        this.rightThighMesh = thighMesh;
        this.rightShin = shinBody;
        this.rightShinMesh = shinMesh;
      }
    });
  }

  // Set up tight anatomical joint constraints with collideConnected: false
  setupJointConstraints() {
    // 1. Spine: Pelvis to Torso (Lumbar hinge/ball with strict anti-backbend)
    const spineJoint = new CANNON.ConeTwistConstraint(this.pelvis, this.torso, {
      pivotA: new CANNON.Vec3(0, 0.16, 0),
      pivotB: new CANNON.Vec3(0, -0.22, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 12, // Strict angular limit prevents backbreaking
      twistAngle: Math.PI / 10,
      collideConnected: false, // CRITICAL: prevents internal jitter/repulsion
    });
    this.world.addConstraint(spineJoint);
    this.constraints.push(spineJoint);

    // 2. Neck: Torso to Head
    const neckJoint = new CANNON.ConeTwistConstraint(this.torso, this.head, {
      pivotA: new CANNON.Vec3(0, 0.24, 0),
      pivotB: new CANNON.Vec3(0, -0.15, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 10,
      twistAngle: Math.PI / 8,
      collideConnected: false,
    });
    this.world.addConstraint(neckJoint);
    this.constraints.push(neckJoint);

    // 3. Shoulders
    const leftShoulder = new CANNON.ConeTwistConstraint(this.torso, this.leftUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.18, 0.28),
      pivotB: new CANNON.Vec3(0, 0.13, 0),
      axisA: new CANNON.Vec3(0, 0, 1),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 3,
      twistAngle: Math.PI / 3,
      collideConnected: false,
    });
    this.world.addConstraint(leftShoulder);
    this.constraints.push(leftShoulder);

    const rightShoulder = new CANNON.ConeTwistConstraint(this.torso, this.rightUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.18, -0.28),
      pivotB: new CANNON.Vec3(0, 0.13, 0),
      axisA: new CANNON.Vec3(0, 0, -1),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: Math.PI / 3,
      twistAngle: Math.PI / 3,
      collideConnected: false,
    });
    this.world.addConstraint(rightShoulder);
    this.constraints.push(rightShoulder);

    // 4. Elbows (True Hinge - cannot bend backward)
    const leftElbow = new CANNON.HingeConstraint(this.leftUpperArm, this.leftGlove, {
      pivotA: new CANNON.Vec3(0, -0.13, 0),
      pivotB: new CANNON.Vec3(-0.08 * this.facingDir, 0, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    });
    this.world.addConstraint(leftElbow);
    this.constraints.push(leftElbow);

    const rightElbow = new CANNON.HingeConstraint(this.rightUpperArm, this.rightGlove, {
      pivotA: new CANNON.Vec3(0, -0.13, 0),
      pivotB: new CANNON.Vec3(-0.08 * this.facingDir, 0, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    });
    this.world.addConstraint(rightElbow);
    this.constraints.push(rightElbow);

    // 5. Hips
    const leftHip = new CANNON.ConeTwistConstraint(this.pelvis, this.leftThigh, {
      pivotA: new CANNON.Vec3(0, -0.14, 0.15),
      pivotB: new CANNON.Vec3(0, 0.18, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4,
      twistAngle: Math.PI / 6,
      collideConnected: false,
    });
    this.world.addConstraint(leftHip);
    this.constraints.push(leftHip);

    const rightHip = new CANNON.ConeTwistConstraint(this.pelvis, this.rightThigh, {
      pivotA: new CANNON.Vec3(0, -0.14, -0.15),
      pivotB: new CANNON.Vec3(0, 0.18, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4,
      twistAngle: Math.PI / 6,
      collideConnected: false,
    });
    this.world.addConstraint(rightHip);
    this.constraints.push(rightHip);

    // 6. Knees (True Hinge - cannot bend forward)
    const leftKnee = new CANNON.HingeConstraint(this.leftThigh, this.leftShin, {
      pivotA: new CANNON.Vec3(0, -0.18, 0),
      pivotB: new CANNON.Vec3(0, 0.19, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    });
    this.world.addConstraint(leftKnee);
    this.constraints.push(leftKnee);

    const rightKnee = new CANNON.HingeConstraint(this.rightThigh, this.rightShin, {
      pivotA: new CANNON.Vec3(0, -0.18, 0),
      pivotB: new CANNON.Vec3(0, 0.19, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    });
    this.world.addConstraint(rightKnee);
    this.constraints.push(rightKnee);
  }

  // --- RAGDOLL MODE TRANSITIONS ---

  enableHybridRagdoll() {
    this.ragdollMode = 'HYBRID';
    this.isKnockedOut = false;
    this.state = 'STAND_IDLE';

    // Set all bodies to KINEMATIC so they move 100% smoothly according to the fighter stance kinematics
    // without suffering from gravity drag, constraint oscillation, or physics jitter!
    this.bodies.forEach(b => {
      b.type = CANNON.Body.KINEMATIC;
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);
      b.updateMassProperties();
    });
  }

  enableActiveRagdoll() {
    this.ragdollMode = 'ACTIVE';
    this.isKnockedOut = false;

    this.bodies.forEach(b => {
      b.type = CANNON.Body.DYNAMIC;
      b.linearDamping = 0.55;
      b.angularDamping = 0.8;
      b.updateMassProperties();
      b.wakeUp();
    });
  }

  enablePassiveRagdoll() {
    this.ragdollMode = 'PASSIVE';
    this.isKnockedOut = true;
    this.state = 'KO';

    // 100% limp dead weight: switch to DYNAMIC
    this.bodies.forEach(b => {
      b.type = CANNON.Body.DYNAMIC;
      b.linearDamping = 0.25;
      b.angularDamping = 0.40;
      b.updateMassProperties();
      b.wakeUp();
    });

    // Relax joint angles for realistic crumpling on canvas
    this.constraints.forEach(c => {
      if (c.angle !== undefined) c.angle = Math.PI / 2.2;
      if (c.twistAngle !== undefined) c.twistAngle = Math.PI / 2.2;
    });
  }

  knockout() {
    if (this.isKnockedOut && this.ragdollMode === 'PASSIVE') return;
    this.health = 0;
    sounds.playKnockout();
    this.enablePassiveRagdoll();

    // Sudden limp collapse impulse
    const knockDir = -this.facingDir;
    this.head.applyImpulse(new CANNON.Vec3(knockDir * 16, -10, (Math.random() - 0.5) * 12), this.head.position);
    this.torso.applyImpulse(new CANNON.Vec3(knockDir * 24, -14, 0), this.torso.position);
    this.pelvis.applyImpulse(new CANNON.Vec3(knockDir * 18, -8, 0), this.pelvis.position);
  }

  standUp() {
    this.health = 100;
    this.stamina = 100;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.state = 'STAND_IDLE';

    // Center root position to where the pelvis landed
    this.rootPosition.set(this.pelvis.position.x, 0, this.pelvis.position.z);
    this.rootVelocity.set(0, 0, 0);

    sounds.playBell();
    this.enableHybridRagdoll();
    this.snapBodiesToStance(this.rootPosition.x, this.rootPosition.z);
  }

  reset(x = 0, z = 0) {
    this.rootPosition.set(x, 0, z);
    this.rootVelocity.set(0, 0, 0);
    this.targetMoveVelocity.set(0, 0, 0);
    this.health = 100;
    this.stamina = 100;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.isRocked = false;
    this.isCrouching = false;
    this.state = 'STAND_IDLE';
    this.strikeCooldown = 0;
    this.stumbleTimer = 0;
    this.facingAngle = this.isPlayer ? 0 : Math.PI;

    this.enableHybridRagdoll();
    this.snapBodiesToStance(x, z);
  }

  // --- LOCOMOTION & MMA FOOTWORK (KUDA-KUDA & JALAN PELAN-PELAN) ---

  move(dirX, dirZ, isSprint = false) {
    if (this.cannotAct() || this.ragdollMode === 'PASSIVE') return;

    // Tactical Fighter Footwork Velocities
    const moveSpeed = isSprint ? 3.4 : (this.isCrouching ? 1.0 : 1.75);
    const speed = this.isRocked ? 0.9 : moveSpeed;

    this.targetMoveVelocity.set(dirX * speed, 0, dirZ * speed);
    this.isMoving = true;

    // Turn smoothly toward movement direction if not locked on an opponent
    if (!this.targetOpponent) {
      this.targetFacingAngle = Math.atan2(dirX, dirZ);
    }
  }

  jump() {
    if (this.cannotAct() || this.ragdollMode === 'PASSIVE' || this.rootPosition.y > 0.1) return;
    this.rootVelocity.y = 4.2;
    sounds.playJab();
  }

  crouch(isDown) {
    this.isCrouching = isDown;
  }

  slip(direction) {
    if (this.cannotAct() || this.ragdollMode === 'PASSIVE') return;
    this.state = 'SLIPPING';
    this.slipDirection = direction;
    this.strikeCooldown = 0.35;
    sounds.playSwoosh();
  }

  // --- STRIKE ACTIONS WITH PHYSICAL KINETIC PROJECTION ---

  throwJab() {
    if (this.cannotAct() || this.stamina < 8) return;
    this.stamina = Math.max(0, this.stamina - 8);
    this.triggerStrike('JAB', 0.28);
    sounds.playJab();
  }

  throwCross() {
    if (this.cannotAct() || this.stamina < 14) return;
    this.stamina = Math.max(0, this.stamina - 14);
    this.triggerStrike('CROSS', 0.40);
    sounds.playPunch(0.9);
  }

  throwHook() {
    if (this.cannotAct() || this.stamina < 18) return;
    this.stamina = Math.max(0, this.stamina - 18);
    this.triggerStrike('HOOK', 0.45);
    sounds.playHeavyImpact(false);
  }

  throwUppercut() {
    if (this.cannotAct() || this.stamina < 16) return;
    this.stamina = Math.max(0, this.stamina - 16);
    this.triggerStrike('UPPERCUT', 0.42);
    sounds.playPunch(1.0);
  }

  throwHeadkick() {
    if (this.cannotAct() || this.stamina < 26) return;
    this.stamina = Math.max(0, this.stamina - 26);
    this.triggerStrike('HEADKICK', 0.60);
    sounds.playHeavyImpact(true);
  }

  throwLowKick() {
    if (this.cannotAct() || this.stamina < 20) return;
    this.stamina = Math.max(0, this.stamina - 20);
    this.triggerStrike('LOWKICK', 0.48);
    sounds.playPunch(0.85);
  }

  triggerStrike(type, duration) {
    this.state = 'STRIKING';
    this.strikeType = type;
    this.strikeDuration = duration;
    this.strikeProgress = 0;
    this.strikeCooldown = duration + 0.05;
  }

  cannotAct() {
    return this.isKnockedOut || this.strikeCooldown > 0 || this.ragdollMode === 'PASSIVE';
  }

  // --- HIT RECEPTION & FLASH KNOCKOUT ---

  receivePhysicalHit(hitData) {
    if (this.isKnockedOut) return;

    const { damage = 15, isHeadshot = false, isCounter = false, kineticEnergy = 50 } = hitData;
    let finalDmg = damage;
    if (this.guardUp && !isCounter) finalDmg *= 0.4;

    this.health = Math.max(0, this.health - finalDmg);

    if (isHeadshot) {
      this.concussionLevel = Math.min(100, this.concussionLevel + kineticEnergy * 0.45);
    }

    if (finalDmg > 18 || isCounter) {
      sounds.playHeavyImpact(isCounter);
    } else {
      sounds.playPunch(0.7);
    }

    // Flash KO dynamics
    const flashKO = (this.concussionLevel >= 95) || (this.health <= 0) || (isCounter && kineticEnergy > 85);
    if (flashKO) {
      this.knockout();
    } else if (finalDmg > 16) {
      this.isRocked = true;
      this.stumbleTimer = 0.55;
      this.state = 'STUMBLE';
      this.stamina = Math.max(0, this.stamina - 20);
      setTimeout(() => { this.isRocked = false; }, 1200);
    }
  }

  // --- SIMULATION LOOP: HYBRID / ACTIVE / PASSIVE UPDATE ---

  updateActiveRagdoll(delta) {
    // Stamina regen
    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 15);
    }

    // Concussion decay
    if (this.concussionLevel > 0) {
      this.concussionLevel = Math.max(0, this.concussionLevel - delta * 8);
    }

    // Cooldown management
    if (this.strikeCooldown > 0) {
      this.strikeCooldown = Math.max(0, this.strikeCooldown - delta);
      if (this.strikeCooldown === 0 && this.state !== 'KO' && this.stumbleTimer <= 0) {
        this.state = 'STAND_IDLE';
      }
    }

    // Stumble decay
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= delta;
      if (this.stumbleTimer <= 0 && this.state === 'STUMBLE') {
        this.state = 'STAND_IDLE';
      }
    }

    // Handle Active Strike progress
    if (this.state === 'STRIKING') {
      this.strikeProgress = Math.min(1.0, this.strikeProgress + delta / this.strikeDuration);
    }

    // 1. PASSIVE RAGDOLL MODE: Pure dynamic physics
    if (this.ragdollMode === 'PASSIVE') {
      // Sync root position to pelvis so camera follows ragdoll
      this.rootPosition.set(this.pelvis.position.x, this.pelvis.position.y - 0.98, this.pelvis.position.z);
      return;
    }

    // 2. ACTIVE RAGDOLL MODE: Physics balance spring controller
    if (this.ragdollMode === 'ACTIVE') {
      this.updateActivePhysicsBalance(delta);
      return;
    }

    // 3. HYBRID RAGDOLL MODE (Default): Kinematic Stance & Step Footwork
    this.updateHybridStanceAndFootwork(delta);
  }

  // --- HYBRID RAGDOLL STANCE KINEMATICS & FOOTWORK CONTROLLER ---

  updateHybridStanceAndFootwork(delta) {
    // A. Smooth Locomotion Integration
    const accelRate = this.isMoving ? 14 : 18;
    this.rootVelocity.x += (this.targetMoveVelocity.x - this.rootVelocity.x) * Math.min(1, delta * accelRate);
    this.rootVelocity.z += (this.targetMoveVelocity.z - this.rootVelocity.z) * Math.min(1, delta * accelRate);

    // Octagon boundary clamp (~5.8m radius circle)
    const nextX = this.rootPosition.x + this.rootVelocity.x * delta;
    const nextZ = this.rootPosition.z + this.rootVelocity.z * delta;
    const distFromCenter = Math.hypot(nextX, nextZ);
    if (distFromCenter < 5.8) {
      this.rootPosition.x = nextX;
      this.rootPosition.z = nextZ;
    } else {
      this.rootVelocity.x *= -0.2;
      this.rootVelocity.z *= -0.2;
    }

    this.targetMoveVelocity.set(0, 0, 0);
    this.isMoving = false;

    // B. Stance Facing Direction Alignment
    if (this.targetOpponent && !this.targetOpponent.isKnockedOut) {
      const oppPos = this.targetOpponent.getTorsoPosition();
      this.targetFacingAngle = Math.atan2(oppPos.x - this.rootPosition.x, oppPos.z - this.rootPosition.z);
    }

    let angleDiff = this.targetFacingAngle - this.facingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.facingAngle += angleDiff * Math.min(1, delta * 12);
    this.facingDir = Math.cos(this.facingAngle) >= 0 ? 1 : -1;

    // C. Vertical Dynamics (Jump / Hop)
    if (this.rootPosition.y > 0 || this.rootVelocity.y !== 0) {
      this.rootVelocity.y -= 9.81 * delta;
      this.rootPosition.y += this.rootVelocity.y * delta;
      if (this.rootPosition.y <= 0) {
        this.rootPosition.y = 0;
        this.rootVelocity.y = 0;
      }
    }

    // D. Fighter Footwork Gait & Tactical Step-and-Drag
    const currentSpeed = Math.hypot(this.rootVelocity.x, this.rootVelocity.z);
    if (currentSpeed > 0.2) {
      this.walkCycle += delta * currentSpeed * 4.5;
    } else {
      this.idleTimer += delta * 3.5;
    }

    // Stance Vectors: Forward is +X (towards opponent), Right is +Z (towards camera)
    const stanceYaw = this.facingAngle;
    const fX = Math.cos(stanceYaw);
    const fZ = Math.sin(stanceYaw);
    const rX = -Math.sin(stanceYaw);
    const rZ = Math.cos(stanceYaw);

    const F = new THREE.Vector3(fX, 0, fZ); // Forward unit vector
    const R = new THREE.Vector3(rX, 0, rZ); // Right unit vector
    const L = new THREE.Vector3(-rX, 0, -rZ); // Left unit vector

    const idleBob = (currentSpeed < 0.2) ? Math.sin(this.idleTimer) * 0.02 : Math.sin(this.walkCycle * 2) * 0.03;
    const crouchDrop = this.isCrouching ? 0.32 : 0;
    const baseHeight = 0.98 + this.rootPosition.y - crouchDrop + idleBob;

    // 1. Pelvis Position & Orientation (Orthodox angle ~18 deg)
    const pelvisTargetPos = new THREE.Vector3(
      this.rootPosition.x,
      baseHeight,
      this.rootPosition.z
    );
    const pelvisTargetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), stanceYaw + 0.25);

    // 2. Torso Position & Orientation (Athletic forward lean, broad shoulders)
    const forwardIncline = 0.08;
    const slipOffset = (this.state === 'SLIPPING') ? this.slipDirection * 0.22 : 0;
    const torsoTargetPos = new THREE.Vector3(
      pelvisTargetPos.x + F.x * forwardIncline + R.x * slipOffset,
      baseHeight + 0.38,
      pelvisTargetPos.z + F.z * forwardIncline + R.z * slipOffset
    );
    const torsoEuler = new THREE.Euler(forwardIncline, stanceYaw + 0.15, 0, 'YXZ');
    const torsoTargetQuat = new THREE.Quaternion().setFromEuler(torsoEuler);

    // 3. Head Position & Orientation (Chin tucked, eyes on target)
    const headTargetPos = new THREE.Vector3(
      torsoTargetPos.x + F.x * 0.05 + R.x * (slipOffset * 0.5),
      torsoTargetPos.y + 0.38,
      torsoTargetPos.z + F.z * 0.05 + R.z * (slipOffset * 0.5)
    );
    const headTargetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), stanceYaw);

    // 4. Legs Footwork (Orthodox Stance: Lead left foot forward, rear right foot back)
    const stepL = (currentSpeed > 0.2) ? Math.sin(this.walkCycle) * 0.16 : 0;
    const stepR = (currentSpeed > 0.2) ? -Math.sin(this.walkCycle) * 0.16 : 0;

    // Hips
    const leftHip = new THREE.Vector3().copy(pelvisTargetPos).addScaledVector(L, 0.14).add(new THREE.Vector3(0, -0.10, 0));
    const rightHip = new THREE.Vector3().copy(pelvisTargetPos).addScaledVector(R, 0.14).add(new THREE.Vector3(0, -0.10, 0));

    // Knees
    const leftKnee = new THREE.Vector3().copy(leftHip).addScaledVector(F, 0.16 + stepL).add(new THREE.Vector3(0, -0.38, 0));
    const rightKnee = new THREE.Vector3().copy(rightHip).addScaledVector(F, -0.14 + stepR).add(new THREE.Vector3(0, -0.38, 0));

    // Feet (Resting flat on canvas surface at Y ~ 0.03)
    const footY = 0.03 + this.rootPosition.y;
    const leftFoot = new THREE.Vector3().copy(leftKnee).addScaledVector(F, 0.06);
    leftFoot.y = footY + Math.max(0, stepL * 0.20);
    const rightFoot = new THREE.Vector3().copy(rightKnee).addScaledVector(F, -0.05);
    rightFoot.y = footY + Math.max(0, stepR * 0.20);

    // Midpoints for Thighs & Shins
    const leftThighPos = new THREE.Vector3().addVectors(leftHip, leftKnee).multiplyScalar(0.5);
    const rightThighPos = new THREE.Vector3().addVectors(rightHip, rightKnee).multiplyScalar(0.5);
    const leftShinPos = new THREE.Vector3().addVectors(leftKnee, leftFoot).multiplyScalar(0.5);
    const rightShinPos = new THREE.Vector3().addVectors(rightKnee, rightFoot).multiplyScalar(0.5);

    // Leg Quaternions
    const lThighDir = new THREE.Vector3().subVectors(leftKnee, leftHip).normalize();
    const leftThighQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), lThighDir);

    const rThighDir = new THREE.Vector3().subVectors(rightKnee, rightHip).normalize();
    const rightThighQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), rThighDir);

    const lShinDir = new THREE.Vector3().subVectors(leftFoot, leftKnee).normalize();
    const leftShinQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), lShinDir);

    const rShinDir = new THREE.Vector3().subVectors(rightFoot, rightKnee).normalize();
    const rightShinQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), rShinDir);

    // 5. Arms (Authentic UFC High Guard: Elbows tucked to ribs, gloves up protecting chin)
    const leftShoulder = new THREE.Vector3().copy(torsoTargetPos).addScaledVector(L, 0.22).add(new THREE.Vector3(0, 0.14, 0));
    const rightShoulder = new THREE.Vector3().copy(torsoTargetPos).addScaledVector(R, 0.22).add(new THREE.Vector3(0, 0.14, 0));

    // Elbows tucked down along ribs
    const leftElbow = new THREE.Vector3().copy(leftShoulder).addScaledVector(F, 0.10).addScaledVector(R, 0.04).add(new THREE.Vector3(0, -0.26, 0));
    const rightElbow = new THREE.Vector3().copy(rightShoulder).addScaledVector(F, 0.08).addScaledVector(L, 0.04).add(new THREE.Vector3(0, -0.26, 0));

    // Gloves / Fists: Held up in guard protecting chin/face
    let leftGloveTarget = new THREE.Vector3().copy(leftElbow).addScaledVector(F, 0.22).add(new THREE.Vector3(0, 0.24, 0));
    let rightGloveTarget = new THREE.Vector3().copy(rightElbow).addScaledVector(F, 0.12).addScaledVector(L, 0.02).add(new THREE.Vector3(0, 0.22, 0));

    // Kinetic Strike Displacements
    if (this.state === 'STRIKING') {
      const p = this.strikeProgress;
      const strikeExtension = Math.sin(p * Math.PI);

      switch (this.strikeType) {
        case 'JAB':
          leftGloveTarget.addScaledVector(F, 0.55 * strikeExtension);
          break;
        case 'CROSS':
          rightGloveTarget.addScaledVector(F, 0.75 * strikeExtension);
          torsoTargetPos.addScaledVector(F, 0.10 * strikeExtension);
          break;
        case 'HOOK':
          leftGloveTarget.addScaledVector(F, 0.35 * strikeExtension).addScaledVector(R, 0.38 * strikeExtension);
          break;
        case 'UPPERCUT':
          rightGloveTarget.addScaledVector(F, 0.36 * strikeExtension).add(new THREE.Vector3(0, 0.32 * strikeExtension, 0));
          break;
        case 'HEADKICK':
          rightFoot.addScaledVector(F, 0.55 * strikeExtension).add(new THREE.Vector3(0, 0.95 * strikeExtension, 0));
          break;
        case 'LOWKICK':
          rightFoot.addScaledVector(F, 0.45 * strikeExtension).add(new THREE.Vector3(0, 0.30 * strikeExtension, 0));
          break;
      }
    }

    // Upper Arm midpoints & orientations
    const leftUpperArmPos = new THREE.Vector3().addVectors(leftShoulder, leftElbow).multiplyScalar(0.5);
    const rightUpperArmPos = new THREE.Vector3().addVectors(rightShoulder, rightElbow).multiplyScalar(0.5);

    const lUpperDir = new THREE.Vector3().subVectors(leftElbow, leftShoulder).normalize();
    const leftUpperArmQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), lUpperDir);

    const rUpperDir = new THREE.Vector3().subVectors(rightElbow, rightShoulder).normalize();
    const rightUpperArmQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), rUpperDir);

    // Forearm midpoints & orientations
    const leftForearmPos = new THREE.Vector3().addVectors(leftElbow, leftGloveTarget).multiplyScalar(0.5);
    const rightForearmPos = new THREE.Vector3().addVectors(rightElbow, rightGloveTarget).multiplyScalar(0.5);

    const lForearmDir = new THREE.Vector3().subVectors(leftGloveTarget, leftElbow).normalize();
    const leftGloveQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lForearmDir);

    const rForearmDir = new THREE.Vector3().subVectors(rightGloveTarget, rightElbow).normalize();
    const rightGloveQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rForearmDir);

    // Apply Solid Kinematic Sync to Cannon Physics Bodies
    const syncBody = (body, targetPos, targetQuat) => {
      body.position.copy(targetPos);
      if (targetQuat) {
        body.quaternion.copy(targetQuat);
      }
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
    };

    syncBody(this.pelvis, pelvisTargetPos, pelvisTargetQuat);
    syncBody(this.torso, torsoTargetPos, torsoTargetQuat);
    syncBody(this.head, headTargetPos, headTargetQuat);
    syncBody(this.leftUpperArm, leftUpperArmPos, leftUpperArmQuat);
    syncBody(this.rightUpperArm, rightUpperArmPos, rightUpperArmQuat);
    syncBody(this.leftGlove, leftForearmPos, leftGloveQuat);
    syncBody(this.rightGlove, rightForearmPos, rightGloveQuat);
    syncBody(this.leftThigh, leftThighPos, leftThighQuat);
    syncBody(this.rightThigh, rightThighPos, rightThighQuat);
    syncBody(this.leftShin, leftShinPos, leftShinQuat);
    syncBody(this.rightShin, rightShinPos, rightShinQuat);
  }

  // --- ACTIVE RAGDOLL PHYSICS BALANCE CONTROLLER ---

  updateActivePhysicsBalance(delta) {
    // Upright height buoyancy spring
    const targetY = this.isCrouching ? 0.75 : 1.0;
    const heightErr = targetY - this.pelvis.position.y;
    this.pelvis.velocity.y += heightErr * 24.0 * delta;

    // Upright spine alignment torque
    const up = new THREE.Vector3(0, 1, 0);
    const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.torso.quaternion);
    const tiltAxis = new THREE.Vector3().crossVectors(currentUp, up);
    this.torso.applyTorque(new CANNON.Vec3(tiltAxis.x * 120, tiltAxis.y * 60, tiltAxis.z * 120));

    // Gloves pulled toward chin
    const guardHeight = this.torso.position.y + 0.1;
    const lDiff = new CANNON.Vec3(this.torso.position.x + 0.25, guardHeight, this.torso.position.z + 0.15).vsub(this.leftGlove.position);
    const rDiff = new CANNON.Vec3(this.torso.position.x + 0.20, guardHeight, this.torso.position.z - 0.15).vsub(this.rightGlove.position);
    this.leftGlove.applyForce(lDiff.scale(140), this.leftGlove.position);
    this.rightGlove.applyForce(rDiff.scale(140), this.rightGlove.position);
  }

  // Snap all physics bodies instantly to stance at given X, Z
  snapBodiesToStance(x, z) {
    this.rootPosition.set(x, 0, z);
    this.rootVelocity.set(0, 0, 0);
    this.targetMoveVelocity.set(0, 0, 0);
    this.updateHybridStanceAndFootwork(0.016);
    this.updateMeshTransforms();
  }

  // --- SYNC THREE.JS VISUAL MESHES TO CANNON PHYSICS BODIES ---

  updateMeshTransforms() {
    this.pelvisMesh.position.copy(this.pelvis.position);
    this.pelvisMesh.quaternion.copy(this.pelvis.quaternion);

    this.torsoMesh.position.copy(this.torso.position);
    this.torsoMesh.quaternion.copy(this.torso.quaternion);

    this.headMesh.position.copy(this.head.position);
    this.headMesh.quaternion.copy(this.head.quaternion);

    this.leftUpperArmMesh.position.copy(this.leftUpperArm.position);
    this.leftUpperArmMesh.quaternion.copy(this.leftUpperArm.quaternion);

    this.rightUpperArmMesh.position.copy(this.rightUpperArm.position);
    this.rightUpperArmMesh.quaternion.copy(this.rightUpperArm.quaternion);

    this.leftGloveMesh.position.copy(this.leftGlove.position);
    this.leftGloveMesh.quaternion.copy(this.leftGlove.quaternion);

    this.rightGloveMesh.position.copy(this.rightGlove.position);
    this.rightGloveMesh.quaternion.copy(this.rightGlove.quaternion);

    this.leftThighMesh.position.copy(this.leftThigh.position);
    this.leftThighMesh.quaternion.copy(this.leftThigh.quaternion);

    this.rightThighMesh.position.copy(this.rightThigh.position);
    this.rightThighMesh.quaternion.copy(this.rightThigh.quaternion);

    this.leftShinMesh.position.copy(this.leftShin.position);
    this.leftShinMesh.quaternion.copy(this.leftShin.quaternion);

    this.rightShinMesh.position.copy(this.rightShin.position);
    this.rightShinMesh.quaternion.copy(this.rightShin.quaternion);
  }

  // Telemetry getters
  getTorsoPosition() {
    return this.torso.position;
  }

  getHeadPosition() {
    return this.head.position;
  }

  getPelvisPosition() {
    return this.pelvis.position;
  }
}
