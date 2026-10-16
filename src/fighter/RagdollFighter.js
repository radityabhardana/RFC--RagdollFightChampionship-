import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sounds } from '../audio/SoundManager.js';
import { HumanFighterMesh } from './HumanFighterMesh.js';
import { MMAStrikerStyle } from './styles/MMAStrikerStyle.js';
import { solve2BoneIK, safeLimbQuat, safeGloveQuat, solveArticulatedFoot } from './kinematics/LimbKinematics.js';

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
      pantsColor: config.pantsColor || (this.isPlayer ? 0x16181d : 0x121417),
      corner: this.corner,
      isPlayer: this.isPlayer,
    });

    // Modular Fighting Style System (MMA Striker, Dutch Kickboxer, Karate, etc.)
    this.fightingStyle = config.fightingStyle || new MMAStrikerStyle();

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

    // Procedural GoreBox Flinch & Hit Dynamics
    this.flinchTimer = 0;
    this.flinchIntensity = 0;
    this.flinchIsHead = false;
    this.flinchSide = 1;

    // Movement & Combat state
    this.state = 'STAND_IDLE'; // STAND_IDLE | STRIKING | SLIPPING | STUMBLE | KO | GET_UP
    this.strikeType = null;
    this.strikeProgress = 0;
    this.strikeDuration = 0.35;
    this.strikeCooldown = 0;
    this.slipDirection = 0;
    this.slipType = 'LATERAL'; // 'LATERAL' | 'BACK'
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

    // Biomechanical Jump State & Heavy Gravity Dynamics
    this.jumpState = 'GROUNDED'; // 'GROUNDED' | 'WINDUP' | 'AIR' | 'LAND'
    this.jumpTimer = 0;
    this.jumpLandTimer = 0;
    this.jumpCompression = 0;

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
      // Upper arm (Biceps / Triceps) - 0.35m athletic reach
      const upperBody = new CANNON.Body({
        mass: 1.9,
        position: new CANNON.Vec3(x, 1.28, z + offsetZ),
        angularDamping: 0.5,
        linearDamping: 0.3,
      });
      upperBody.addShape(new CANNON.Box(new CANNON.Vec3(0.065, 0.175, 0.065)));
      this.configureBody(upperBody, nameUpper);
      const upperMesh = this.humanMesh.buildUpperArmMesh();
      this.meshGroup.add(upperMesh);

      // Forearm (Elbow to Wrist) - 0.31m reach
      const foreBody = new CANNON.Body({
        mass: 1.4,
        position: new CANNON.Vec3(x + 0.20 * this.facingDir, 1.25, z + offsetZ * 0.9),
        angularDamping: 0.45,
        linearDamping: 0.25,
      });
      foreBody.addShape(new CANNON.Box(new CANNON.Vec3(0.055, 0.155, 0.055)));
      this.configureBody(foreBody, nameFore);
      const foreMesh = this.humanMesh.buildForearmMesh();
      this.meshGroup.add(foreMesh);

      // 4oz UFC Combat Glove (Fist & Wrist)
      const gloveBody = new CANNON.Body({
        mass: 0.9,
        position: new CANNON.Vec3(x + 0.38 * this.facingDir, 1.34, z + offsetZ * 0.7),
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
    // 1. Lumbar Spine: Pelvis -> Abdomen (Allows forward torso crunch and natural pelvic bending)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.abdomen, {
      pivotA: new CANNON.Vec3(0, 0.10, 0),
      pivotB: new CANNON.Vec3(0, -0.08, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4.2,
      twistAngle: Math.PI / 4.5,
      collideConnected: false,
    }));

    // 2. Thoracic Spine: Abdomen -> Chest (Multi-segment mid-torso arch and fold)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.abdomen, this.chest, {
      pivotA: new CANNON.Vec3(0, 0.08, 0),
      pivotB: new CANNON.Vec3(0, -0.11, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4.5,
      twistAngle: Math.PI / 3.8,
      collideConnected: false,
    }));

    // 3. Cervical Column Base: Chest -> Neck (Neck whiplash and tilt)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.neck, {
      pivotA: new CANNON.Vec3(0, 0.11, 0),
      pivotB: new CANNON.Vec3(0, -0.055, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 3.8,
      twistAngle: Math.PI / 3.8,
      collideConnected: false,
    }));

    // 4. Atlanto-Occipital Joint: Neck -> Head (Signature GoreBox limp head floppiness on KO)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.neck, this.head, {
      pivotA: new CANNON.Vec3(0, 0.055, 0),
      pivotB: new CANNON.Vec3(0, -0.10, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 3.2,
      twistAngle: Math.PI / 3.0,
      collideConnected: false,
    }));

    // 5. Shoulders: Chest -> Upper Arms (Wide reach & natural crumpling)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.leftUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.06, -0.21),
      pivotB: new CANNON.Vec3(0, 0.175, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.72,
      twistAngle: Math.PI * 0.65,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.rightUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.06, 0.21),
      pivotB: new CANNON.Vec3(0, 0.175, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.72,
      twistAngle: Math.PI * 0.65,
      collideConnected: false,
    }));

    // 6. Elbows: Upper Arm -> Forearm (Hinge Joint)
    this.addConstraint(new CANNON.HingeConstraint(this.leftUpperArm, this.leftForearm, {
      pivotA: new CANNON.Vec3(0, -0.175, 0),
      pivotB: new CANNON.Vec3(0, 0.155, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.HingeConstraint(this.rightUpperArm, this.rightForearm, {
      pivotA: new CANNON.Vec3(0, -0.175, 0),
      pivotB: new CANNON.Vec3(0, 0.155, 0),
      axisA: CANNON.Vec3.UNIT_Z,
      axisB: CANNON.Vec3.UNIT_Z,
      collideConnected: false,
    }));

    // 7. Wrists: Forearm -> Combat Glove (Articulated Wrist)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.leftForearm, this.leftGlove, {
      pivotA: new CANNON.Vec3(0, -0.155, 0),
      pivotB: new CANNON.Vec3(0, -0.05, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 3.2,
      twistAngle: Math.PI / 2.5,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.rightForearm, this.rightGlove, {
      pivotA: new CANNON.Vec3(0, -0.155, 0),
      pivotB: new CANNON.Vec3(0, -0.05, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 3.2,
      twistAngle: Math.PI / 2.5,
      collideConnected: false,
    }));

    // 8. Hips: Pelvis -> Thighs (Natural leg splay and folding)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.leftThigh, {
      pivotA: new CANNON.Vec3(0, -0.08, -0.15),
      pivotB: new CANNON.Vec3(0, 0.21, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.65,
      twistAngle: Math.PI * 0.55,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.rightThigh, {
      pivotA: new CANNON.Vec3(0, -0.08, 0.15),
      pivotB: new CANNON.Vec3(0, 0.21, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.65,
      twistAngle: Math.PI * 0.55,
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
      angle: Math.PI / 4.2,
      twistAngle: Math.PI / 5,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.rightShin, this.rightFoot, {
      pivotA: new CANNON.Vec3(0, -0.20, 0),
      pivotB: new CANNON.Vec3(-0.04, 0.03, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4.2,
      twistAngle: Math.PI / 5,
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
    if (this.flinchTimer > 0) {
      this.flinchTimer = Math.max(0, this.flinchTimer - delta);
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

      // Enforce strict cage bounce matching official UFC 30ft Octagon (radius: 4.572m, inradius: 4.224m)
      for (const b of this.bodies) {
        const d = Math.hypot(b.position.x, b.position.z);
        if (d > 4.18) {
          const sc = 4.18 / d;
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

    // C. Vertical Dynamics (Jump / Stance Hop with Heavy Gravity & Athletic Muscle Coiling)
    if (this.jumpState === 'WINDUP') {
      this.jumpTimer -= delta;
      const t = Math.max(0, Math.min(1.0, 1.0 - (this.jumpTimer / 0.11)));
      // Athletic squatted compression: hips drop 16cm, knees bend deep
      this.jumpCompression = Math.sin(t * Math.PI * 0.5) * 0.16;
      if (this.jumpTimer <= 0) {
        this.jumpState = 'AIR';
        this.rootVelocity.y = 5.8; // Explosive upward propulsion
        this.jumpCompression = 0;
        sounds.playSwoosh(0.55);
      }
    } else if (this.rootPosition.y > 0 || this.rootVelocity.y !== 0) {
      this.jumpState = 'AIR';
      // Heavy fighting game gravity:
      // Ascending: 22 m/s^2, Falling: 30 m/s^2 (snappy, weighted downward pull)
      const grav = this.rootVelocity.y < 0 ? 30.0 : 22.0;
      this.rootVelocity.y -= grav * delta;
      this.rootPosition.y += this.rootVelocity.y * delta;

      if (this.rootPosition.y <= 0) {
        this.rootPosition.y = 0;
        this.rootVelocity.y = 0;
        this.jumpState = 'LAND';
        this.jumpLandTimer = 0.20; // 200ms impact shock absorption
        sounds.playJumpLand();
      }
    } else if (this.jumpState === 'LAND') {
      this.jumpLandTimer -= delta;
      if (this.jumpLandTimer > 0) {
        const t = this.jumpLandTimer / 0.20;
        // Heavy impact absorption dip: knees and hips compress down 14cm to absorb 85kg mass
        this.jumpCompression = Math.sin(t * Math.PI) * 0.14;
      } else {
        this.jumpCompression = 0;
        this.jumpState = 'GROUNDED';
      }
    } else {
      this.jumpCompression = 0;
      this.jumpState = 'GROUNDED';
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

  calculateOrthodoxPose(currentSpeed, delta = 0.016) {
    return this.calculateCombatPose(currentSpeed, delta);
  }

  calculateCombatPose(currentSpeed, delta = 0.016) {
    if (!this.fightingStyle) {
      this.fightingStyle = new MMAStrikerStyle();
    }
    return this.fightingStyle.calculateCombatPose({
      fighter: this,
      currentSpeed,
      delta,
      time: this.idleTimer,
    });
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

  // Forwarding wrappers to LimbKinematics for external callers
  solve2BoneIK(root, target, l1, l2, fwdHint) {
    return solve2BoneIK(root, target, l1, l2, fwdHint);
  }

  safeLimbQuat(fromPt, toPt, hintFwd, hintUp) {
    return safeLimbQuat(fromPt, toPt, hintFwd, hintUp);
  }

  safeGloveQuat(fromElbow, toWrist, forwardDir, pronationAngle = 0) {
    return safeGloveQuat(fromElbow, toWrist, forwardDir, pronationAngle);
  }

  solveArticulatedFoot(ankle, knee, shinQuat, groundPos, groundQuat, isKicking, strikeType, kickExt, F, U) {
    return solveArticulatedFoot(ankle, knee, shinQuat, groundPos, groundQuat, isKicking, strikeType, kickExt, F, U);
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
    if (this.cannotAct() || this.rootPosition.y > 0.04 || this.jumpState !== 'GROUNDED') return;
    this.jumpState = 'WINDUP';
    this.jumpTimer = 0.11; // 110ms muscle loading / coiling phase
    this.jumpCompression = 0;
  }

  crouch(isDown) {
    this.isCrouching = isDown;
  }

  slip(direction = 0, type = 'LATERAL') {
    if (this.isKnockedOut || this.limp || this.getUpTimer > 0) return;
    if (direction === 'BACK' || type === 'BACK') {
      this.slipType = 'BACK';
      this.slipDirection = 0;
      this.slipDuration = 0.44;
    } else {
      this.slipType = 'LATERAL';
      this.slipDirection = direction;
      this.slipDuration = 0.42;
    }
    this.slipTimer = this.slipDuration;
    // Fluid slip-and-rip: do not lock out punches with cooldown!
    if (this.state !== 'STRIKING') {
      this.state = 'SLIPPING';
    }
    sounds.playSwoosh();
  }

  slipBack() {
    this.slip(0, 'BACK');
  }

  throwJab() {
    if (this.cannotAct() || this.stamina < 8) return;
    this.stamina = Math.max(0, this.stamina - 8);
    this.triggerStrike('JAB', 0.28);
    sounds.playSwoosh(0.35);
  }

  throwCross() {
    if (this.cannotAct() || this.stamina < 14) return;
    this.stamina = Math.max(0, this.stamina - 14);
    this.triggerStrike('CROSS', 0.38);
    sounds.playSwoosh(0.45);
  }

  throwHook() {
    if (this.cannotAct() || this.stamina < 18) return;
    this.stamina = Math.max(0, this.stamina - 18);
    this.triggerStrike('HOOK', 0.44);
    sounds.playSwoosh(0.55);
  }

  throwUppercut() {
    if (this.cannotAct() || this.stamina < 16) return;
    this.stamina = Math.max(0, this.stamina - 16);
    this.triggerStrike('UPPERCUT', 0.40);
    sounds.playSwoosh(0.5);
  }

  throwOverhand() {
    if (this.cannotAct() || this.stamina < 22) return;
    this.stamina = Math.max(0, this.stamina - 22);
    this.triggerStrike('OVERHAND', 0.50);
    sounds.playSwoosh(0.65);
  }

  throwHeadkick() {
    if (this.cannotAct() || this.stamina < 26) return;
    this.stamina = Math.max(0, this.stamina - 26);
    this.triggerStrike('HEADKICK', 0.58);
    sounds.playSwoosh(0.7);
  }

  throwLowKick() {
    if (this.cannotAct() || this.stamina < 20) return;
    this.stamina = Math.max(0, this.stamina - 20);
    this.triggerStrike('LOWKICK', 0.46);
    sounds.playSwoosh(0.5);
  }

  throwBodyKick() {
    if (this.cannotAct() || this.stamina < 22) return;
    this.stamina = Math.max(0, this.stamina - 22);
    this.triggerStrike('BODYKICK', 0.52);
    sounds.playSwoosh(0.55);
  }

  throwTeep() {
    if (this.cannotAct() || this.stamina < 16) return;
    this.stamina = Math.max(0, this.stamina - 16);
    this.triggerStrike('TEEP', 0.44);
    sounds.playSwoosh(0.45);
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

    // Procedural GoreBox Flinch & Reaction Physics
    this.flinchTimer = 0.38;
    this.flinchIntensity = Math.min(2.2, Math.max(0.6, (finalDmg || 15) / 14));
    this.flinchIsHead = isHeadshot;
    this.flinchSide = Math.random() > 0.5 ? 1 : -1;

    const flashKO = this.concussionLevel >= 95 || this.health <= 0 || (isCounter && kineticEnergy > 85);
    if (flashKO) {
      this.knockout();
    } else if (finalDmg > 14 || (isHeadshot && finalDmg > 10)) {
      this.isRocked = true;
      this.rockTimer = 1.3;
      this.stumbleTimer = 0.65;
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
