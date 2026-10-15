import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sounds } from '../audio/SoundManager.js';
import { HumanFighterMesh } from './HumanFighterMesh.js';

export class RagdollFighter {
  constructor(scene, world, config = {}) {
    this.scene = scene;
    this.world = world;

    // Config options
    this.isPlayer = config.isPlayer || false;
    this.name = config.name || (this.isPlayer ? 'ALEX "THE VIPER"' : 'ISLAM "THE SMESH"');
    this.corner = config.corner || (this.isPlayer ? 'RED' : 'BLUE');
    this.archetype = config.archetype || 'BALANCED';
    this.shortsColor = config.shortsColor || (this.isPlayer ? 0xd4af37 : 0xd20a0a); // Gold vs Red
    this.skinColor = config.skinColor || (this.isPlayer ? 0xd99b7d : 0xc68662);

    // Anatomical Human Mesh Sculpt Builder
    this.humanMesh = new HumanFighterMesh({
      skinColor: this.skinColor,
      shortsColor: this.shortsColor,
      corner: this.corner,
      isPlayer: this.isPlayer,
    });

    // Physiological & Trauma Stats (Real-world biomedical metrics)
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.concussionLevel = 0; // Brain rotational acceleration trauma (0 - 100)
    this.isKnockedOut = false;
    this.isRocked = false;
    this.isGrounded = false;
    this.groundRole = null; // 'TOP' (Mount) or 'BOTTOM' (Guard)
    this.groundTimer = 0;
    this.stumbleTimer = 0;

    // Combat states
    this.state = 'STAND_IDLE'; // 'STAND_IDLE', 'STRIKING', 'SLIPPING', 'TAKEDOWN_SHOOT', 'GROUND_POUND', 'STUMBLE', 'KO'
    this.strikeType = null;
    this.strikeProgress = 0;
    this.strikeCooldown = 0;
    this.slipDirection = 0; // -1 left, 1 right, 0 center
    this.guardUp = false;

    // Meshes & Physics Bodies collections
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);
    this.bodies = [];
    this.constraints = [];

    // Direction faced (1 for Player facing +X, -1 for AI facing -X)
    this.facingDir = this.isPlayer ? 1 : -1;
    this.targetOpponent = null;

    // Build Ragdoll with anatomical mass ratios
    const startX = config.startX || (this.isPlayer ? -1.8 : 1.8);
    const startZ = config.startZ || 0;
    this.initRagdoll(startX, startZ);
  }

  setOpponent(opponent) {
    this.targetOpponent = opponent;
  }

  // Authentic UFC Fighter Anatomical Mass Ratios (Total ~76.5 kg athlete)
  initRagdoll(x, z) {
    // Materials
    this.matSkin = new THREE.MeshStandardMaterial({
      color: this.skinColor,
      roughness: 0.65,
      metalness: 0.1,
    });

    this.matShorts = new THREE.MeshStandardMaterial({
      color: this.shortsColor,
      roughness: 0.7,
      metalness: 0.2,
    });

    this.matGloves = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.4,
      metalness: 0.3,
    });

    this.matTape = new THREE.MeshStandardMaterial({
      color: this.corner === 'RED' ? 0xd20a0a : 0x0a5cd2,
      roughness: 0.5,
    });

    // Physics materials with real friction & restitution
    const fighterPhysMat = new CANNON.Material({ friction: 0.82, restitution: 0.15 });
    const glovePhysMat = new CANNON.Material({ friction: 0.65, restitution: 0.22 });

    // 1. Pelvis / Lower Abdomen (Center of Mass Root ~15 kg)
    const pelvisShape = new CANNON.Cylinder(0.24, 0.22, 0.35, 12);
    this.pelvis = new CANNON.Body({
      mass: 15.0,
      position: new CANNON.Vec3(x, 1.05, z),
      material: fighterPhysMat,
      angularDamping: 0.85,
      linearDamping: 0.35,
    });
    this.pelvis.addShape(pelvisShape);
    this.pelvis.angularFactor.set(0, 1, 0); // Active balance lock (yaw only)
    this.world.addBody(this.pelvis);
    this.bodies.push(this.pelvis);

    // 1. Pelvis / Lower Abdomen with UFC Shorts & Waistband
    this.pelvisMesh = this.humanMesh.buildPelvisMesh();
    this.meshGroup.add(this.pelvisMesh);

    // 2. Torso / Ribcage & Chest (~25 kg)
    const torsoShape = new CANNON.Cylinder(0.28, 0.24, 0.45, 12);
    this.torso = new CANNON.Body({
      mass: 25.0,
      position: new CANNON.Vec3(x, 1.45, z),
      material: fighterPhysMat,
      angularDamping: 0.85,
      linearDamping: 0.35,
    });
    this.torso.addShape(torsoShape);
    this.torso.angularFactor.set(0.18, 1, 0.18); // Natural upper-body sway flex
    this.world.addBody(this.torso);
    this.bodies.push(this.torso);

    // Anatomical V-Taper Muscular Torso with Pectorals & 6-Pack Abs
    this.torsoMesh = this.humanMesh.buildTorsoMesh();
    this.meshGroup.add(this.torsoMesh);

    // Spine Joint: Pelvis to Torso (Lumbar Spine)
    const spineJoint = new CANNON.ConeTwistConstraint(this.pelvis, this.torso, {
      pivotA: new CANNON.Vec3(0, 0.2, 0),
      pivotB: new CANNON.Vec3(0, -0.22, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 10,
      twistAngle: Math.PI / 8,
    });
    this.world.addConstraint(spineJoint);
    this.constraints.push(spineJoint);

    // 3. Head & Cervical Spine (Anatomical ~4.8 kg Skull with Jaw, Brow, Ears & Mouthguard)
    const headShape = new CANNON.Sphere(0.18);
    this.head = new CANNON.Body({
      mass: 4.8,
      position: new CANNON.Vec3(x, 1.82, z),
      material: fighterPhysMat,
      angularDamping: 0.65, // Cervical neck muscle damping
      linearDamping: 0.3,
    });
    this.head.addShape(headShape);
    this.head.isHead = true;
    this.head.ownerFighter = this;
    this.world.addBody(this.head);
    this.bodies.push(this.head);

    this.headMesh = this.humanMesh.buildHeadMesh(this.facingDir);
    this.meshGroup.add(this.headMesh);

    // Neck Joint: Cervical Spine (resists rotational whiplash with realistic spring limits)
    const neckJoint = new CANNON.ConeTwistConstraint(this.torso, this.head, {
      pivotA: new CANNON.Vec3(0, 0.25, 0),
      pivotB: new CANNON.Vec3(0, -0.16, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 9,
      twistAngle: Math.PI / 7,
    });
    this.world.addConstraint(neckJoint);
    this.constraints.push(neckJoint);

    // 4. Arms & 4oz MMA Gloves (Biomechanical Kinetic Whip)
    this.initArms(x, z, glovePhysMat);

    // 5. Legs & Ground Support (Thighs ~7.2 kg, Shins ~3.8 kg)
    this.initLegs(x, z, fighterPhysMat);
  }

  initArms(x, z, glovePhysMat) {
    const armSides = [
      { side: 'left', offsetZ: 0.34, sign: 1 },
      { side: 'right', offsetZ: -0.34, sign: -1 },
    ];

    armSides.forEach(({ side, offsetZ, sign }) => {
      // Upper arm (Biceps / Triceps ~2.5 kg)
      const upperShape = new CANNON.Cylinder(0.08, 0.07, 0.32, 10);
      const upperBody = new CANNON.Body({
        mass: 2.5,
        position: new CANNON.Vec3(x, 1.45, z + offsetZ),
        angularDamping: 0.75,
        linearDamping: 0.35,
      });
      upperBody.addShape(upperShape);
      this.world.addBody(upperBody);
      this.bodies.push(upperBody);

      // Anatomical Biceps & Triceps Upper Arm Sculpt
      const upperMesh = this.humanMesh.buildUpperArmMesh();
      this.meshGroup.add(upperMesh);

      // Shoulder Joint (Glenohumeral ball-and-socket)
      const shoulderJoint = new CANNON.ConeTwistConstraint(this.torso, upperBody, {
        pivotA: new CANNON.Vec3(0, 0.18, offsetZ * 0.9),
        pivotB: new CANNON.Vec3(0, 0.16, 0),
        axisA: new CANNON.Vec3(0, 0, sign),
        axisB: new CANNON.Vec3(0, 1, 0),
        angle: Math.PI / 3.5,
        twistAngle: Math.PI / 2.8,
      });
      this.world.addConstraint(shoulderJoint);
      this.constraints.push(shoulderJoint);

      // Forearm & 4oz MMA Glove (~2.1 kg)
      const gloveShape = new CANNON.Sphere(0.12);
      const gloveBody = new CANNON.Body({
        mass: 2.1,
        position: new CANNON.Vec3(x + 0.35 * this.facingDir, 1.45, z + offsetZ * 0.6),
        material: glovePhysMat,
        angularDamping: 0.65,
        linearDamping: 0.25,
      });
      gloveBody.addShape(gloveShape);
      gloveBody.isGlove = true;
      gloveBody.ownerFighter = this;
      gloveBody.armSide = side;
      this.world.addBody(gloveBody);
      this.bodies.push(gloveBody);

      // Authentic 4oz UFC Open-Finger Glove with Corner Tape
      const gloveGroup = this.humanMesh.buildGloveMesh(this.facingDir);
      this.meshGroup.add(gloveGroup);

      // Elbow Hinge Joint
      const elbowJoint = new CANNON.ConeTwistConstraint(upperBody, gloveBody, {
        pivotA: new CANNON.Vec3(0, -0.16, 0),
        pivotB: new CANNON.Vec3(-0.1 * this.facingDir, 0, 0),
        axisA: CANNON.Vec3.UNIT_Y,
        axisB: CANNON.Vec3.UNIT_X,
        angle: Math.PI / 2.5,
        twistAngle: Math.PI / 3,
      });
      this.world.addConstraint(elbowJoint);
      this.constraints.push(elbowJoint);

      if (side === 'left') {
        this.leftUpperArm = upperBody;
        this.leftUpperArmMesh = upperMesh;
        this.leftGlove = gloveBody;
        this.leftGloveMesh = gloveGroup;
      } else {
        this.rightUpperArm = upperBody;
        this.rightUpperArmMesh = upperMesh;
        this.rightGlove = gloveBody;
        this.rightGloveMesh = gloveGroup;
      }
    });
  }

  initLegs(x, z, fighterPhysMat) {
    const legSides = [
      { side: 'left', offsetZ: 0.18 },
      { side: 'right', offsetZ: -0.18 },
    ];

    legSides.forEach(({ side, offsetZ }) => {
      // Thigh (Quadriceps / Hamstring ~7.2 kg)
      const thighShape = new CANNON.Cylinder(0.11, 0.09, 0.42, 10);
      const thighBody = new CANNON.Body({
        mass: 7.2,
        position: new CANNON.Vec3(x, 0.72, z + offsetZ),
        material: fighterPhysMat,
        angularDamping: 0.8,
        linearDamping: 0.35,
      });
      thighBody.addShape(thighShape);
      this.world.addBody(thighBody);
      this.bodies.push(thighBody);

      // Muscular Thigh & Fight Shorts Sleeve Sculpt
      const thighMesh = this.humanMesh.buildThighMesh();
      this.meshGroup.add(thighMesh);

      // Hip Joint
      const hipJoint = new CANNON.ConeTwistConstraint(this.pelvis, thighBody, {
        pivotA: new CANNON.Vec3(0, -0.18, offsetZ),
        pivotB: new CANNON.Vec3(0, 0.2, 0),
        axisA: CANNON.Vec3.UNIT_Y,
        axisB: CANNON.Vec3.UNIT_Y,
        angle: Math.PI / 5,
        twistAngle: Math.PI / 7,
      });
      this.world.addConstraint(hipJoint);
      this.constraints.push(hipJoint);

      // Shin, Muscular Diamond Calf, Ankle Wrap & Foot (~3.8 kg)
      const shinShape = new CANNON.Cylinder(0.08, 0.07, 0.42, 10);
      const shinBody = new CANNON.Body({
        mass: 3.8,
        position: new CANNON.Vec3(x, 0.25, z + offsetZ),
        material: fighterPhysMat,
        angularDamping: 0.7,
        linearDamping: 0.35,
      });
      shinBody.addShape(shinShape);
      shinBody.isShin = true;
      shinBody.ownerFighter = this;
      this.world.addBody(shinBody);
      this.bodies.push(shinBody);

      // Muscular Calf with Ankle Compression Wrap & Athletic Foot
      const shinMesh = this.humanMesh.buildShinMesh();
      this.meshGroup.add(shinMesh);

      // Knee Joint (True Hinge)
      const kneeJoint = new CANNON.HingeConstraint(thighBody, shinBody, {
        pivotA: new CANNON.Vec3(0, -0.21, 0),
        pivotB: new CANNON.Vec3(0, 0.21, 0),
        axisA: CANNON.Vec3.UNIT_Z,
        axisB: CANNON.Vec3.UNIT_Z,
      });
      this.world.addConstraint(kneeJoint);
      this.constraints.push(kneeJoint);

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

  // --- BIOMECHANICAL KINETIC CHAIN STRIKING ---
  // (Ground Reaction -> Hip Rotation -> Torso Whip -> Arm Extension)

  throwJab() {
    if (this.cannotAct() || this.stamina < 8) return;
    this.stamina = Math.max(0, this.stamina - 8);
    this.state = 'STRIKING';
    this.strikeType = 'JAB';
    this.strikeProgress = 0;
    this.strikeCooldown = 0.30;

    sounds.playJab();

    // 1. Kinetic forward step
    this.pelvis.applyImpulse(new CANNON.Vec3(this.facingDir * 18, 0, 0), this.pelvis.position);
    // 2. Lead glove linear whip
    const leadGlove = this.facingDir > 0 ? this.leftGlove : this.rightGlove;
    const forwardImpulse = new CANNON.Vec3(this.facingDir * 32, 2.5, 0);
    leadGlove.applyImpulse(forwardImpulse, leadGlove.position);
  }

  throwCross() {
    if (this.cannotAct() || this.stamina < 14) return;
    this.stamina = Math.max(0, this.stamina - 14);
    this.state = 'STRIKING';
    this.strikeType = 'CROSS';
    this.strikeProgress = 0;
    this.strikeCooldown = 0.45;

    sounds.playPunch(0.95);

    // 1. Hip rotational torque (Kinetic ground drive)
    this.pelvis.applyTorque(new CANNON.Vec3(0, -this.facingDir * 45, 0));
    // 2. Torso follow-through torque
    this.torso.applyTorque(new CANNON.Vec3(0, -this.facingDir * 75, 0));
    // 3. Rear glove power extension through centerline
    const rearGlove = this.facingDir > 0 ? this.rightGlove : this.leftGlove;
    const impulse = new CANNON.Vec3(this.facingDir * 48, 4.0, -this.facingDir * 6);
    rearGlove.applyImpulse(impulse, rearGlove.position);
  }

  throwHook() {
    if (this.cannotAct() || this.stamina < 18) return;
    this.stamina = Math.max(0, this.stamina - 18);
    this.state = 'STRIKING';
    this.strikeType = 'HOOK';
    this.strikeProgress = 0;
    this.strikeCooldown = 0.52;

    sounds.playHeavyImpact(false);

    // Violent angular momentum transfer on Torso Y-axis
    this.pelvis.applyTorque(new CANNON.Vec3(0, this.facingDir * 65, 0));
    this.torso.applyTorque(new CANNON.Vec3(0, this.facingDir * 110, 0));

    // Curving hook trajectory
    const leadGlove = this.facingDir > 0 ? this.leftGlove : this.rightGlove;
    const impulse = new CANNON.Vec3(this.facingDir * 42, 2.0, this.facingDir * 36);
    leadGlove.applyImpulse(impulse, leadGlove.position);
  }

  throwHeadkick() {
    if (this.cannotAct() || this.stamina < 25) return;
    this.stamina = Math.max(0, this.stamina - 25);
    this.state = 'STRIKING';
    this.strikeType = 'HEADKICK';
    this.strikeProgress = 0;
    this.strikeCooldown = 0.70;

    sounds.playHeavyImpact(false);

    // Hip elevation & pelvic whip
    this.pelvis.applyTorque(new CANNON.Vec3(0, this.facingDir * 95, 0));
    const rearShin = this.facingDir > 0 ? this.rightShin : this.leftShin;
    const kickImpulse = new CANNON.Vec3(this.facingDir * 60, 42, this.facingDir * 20);
    rearShin.applyImpulse(kickImpulse, rearShin.position);
  }

  // Head Movement (Sway / Slip)
  slip(direction) {
    if (this.cannotAct() || this.stamina < 5) return;
    this.stamina = Math.max(0, this.stamina - 4);
    this.state = 'SLIPPING';
    this.slipDirection = direction;
    this.strikeCooldown = 0.32;

    // Direct cervical slip impulse
    const leanZ = direction * 16;
    this.head.applyImpulse(new CANNON.Vec3(0, -1.8, leanZ), this.head.position);
    this.torso.applyImpulse(new CANNON.Vec3(0, -1.0, leanZ * 0.6), this.torso.position);
  }

  // Takedown Shoot (Level Change & Double-Leg Tackle)
  shootTakedown() {
    if (this.cannotAct() || this.stamina < 30) return;
    this.stamina = Math.max(0, this.stamina - 30);
    this.state = 'TAKEDOWN_SHOOT';
    this.strikeCooldown = 1.0;

    // Drop Center of Mass & blast forward into opponent's hips
    const shootForce = new CANNON.Vec3(this.facingDir * 75, -6, 0);
    this.pelvis.applyImpulse(shootForce, this.pelvis.position);
    this.torso.applyImpulse(shootForce, this.torso.position);

    if (this.targetOpponent && !this.targetOpponent.isKnockedOut) {
      const dist = this.getTorsoPosition().distanceTo(this.targetOpponent.getTorsoPosition());
      if (dist < 1.7) {
        const opponentDefends = this.targetOpponent.state === 'SLIPPING' || this.targetOpponent.guardUp;
        if (!opponentDefends) {
          this.executeTakedownSlam(this.targetOpponent);
        } else {
          // Stuffed / Sprawled takedown recoil
          this.pelvis.applyImpulse(new CANNON.Vec3(-this.facingDir * 40, 12, 0), this.pelvis.position);
          this.stamina = Math.max(0, this.stamina - 15);
        }
      }
    }
  }

  executeTakedownSlam(opponent) {
    sounds.playMatSlam();

    // Mat slam damage
    opponent.health = Math.max(0, opponent.health - 20);
    opponent.isGrounded = true;
    opponent.groundRole = 'BOTTOM';
    opponent.state = 'GROUND_POUND';
    opponent.groundTimer = 5.0;

    this.isGrounded = true;
    this.groundRole = 'TOP';
    this.state = 'GROUND_POUND';
    this.groundTimer = 5.0;

    // Unlock angular factors during ground engagement
    opponent.pelvis.angularFactor.set(1, 1, 1);
    opponent.torso.angularFactor.set(1, 1, 1);

    // Opponent forced onto canvas
    opponent.pelvis.position.y = 0.35;
    opponent.torso.position.y = 0.38;
    opponent.head.position.y = 0.40;
    opponent.pelvis.velocity.set(0, -8, 0);

    // Mount position
    const oppPos = opponent.getTorsoPosition();
    this.pelvis.position.set(oppPos.x, 0.75, oppPos.z);
    this.torso.position.set(oppPos.x, 1.15, oppPos.z);
    this.pelvis.velocity.set(0, 0, 0);
  }

  groundAndPoundStrike() {
    if (this.cannotAct() || this.groundRole !== 'TOP' || this.stamina < 10) return;
    this.stamina = Math.max(0, this.stamina - 10);
    sounds.playHeavyImpact(true);

    const glove = Math.random() > 0.5 ? this.leftGlove : this.rightGlove;
    glove.applyImpulse(new CANNON.Vec3(0, -42, 0), glove.position);

    if (this.targetOpponent && this.targetOpponent.isGrounded) {
      this.targetOpponent.health = Math.max(0, this.targetOpponent.health - 16);
      if (this.targetOpponent.health <= 0) {
        this.targetOpponent.knockout();
      }
    }
  }

  // --- REAL-WORLD BIOMECHANICAL HIT RECEPTION ---
  receivePhysicalHit(hitData) {
    if (this.isKnockedOut) return;

    const { damage, isHeadshot, isCounter, rotationalTorque, kineticEnergy } = hitData;

    let finalDmg = damage;
    if (this.guardUp) finalDmg *= 0.35; // Guard block absorption

    this.health = Math.max(0, this.health - finalDmg);

    // Rotational Concussion Dynamics (Biomechanics of Brainstem Trauma)
    if (isHeadshot) {
      const concussionDelta = (rotationalTorque * 3.2 + kineticEnergy * 0.4);
      this.concussionLevel = Math.min(100, this.concussionLevel + concussionDelta);
    }

    // Play impact audio proportional to kinetic energy
    if (kineticEnergy > 60 || finalDmg > 20) {
      sounds.playHeavyImpact(isCounter);
    } else {
      sounds.playPunch(0.7, isCounter);
    }

    // FLASH KNOCKOUT CRITERIA (Real UFC flash KO dynamics):
    // 1. Health depleted to 0, OR
    // 2. Concussion level reaches 100, OR
    // 3. Counter-hit with high kinetic energy (>80J) while unprotected!
    const isFlashKO = (this.concussionLevel >= 95) || (isCounter && kineticEnergy > 80 && Math.random() < 0.65);

    if (this.health <= 0 || isFlashKO) {
      this.knockout();
    } else if (finalDmg > 18) {
      // Reactive stumble / wobbly legs
      this.isRocked = true;
      this.stumbleTimer = 0.55;
      this.state = 'STUMBLE';
      this.stamina = Math.max(0, this.stamina - 20);
      setTimeout(() => { this.isRocked = false; }, 1200);
    }
  }

  // Full Limp Ragdoll Knockout (Motor Tone = 0)
  knockout() {
    if (this.isKnockedOut) return;
    this.isKnockedOut = true;
    this.health = 0;
    this.state = 'KO';
    sounds.playKnockout();

    // 100% Limp Ragdoll: Unlock all 3-axis angular freedom
    this.pelvis.angularFactor.set(1, 1, 1);
    this.torso.angularFactor.set(1, 1, 1);

    // Loosen all joint constraints so limbs collapse naturally with inertia
    this.constraints.forEach(c => {
      if (c.angle) c.angle = Math.PI / 1.4;
      if (c.twistAngle) c.twistAngle = Math.PI / 1.4;
    });

    // Sudden limp collapse impulse
    this.head.applyImpulse(new CANNON.Vec3(-this.facingDir * 18, -12, (Math.random() - 0.5) * 14), this.head.position);
    this.torso.applyImpulse(new CANNON.Vec3(-this.facingDir * 24, -18, 0), this.torso.position);
  }

  cannotAct() {
    return this.isKnockedOut || this.strikeCooldown > 0;
  }

  // Active Balance Controller (Inverted Pendulum & Dynamic Footwork)
  updateActiveRagdoll(delta) {
    if (this.isKnockedOut) return;

    // Stamina auto-regen
    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 14);
    }

    // Concussion decay (brain recovery over time)
    if (this.concussionLevel > 0) {
      this.concussionLevel = Math.max(0, this.concussionLevel - delta * 8);
    }

    // Cooldown management
    if (this.strikeCooldown > 0) {
      this.strikeCooldown = Math.max(0, this.strikeCooldown - delta);
      if (this.strikeCooldown === 0 && !this.isGrounded && this.stumbleTimer <= 0) {
        this.state = 'STAND_IDLE';
      }
    }

    // Stumble timer decay
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= delta;
      // Stumble recovery step backward
      this.pelvis.velocity.x = -this.facingDir * 1.8;
      if (this.stumbleTimer <= 0) {
        this.state = 'STAND_IDLE';
      }
    }

    // Ground & Pound Timer & Recovery
    if (this.isGrounded) {
      this.groundTimer -= delta;
      if (this.groundTimer <= 0) {
        this.isGrounded = false;
        this.groundRole = null;
        this.state = 'STAND_IDLE';
        this.pelvis.angularFactor.set(0, 1, 0);
        this.torso.angularFactor.set(0.18, 1, 0.18);
        this.pelvis.position.y = 1.05;
        this.torso.position.y = 1.45;
        this.head.position.y = 1.82;
        this.pelvis.velocity.set(0, 0, 0);
      }
      return;
    }

    // --- UPRIGHT BALANCE CONTROLLER (Direct Velocity Height Drive) ---
    const now = performance.now() * 0.0035;
    const idleBob = (this.state === 'STAND_IDLE') ? Math.sin(now + (this.isPlayer ? 0 : Math.PI)) * 0.035 : 0;
    const targetHeight = 1.05 + idleBob;
    const currentHeight = this.pelvis.position.y;

    // Direct vertical spring: maintains fighting stance height firmly
    this.pelvis.velocity.y = (targetHeight - currentHeight) * 12.0;

    // Align Torso posture above pelvis
    const targetTorsoY = targetHeight + 0.40;
    this.torso.velocity.y = (targetTorsoY - this.torso.position.y) * 12.0;

    // Stance Face Direction (Yaw alignment towards opponent)
    if (this.targetOpponent) {
      const oppPos = this.targetOpponent.getTorsoPosition();
      const myPos = this.getTorsoPosition();
      const angleToOpp = Math.atan2(oppPos.z - myPos.z, oppPos.x - myPos.x);
      const desiredFacing = oppPos.x > myPos.x ? 1 : -1;
      this.facingDir = desiredFacing;

      const currentAngle = this.torsoMesh.rotation.y;
      const angleDiff = angleToOpp - currentAngle;
      this.torso.applyTorque(new CANNON.Vec3(0, angleDiff * 60, 0));
    }

    // Guard Arms (Fists up protecting chin)
    if (this.state === 'STAND_IDLE') {
      const guardHeight = 1.55 + idleBob;
      const fX = this.facingDir * 0.32;
      const targetLeftGlove = new CANNON.Vec3(this.torso.position.x + fX, guardHeight, this.torso.position.z + 0.15);
      const targetRightGlove = new CANNON.Vec3(this.torso.position.x + fX, guardHeight, this.torso.position.z - 0.15);

      const lDiff = targetLeftGlove.vsub(this.leftGlove.position);
      const rDiff = targetRightGlove.vsub(this.rightGlove.position);

      this.leftGlove.applyForce(lDiff.scale(220), this.leftGlove.position);
      this.rightGlove.applyForce(rDiff.scale(220), this.rightGlove.position);
    }
  }

  // Locomotion (Dynamic Footwork)
  move(dirX, dirZ) {
    if (this.cannotAct() || this.isGrounded) return;

    const speed = this.isRocked ? 700 : 1400;
    const force = new CANNON.Vec3(dirX * speed, 0, dirZ * speed);
    this.pelvis.applyForce(force, this.pelvis.position);
  }

  // Sync Three.js Meshes to Physics Bodies
  updateMeshTransforms() {
    this.pelvisMesh.position.copy(this.pelvis.position);
    this.pelvisMesh.quaternion.copy(this.pelvis.quaternion);

    this.torsoMesh.position.copy(this.torso.position);
    this.torsoMesh.quaternion.copy(this.torso.quaternion);

    this.headMesh.position.copy(this.head.position);
    this.headMesh.quaternion.copy(this.head.quaternion);

    if (this.leftUpperArmMesh) {
      this.leftUpperArmMesh.position.copy(this.leftUpperArm.position);
      this.leftUpperArmMesh.quaternion.copy(this.leftUpperArm.quaternion);
    }
    if (this.leftGloveMesh) {
      this.leftGloveMesh.position.copy(this.leftGlove.position);
      this.leftGloveMesh.quaternion.copy(this.leftGlove.quaternion);
    }
    if (this.rightUpperArmMesh) {
      this.rightUpperArmMesh.position.copy(this.rightUpperArm.position);
      this.rightUpperArmMesh.quaternion.copy(this.rightUpperArm.quaternion);
    }
    if (this.rightGloveMesh) {
      this.rightGloveMesh.position.copy(this.rightGlove.position);
      this.rightGloveMesh.quaternion.copy(this.rightGlove.quaternion);
    }

    if (this.leftThighMesh) {
      this.leftThighMesh.position.copy(this.leftThigh.position);
      this.leftThighMesh.quaternion.copy(this.leftThigh.quaternion);
    }
    if (this.leftShinMesh) {
      this.leftShinMesh.position.copy(this.leftShin.position);
      this.leftShinMesh.quaternion.copy(this.leftShin.quaternion);
    }
    if (this.rightThighMesh) {
      this.rightThighMesh.position.copy(this.rightThigh.position);
      this.rightThighMesh.quaternion.copy(this.rightThigh.quaternion);
    }
    if (this.rightShinMesh) {
      this.rightShinMesh.position.copy(this.rightShin.position);
      this.rightShinMesh.quaternion.copy(this.rightShin.quaternion);
    }
  }

  getTorsoPosition() {
    return new THREE.Vector3(this.torso.position.x, this.torso.position.y, this.torso.position.z);
  }

  getHeadPosition() {
    return new THREE.Vector3(this.head.position.x, this.head.position.y, this.head.position.z);
  }

  reset(x, z) {
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.isRocked = false;
    this.isGrounded = false;
    this.groundRole = null;
    this.state = 'STAND_IDLE';
    this.strikeCooldown = 0;
    this.stumbleTimer = 0;

    // Reset angular factors
    this.pelvis.angularFactor.set(0, 1, 0);
    this.torso.angularFactor.set(0.18, 1, 0.18);

    // Reset physics transforms
    this.pelvis.position.set(x, 1.05, z);
    this.pelvis.velocity.set(0, 0, 0);
    this.pelvis.angularVelocity.set(0, 0, 0);

    this.torso.position.set(x, 1.45, z);
    this.torso.velocity.set(0, 0, 0);
    this.torso.angularVelocity.set(0, 0, 0);

    this.head.position.set(x, 1.82, z);
    this.head.velocity.set(0, 0, 0);
    this.head.angularVelocity.set(0, 0, 0);

    // Reset joint limits
    this.constraints.forEach(c => {
      if (c.angle) c.angle = Math.PI / 9;
      if (c.twistAngle) c.twistAngle = Math.PI / 8;
    });
  }
}
