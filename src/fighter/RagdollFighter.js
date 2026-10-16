import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sounds } from '../audio/SoundManager.js';
import { HumanFighterMesh } from './HumanFighterMesh.js';

// Collision Filter Groups
export const COLLISION_GROUP_OCTAGON = 1;
export const COLLISION_GROUP_FIGHTER = 2;   // RED / player corner
export const COLLISION_GROUP_OPPONENT = 4;  // BLUE / opponent corner

/**
 * Professional UFC Fighter with 17-Segment Anatomical Ragdoll Architecture:
 * 
 * 3-State Ragdoll Architecture:
 * 1. HYBRID (Default): 100% authoritative kinematic orthodox stance & step-and-drag locomotion.
 *    Bodies carry physical velocity for strike impact, zero lag/spaghetti flailing.
 * 2. PASSIVE: 100% limp dead-weight physics collapse under gravity on the octagon canvas.
 * 3. ACTIVE: Dynamic bodies with physics recovery impulses and balance stabilization.
 */
export class RagdollFighter {
  constructor(scene, world, config = {}) {
    this.scene = scene;
    this.world = world;

    this.isPlayer = config.isPlayer !== false;
    this.name = config.name || (this.isPlayer ? 'ALEX "THE VIPER"' : 'ISLAM "THE SMESH"');
    this.corner = config.corner || (this.isPlayer ? 'RED' : 'BLUE');
    this.shortsColor = config.shortsColor || (this.isPlayer ? 0xd4af37 : 0xd20a0a);
    this.skinColor = config.skinColor || (this.isPlayer ? 0xd99b7d : 0xc68662);

    this.collisionGroup = this.isPlayer ? COLLISION_GROUP_FIGHTER : COLLISION_GROUP_OPPONENT;
    this.collisionMask = COLLISION_GROUP_OCTAGON | (this.isPlayer ? COLLISION_GROUP_OPPONENT : COLLISION_GROUP_FIGHTER);

    this.humanMesh = new HumanFighterMesh({
      skinColor: this.skinColor,
      shortsColor: this.shortsColor,
      corner: this.corner,
      isPlayer: this.isPlayer,
    });

    // Ragdoll Mode: 'HYBRID' | 'PASSIVE' | 'ACTIVE'
    this.ragdollMode = 'HYBRID';
    this.limp = false;
    this.isKnockedOut = false;
    this.isRocked = false;
    this.isCrouching = false;

    // Physiological stats
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.concussionLevel = 0;
    this.rockTimer = 0;
    this.stumbleTimer = 0;
    this.getUpTimer = 0;
    this.getUpDuration = 0.85;
    this.autoRecoverTimer = 0;

    // Movement & Combat state
    this.state = 'STAND_IDLE'; // STAND_IDLE | STRIKING | SLIPPING | STUMBLE | KO | GET_UP
    this.strikeType = null;
    this.strikeProgress = 0;
    this.strikeDuration = 0.35;
    this.strikeCooldown = 0;
    this.slipDirection = 0;
    this.slipTimer = 0;
    this.slipDuration = 0.38;
    this.guardUp = true;

    // Locomotion & Stance Coordinates
    this.stance = 'ORTHODOX'; // 'ORTHODOX' (Left lead) | 'SOUTHPAW' (Right lead)
    this.stanceTransition = 0.0; // 0.0 = 100% Orthodox, 1.0 = 100% Southpaw
    this.rootPosition = new THREE.Vector3(config.startX || 0, 0, config.startZ || 0);
    this.rootVelocity = new THREE.Vector3(0, 0, 0);
    this.targetMoveVelocity = new THREE.Vector3(0, 0, 0);
    this.facingAngle = this.isPlayer ? 0 : Math.PI; // 0 = facing +X
    this.targetFacingAngle = this.facingAngle;
    this.facingDir = this.isPlayer ? 1 : -1;
    this.targetOpponent = null;
    this.lockTarget = null;

    this.walkCycle = 0;
    this.isMoving = false;
    this.idleTimer = 0;

    // Current Target Reference Pose
    this.currentPoseTarget = null;
    this.getUpSnapshot = null;

    // Mesh Group
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    this.bodies = [];
    this.constraints = [];
    this.bodyPartMap = new Map();

    // Build bodies & joints
    this.initRagdoll(this.rootPosition.x, this.rootPosition.z);

    // Initial pose alignment
    this.snapBodiesToStance(this.rootPosition.x, this.rootPosition.z);
  }

  setOpponent(opponent) {
    this.targetOpponent = opponent;
  }

  setLockTarget(target) {
    this.lockTarget = target;
  }

  // --- 3-STATE RAGDOLL ARCHITECTURE SWITCHER ---

  setRagdollMode(mode) {
    if (this.ragdollMode === mode) return;

    if (mode === 'PASSIVE') {
      this.knockout();
    } else if (mode === 'HYBRID') {
      this.standUp();
    } else if (mode === 'ACTIVE') {
      this.ragdollMode = 'ACTIVE';
      this.limp = false;
      this.isKnockedOut = false;
      this.setBodiesPhysicsType(CANNON.Body.DYNAMIC);
    }
  }

  setBodiesPhysicsType(type) {
    for (const body of this.bodies) {
      body.type = type;
      if (type === CANNON.Body.DYNAMIC) {
        body.wakeUp();
      }
    }
  }

  // --- RIGID BODY & CONSTRAINT CONSTRUCTION ---

  configureBody(body, name) {
    body.collisionFilterGroup = this.collisionGroup;
    body.collisionFilterMask = this.collisionMask;
    body.allowSleep = false;
    body.ownerFighter = this;
    body.partName = name;
    this.world.addBody(body);
    this.bodies.push(body);
    this.bodyPartMap.set(name, body);
  }

  initRagdoll(x, z) {
    const fighterMat = new CANNON.Material({ friction: 0.6, restitution: 0.08 });
    const gloveMat = new CANNON.Material({ friction: 0.5, restitution: 0.22 });

    // 1. Pelvis (~14 kg) - Center of mass hub (fight shorts)
    this.pelvis = new CANNON.Body({
      mass: 14.0,
      position: new CANNON.Vec3(x, 0.92, z),
      material: fighterMat,
      angularDamping: 0.6,
      linearDamping: 0.35,
    });
    this.pelvis.addShape(new CANNON.Box(new CANNON.Vec3(0.14, 0.10, 0.18)));
    this.configureBody(this.pelvis, 'pelvis');
    this.pelvisMesh = this.humanMesh.buildPelvisMesh();
    this.meshGroup.add(this.pelvisMesh);

    // 2. Abdomen / Lumbar Core (~9 kg) - Core crunch & waist flex
    this.abdomen = new CANNON.Body({
      mass: 9.0,
      position: new CANNON.Vec3(x, 1.10, z),
      material: fighterMat,
      angularDamping: 0.55,
      linearDamping: 0.35,
    });
    this.abdomen.addShape(new CANNON.Box(new CANNON.Vec3(0.13, 0.08, 0.16)));
    this.configureBody(this.abdomen, 'abdomen');
    this.abdomenMesh = this.humanMesh.buildAbdomenMesh();
    this.meshGroup.add(this.abdomenMesh);

    // 3. Chest / Thoracic Ribcage (~16 kg) - Shoulder drive & upper body rotation
    this.chest = new CANNON.Body({
      mass: 16.0,
      position: new CANNON.Vec3(x, 1.28, z),
      material: fighterMat,
      angularDamping: 0.55,
      linearDamping: 0.35,
    });
    this.chest.addShape(new CANNON.Box(new CANNON.Vec3(0.15, 0.11, 0.20)));
    this.configureBody(this.chest, 'chest');
    this.chestMesh = this.humanMesh.buildChestMesh();
    this.meshGroup.add(this.chestMesh);

    // 4. Neck (~1.5 kg) - Cervical column & chin tuck
    this.neck = new CANNON.Body({
      mass: 1.5,
      position: new CANNON.Vec3(x, 1.44, z),
      material: fighterMat,
      angularDamping: 0.5,
      linearDamping: 0.3,
    });
    this.neck.addShape(new CANNON.Box(new CANNON.Vec3(0.065, 0.055, 0.065)));
    this.configureBody(this.neck, 'neck');
    this.neckMesh = this.humanMesh.buildNeckMesh();
    this.meshGroup.add(this.neckMesh);

    // 5. Head (~4.2 kg) - Vulnerable knockout target
    this.head = new CANNON.Body({
      mass: 4.2,
      position: new CANNON.Vec3(x, 1.62, z),
      material: fighterMat,
      angularDamping: 0.45,
      linearDamping: 0.25,
    });
    this.head.addShape(new CANNON.Sphere(0.135));
    this.head.isHead = true;
    this.configureBody(this.head, 'head');
    this.headMesh = this.humanMesh.buildHeadMesh(this.facingDir);
    this.meshGroup.add(this.headMesh);

    // 6-11. Arms (Upper Arm, Forearm, 4oz Combat Glove)
    this.initArms(x, z, gloveMat);

    // 12-17. Legs (Thigh, Shin, Combat Foot with Articulated Ankle)
    this.initLegs(x, z, fighterMat);

    // 18. Anatomical Human Joint Limits Matrix
    this.setupJointConstraints();

    // Default to authoritative HYBRID kinematic state (0.00mm lag, instant responsive footwork)
    this.setBodiesPhysicsType(CANNON.Body.KINEMATIC);
  }

  initArms(x, z, gloveMat) {
    const sides = [
      { side: 'left', offsetZ: -0.21, nameUpper: 'leftUpperArm', nameFore: 'leftForearm', nameGlove: 'leftGlove' },
      { side: 'right', offsetZ: 0.21, nameUpper: 'rightUpperArm', nameFore: 'rightForearm', nameGlove: 'rightGlove' },
    ];

    sides.forEach(({ side, offsetZ, nameUpper, nameFore, nameGlove }) => {
      // Upper arm (Biceps / Triceps)
      const upperBody = new CANNON.Body({
        mass: 1.9,
        position: new CANNON.Vec3(x, 1.28, z + offsetZ),
        angularDamping: 0.5,
        linearDamping: 0.3,
      });
      upperBody.addShape(new CANNON.Box(new CANNON.Vec3(0.065, 0.125, 0.065)));
      this.configureBody(upperBody, nameUpper);
      const upperMesh = this.humanMesh.buildUpperArmMesh();
      this.meshGroup.add(upperMesh);

      // Forearm (Elbow to Wrist)
      const foreBody = new CANNON.Body({
        mass: 1.4,
        position: new CANNON.Vec3(x + 0.15 * this.facingDir, 1.25, z + offsetZ * 0.9),
        angularDamping: 0.45,
        linearDamping: 0.25,
      });
      foreBody.addShape(new CANNON.Box(new CANNON.Vec3(0.055, 0.11, 0.055)));
      this.configureBody(foreBody, nameFore);
      const foreMesh = this.humanMesh.buildForearmMesh();
      this.meshGroup.add(foreMesh);

      // 4oz UFC Combat Glove (Fist & Wrist)
      const gloveBody = new CANNON.Body({
        mass: 0.9,
        position: new CANNON.Vec3(x + 0.28 * this.facingDir, 1.34, z + offsetZ * 0.7),
        material: gloveMat,
        angularDamping: 0.4,
        linearDamping: 0.2,
      });
      gloveBody.addShape(new CANNON.Box(new CANNON.Vec3(0.06, 0.05, 0.06)));
      gloveBody.isGlove = true;
      gloveBody.armSide = side;
      this.configureBody(gloveBody, nameGlove);
      const gloveMesh = this.humanMesh.buildGloveMesh();
      this.meshGroup.add(gloveMesh);

      if (side === 'left') {
        this.leftUpperArm = upperBody;
        this.leftUpperArmMesh = upperMesh;
        this.leftForearm = foreBody;
        this.leftForearmMesh = foreMesh;
        this.leftGlove = gloveBody;
        this.leftGloveMesh = gloveMesh;
      } else {
        this.rightUpperArm = upperBody;
        this.rightUpperArmMesh = upperMesh;
        this.rightForearm = foreBody;
        this.rightForearmMesh = foreMesh;
        this.rightGlove = gloveBody;
        this.rightGloveMesh = gloveMesh;
      }
    });
  }

  initLegs(x, z, fighterMat) {
    const sides = [
      { side: 'left', offsetZ: -0.15, nameThigh: 'leftThigh', nameShin: 'leftShin', nameFoot: 'leftFoot' },
      { side: 'right', offsetZ: 0.15, nameThigh: 'rightThigh', nameShin: 'rightShin', nameFoot: 'rightFoot' },
    ];

    sides.forEach(({ side, offsetZ, nameThigh, nameShin, nameFoot }) => {
      // Thigh (Femur, quadriceps)
      const thighBody = new CANNON.Body({
        mass: 5.8,
        position: new CANNON.Vec3(x, 0.64, z + offsetZ),
        material: fighterMat,
        angularDamping: 0.6,
        linearDamping: 0.35,
      });
      thighBody.addShape(new CANNON.Box(new CANNON.Vec3(0.085, 0.21, 0.085)));
      this.configureBody(thighBody, nameThigh);
      const thighMesh = this.humanMesh.buildThighMesh();
      this.meshGroup.add(thighMesh);

      // Shin (Tibia, calf)
      const shinBody = new CANNON.Body({
        mass: 2.8,
        position: new CANNON.Vec3(x, 0.24, z + offsetZ),
        material: fighterMat,
        angularDamping: 0.55,
        linearDamping: 0.3,
      });
      shinBody.addShape(new CANNON.Box(new CANNON.Vec3(0.07, 0.20, 0.07)));
      shinBody.isShin = true;
      shinBody.legSide = side;
      this.configureBody(shinBody, nameShin);
      const shinMesh = this.humanMesh.buildShinMesh();
      this.meshGroup.add(shinMesh);

      // Combat Foot (Articulated Ankle & Flat Canvas Sole)
      const footBody = new CANNON.Body({
        mass: 1.2,
        position: new CANNON.Vec3(x + 0.04, 0.04, z + offsetZ),
        material: fighterMat,
        angularDamping: 0.6,
        linearDamping: 0.35,
      });
      footBody.addShape(new CANNON.Box(new CANNON.Vec3(0.10, 0.03, 0.055)));
      footBody.isFoot = true;
      footBody.legSide = side;
      this.configureBody(footBody, nameFoot);
      const footMesh = this.humanMesh.buildFootMesh();
      this.meshGroup.add(footMesh);

      if (side === 'left') {
        this.leftThigh = thighBody;
        this.leftThighMesh = thighMesh;
        this.leftShin = shinBody;
        this.leftShinMesh = shinMesh;
        this.leftFoot = footBody;
        this.leftFootMesh = footMesh;
      } else {
        this.rightThigh = thighBody;
        this.rightThighMesh = thighMesh;
        this.rightShin = shinBody;
        this.rightShinMesh = shinMesh;
        this.rightFoot = footBody;
        this.rightFootMesh = footMesh;
      }
    });
  }

  setupJointConstraints() {
    // 1. Lumbar Spine: Pelvis -> Abdomen
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.abdomen, {
      pivotA: new CANNON.Vec3(0, 0.10, 0),
      pivotB: new CANNON.Vec3(0, -0.08, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 6,
      twistAngle: Math.PI / 8,
      collideConnected: false,
    }));

    // 2. Thoracic Spine: Abdomen -> Chest
    this.addConstraint(new CANNON.ConeTwistConstraint(this.abdomen, this.chest, {
      pivotA: new CANNON.Vec3(0, 0.08, 0),
      pivotB: new CANNON.Vec3(0, -0.11, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 7,
      twistAngle: Math.PI / 4,
      collideConnected: false,
    }));

    // 3. Cervical Column Base: Chest -> Neck
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.neck, {
      pivotA: new CANNON.Vec3(0, 0.11, 0),
      pivotB: new CANNON.Vec3(0, -0.055, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 6,
      twistAngle: Math.PI / 6,
      collideConnected: false,
    }));

    // 4. Atlanto-Occipital Joint: Neck -> Head
    this.addConstraint(new CANNON.ConeTwistConstraint(this.neck, this.head, {
      pivotA: new CANNON.Vec3(0, 0.055, 0),
      pivotB: new CANNON.Vec3(0, -0.10, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 6,
      twistAngle: Math.PI / 5,
      collideConnected: false,
    }));

    // 5. Shoulders: Chest -> Upper Arms (left = -Z, right = +Z)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.leftUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.06, -0.21),
      pivotB: new CANNON.Vec3(0, 0.125, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.65,
      twistAngle: Math.PI / 2,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.rightUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.06, 0.21),
      pivotB: new CANNON.Vec3(0, 0.125, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.65,
      twistAngle: Math.PI / 2,
      collideConnected: false,
    }));

    // 6. Elbows: Upper Arm -> Forearm (Hinge Joint)
    this.addConstraint(new CANNON.HingeConstraint(this.leftUpperArm, this.leftForearm, {
      pivotA: new CANNON.Vec3(0, -0.125, 0),
      pivotB: new CANNON.Vec3(0, 0.11, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.HingeConstraint(this.rightUpperArm, this.rightForearm, {
      pivotA: new CANNON.Vec3(0, -0.125, 0),
      pivotB: new CANNON.Vec3(0, 0.11, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    }));

    // 7. Wrists: Forearm -> 4oz Combat Glove (Articulated Wrist)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.leftForearm, this.leftGlove, {
      pivotA: new CANNON.Vec3(0, -0.11, 0),
      pivotB: new CANNON.Vec3(0, -0.05, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 5,
      twistAngle: Math.PI / 3,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.rightForearm, this.rightGlove, {
      pivotA: new CANNON.Vec3(0, -0.11, 0),
      pivotB: new CANNON.Vec3(0, -0.05, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 5,
      twistAngle: Math.PI / 3,
      collideConnected: false,
    }));

    // 8. Hips: Pelvis -> Thighs (left = -Z, right = +Z)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.leftThigh, {
      pivotA: new CANNON.Vec3(0, -0.08, -0.15),
      pivotB: new CANNON.Vec3(0, 0.21, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.55,
      twistAngle: Math.PI / 2,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.rightThigh, {
      pivotA: new CANNON.Vec3(0, -0.08, 0.15),
      pivotB: new CANNON.Vec3(0, 0.21, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.55,
      twistAngle: Math.PI / 2,
      collideConnected: false,
    }));

    // 9. Knees: Thigh -> Shin (Hinge Joint)
    this.addConstraint(new CANNON.HingeConstraint(this.leftThigh, this.leftShin, {
      pivotA: new CANNON.Vec3(0, -0.21, 0),
      pivotB: new CANNON.Vec3(0, 0.20, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.HingeConstraint(this.rightThigh, this.rightShin, {
      pivotA: new CANNON.Vec3(0, -0.21, 0),
      pivotB: new CANNON.Vec3(0, 0.20, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    }));

    // 10. Ankles: Shin -> Foot (Articulated Ankle Joint)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.leftShin, this.leftFoot, {
      pivotA: new CANNON.Vec3(0, -0.20, 0),
      pivotB: new CANNON.Vec3(-0.04, 0.03, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 6,
      twistAngle: Math.PI / 8,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.rightShin, this.rightFoot, {
      pivotA: new CANNON.Vec3(0, -0.20, 0),
      pivotB: new CANNON.Vec3(-0.04, 0.03, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 6,
      twistAngle: Math.PI / 8,
      collideConnected: false,
    }));
  }

  addConstraint(constraint) {
    this.world.addConstraint(constraint);
    this.constraints.push(constraint);
  }

  // --- LOCOMOTION & ORTHODOX STANCE KINEMATICS ---

  planReferencePose(delta) {
    this.update(delta);
  }

  update(delta) {
    // Stat regen
    if (this.stamina < this.maxStamina) this.stamina = Math.min(this.maxStamina, this.stamina + delta * 14);
    if (this.concussionLevel > 0) this.concussionLevel = Math.max(0, this.concussionLevel - delta * 6);

    // Timers
    if (this.strikeCooldown > 0) {
      this.strikeCooldown = Math.max(0, this.strikeCooldown - delta);
      if (this.strikeCooldown === 0 && this.state !== 'KO' && this.stumbleTimer <= 0) {
        this.state = this.slipTimer > 0 ? 'SLIPPING' : 'STAND_IDLE';
      }
    }
    if (this.slipTimer > 0) {
      this.slipTimer = Math.max(0, this.slipTimer - delta);
      if (this.slipTimer === 0 && this.state === 'SLIPPING') {
        this.state = 'STAND_IDLE';
      }
    }
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= delta;
      if (this.stumbleTimer <= 0 && this.state === 'STUMBLE') {
        this.state = 'STAND_IDLE';
      }
    }
    if (this.rockTimer > 0) {
      this.rockTimer -= delta;
      if (this.rockTimer <= 0) this.isRocked = false;
    }

    // 1. PASSIVE RAGDOLL MODE (Knocked Out / Floor Collapse)
    if (this.ragdollMode === 'PASSIVE' || this.limp) {
      if (!this.isPlayer && this.autoRecoverTimer > 0) {
        this.autoRecoverTimer -= delta;
        if (this.autoRecoverTimer <= 0) {
          this.standUp();
          return;
        }
      }

      // Enforce strict cage bounce so limp bodies never poke through fence wire (UFC 30ft inradius: 4.22m)
      for (const b of this.bodies) {
        const d = Math.hypot(b.position.x, b.position.z);
        if (d > 3.95) {
          const sc = 3.95 / d;
          b.position.x *= sc;
          b.position.z *= sc;
          const nx = b.position.x / d;
          const nz = b.position.z / d;
          const vDot = b.velocity.x * nx + b.velocity.z * nz;
          if (vDot > 0) {
            b.velocity.x -= vDot * nx * 1.5;
            b.velocity.z -= vDot * nz * 1.5;
          }
        }
      }
      this.rootPosition.set(this.pelvis.position.x, 0, this.pelvis.position.z);
      return;
    }

    // 2. GET-UP RECOVERY TRANSITION
    if (this.getUpTimer > 0) {
      this.getUpTimer -= delta;
      const t = Math.max(0, Math.min(1.0, 1.0 - (this.getUpTimer / this.getUpDuration)));
      this.blendGetUpToStance(t, delta);
      if (this.getUpTimer <= 0) {
        this.state = 'STAND_IDLE';
        this.ragdollMode = 'HYBRID';
        this.setBodiesPhysicsType(CANNON.Body.KINEMATIC);
      }
      return;
    }

    // 3. HYBRID & ACTIVE MODES: AUTHORITATIVE ORTHODOX / SOUTHPAW STANCE & FOOTWORK
    const targetStanceVal = this.stance === 'SOUTHPAW' ? 1.0 : 0.0;
    this.stanceTransition = THREE.MathUtils.lerp(this.stanceTransition, targetStanceVal, Math.min(1.0, delta * 7.5));

    if (this.state === 'STRIKING') {
      this.strikeProgress = Math.min(1.0, this.strikeProgress + delta / this.strikeDuration);
    }

    // A. Root Locomotion Integration
    const accelRate = this.isMoving ? 16 : 22;
    this.rootVelocity.x += (this.targetMoveVelocity.x - this.rootVelocity.x) * Math.min(1, delta * accelRate);
    this.rootVelocity.z += (this.targetMoveVelocity.z - this.rootVelocity.z) * Math.min(1, delta * accelRate);

    const nextX = this.rootPosition.x + this.rootVelocity.x * delta;
    const nextZ = this.rootPosition.z + this.rootVelocity.z * delta;

    // Strict Octagon 8-Sided Wall Collision & Sliding Constraint (Safe Inradius = 3.75m for UFC 30ft Cage)
    const maxSafeRadius = 3.75;
    const nextDist = Math.hypot(nextX, nextZ);
    if (nextDist > maxSafeRadius) {
      // Clamp position strictly inside the Octagon fence
      const scale = maxSafeRadius / nextDist;
      this.rootPosition.x = nextX * scale;
      this.rootPosition.z = nextZ * scale;

      // Project velocity along the cage wall (cancel outward velocity, allow smooth wall sliding)
      const normX = nextX / nextDist;
      const normZ = nextZ / nextDist;
      const outwardVel = this.rootVelocity.x * normX + this.rootVelocity.z * normZ;
      if (outwardVel > 0) {
        this.rootVelocity.x -= outwardVel * normX;
        this.rootVelocity.z -= outwardVel * normZ;
      }
    } else {
      this.rootPosition.x = nextX;
      this.rootPosition.z = nextZ;
    }

    const currentSpeed = Math.hypot(this.rootVelocity.x, this.rootVelocity.z);
    this.isMoving = currentSpeed > 0.15;

    // B. Smooth Facing Angle Interpolation (Target Lock!)
    if (this.lockTarget) {
      const tPos = this.lockTarget.getPosition ? this.lockTarget.getPosition() : (this.lockTarget.position || this.lockTarget.getTorsoPosition());
      const oppDirX = tPos.x - this.rootPosition.x;
      const oppDirZ = tPos.z - this.rootPosition.z;
      this.targetFacingAngle = Math.atan2(-oppDirZ, oppDirX);
    } else if (this.targetOpponent && !this.targetOpponent.isKnockedOut) {
      const oppPos = this.targetOpponent.getTorsoPosition();
      const oppDirX = oppPos.x - this.rootPosition.x;
      const oppDirZ = oppPos.z - this.rootPosition.z;
      this.targetFacingAngle = Math.atan2(-oppDirZ, oppDirX);
    }

    let angleDiff = this.targetFacingAngle - this.facingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.facingAngle += angleDiff * Math.min(1, delta * 14.0);
    this.facingDir = Math.cos(this.facingAngle) >= 0 ? 1 : -1;

    // C. Vertical Dynamics (Jump / Stance Hop)
    if (this.rootPosition.y > 0 || this.rootVelocity.y !== 0) {
      this.rootVelocity.y -= 14.0 * delta;
      this.rootPosition.y += this.rootVelocity.y * delta;
      if (this.rootPosition.y <= 0) {
        this.rootPosition.y = 0;
        this.rootVelocity.y = 0;
      }
    }

    // D. Step-and-Drag Gait Cycle
    if (this.isMoving) {
      this.walkCycle += delta * currentSpeed * 4.8;
    } else {
      this.idleTimer += delta * 3.5;
    }

    // E. Compute Anatomical Pose Transforms for all 17 Body Segments
    this.currentPoseTarget = this.calculateOrthodoxPose(currentSpeed);

    // F. Apply Authoritative Kinematics to Cannon Bodies (carrying physical velocity!)
    const dt = Math.max(0.001, delta);
    this.applyKinematicTransforms(this.currentPoseTarget, dt);
  }

  calculateOrthodoxPose(currentSpeed) {
    return this.calculateCombatPose(currentSpeed);
  }

  calculateCombatPose(currentSpeed) {
    // Root Basis Vectors
    const rootQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.facingAngle);
    const F = new THREE.Vector3(1, 0, 0).applyQuaternion(rootQuat);
    const R = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQuat);
    const L = new THREE.Vector3(0, 0, -1).applyQuaternion(rootQuat);
    const U = new THREE.Vector3(0, 1, 0);

    // Stance Blend Factor: +1.0 = Orthodox (Left Lead), -1.0 = Southpaw (Right Lead)
    const stanceSign = THREE.MathUtils.lerp(1.0, -1.0, this.stanceTransition);
    const isOrthodox = stanceSign >= 0;

    // Smooth slip progress (0 -> 1 -> 0 bell curve, active even during strikes!)
    let slipWeight = 0;
    if (this.slipTimer > 0 && this.slipDuration > 0) {
      const sp = Math.max(0, Math.min(1.0, 1.0 - (this.slipTimer / this.slipDuration)));
      slipWeight = Math.sin(sp * Math.PI);
    }
    const sDir = this.slipDirection;

    const idleBob = !this.isMoving ? Math.sin(this.idleTimer) * 0.016 : Math.sin(this.walkCycle * 2) * 0.025;
    const crouchDrop = this.isCrouching ? 0.28 : 0;
    const slipDip = slipWeight * 0.10;
    // Lowered athletic combat center of gravity (knees bent, authentic stance)
    const baseHeight = 0.86 + this.rootPosition.y - crouchDrop - slipDip + idleBob;
    const hipSway = this.isMoving ? Math.sin(this.walkCycle) * 0.03 : 0;

    // 1. PELVIS: 3D Dynamic turnover, athletic weight shift, and stance rotation
    let pelvisPitch = 0.0;
    let pelvisYaw = 0.18 * stanceSign + sDir * 0.14 * slipWeight;
    let pelvisRoll = 0.0;
    let pelvisLift = 0.0;
    let pelvisFwd = 0.0;

    // Dynamic Variables for Spine Chain
    let lumbarPitch = 0.06;
    let lumbarYaw = 0.10 * stanceSign;
    let lumbarRoll = 0.0;

    let chestPitch = 0.06;
    let chestYaw = 0.14 * stanceSign;
    let chestRoll = 0.0;
    let chestFwd = 0.04;
    let chestSide = 0.0;

    let leftShoulderFwd = 0.0;
    let leftShoulderUp = 0.0;
    let rightShoulderFwd = 0.0;
    let rightShoulderUp = 0.0;

    let leftGloveTarget = null;
    let rightGloveTarget = null;

    let plantFootYawL = 0.0;
    let plantFootYawR = 0.0;
    let footLiftL = 0.0;
    let footLiftR = 0.0;
    let footPitchL = 0.0;
    let footPitchR = 0.0;

    let customLeftAnkle = null;
    let customRightAnkle = null;
    let customLeftKneeHint = null;
    let customRightKneeHint = null;

    // Slips: Anatomical Spine Bending & Lateral Roll (Natural continuous curvature)
    if (slipWeight > 0) {
      pelvisRoll -= sDir * 0.06 * slipWeight;
      pelvisYaw += sDir * 0.10 * slipWeight;

      lumbarPitch += 0.08 * slipWeight;
      lumbarYaw += sDir * 0.16 * slipWeight;
      lumbarRoll -= sDir * 0.20 * slipWeight;

      chestPitch += 0.10 * slipWeight;
      chestYaw += sDir * 0.20 * slipWeight;
      chestRoll -= sDir * 0.24 * slipWeight;
    }

    // Strikes & Kicking Biomechanics
    if (this.state === 'STRIKING') {
      const p = this.strikeProgress;
      const ext = Math.sin(p * Math.PI);

      switch (this.strikeType) {
        case 'JAB': {
          pelvisFwd += 0.07 * ext;
          chestYaw += 0.28 * ext * stanceSign;
          chestFwd += 0.12 * ext;

          if (isOrthodox) {
            leftShoulderFwd += 0.16 * ext;
            leftShoulderUp += 0.04 * ext;
            rightShoulderFwd -= 0.08 * ext;
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.28 + 0.16 * ext).addScaledVector(U, 0.04 * ext);
          } else {
            rightShoulderFwd += 0.16 * ext;
            rightShoulderUp += 0.04 * ext;
            leftShoulderFwd -= 0.08 * ext;
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.28 + 0.16 * ext).addScaledVector(U, 0.04 * ext);
          }
          break;
        }

        case 'CROSS': {
          pelvisFwd += 0.09 * ext;
          pelvisYaw -= 0.28 * ext * stanceSign;
          lumbarYaw -= 0.28 * ext * stanceSign;
          chestYaw -= 0.64 * ext * stanceSign;
          chestFwd += 0.20 * ext;

          if (isOrthodox) {
            rightShoulderFwd += 0.25 * ext;
            leftShoulderFwd -= 0.14 * ext;
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14 + 0.30 * ext).addScaledVector(L, 0.03 * ext).addScaledVector(U, 0.03 * ext);
            footLiftR = 0.05 * ext;
            footPitchR = -0.32 * ext;
          } else {
            leftShoulderFwd += 0.25 * ext;
            rightShoulderFwd -= 0.14 * ext;
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14 + 0.30 * ext).addScaledVector(R, 0.03 * ext).addScaledVector(U, 0.03 * ext);
            footLiftL = 0.05 * ext;
            footPitchL = -0.32 * ext;
          }
          break;
        }

        case 'HOOK': {
          lumbarYaw += 0.26 * ext * stanceSign;
          chestYaw += 0.62 * ext * stanceSign;
          chestFwd += 0.09 * ext;

          if (isOrthodox) {
            leftShoulderFwd += 0.18 * ext;
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.20 * ext + 0.16).addScaledVector(R, 0.24 * ext).addScaledVector(U, 0.04 * ext);
          } else {
            rightShoulderFwd += 0.18 * ext;
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.20 * ext + 0.16).addScaledVector(L, 0.24 * ext).addScaledVector(U, 0.04 * ext);
          }
          break;
        }

        case 'UPPERCUT': {
          chestFwd += 0.11 * ext;
          lumbarYaw -= 0.18 * ext * stanceSign;
          chestYaw -= 0.36 * ext * stanceSign;

          if (isOrthodox) {
            rightShoulderFwd += 0.18 * ext;
            rightShoulderUp += 0.12 * ext;
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.18 * ext + 0.12).addScaledVector(U, 0.28 * ext + 0.04);
          } else {
            leftShoulderFwd += 0.18 * ext;
            leftShoulderUp += 0.12 * ext;
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.18 * ext + 0.12).addScaledVector(U, 0.28 * ext + 0.04);
          }
          break;
        }

        case 'HEADKICK': {
          // Rear leg high roundhouse kick targeting head (y = 1.66m)
          // 1. Pelvis turnover: 53° roll along spine, opening hips towards target
          pelvisRoll = -0.92 * ext * stanceSign;
          pelvisYaw = (0.18 + 0.48 * ext) * stanceSign;
          pelvisLift = 0.08 * ext;
          pelvisFwd = 0.10 * ext;

          // 2. Spine C-curve counterbalance: lean back and lateral away from kick
          chestPitch = -0.24 * ext;
          chestRoll = 0.55 * ext * stanceSign;
          chestYaw = 0.32 * ext * stanceSign;
          chestFwd = -0.16 * ext;

          // 3. Muay Thai arm whip & high shield guard
          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.10).addScaledVector(R, 0.18).addScaledVector(U, -0.30 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14).addScaledVector(U, 0.16 * ext);
            plantFootYawL = 1.45 * ext;
            footLiftL = 0.03 * ext;
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.10).addScaledVector(L, 0.18).addScaledVector(U, -0.30 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14).addScaledVector(U, 0.16 * ext);
            plantFootYawR = -1.45 * ext;
            footLiftR = 0.03 * ext;
          }
          break;
        }

        case 'BODYKICK': {
          // Rear leg roundhouse targeting ribs / liver (y = 1.10m)
          pelvisRoll = -0.60 * ext * stanceSign;
          pelvisYaw = (0.18 + 0.44 * ext) * stanceSign;
          pelvisLift = 0.04 * ext;
          pelvisFwd = 0.10 * ext;

          chestPitch = -0.14 * ext;
          chestRoll = 0.38 * ext * stanceSign;
          chestYaw = 0.28 * ext * stanceSign;
          chestFwd = -0.10 * ext;

          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.10).addScaledVector(R, 0.16).addScaledVector(U, -0.22 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14).addScaledVector(U, 0.12 * ext);
            plantFootYawL = 1.10 * ext;
            footLiftL = 0.02 * ext;
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.10).addScaledVector(L, 0.16).addScaledVector(U, -0.22 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14).addScaledVector(U, 0.12 * ext);
            plantFootYawR = -1.10 * ext;
            footLiftR = 0.02 * ext;
          }
          break;
        }

        case 'LOWKICK': {
          // Rear leg chopping kick to lead thigh (y = 0.44m)
          pelvisRoll = -0.32 * ext * stanceSign;
          pelvisYaw = (0.18 + 0.36 * ext) * stanceSign;
          pelvisFwd = 0.12 * ext;

          chestRoll = 0.22 * ext * stanceSign;
          chestFwd = -0.06 * ext;

          if (isOrthodox) {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.12).addScaledVector(R, 0.14).addScaledVector(U, -0.16 * ext);
            plantFootYawL = 0.85 * ext;
          } else {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.12).addScaledVector(L, 0.14).addScaledVector(U, -0.16 * ext);
            plantFootYawR = -0.85 * ext;
          }
          break;
        }

        case 'TEEP': {
          // Lead front push kick (thrusts straight into center of mass, y = 0.96m)
          pelvisFwd = 0.15 * ext;
          pelvisPitch = -0.12 * ext;
          chestPitch = -0.18 * ext;
          chestFwd = -0.14 * ext;

          if (isOrthodox) {
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.16).addScaledVector(U, 0.08 * ext);
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14).addScaledVector(U, 0.05);
          } else {
            rightGloveTarget = new THREE.Vector3().addScaledVector(F, 0.16).addScaledVector(U, 0.08 * ext);
            leftGloveTarget = new THREE.Vector3().addScaledVector(F, 0.14).addScaledVector(U, 0.05);
          }
          break;
        }
      }
    }

    // =========================================================================
    // ANATOMICAL HIERARCHICAL KINEMATIC SPINE CHAIN (100% GAP-FREE CONTINUITY)
    // =========================================================================
    // 1. PELVIS: Base anchor (mass hub)
    const pelvisPos = new THREE.Vector3(
      this.rootPosition.x + R.x * (hipSway + sDir * 0.06 * slipWeight) + F.x * pelvisFwd,
      baseHeight + pelvisLift,
      this.rootPosition.z + R.z * (hipSway + sDir * 0.06 * slipWeight) + F.z * pelvisFwd
    );

    const pelvisRotEuler = new THREE.Euler(pelvisPitch, pelvisYaw, pelvisRoll, 'YXZ');
    const pelvisQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(pelvisRotEuler));

    // Dynamic Hip Sockets derived from 3D Rotated Pelvis (Lifting hip high during kicks)
    const leftHip = pelvisPos.clone().add(new THREE.Vector3(0, -0.06, -0.15).applyQuaternion(pelvisQuat));
    const rightHip = pelvisPos.clone().add(new THREE.Vector3(0, -0.06, 0.15).applyQuaternion(pelvisQuat));

    // 2. ABDOMEN (Lumbar core): Kinematically anchored to top socket of Pelvis
    const pelvisTopJoint = pelvisPos.clone().add(new THREE.Vector3(0.01, 0.10, 0).applyQuaternion(pelvisQuat));

    const abdomenRotEuler = new THREE.Euler(lumbarPitch, lumbarYaw, lumbarRoll, 'YXZ');
    const abdomenQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(abdomenRotEuler));

    const abdomenPos = pelvisTopJoint.clone().add(new THREE.Vector3(0, 0.08, 0).applyQuaternion(abdomenQuat));

    // 3. CHEST (Thoracic ribcage): Kinematically anchored to top socket of Abdomen
    const abdomenTopJoint = abdomenPos.clone().add(new THREE.Vector3(0.01, 0.08, 0).applyQuaternion(abdomenQuat));

    const chestRotEuler = new THREE.Euler(chestPitch, chestYaw, chestRoll, 'YXZ');
    const chestQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(chestRotEuler));

    const chestPos = abdomenTopJoint.clone().add(new THREE.Vector3(chestFwd * 0.25, 0.11, 0).applyQuaternion(chestQuat));

    // 4. NECK (Cervical column): Kinematically anchored to collar socket of Chest
    const chestTopJoint = chestPos.clone().add(new THREE.Vector3(0.02, 0.11, 0).applyQuaternion(chestQuat));

    let neckPitch = chestPitch * 0.5 - 0.05;
    let neckYaw = chestYaw * 0.5;
    let neckRoll = chestRoll * 0.5;
    if (slipWeight > 0) {
      neckRoll += sDir * 0.08 * slipWeight;
    }
    const neckRotEuler = new THREE.Euler(neckPitch, neckYaw, neckRoll, 'YXZ');
    const neckQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(neckRotEuler));

    const neckPos = chestTopJoint.clone().add(new THREE.Vector3(0, 0.055, 0).applyQuaternion(neckQuat));

    // 5. HEAD (Cranium & Eyes Level): Kinematically anchored to top of Neck
    const neckTopJoint = neckPos.clone().add(new THREE.Vector3(0, 0.055, 0).applyQuaternion(neckQuat));

    let headPitch = -0.08;
    let headYaw = 0.0;
    let headRoll = 0.0;
    if (this.state === 'STRIKING' && this.strikeType === 'JAB') headPitch = -0.14;
    if (slipWeight > 0) {
      headYaw = sDir * 0.12 * slipWeight;
      headRoll = sDir * 0.16 * slipWeight;
    }
    const headRotEuler = new THREE.Euler(headPitch, headYaw, headRoll, 'YXZ');
    const headQuat = rootQuat.clone().multiply(new THREE.Quaternion().setFromEuler(headRotEuler));

    const headPos = neckTopJoint.clone().add(new THREE.Vector3(0.02, 0.10, 0).applyQuaternion(headQuat));

    // 6. LEGS & ARTICULATED FEET
    const stepL = this.isMoving ? Math.sin(this.walkCycle) * 0.16 : 0;
    const stepR = this.isMoving ? -Math.sin(this.walkCycle) * 0.16 : 0;
    const liftL = this.isMoving ? Math.max(0, Math.cos(this.walkCycle)) * 0.08 : 0;
    const liftR = this.isMoving ? Math.max(0, -Math.cos(this.walkCycle)) * 0.08 : 0;

    const lateralVel = this.isMoving ? (this.rootVelocity.x * R.x + this.rootVelocity.z * R.z) : 0;
    const strafeL = this.isMoving ? Math.sin(this.walkCycle) * (lateralVel * 0.04) : 0;
    const strafeR = this.isMoving ? -Math.sin(this.walkCycle) * (lateralVel * 0.04) : 0;

    const footGroundY = 0.04 + this.rootPosition.y;

    // Stance-adaptive lead & rear foot placement
    const leadFwdL = 0.02 + 0.20 * stanceSign;
    const leadFwdR = 0.02 - 0.20 * stanceSign;
    const lateralOffsetL = 0.03 * stanceSign;
    const lateralOffsetR = -0.03 * stanceSign;

    const leftAnkle = leftHip.clone()
      .addScaledVector(F, leadFwdL + stepL)
      .addScaledVector(L, 0.03 + lateralOffsetL + strafeL);
    leftAnkle.y = footGroundY + liftL + footLiftL + 0.04;

    const rightAnkle = rightHip.clone()
      .addScaledVector(F, leadFwdR + stepR)
      .addScaledVector(R, 0.03 + lateralOffsetR + strafeR);
    rightAnkle.y = footGroundY + liftR + footLiftR + 0.04;

    // Kicking Target Solvers (GoreBox-Style Authentic Articulation)
    if (this.state === 'STRIKING') {
      const p = this.strikeProgress;
      const ext = Math.sin(p * Math.PI);

      if (this.strikeType === 'HEADKICK') {
        const kickingHip = isOrthodox ? rightHip : leftHip;
        const oppSideVec = isOrthodox ? L : R;

        const targetHeadY = 1.66 * ext + (1 - ext) * (footGroundY + 0.04);
        const kickTarget = kickingHip.clone()
          .addScaledVector(F, 0.58 * ext)
          .addScaledVector(oppSideVec, 0.16 * ext);
        kickTarget.y = targetHeadY;

        // Clamp to safe max leg reach (thigh 0.42 + shin 0.40 = 0.82m, clamp to 0.80m for slight natural flex)
        const kickDelta = new THREE.Vector3().subVectors(kickTarget, kickingHip);
        const kLen = kickDelta.length();
        if (kLen > 0.80) {
          kickDelta.multiplyScalar(0.80 / kLen);
          kickTarget.copy(kickingHip).add(kickDelta);
        }

        if (isOrthodox) {
          rightAnkle.copy(kickTarget);
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.65).addScaledVector(L, 0.35).addScaledVector(U, 0.35).normalize();
        } else {
          leftAnkle.copy(kickTarget);
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.65).addScaledVector(R, 0.35).addScaledVector(U, 0.35).normalize();
        }
      } else if (this.strikeType === 'BODYKICK') {
        const kickingHip = isOrthodox ? rightHip : leftHip;
        const oppSideVec = isOrthodox ? L : R;

        const targetBodyY = 1.10 * ext + (1 - ext) * (footGroundY + 0.04);
        const kickTarget = kickingHip.clone()
          .addScaledVector(F, 0.56 * ext)
          .addScaledVector(oppSideVec, 0.18 * ext);
        kickTarget.y = targetBodyY;

        const kickDelta = new THREE.Vector3().subVectors(kickTarget, kickingHip);
        const kLen = kickDelta.length();
        if (kLen > 0.80) {
          kickDelta.multiplyScalar(0.80 / kLen);
          kickTarget.copy(kickingHip).add(kickDelta);
        }

        if (isOrthodox) {
          rightAnkle.copy(kickTarget);
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.70).addScaledVector(L, 0.35).addScaledVector(U, 0.20).normalize();
        } else {
          leftAnkle.copy(kickTarget);
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.70).addScaledVector(R, 0.35).addScaledVector(U, 0.20).normalize();
        }
      } else if (this.strikeType === 'LOWKICK') {
        const kickingHip = isOrthodox ? rightHip : leftHip;
        const oppSideVec = isOrthodox ? L : R;

        const targetLowY = 0.44 * ext + (1 - ext) * (footGroundY + 0.04);
        const kickTarget = kickingHip.clone()
          .addScaledVector(F, 0.50 * ext)
          .addScaledVector(oppSideVec, 0.20 * ext);
        kickTarget.y = targetLowY;

        const kickDelta = new THREE.Vector3().subVectors(kickTarget, kickingHip);
        const kLen = kickDelta.length();
        if (kLen > 0.80) {
          kickDelta.multiplyScalar(0.80 / kLen);
          kickTarget.copy(kickingHip).add(kickDelta);
        }

        if (isOrthodox) {
          rightAnkle.copy(kickTarget);
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.75).addScaledVector(L, 0.35).addScaledVector(U, -0.20).normalize();
        } else {
          leftAnkle.copy(kickTarget);
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.75).addScaledVector(R, 0.35).addScaledVector(U, -0.20).normalize();
        }
      } else if (this.strikeType === 'TEEP') {
        const kickingHip = isOrthodox ? leftHip : rightHip;

        const targetTeepY = 0.96 * ext + (1 - ext) * (footGroundY + 0.04);
        const kickTarget = kickingHip.clone()
          .addScaledVector(F, 0.65 * ext);
        kickTarget.y = targetTeepY;

        const kickDelta = new THREE.Vector3().subVectors(kickTarget, kickingHip);
        const kLen = kickDelta.length();
        if (kLen > 0.80) {
          kickDelta.multiplyScalar(0.80 / kLen);
          kickTarget.copy(kickingHip).add(kickDelta);
        }

        if (isOrthodox) {
          leftAnkle.copy(kickTarget);
          customLeftKneeHint = new THREE.Vector3().addScaledVector(F, 0.9).addScaledVector(U, 0.4).normalize();
        } else {
          rightAnkle.copy(kickTarget);
          customRightKneeHint = new THREE.Vector3().addScaledVector(F, 0.9).addScaledVector(U, 0.4).normalize();
        }
      }
    }

    // 2-Bone Analytical IK with authentic 0.42m thigh & 0.40m shin lengths
    const leftKneeHint = customLeftKneeHint || F;
    const rightKneeHint = customRightKneeHint || F;

    const leftKnee = this.solve2BoneIK(leftHip, leftAnkle, 0.42, 0.40, leftKneeHint);
    const rightKnee = this.solve2BoneIK(rightHip, rightAnkle, 0.42, 0.40, rightKneeHint);

    const leftThighPos = new THREE.Vector3().addVectors(leftHip, leftKnee).multiplyScalar(0.5);
    const rightThighPos = new THREE.Vector3().addVectors(rightHip, rightKnee).multiplyScalar(0.5);
    const leftShinPos = new THREE.Vector3().addVectors(leftKnee, leftAnkle).multiplyScalar(0.5);
    const rightShinPos = new THREE.Vector3().addVectors(rightKnee, rightAnkle).multiplyScalar(0.5);

    const leftThighQuat = this.safeLimbQuat(leftHip, leftKnee, F, U);
    const rightThighQuat = this.safeLimbQuat(rightHip, rightKnee, F, U);
    const leftShinQuat = this.safeLimbQuat(leftKnee, leftAnkle, customLeftKneeHint || F, U);
    const rightShinQuat = this.safeLimbQuat(rightKnee, rightAnkle, customRightKneeHint || F, U);

    // Kicking state evaluation for articulated footwork
    let kickExt = 0;
    let isKick = false;
    if (this.state === 'STRIKING') {
      const p = this.strikeProgress;
      kickExt = Math.sin(p * Math.PI);
      isKick = ['HEADKICK', 'BODYKICK', 'LOWKICK', 'TEEP'].includes(this.strikeType);
    }

    const isKickingRight = isKick && kickExt > 0.001 && (
      ((this.strikeType === 'HEADKICK' || this.strikeType === 'BODYKICK' || this.strikeType === 'LOWKICK') && isOrthodox) ||
      (this.strikeType === 'TEEP' && !isOrthodox)
    );
    const isKickingLeft = isKick && kickExt > 0.001 && (
      ((this.strikeType === 'HEADKICK' || this.strikeType === 'BODYKICK' || this.strikeType === 'LOWKICK') && !isOrthodox) ||
      (this.strikeType === 'TEEP' && isOrthodox)
    );

    const leftGroundPos = leftAnkle.clone().addScaledVector(F, 0.04);
    leftGroundPos.y = footGroundY + liftL + footLiftL * 0.5;
    const leftGroundQuat = rootQuat.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(footPitchL, 0.12 * stanceSign + plantFootYawL, 0, 'YXZ'))
    );

    const rightGroundPos = rightAnkle.clone().addScaledVector(F, 0.04);
    rightGroundPos.y = footGroundY + liftR + footLiftR * 0.5;
    const rightGroundQuat = rootQuat.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(footPitchR, 0.22 * stanceSign + plantFootYawR, 0, 'YXZ'))
    );

    const leftFootSolved = this.solveArticulatedFoot(
      leftAnkle, leftKnee, leftShinQuat, leftGroundPos, leftGroundQuat,
      isKickingLeft, this.strikeType, kickExt, F, U
    );
    const rightFootSolved = this.solveArticulatedFoot(
      rightAnkle, rightKnee, rightShinQuat, rightGroundPos, rightGroundQuat,
      isKickingRight, this.strikeType, kickExt, F, U
    );

    const leftFootPos = leftFootSolved.p;
    const leftFootQuat = leftFootSolved.q;
    const rightFootPos = rightFootSolved.p;
    const rightFootQuat = rightFootSolved.q;

    // 7. ARMS & ARTICULATED WRISTS
    // Shoulders are strictly anchored to the rotated CHEST frame!
    const leftShoulder = chestPos.clone().add(
      new THREE.Vector3(leftShoulderFwd, 0.06 + leftShoulderUp, -0.21).applyQuaternion(chestQuat)
    );
    const rightShoulder = chestPos.clone().add(
      new THREE.Vector3(rightShoulderFwd, 0.06 + rightShoulderUp, 0.21).applyQuaternion(chestQuat)
    );

    // Stance-adaptive guard positions
    const leadArmFwd = THREE.MathUtils.lerp(0.14, 0.28, (stanceSign + 1) * 0.5);
    const rearArmFwd = THREE.MathUtils.lerp(0.28, 0.14, (stanceSign + 1) * 0.5);

    let leftWristPos = leftShoulder.clone().addScaledVector(F, leadArmFwd).addScaledVector(R, 0.04).addScaledVector(U, 0.05);
    let rightWristPos = rightShoulder.clone().addScaledVector(F, rearArmFwd).addScaledVector(L, 0.04).addScaledVector(U, 0.05);

    let leftElbow = leftShoulder.clone().addScaledVector(F, 0.08).addScaledVector(R, 0.04).addScaledVector(U, -0.22);
    let rightElbow = rightShoulder.clone().addScaledVector(F, 0.06).addScaledVector(L, 0.04).addScaledVector(U, -0.22);

    const maxArmReach = 0.44;

    // Slip counter aim compensation (when slipping sideways, keep punch aimed straight at target centerline)
    if (slipWeight > 0) {
      const slipComp = sDir * 0.08 * slipWeight;
      if (leftGloveTarget) leftGloveTarget.addScaledVector(L, slipComp);
      if (rightGloveTarget) rightGloveTarget.addScaledVector(L, slipComp);
    }

    if (leftGloveTarget) {
      const armTarget = leftGloveTarget.clone();
      const tLen = armTarget.length();
      if (tLen > maxArmReach) {
        armTarget.multiplyScalar(maxArmReach / tLen);
      }
      leftWristPos.copy(leftShoulder).add(armTarget);
    }
    if (rightGloveTarget) {
      const armTarget = rightGloveTarget.clone();
      const tLen = armTarget.length();
      if (tLen > maxArmReach) {
        armTarget.multiplyScalar(maxArmReach / tLen);
      }
      rightWristPos.copy(rightShoulder).add(armTarget);
    }

    const isHook = this.state === 'STRIKING' && this.strikeType === 'HOOK';
    const isUppercut = this.state === 'STRIKING' && this.strikeType === 'UPPERCUT';

    const leftElbowHint = (isHook && isOrthodox)
      ? new THREE.Vector3().addScaledVector(L, 0.85).addScaledVector(U, -0.20).normalize()
      : new THREE.Vector3().addScaledVector(U, -0.80).addScaledVector(L, 0.40).normalize();

    const rightElbowHint = (isHook && !isOrthodox)
      ? new THREE.Vector3().addScaledVector(R, 0.85).addScaledVector(U, -0.20).normalize()
      : (isUppercut && isOrthodox)
      ? new THREE.Vector3().addScaledVector(U, -0.90).addScaledVector(R, 0.25).normalize()
      : new THREE.Vector3().addScaledVector(U, -0.80).addScaledVector(R, 0.40).normalize();

    const leftElbowSolved = this.solve2BoneIK(leftShoulder, leftWristPos, 0.25, 0.22, leftElbowHint);
    const rightElbowSolved = this.solve2BoneIK(rightShoulder, rightWristPos, 0.25, 0.22, rightElbowHint);

    const leftUpperArmPos = new THREE.Vector3().addVectors(leftShoulder, leftElbowSolved).multiplyScalar(0.5);
    const rightUpperArmPos = new THREE.Vector3().addVectors(rightShoulder, rightElbowSolved).multiplyScalar(0.5);
    const leftForearmPos = new THREE.Vector3().addVectors(leftElbowSolved, leftWristPos).multiplyScalar(0.5);
    const rightForearmPos = new THREE.Vector3().addVectors(rightElbowSolved, rightWristPos).multiplyScalar(0.5);

    const leftUpperArmQuat = this.safeLimbQuat(leftShoulder, leftElbowSolved, leftElbowHint, F);
    const rightUpperArmQuat = this.safeLimbQuat(rightShoulder, rightElbowSolved, rightElbowHint, F);
    const leftForearmQuat = this.safeLimbQuat(leftElbowSolved, leftWristPos, leftElbowHint, F);
    const rightForearmQuat = this.safeLimbQuat(rightElbowSolved, rightWristPos, rightElbowHint, F);

    const leftGlovePos = leftWristPos.clone().addScaledVector(
      new THREE.Vector3().subVectors(leftWristPos, leftElbowSolved).normalize(),
      0.06
    );
    const rightGlovePos = rightWristPos.clone().addScaledVector(
      new THREE.Vector3().subVectors(rightWristPos, rightElbowSolved).normalize(),
      0.06
    );

    const leftGloveQuat = this.safeGloveQuat(leftElbowSolved, leftWristPos, F);
    const rightGloveQuat = this.safeGloveQuat(rightElbowSolved, rightWristPos, F);

    return {
      pelvis: { p: pelvisPos, q: pelvisQuat },
      abdomen: { p: abdomenPos, q: abdomenQuat },
      chest: { p: chestPos, q: chestQuat },
      neck: { p: neckPos, q: neckQuat },
      head: { p: headPos, q: headQuat },
      leftUpperArm: { p: leftUpperArmPos, q: leftUpperArmQuat },
      rightUpperArm: { p: rightUpperArmPos, q: rightUpperArmQuat },
      leftForearm: { p: leftForearmPos, q: leftForearmQuat },
      rightForearm: { p: rightForearmPos, q: rightForearmQuat },
      leftGlove: { p: leftGlovePos, q: leftGloveQuat },
      rightGlove: { p: rightGlovePos, q: rightGloveQuat },
      leftThigh: { p: leftThighPos, q: leftThighQuat },
      rightThigh: { p: rightThighPos, q: rightThighQuat },
      leftShin: { p: leftShinPos, q: leftShinQuat },
      rightShin: { p: rightShinPos, q: rightShinQuat },
      leftFoot: { p: leftFootPos, q: leftFootQuat },
      rightFoot: { p: rightFootPos, q: rightFootQuat },
    };
  }

  // Authoritative Kinematic Transform (Carries physical velocity for strike impact)
  applyKinematicTransforms(pose, dt) {
    if (!pose) return;

    const apply = (body, target) => {
      if (!body || !target) return;

      // Strict cage containment: guarantee no limb extends through the Octagon wire mesh (cage wire at 4.22m)
      let px = target.p.x;
      let pz = target.p.z;
      const partDist = Math.hypot(px, pz);
      if (partDist > 4.15) {
        const sc = 4.15 / partDist;
        px *= sc;
        pz *= sc;
      }

      body.velocity.set(
        (px - body.position.x) / dt,
        (target.p.y - body.position.y) / dt,
        (pz - body.position.z) / dt
      );
      body.position.set(px, target.p.y, pz);
      body.quaternion.copy(target.q);
      if (body.interpolatedPosition) body.interpolatedPosition.set(px, target.p.y, pz);
      if (body.interpolatedQuaternion) body.interpolatedQuaternion.copy(target.q);
    };

    apply(this.pelvis, pose.pelvis);
    apply(this.abdomen, pose.abdomen);
    apply(this.chest, pose.chest);
    apply(this.neck, pose.neck);
    apply(this.head, pose.head);
    apply(this.leftUpperArm, pose.leftUpperArm);
    apply(this.rightUpperArm, pose.rightUpperArm);
    apply(this.leftForearm, pose.leftForearm);
    apply(this.rightForearm, pose.rightForearm);
    apply(this.leftGlove, pose.leftGlove);
    apply(this.rightGlove, pose.rightGlove);
    apply(this.leftThigh, pose.leftThigh);
    apply(this.rightThigh, pose.rightThigh);
    apply(this.leftShin, pose.leftShin);
    apply(this.rightShin, pose.rightShin);
    apply(this.leftFoot, pose.leftFoot);
    apply(this.rightFoot, pose.rightFoot);
  }

  // Robust, Singularity-Free Analytical 2-Bone IK
  solve2BoneIK(root, target, l1, l2, fwdHint) {
    const toTarget = new THREE.Vector3().subVectors(target, root);
    const d = Math.max(0.08, Math.min(l1 + l2 - 0.005, toTarget.length()));
    const dir = toTarget.clone().multiplyScalar(1 / d);

    const cosAlpha = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const alpha = Math.acos(cosAlpha);

    let bendDir = new THREE.Vector3().copy(fwdHint);
    const proj = bendDir.dot(dir);
    bendDir.addScaledVector(dir, -proj);
    if (bendDir.lengthSq() < 0.001) {
      bendDir.set(0, 0, 1);
      const p2 = bendDir.dot(dir);
      bendDir.addScaledVector(dir, -p2);
    }
    bendDir.normalize();

    const knee = root.clone()
      .addScaledVector(dir, l1 * Math.cos(alpha))
      .addScaledVector(bendDir, l1 * Math.sin(alpha));

    return knee;
  }

  safeLimbQuat(fromPt, toPt, hintFwd, hintUp) {
    const dir = new THREE.Vector3().subVectors(toPt, fromPt);
    const len = dir.length();
    if (len < 1e-4) return new THREE.Quaternion();
    dir.multiplyScalar(1 / len);

    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);

    let fwd = new THREE.Vector3().copy(hintFwd);
    const dotFwd = fwd.dot(dir);
    fwd.addScaledVector(dir, -dotFwd);

    if (fwd.lengthSq() < 0.01 && hintUp) {
      fwd.copy(hintUp);
      const dotUp = fwd.dot(dir);
      fwd.addScaledVector(dir, -dotUp);
    }

    if (fwd.lengthSq() > 1e-4) {
      fwd.normalize();
      const curX = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const cross = new THREE.Vector3().crossVectors(curX, fwd);
      const dot = THREE.MathUtils.clamp(curX.dot(fwd), -1, 1);
      const angle = Math.acos(dot) * Math.sign(cross.dot(dir));
      const twistQ = new THREE.Quaternion().setFromAxisAngle(dir, angle);
      q.premultiply(twistQ);
    }

    return q;
  }

  safeGloveQuat(fromElbow, toWrist, forwardDir) {
    const dir = new THREE.Vector3().subVectors(toWrist, fromElbow);
    const len = dir.length();
    if (len < 1e-4) return new THREE.Quaternion();
    dir.multiplyScalar(1 / len);

    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  // Authentic Biomechanical Articulated Combat Foot Solver
  // Elevates foot into 3D space with ankle, applying plantar flexion (roundhouses) or dorsiflexion (teep)
  solveArticulatedFoot(ankle, knee, shinQuat, groundPos, groundQuat, isKicking, strikeType, kickExt, F, U) {
    if (!isKicking || kickExt <= 0.001) {
      return { p: groundPos, q: groundQuat };
    }

    const shinDir = new THREE.Vector3().subVectors(ankle, knee).normalize();
    const shinFront = new THREE.Vector3(1, 0, 0).applyQuaternion(shinQuat).normalize();
    const shinSide = new THREE.Vector3(0, 0, 1).applyQuaternion(shinQuat).normalize();

    let targetFootQuat;
    if (strikeType === 'TEEP') {
      // Front push kick: flat sole drives forward (+F), toes pulled up (+U) (dorsiflexion)
      const kickDir = F.clone().addScaledVector(U, 0.08).normalize();
      const kFootSole = kickDir;
      const kFootY = kFootSole.clone().multiplyScalar(-1); // Instep opposite sole
      const kFootX = U.clone().addScaledVector(kickDir, 0.18).normalize(); // Toes up & slight fwd
      const kFootZ = new THREE.Vector3().crossVectors(kFootX, kFootY).normalize();
      kFootY.crossVectors(kFootZ, kFootX).normalize();
      const m = new THREE.Matrix4().makeBasis(kFootX, kFootY, kFootZ);
      targetFootQuat = new THREE.Quaternion().setFromRotationMatrix(m);
    } else {
      // Roundhouse kicks (HEADKICK, BODYKICK, LOWKICK):
      // Plantar flexion: toes pointed along shin line (+shinDir) with instep facing strike normal (+shinFront)
      const kFootX = shinDir.clone().addScaledVector(shinFront, 0.10).normalize();
      const kFootZ = shinSide.clone().normalize();
      const kFootY = new THREE.Vector3().crossVectors(kFootZ, kFootX).normalize();
      const m = new THREE.Matrix4().makeBasis(kFootX, kFootY, kFootZ);
      targetFootQuat = new THREE.Quaternion().setFromRotationMatrix(m);
    }

    // Smooth blend into pointed kicking posture as foot elevates off canvas
    const blend = THREE.MathUtils.smoothstep(kickExt, 0.02, 0.35);
    const footQuat = groundQuat.clone().slerp(targetFootQuat, blend);

    // Articulated 3D position: foot is strictly anchored to airborne ankle joint!
    const curFootX = new THREE.Vector3(1, 0, 0).applyQuaternion(footQuat);
    const curFootY = new THREE.Vector3(0, 1, 0).applyQuaternion(footQuat);
    const airbornePos = ankle.clone().addScaledVector(curFootX, 0.04).addScaledVector(curFootY, -0.03);
    const footPos = new THREE.Vector3().lerpVectors(groundPos, airbornePos, blend);

    return { p: footPos, q: footQuat };
  }

  // --- ACTIONS & COMBAT CONTROLS ---

  move(dirX, dirZ, isSprint = false) {
    if (this.isKnockedOut || this.limp) return;

    const baseSpeed = isSprint ? 3.2 : (this.isCrouching ? 1.0 : 1.75);
    const speed = this.isRocked ? 0.9 : baseSpeed;

    this.targetMoveVelocity.set(dirX * speed, 0, dirZ * speed);

    // Only set facing angle directly from movement direction when NOT locked on target
    if (!this.lockTarget && !this.targetOpponent && (dirX !== 0 || dirZ !== 0)) {
      this.targetFacingAngle = Math.atan2(-dirZ, dirX);
    }
  }

  jump() {
    if (this.isKnockedOut || this.limp || this.rootPosition.y > 0.05) return;
    this.rootVelocity.y = 4.2;
    sounds.playJab();
  }

  crouch(isDown) {
    this.isCrouching = isDown;
  }

  slip(direction) {
    if (this.isKnockedOut || this.limp || this.getUpTimer > 0) return;
    this.slipDirection = direction;
    this.slipDuration = 0.42;
    this.slipTimer = this.slipDuration;
    // Fluid slip-and-rip: do not lock out punches with cooldown!
    if (this.state !== 'STRIKING') {
      this.state = 'SLIPPING';
    }
    sounds.playSwoosh();
  }

  throwJab() {
    if (this.cannotAct() || this.stamina < 8) return;
    this.stamina = Math.max(0, this.stamina - 8);
    this.triggerStrike('JAB', 0.28);
    sounds.playJab();
  }

  throwCross() {
    if (this.cannotAct() || this.stamina < 14) return;
    this.stamina = Math.max(0, this.stamina - 14);
    this.triggerStrike('CROSS', 0.38);
    sounds.playPunch(0.9);
  }

  throwHook() {
    if (this.cannotAct() || this.stamina < 18) return;
    this.stamina = Math.max(0, this.stamina - 18);
    this.triggerStrike('HOOK', 0.44);
    sounds.playHeavyImpact(false);
  }

  throwUppercut() {
    if (this.cannotAct() || this.stamina < 16) return;
    this.stamina = Math.max(0, this.stamina - 16);
    this.triggerStrike('UPPERCUT', 0.40);
    sounds.playPunch(1.0);
  }

  throwHeadkick() {
    if (this.cannotAct() || this.stamina < 26) return;
    this.stamina = Math.max(0, this.stamina - 26);
    this.triggerStrike('HEADKICK', 0.58);
    sounds.playHeavyImpact(true);
  }

  throwLowKick() {
    if (this.cannotAct() || this.stamina < 20) return;
    this.stamina = Math.max(0, this.stamina - 20);
    this.triggerStrike('LOWKICK', 0.46);
    sounds.playPunch(0.85);
  }

  throwBodyKick() {
    if (this.cannotAct() || this.stamina < 22) return;
    this.stamina = Math.max(0, this.stamina - 22);
    this.triggerStrike('BODYKICK', 0.52);
    sounds.playPunch(0.95);
  }

  throwTeep() {
    if (this.cannotAct() || this.stamina < 16) return;
    this.stamina = Math.max(0, this.stamina - 16);
    this.triggerStrike('TEEP', 0.44);
    sounds.playPunch(0.8);
  }

  switchStance() {
    if (this.cannotAct()) return this.stance;
    this.stance = this.stance === 'ORTHODOX' ? 'SOUTHPAW' : 'ORTHODOX';
    sounds.playSwoosh();
    return this.stance;
  }

  triggerStrike(type, duration) {
    this.state = 'STRIKING';
    this.strikeType = type;
    this.strikeDuration = duration;
    this.strikeProgress = 0;
    this.strikeCooldown = duration + 0.06;
  }

  cannotAct() {
    return this.isKnockedOut || this.limp || (this.state === 'STRIKING' && this.strikeCooldown > 0) || this.getUpTimer > 0;
  }

  // --- HIT RECEPTION & KNOCKOUT ---

  receivePhysicalHit(hitData) {
    if (this.isKnockedOut || this.limp) return;

    const { damage = 15, isHeadshot = false, isCounter = false, kineticEnergy = 50, impulseMagnitude = 20 } = hitData;
    let finalDmg = damage;
    if (this.guardUp && !isCounter) finalDmg *= 0.4;

    this.health = Math.max(0, this.health - finalDmg);
    if (isHeadshot) this.concussionLevel = Math.min(100, this.concussionLevel + kineticEnergy * 0.45);

    // Apply physical pushback / stumble velocity to root position
    if (impulseMagnitude && this.targetOpponent) {
      const oppPos = this.targetOpponent.getTorsoPosition ? this.targetOpponent.getTorsoPosition() : this.targetOpponent.position;
      const myPos = this.getTorsoPosition();
      const pushX = myPos.x - oppPos.x;
      const pushZ = myPos.z - oppPos.z;
      const pushDist = Math.hypot(pushX, pushZ) || 1;
      const pushSpeed = Math.min(4.5, impulseMagnitude * 0.12);
      this.rootVelocity.x += (pushX / pushDist) * pushSpeed;
      this.rootVelocity.z += (pushZ / pushDist) * pushSpeed;
    }

    if (finalDmg > 18 || isCounter) sounds.playHeavyImpact(isCounter);
    else sounds.playPunch(0.7);

    const flashKO = this.concussionLevel >= 95 || this.health <= 0 || (isCounter && kineticEnergy > 85);
    if (flashKO) {
      this.knockout();
    } else if (finalDmg > 16) {
      this.isRocked = true;
      this.rockTimer = 1.2;
      this.stumbleTimer = 0.55;
      this.state = 'STUMBLE';
      this.stamina = Math.max(0, this.stamina - 20);
    }
  }

  // Pure Limp Physics Collapse onto Canvas (17 Segments collapse under Gravity)
  knockout() {
    if (this.isKnockedOut && this.limp) return;
    this.health = 0;
    this.isKnockedOut = true;
    this.limp = true;
    this.ragdollMode = 'PASSIVE';
    this.state = 'KO';
    sounds.playKnockout();

    // Switch all 17 bodies to dynamic so Cannon-es simulates full gravity, joints & collisions
    this.setBodiesPhysicsType(CANNON.Body.DYNAMIC);

    // Apply knockout impact impulse to head, chest and pelvis away from opponent
    let knockDir = -this.facingDir;
    if (this.targetOpponent) {
      const oppPos = this.targetOpponent.rootPosition || this.targetOpponent.position;
      if (oppPos) {
        knockDir = Math.sign(this.rootPosition.x - oppPos.x) || -this.facingDir;
      }
    }
    this.head.applyImpulse(new CANNON.Vec3(knockDir * 16, -6, (Math.random() - 0.5) * 8), this.head.position);
    this.chest.applyImpulse(new CANNON.Vec3(knockDir * 22, -8, 0), this.chest.position);
    this.pelvis.applyImpulse(new CANNON.Vec3(knockDir * 16, -4, 0), this.pelvis.position);

    // If this is a training dummy, set auto-recovery timer
    if (!this.isPlayer) {
      this.autoRecoverTimer = 3.0; // 3 seconds on the canvas then gets back up
    }
  }

  // Recovery: Physical get-up from floor back into stance
  standUp() {
    this.health = 100;
    this.stamina = 100;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.limp = false;
    this.state = 'GET_UP';
    this.getUpTimer = this.getUpDuration;

    // Snapshot current floor ragdoll positions
    this.getUpSnapshot = this.bodies.map(b => ({
      body: b,
      startP: new THREE.Vector3().copy(b.position),
      startQ: new THREE.Quaternion().copy(b.quaternion),
    }));

    // Anchor root to where pelvis landed
    this.rootPosition.set(this.pelvis.position.x, 0, this.pelvis.position.z);
    this.rootVelocity.set(0, 0, 0);
    this.targetMoveVelocity.set(0, 0, 0);

    sounds.playBell();
  }

  blendGetUpToStance(t, delta) {
    if (!this.getUpSnapshot) return;

    const targetPose = this.calculateOrthodoxPose(0);
    const poseLookup = {
      pelvis: targetPose.pelvis,
      abdomen: targetPose.abdomen,
      chest: targetPose.chest,
      neck: targetPose.neck,
      head: targetPose.head,
      leftUpperArm: targetPose.leftUpperArm,
      rightUpperArm: targetPose.rightUpperArm,
      leftForearm: targetPose.leftForearm,
      rightForearm: targetPose.rightForearm,
      leftGlove: targetPose.leftGlove,
      rightGlove: targetPose.rightGlove,
      leftThigh: targetPose.leftThigh,
      rightThigh: targetPose.rightThigh,
      leftShin: targetPose.leftShin,
      rightShin: targetPose.rightShin,
      leftFoot: targetPose.leftFoot,
      rightFoot: targetPose.rightFoot,
    };

    const smoothT = t * t * (3 - 2 * t);

    for (const snap of this.getUpSnapshot) {
      const b = snap.body;
      const target = poseLookup[b.partName];
      if (!target) continue;

      b.position.set(
        THREE.MathUtils.lerp(snap.startP.x, target.p.x, smoothT),
        THREE.MathUtils.lerp(snap.startP.y, target.p.y, smoothT),
        THREE.MathUtils.lerp(snap.startP.z, target.p.z, smoothT)
      );

      const blendedQ = new THREE.Quaternion().copy(snap.startQ).slerp(target.q, smoothT);
      b.quaternion.set(blendedQ.x, blendedQ.y, blendedQ.z, blendedQ.w);
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);
    }
  }

  reset(x = 0, z = 0) {
    this.health = 100;
    this.stamina = 100;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.limp = false;
    this.isRocked = false;
    this.isCrouching = false;
    this.state = 'STAND_IDLE';
    this.ragdollMode = 'HYBRID';
    this.strikeCooldown = 0;
    this.stumbleTimer = 0;
    this.rockTimer = 0;
    this.getUpTimer = 0;
    this.facingAngle = this.isPlayer ? 0 : Math.PI;
    this.targetFacingAngle = this.facingAngle;

    this.snapBodiesToStance(x, z);
  }

  snapBodiesToStance(x, z) {
    this.rootPosition.set(x, 0, z);
    this.rootVelocity.set(0, 0, 0);
    this.targetMoveVelocity.set(0, 0, 0);

    const pose = this.calculateOrthodoxPose(0);
    this.currentPoseTarget = pose;

    const poseLookup = {
      pelvis: pose.pelvis,
      abdomen: pose.abdomen,
      chest: pose.chest,
      neck: pose.neck,
      head: pose.head,
      leftUpperArm: pose.leftUpperArm,
      rightUpperArm: pose.rightUpperArm,
      leftForearm: pose.leftForearm,
      rightForearm: pose.rightForearm,
      leftGlove: pose.leftGlove,
      rightGlove: pose.rightGlove,
      leftThigh: pose.leftThigh,
      rightThigh: pose.rightThigh,
      leftShin: pose.leftShin,
      rightShin: pose.rightShin,
      leftFoot: pose.leftFoot,
      rightFoot: pose.rightFoot,
    };

    for (const b of this.bodies) {
      const target = poseLookup[b.partName];
      if (target) {
        b.position.set(target.p.x, target.p.y, target.p.z);
        b.quaternion.set(target.q.x, target.q.y, target.q.z, target.q.w);
        b.velocity.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
        b.force.set(0, 0, 0);
        b.torque.set(0, 0, 0);
      }
    }

    this.setBodiesPhysicsType(CANNON.Body.KINEMATIC);
    this.updateMeshTransforms();
  }

  // --- VISUAL THREE.JS MESH SYNCHRONIZATION ---

  updateMeshTransforms() {
    if ((this.ragdollMode === 'PASSIVE' || this.limp) || !this.currentPoseTarget) {
      // Passive ragdoll mode: meshes directly follow Cannon dynamic physics bodies
      const sync = (mesh, body) => {
        if (!mesh || !body) return;
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      };

      sync(this.pelvisMesh, this.pelvis);
      sync(this.abdomenMesh, this.abdomen);
      sync(this.chestMesh, this.chest);
      sync(this.neckMesh, this.neck);
      sync(this.headMesh, this.head);

      sync(this.leftUpperArmMesh, this.leftUpperArm);
      sync(this.rightUpperArmMesh, this.rightUpperArm);
      sync(this.leftForearmMesh, this.leftForearm);
      sync(this.rightForearmMesh, this.rightForearm);
      sync(this.leftGloveMesh, this.leftGlove);
      sync(this.rightGloveMesh, this.rightGlove);

      sync(this.leftThighMesh, this.leftThigh);
      sync(this.rightThighMesh, this.rightThigh);
      sync(this.leftShinMesh, this.leftShin);
      sync(this.rightShinMesh, this.rightShin);
      sync(this.leftFootMesh, this.leftFoot);
      sync(this.rightFootMesh, this.rightFoot);
    } else {
      // Standing combat mode: sync visual meshes directly to the authoritative smooth reference pose
      const pose = this.currentPoseTarget;
      const syncPose = (mesh, target) => {
        if (!mesh || !target) return;
        mesh.position.copy(target.p);
        mesh.quaternion.copy(target.q);
      };

      syncPose(this.pelvisMesh, pose.pelvis);
      syncPose(this.abdomenMesh, pose.abdomen);
      syncPose(this.chestMesh, pose.chest);
      syncPose(this.neckMesh, pose.neck);
      syncPose(this.headMesh, pose.head);

      syncPose(this.leftUpperArmMesh, pose.leftUpperArm);
      syncPose(this.rightUpperArmMesh, pose.rightUpperArm);
      syncPose(this.leftForearmMesh, pose.leftForearm);
      syncPose(this.rightForearmMesh, pose.rightForearm);
      syncPose(this.leftGloveMesh, pose.leftGlove);
      syncPose(this.rightGloveMesh, pose.rightGlove);

      syncPose(this.leftThighMesh, pose.leftThigh);
      syncPose(this.rightThighMesh, pose.rightThigh);
      syncPose(this.leftShinMesh, pose.leftShin);
      syncPose(this.rightShinMesh, pose.rightShin);
      syncPose(this.leftFootMesh, pose.leftFoot);
      syncPose(this.rightFootMesh, pose.rightFoot);
    }
  }

  // --- TELEMETRY ---

  getTorsoPosition() { return this.chest.position; }
  getHeadPosition() { return this.head.position; }
  getPelvisPosition() { return this.pelvis.position; }
}
