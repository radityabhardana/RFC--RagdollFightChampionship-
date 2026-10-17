import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sounds } from '../audio/SoundManager.js';
import { HumanFighterMesh } from './HumanFighterMesh.js';
import { MMAStrikerStyle } from './styles/MMAStrikerStyle.js';
import { solve2BoneIK, safeLimbQuat, safeGloveQuat, solveArticulatedFoot } from './kinematics/LimbKinematics.js';
import { StaminaSystem } from '../combat/StaminaSystem.js';

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
    this.fighterProfile = config;

    // Weight class and stature scale calibration (Featherweight vs Lightweight vs Middleweight vs Light Heavyweight)
    const division = config.division || 'LIGHTWEIGHT';
    let weightScale = 1.0;
    let massMultiplier = 1.0;

    if (division === 'FEATHERWEIGHT') {
      weightScale = 0.94; // 145 lbs lean, agile, compact
      massMultiplier = 0.90;
    } else if (division === 'LIGHTWEIGHT') {
      weightScale = 1.00; // 155 lbs standard baseline
      massMultiplier = 1.00;
    } else if (division === 'MIDDLEWEIGHT') {
      weightScale = 1.07; // 185 lbs broad muscular frame
      massMultiplier = 1.16;
    } else if (division === 'LIGHT_HEAVYWEIGHT') {
      weightScale = 1.14; // 205 lbs heavyweight power stature
      massMultiplier = 1.34;
    }

    this.division = division;
    this.weightScale = weightScale;
    this.massMultiplier = massMultiplier;

    this.collisionGroup = this.isPlayer ? COLLISION_GROUP_FIGHTER : COLLISION_GROUP_OPPONENT;
    this.collisionMask = COLLISION_GROUP_OCTAGON | (this.isPlayer ? COLLISION_GROUP_OPPONENT : COLLISION_GROUP_FIGHTER);

    this.humanMesh = new HumanFighterMesh({
      skinColor: this.skinColor,
      pantsColor: config.pantsColor || config.trunksColor || (this.isPlayer ? 0x16181d : 0x121417),
      trunksColor: config.trunksColor || config.pantsColor,
      trunksTrimColor: config.trunksTrimColor,
      corner: this.corner,
      isPlayer: this.isPlayer,
      hairColor: config.hairColor,
      hairStyle: config.hairStyle,
      beardStyle: config.beardStyle,
      beardColor: config.beardColor,
      tattooType: config.tattooType,
    });

    // Modular Fighting Style System (MMA Striker, Dutch Kickboxer, Karate, etc.)
    this.fightingStyle = config.fightingStyle || new MMAStrikerStyle();

    // Ragdoll Mode: 'HYBRID' | 'PASSIVE' | 'ACTIVE'
    this.ragdollMode = 'HYBRID';
    this.limp = false;
    this.isKnockedOut = false;
    this.isRocked = false;
    this.isCrouching = false;

    // Physiological stats & Authentic Real-Life Attributes
    const stats = config.stats || {
      power: 90,
      speed: 90,
      stamina: 90,
      chin: 90,
      reach: 90,
    };
    this.stats = stats;
    this.statPower = stats.power || 90;
    this.statSpeed = stats.speed || 90;
    this.statStamina = stats.stamina || 90;
    this.statChin = stats.chin || 90;
    this.statReach = stats.reach || 90;

    // Stat Multipliers (calibrated against 90 baseline)
    this.powerMultiplier = this.statPower / 90.0;
    this.speedMultiplier = this.statSpeed / 90.0;
    this.staminaMultiplier = this.statStamina / 90.0;
    this.chinMultiplier = this.statChin / 90.0;
    this.reachMultiplier = this.statReach / 90.0;

    // Health Pools dynamically calibrated by Chin & Toughness
    this.maxHeadHealth = Math.round(112 + (this.statChin - 80) * 2.8);
    this.headHealth = this.maxHeadHealth;
    this.maxBodyHealth = Math.round(116 + (this.statChin - 80) * 2.4);
    this.bodyHealth = this.maxBodyHealth;
    this.maxLegHealth = Math.round(112 + (this.statChin - 80) * 2.2);
    this.legHealth = this.maxLegHealth;
    this.maxHealth = Math.round((this.maxHeadHealth + this.maxBodyHealth + this.maxLegHealth) / 3);
    this.health = this.maxHealth;

    // UFC 4 Block System scaled by Chin/Guard Durability
    this.maxBlockHealth = Math.round(105 + (this.statChin - 80) * 2.0);
    this.blockHealth = this.maxBlockHealth;
    this.isBlocking = false;
    this.blockBrokenTimer = 0;

    // EA Sports UFC Anatomical Damage Recovery Delay Timers
    this.headDamageTimer = 0;
    this.bodyDamageTimer = 0;
    this.legDamageTimer = 0;

    // UFC 4 Two-Tier Stamina Engine calibrated by Athlete Cardio
    this.staminaSystem = new StaminaSystem({
      baseMax: Math.round(80 + (this.statStamina - 80) * 1.5),
      costMultiplier: 90.0 / this.statStamina,
      regenMultiplier: this.statStamina / 90.0,
      minCapFloor: Math.round(26 + (this.statStamina - 80) * 0.45),
    });
    this.isSprinting = false;
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

    // UFC Real Player Motion Combo & Chaining System
    this.comboCount = 0;
    this.comboTimer = 0;
    this.bufferedStrike = null;
    this.isComboStrike = false;
    this.flashKdCount = 0;
    this.flashKdTimer = 0;

    // Movement & Combat state
    this.isEmoting = false;
    this.emoteType = 'MCGREGOR_SWAGGER';
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
    this.stance = config.stance || 'ORTHODOX'; // 'ORTHODOX' (Left lead) | 'SOUTHPAW' (Right lead)
    this.stanceTransition = this.stance === 'SOUTHPAW' ? 1.0 : 0.0; // 0.0 = 100% Orthodox, 1.0 = 100% Southpaw
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
    this.damageFlashTimers = new Map();
    this.bodyMeshesMap = new Map();
    this.lastDelta = 0.016;

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
    this.fighterMat = new CANNON.Material('fighterMat');
    this.gloveMat = new CANNON.Material('gloveMat');

    // 1. Pelvis (~14.2 kg) - Center of mass hub (fight shorts)
    this.pelvis = new CANNON.Body({
      mass: 14.2 * this.massMultiplier,
      position: new CANNON.Vec3(x, 0.92, z),
      material: this.fighterMat,
      angularDamping: 0.68,
      linearDamping: 0.40,
    });
    this.pelvis.addShape(new CANNON.Box(new CANNON.Vec3(0.14 * this.weightScale, 0.10 * this.weightScale, 0.18 * this.weightScale)));
    this.configureBody(this.pelvis, 'pelvis');
    this.pelvisMesh = this.humanMesh.buildPelvisMesh();
    this.pelvisMesh.scale.setScalar(this.weightScale);
    this.meshGroup.add(this.pelvisMesh);

    // 2. Abdomen / Lumbar Core (~9.5 kg) - Core crunch & waist flex
    this.abdomen = new CANNON.Body({
      mass: 9.5 * this.massMultiplier,
      position: new CANNON.Vec3(x, 1.10, z),
      material: this.fighterMat,
      angularDamping: 0.65,
      linearDamping: 0.40,
    });
    this.abdomen.addShape(new CANNON.Box(new CANNON.Vec3(0.13 * this.weightScale, 0.08 * this.weightScale, 0.16 * this.weightScale)));
    this.configureBody(this.abdomen, 'abdomen');
    this.abdomenMesh = this.humanMesh.buildAbdomenMesh();
    this.abdomenMesh.scale.setScalar(this.weightScale);
    this.meshGroup.add(this.abdomenMesh);

    // 3. Chest / Thoracic Ribcage (~16.5 kg) - Shoulder drive & upper body rotation
    this.chest = new CANNON.Body({
      mass: 16.5 * this.massMultiplier,
      position: new CANNON.Vec3(x, 1.28, z),
      material: this.fighterMat,
      angularDamping: 0.65,
      linearDamping: 0.40,
    });
    this.chest.addShape(new CANNON.Box(new CANNON.Vec3(0.15 * this.weightScale, 0.11 * this.weightScale, 0.20 * this.weightScale)));
    this.configureBody(this.chest, 'chest');
    this.chestMesh = this.humanMesh.buildChestMesh();
    this.chestMesh.scale.setScalar(this.weightScale);
    this.meshGroup.add(this.chestMesh);

    // 4. Neck (~1.8 kg) - Cervical column & chin tuck
    this.neck = new CANNON.Body({
      mass: 1.8 * this.massMultiplier,
      position: new CANNON.Vec3(x, 1.44, z),
      material: this.fighterMat,
      angularDamping: 0.60,
      linearDamping: 0.35,
    });
    this.neck.addShape(new CANNON.Box(new CANNON.Vec3(0.065 * this.weightScale, 0.055 * this.weightScale, 0.065 * this.weightScale)));
    this.configureBody(this.neck, 'neck');
    this.neckMesh = this.humanMesh.buildNeckMesh();
    this.neckMesh.scale.setScalar(this.weightScale);
    this.meshGroup.add(this.neckMesh);

    // 5. Head (~4.5 kg) - Vulnerable knockout target
    this.head = new CANNON.Body({
      mass: 4.5 * this.massMultiplier,
      position: new CANNON.Vec3(x, 1.62, z),
      material: this.fighterMat,
      angularDamping: 0.55,
      linearDamping: 0.30,
    });
    this.head.addShape(new CANNON.Sphere(0.135 * this.weightScale));
    this.head.isHead = true;
    this.configureBody(this.head, 'head');
    this.headMesh = this.humanMesh.buildHeadMesh();
    this.headMesh.scale.setScalar(this.weightScale);
    this.meshGroup.add(this.headMesh);

    // 6-11. Arms (Upper Arm, Forearm, 4oz Combat Glove)
    this.initArms(x, z, this.gloveMat);

    // 12-17. Legs (Thigh, Shin, Combat Foot with Articulated Ankle)
    this.initLegs(x, z, this.fighterMat);

    // 18. Anatomical Human Joint Limits Matrix
    this.setupJointConstraints();

    // 19. Initialize Independent Damage Materials & Flash System
    this.initDamageVisuals();

    // Default to authoritative HYBRID kinematic state (0.00mm lag, instant responsive footwork)
    this.setBodiesPhysicsType(CANNON.Body.KINEMATIC);
  }

  initArms(x, z, gloveMat) {
    const sides = [
      { side: 'left', offsetZ: -0.21 * this.weightScale, nameUpper: 'leftUpperArm', nameFore: 'leftForearm', nameGlove: 'leftGlove' },
      { side: 'right', offsetZ: 0.21 * this.weightScale, nameUpper: 'rightUpperArm', nameFore: 'rightForearm', nameGlove: 'rightGlove' },
    ];

    sides.forEach(({ side, offsetZ, nameUpper, nameFore, nameGlove }) => {
      // Upper arm (Biceps / Triceps) - 2.1 kg athletic reach
      const upperBody = new CANNON.Body({
        mass: 2.1 * this.massMultiplier,
        position: new CANNON.Vec3(x, 1.28, z + offsetZ),
        material: this.fighterMat,
        angularDamping: 0.58,
        linearDamping: 0.35,
      });
      upperBody.addShape(new CANNON.Box(new CANNON.Vec3(0.065 * this.weightScale, 0.175 * this.weightScale, 0.065 * this.weightScale)));
      this.configureBody(upperBody, nameUpper);
      const upperMesh = this.humanMesh.buildUpperArmMesh(side);
      upperMesh.scale.setScalar(this.weightScale);
      this.meshGroup.add(upperMesh);

      // Forearm (Elbow to Wrist) - 1.5 kg reach
      const foreBody = new CANNON.Body({
        mass: 1.5 * this.massMultiplier,
        position: new CANNON.Vec3(x + 0.20 * this.facingDir, 1.25, z + offsetZ * 0.9),
        material: this.fighterMat,
        angularDamping: 0.52,
        linearDamping: 0.30,
      });
      foreBody.addShape(new CANNON.Box(new CANNON.Vec3(0.055 * this.weightScale, 0.155 * this.weightScale, 0.055 * this.weightScale)));
      this.configureBody(foreBody, nameFore);
      const foreMesh = this.humanMesh.buildForearmMesh(side);
      foreMesh.scale.setScalar(this.weightScale);
      this.meshGroup.add(foreMesh);

      // 4oz UFC Combat Glove (Fist & Wrist)
      const gloveBody = new CANNON.Body({
        mass: 0.85 * this.massMultiplier,
        position: new CANNON.Vec3(x + 0.38 * this.facingDir, 1.34, z + offsetZ * 0.7),
        material: gloveMat,
        angularDamping: 0.45,
        linearDamping: 0.25,
      });
      gloveBody.addShape(new CANNON.Box(new CANNON.Vec3(0.06 * this.weightScale, 0.05 * this.weightScale, 0.06 * this.weightScale)));
      gloveBody.isGlove = true;
      gloveBody.armSide = side;
      this.configureBody(gloveBody, nameGlove);
      const gloveMesh = this.humanMesh.buildGloveMesh(side);
      gloveMesh.scale.setScalar(this.weightScale);
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
      { side: 'left', offsetZ: -0.15 * this.weightScale, nameThigh: 'leftThigh', nameShin: 'leftShin', nameFoot: 'leftFoot' },
      { side: 'right', offsetZ: 0.15 * this.weightScale, nameThigh: 'rightThigh', nameShin: 'rightShin', nameFoot: 'rightFoot' },
    ];

    sides.forEach(({ side, offsetZ, nameThigh, nameShin, nameFoot }) => {
      // Thigh (Femur, quadriceps) - 7.2 kg authentic leg weight
      const thighBody = new CANNON.Body({
        mass: 7.2 * this.massMultiplier,
        position: new CANNON.Vec3(x, 0.64, z + offsetZ),
        material: fighterMat,
        angularDamping: 0.68,
        linearDamping: 0.42,
      });
      thighBody.addShape(new CANNON.Box(new CANNON.Vec3(0.085 * this.weightScale, 0.21 * this.weightScale, 0.085 * this.weightScale)));
      this.configureBody(thighBody, nameThigh);
      const thighMesh = this.humanMesh.buildThighMesh();
      thighMesh.scale.setScalar(this.weightScale);
      this.meshGroup.add(thighMesh);

      // Shin (Tibia, calf) - 3.4 kg authentic lower leg mass
      const shinBody = new CANNON.Body({
        mass: 3.4 * this.massMultiplier,
        position: new CANNON.Vec3(x, 0.24, z + offsetZ),
        material: fighterMat,
        angularDamping: 0.62,
        linearDamping: 0.38,
      });
      shinBody.addShape(new CANNON.Box(new CANNON.Vec3(0.07 * this.weightScale, 0.20 * this.weightScale, 0.07 * this.weightScale)));
      shinBody.isShin = true;
      shinBody.legSide = side;
      this.configureBody(shinBody, nameShin);
      const shinMesh = this.humanMesh.buildShinMesh();
      shinMesh.scale.setScalar(this.weightScale);
      this.meshGroup.add(shinMesh);

      // Combat Foot (Articulated Ankle & Flat Canvas Sole) - 1.3 kg
      const footBody = new CANNON.Body({
        mass: 1.3 * this.massMultiplier,
        position: new CANNON.Vec3(x + 0.04, 0.04, z + offsetZ),
        material: fighterMat,
        angularDamping: 0.68,
        linearDamping: 0.40,
      });
      footBody.addShape(new CANNON.Box(new CANNON.Vec3(0.10 * this.weightScale, 0.03 * this.weightScale, 0.055 * this.weightScale)));
      footBody.isFoot = true;
      footBody.legSide = side;
      this.configureBody(footBody, nameFoot);
      const footMesh = this.humanMesh.buildFootMesh();
      footMesh.scale.setScalar(this.weightScale);
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
    // 1. Lumbar Spine: Pelvis -> Abdomen (Torso crunch & natural pelvic bending)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.abdomen, {
      pivotA: new CANNON.Vec3(0, 0.10, 0),
      pivotB: new CANNON.Vec3(0, -0.08, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4.8,
      twistAngle: Math.PI / 5.0,
      collideConnected: false,
    }));

    // 2. Thoracic Spine: Abdomen -> Chest (Mid-torso arch and rotation)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.abdomen, this.chest, {
      pivotA: new CANNON.Vec3(0, 0.08, 0),
      pivotB: new CANNON.Vec3(0, -0.11, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 5.2,
      twistAngle: Math.PI / 4.8,
      collideConnected: false,
    }));

    // 3. Cervical Column Base: Chest -> Neck (Controlled neck whiplash, strictly preventing hyperflexion)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.neck, {
      pivotA: new CANNON.Vec3(0, 0.11, 0),
      pivotB: new CANNON.Vec3(0, -0.055, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 5.5,
      twistAngle: Math.PI / 5.0,
      collideConnected: false,
    }));

    // 4. Atlanto-Occipital Joint: Neck -> Head (Signature limp head floppiness on KO without unnatural 360-degree twist)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.neck, this.head, {
      pivotA: new CANNON.Vec3(0, 0.055, 0),
      pivotB: new CANNON.Vec3(0, -0.10, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4.8,
      twistAngle: Math.PI / 4.5,
      collideConnected: false,
    }));

    // 5. Shoulders: Chest -> Upper Arms (Wide reach & natural crumpling, no chest penetration)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.leftUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.06, -0.21),
      pivotB: new CANNON.Vec3(0, 0.175, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.55,
      twistAngle: Math.PI * 0.45,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.chest, this.rightUpperArm, {
      pivotA: new CANNON.Vec3(0, 0.06, 0.21),
      pivotB: new CANNON.Vec3(0, 0.175, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.55,
      twistAngle: Math.PI * 0.45,
      collideConnected: false,
    }));

    // 6. Elbows: Upper Arm -> Forearm (Hinge Joint with forward flexion)
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
      angle: Math.PI / 3.8,
      twistAngle: Math.PI / 3.2,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.rightForearm, this.rightGlove, {
      pivotA: new CANNON.Vec3(0, -0.155, 0),
      pivotB: new CANNON.Vec3(0, -0.05, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 3.8,
      twistAngle: Math.PI / 3.2,
      collideConnected: false,
    }));

    // 8. Hips: Pelvis -> Thighs (Natural leg splay, outward rotation and folding)
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.leftThigh, {
      pivotA: new CANNON.Vec3(0, -0.08, -0.15),
      pivotB: new CANNON.Vec3(0, 0.21, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.48,
      twistAngle: Math.PI * 0.40,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.pelvis, this.rightThigh, {
      pivotA: new CANNON.Vec3(0, -0.08, 0.15),
      pivotB: new CANNON.Vec3(0, 0.21, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI * 0.48,
      twistAngle: Math.PI * 0.40,
      collideConnected: false,
    }));

    // 9. Knees: Thigh -> Shin (Hinge Joint with backward flexion)
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
      angle: Math.PI / 4.5,
      twistAngle: Math.PI / 5.0,
      collideConnected: false,
    }));
    this.addConstraint(new CANNON.ConeTwistConstraint(this.rightShin, this.rightFoot, {
      pivotA: new CANNON.Vec3(0, -0.20, 0),
      pivotB: new CANNON.Vec3(-0.04, 0.03, 0),
      axisA: CANNON.Vec3.UNIT_Y,
      axisB: CANNON.Vec3.UNIT_Y,
      angle: Math.PI / 4.5,
      twistAngle: Math.PI / 5.0,
      collideConnected: false,
    }));
  }

  addConstraint(constraint) {
    this.world.addConstraint(constraint);
    this.constraints.push(constraint);
  }

  // --- DYNAMIC DAMAGE & VASCULAR TRAUMA VISUALS ---

  initDamageVisuals() {
    this.damageFlashTimers = new Map();
    this.bodyMeshesMap = new Map();

    const registerGroup = (partName, group) => {
      if (!group) return;
      const meshes = [];
      group.traverse(child => {
        if (child.isMesh && child.material) {
          if (!child.userData.isClonedForDamage) {
            child.material = child.material.clone();
            child.userData.isClonedForDamage = true;
          }
          meshes.push(child);
        }
      });
      this.bodyMeshesMap.set(partName, meshes);
    };

    registerGroup('head', this.headMesh);
    registerGroup('neck', this.neckMesh);
    registerGroup('chest', this.chestMesh);
    registerGroup('abdomen', this.abdomenMesh);
    registerGroup('pelvis', this.pelvisMesh);

    registerGroup('leftUpperArm', this.leftUpperArmMesh);
    registerGroup('rightUpperArm', this.rightUpperArmMesh);
    registerGroup('leftForearm', this.leftForearmMesh);
    registerGroup('rightForearm', this.rightForearmMesh);
    registerGroup('leftGlove', this.leftGloveMesh);
    registerGroup('rightGlove', this.rightGloveMesh);

    registerGroup('leftThigh', this.leftThighMesh);
    registerGroup('rightThigh', this.rightThighMesh);
    registerGroup('leftShin', this.leftShinMesh);
    registerGroup('rightShin', this.rightShinMesh);
    registerGroup('leftFoot', this.leftFootMesh);
    registerGroup('rightFoot', this.rightFootMesh);
  }

  triggerDamageFlash(partName, intensity = 1.0, duration = 0.38) {
    // Red damage color is displayed on the screen edge (enemy side of screen), not on body meshes
  }

  updateDamageVisuals(delta) {
    // Body meshes maintain natural human skin and fight trunk tones without red emissive bleeding
  }

  setVisible(visible) {
    if (this.meshGroup) {
      this.meshGroup.visible = visible;
    }
  }

  // --- TWO-TIER STAMINA GETTERS & SETTERS ---
  get stamina() {
    return this.staminaSystem ? this.staminaSystem.current : 100;
  }
  set stamina(val) {
    if (this.staminaSystem) {
      this.staminaSystem.current = Math.max(0, Math.min(this.staminaSystem.maxStamina, val));
    }
  }

  get maxStamina() {
    return this.staminaSystem ? this.staminaSystem.maxStamina : 100;
  }
  set maxStamina(val) {
    if (this.staminaSystem) {
      this.staminaSystem.maxStamina = Math.max(this.staminaSystem.minCapFloor, val);
    }
  }

  // --- LOCOMOTION & ORTHODOX STANCE KINEMATICS ---

  planReferencePose(delta) {
    this.lastDelta = delta;
    this.update(delta);
  }

  update(delta) {
    // Authentic EA Sports UFC Two-Tier Stamina Engine
    if (this.staminaSystem) {
      this.staminaSystem.update(delta, {
        isMoving: this.isMoving,
        isSprinting: this.isSprinting,
        isBlocking: this.isBlocking
      });
    }
    if (this.concussionLevel > 0) this.concussionLevel = Math.max(0, this.concussionLevel - delta * 10);

    // UFC 4 Block Health Regeneration
    if (!this.isBlocking && this.blockBrokenTimer <= 0) {
      this.blockHealth = Math.min(this.maxBlockHealth, this.blockHealth + delta * 40);
    }
    if (this.blockBrokenTimer > 0) {
      this.blockBrokenTimer -= delta;
      if (this.blockBrokenTimer <= 0) {
        this.blockHealth = 65; // Partially restored guard meter
      }
    }

    // EA Sports UFC Dynamic Anatomical Damage Recovery (Fast dynamic fill when not taking damage)
    if (!this.isKnockedOut && !this.limp) {
      if (this.headDamageTimer > 0) {
        this.headDamageTimer -= delta;
      } else if (this.headHealth < this.maxHeadHealth) {
        this.headHealth = Math.min(this.maxHeadHealth, this.headHealth + delta * 22.0);
      }

      if (this.bodyDamageTimer > 0) {
        this.bodyDamageTimer -= delta;
      } else if (this.bodyHealth < this.maxBodyHealth) {
        this.bodyHealth = Math.min(this.maxBodyHealth, this.bodyHealth + delta * 25.0);
      }

      if (this.legDamageTimer > 0) {
        this.legDamageTimer -= delta;
      } else if (this.legHealth < this.maxLegHealth) {
        this.legHealth = Math.min(this.maxLegHealth, this.legHealth + delta * 20.0);
      }

      if (this.concussionLevel > 0) {
        this.concussionLevel = Math.max(0, this.concussionLevel - delta * 15.0);
      }
    }

    // Sync composite health
    this.health = (this.headHealth + this.bodyHealth + this.legHealth) / 3;

    // Timers
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.isComboStrike = false;
      }
    }

    if (this.state === 'FLASH_KD') {
      this.flashKdTimer -= delta;
      if (this.flashKdTimer <= 0) {
        // Authentic EA UFC Scramble Recovery: Fighter pushes off canvas and springs back to stance!
        this.state = 'STAND_IDLE';
        this.headHealth = Math.max(this.headHealth, 50);
        this.bodyHealth = Math.max(this.bodyHealth, 50);
        this.legHealth = Math.max(this.legHealth, 50);
        this.isRocked = true;
        this.rockTimer = 1.0;
        sounds.playJumpLand();
      }
    }

    if (this.strikeCooldown > 0) {
      this.strikeCooldown = Math.max(0, this.strikeCooldown - delta);
      if (this.strikeCooldown === 0 && this.state !== 'KO' && this.state !== 'FLASH_KD' && this.stumbleTimer <= 0) {
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

      // Enforce physiological human joint limits & canvas impact cushioning
      this.enforceAnatomicalJointLimits(delta);

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

    // Strict Octagon 8-Sided Wall Collision & Sliding Constraint (Full 30ft UFC Cage: Radius = 4.57m, inradius = 4.22m)
    // Safe torso radius kept at 3.96m so outer body surfaces (torso width ~0.20m) never penetrate the static barrier
    const maxSafeRadius = 3.96;
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

    // C. Vertical Dynamics: True Earth Gravity (9.81 m/s^2) & Athletic Muscle Coiling
    if (this.jumpState === 'WINDUP') {
      this.jumpTimer -= delta;
      const t = Math.max(0, Math.min(1.0, 1.0 - (this.jumpTimer / 0.11)));
      // Athletic squatted compression: hips drop 14cm, knees bend deep
      this.jumpCompression = Math.sin(t * Math.PI * 0.5) * 0.14;
      if (this.jumpTimer <= 0) {
        this.jumpState = 'AIR';
        this.rootVelocity.y = 3.6; // Natural athletic human vertical leap (~0.66m apex)
        this.jumpCompression = 0;
        sounds.playSwoosh(0.55);
      }
    } else if (this.rootPosition.y > 0 || this.rootVelocity.y !== 0) {
      this.jumpState = 'AIR';
      // Real-World Earth Gravity: 9.81 m/s^2
      const grav = 9.81;
      this.rootVelocity.y -= grav * delta;
      this.rootPosition.y += this.rootVelocity.y * delta;

      if (this.rootPosition.y <= 0) {
        this.rootPosition.y = 0;
        this.rootVelocity.y = 0;
        this.jumpState = 'LAND';
        this.jumpLandTimer = 0.16; // 160ms impact shock absorption
        sounds.playJumpLand();
      }
    } else if (this.jumpState === 'LAND') {
      this.jumpLandTimer -= delta;
      if (this.jumpLandTimer > 0) {
        const t = this.jumpLandTimer / 0.16;
        // Heavy impact absorption dip: knees and hips compress down 12cm to absorb landing mass
        this.jumpCompression = Math.sin(t * Math.PI) * 0.12;
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
    if (this.isEmoting) {
      this.emoteTimer = (this.emoteTimer || 0) + delta;
    } else if (this.isMoving) {
      this.walkCycle += delta * currentSpeed * 4.8;
    } else {
      this.idleTimer += delta * 3.5;
    }

    // E. Compute Anatomical Pose Transforms for all 17 Body Segments
    this.currentPoseTarget = this.calculateOrthodoxPose(currentSpeed, delta);

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
    const timeVal = this.isEmoting ? (this.emoteTimer || 0) : this.idleTimer;
    return this.fightingStyle.calculateCombatPose({
      fighter: this,
      currentSpeed,
      delta,
      time: timeVal,
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
      if (partDist > 4.16) {
        const sc = 4.16 / partDist;
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

    this.isSprinting = isSprint && (dirX !== 0 || dirZ !== 0);
    const fatigueSpeedMult = this.staminaSystem ? this.staminaSystem.getFatigueSpeedMultiplier() : 1.0;
    const speedRatio = Math.sqrt(this.speedMultiplier || 1.0);
    const baseSpeed = (isSprint ? 3.0 : (this.isCrouching ? 1.0 : 1.75)) * speedRatio;
    const speed = (this.isRocked ? 0.9 : baseSpeed) * fatigueSpeedMult;

    this.targetMoveVelocity.set(dirX * speed, 0, dirZ * speed);

    // Only set facing angle directly from movement direction when NOT locked on target
    if (!this.lockTarget && !this.targetOpponent && (dirX !== 0 || dirZ !== 0)) {
      this.targetFacingAngle = Math.atan2(-dirZ, dirX);
    }
  }

  jump() {
    if (this.cannotAct() || this.rootPosition.y > 0.04 || this.jumpState !== 'GROUNDED') return;
    if (this.staminaSystem) {
      if (!this.staminaSystem.canThrow('JUMP')) return;
      this.staminaSystem.consumeAction(9, { delay: 0.45 });
    }
    this.jumpState = 'WINDUP';
    this.jumpTimer = 0.11; // 110ms muscle loading / coiling phase
    this.jumpCompression = 0;
  }

  crouch(isCrouching = true) {
    if (this.cannotAct()) return;
    this.isCrouching = isCrouching;
  }

  setBlocking(isBlocking) {
    if (this.cannotAct() || this.blockBrokenTimer > 0 || this.state === 'STRIKING') {
      this.isBlocking = false;
      return;
    }
    this.isBlocking = isBlocking;
  }

  slip(direction = 0, type = 'LATERAL') {
    if (this.isKnockedOut || this.limp || this.getUpTimer > 0) return;
    if (this.staminaSystem) {
      this.staminaSystem.consumeAction(5, { isDefensive: true, delay: 0.40 });
    }
    if (direction === 'BACK' || type === 'BACK') {
      this.slipType = 'BACK';
      this.slipDirection = 0;
      this.slipDuration = 0.44;
    } else if (direction === 'DOWN' || type === 'DOWN') {
      this.slipType = 'DOWN';
      this.slipDirection = 0;
      this.slipDuration = 0.40;
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

  slipDown() {
    this.slip(0, 'DOWN');
  }

  throwJab() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('JAB')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('JAB');
    this.triggerStrike('JAB', 0.40);
    sounds.playSwoosh(0.35);
  }

  throwCross() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('CROSS')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('CROSS');
    this.triggerStrike('CROSS', 0.50);
    sounds.playSwoosh(0.45);
  }

  throwHook() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('HOOK')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('HOOK');
    this.triggerStrike('HOOK', 0.56);
    sounds.playSwoosh(0.55);
  }

  throwUppercut() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('UPPERCUT')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('UPPERCUT');
    this.triggerStrike('UPPERCUT', 0.52);
    sounds.playSwoosh(0.5);
  }

  throwOverhand() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('OVERHAND')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('OVERHAND');
    this.triggerStrike('OVERHAND', 0.66);
    sounds.playSwoosh(0.65);
  }

  throwHeadkick() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('HEADKICK')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('HEADKICK');
    this.triggerStrike('HEADKICK', 0.76);
    sounds.playSwoosh(0.7);
  }

  throwLowKick() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('LOWKICK')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('LOWKICK');
    this.triggerStrike('LOWKICK', 0.58);
    sounds.playSwoosh(0.5);
  }

  throwBodyKick() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('BODYKICK')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('BODYKICK');
    this.triggerStrike('BODYKICK', 0.66);
    sounds.playSwoosh(0.55);
  }

  throwTeep() {
    if (this.cannotAct()) return;
    if (this.staminaSystem && !this.staminaSystem.canThrow('TEEP')) return;
    if (this.staminaSystem) this.staminaSystem.consumeStrike('TEEP');
    this.triggerStrike('TEEP', 0.56);
    sounds.playSwoosh(0.45);
  }

  switchStance() {
    if (this.cannotAct()) return this.stance;
    this.stance = this.stance === 'ORTHODOX' ? 'SOUTHPAW' : 'ORTHODOX';
    sounds.playSwoosh();
    return this.stance;
  }

  triggerStrike(type, duration) {
    let effectiveDuration = duration;
    // Scale strike duration based on athlete's SPEED stat (e.g. Speed 95 strikes fire ~6% faster than Speed 85)
    const speedRatio = 90.0 / (this.statSpeed || 90);
    effectiveDuration *= speedRatio;

    // EA UFC Fluid Combo Window: Chaining next strike during recoil window (strikeProgress >= 0.45)
    const canComboChain = (this.state === 'STRIKING' && this.strikeProgress >= 0.45) || this.comboTimer > 0;

    if (canComboChain) {
      this.comboCount = Math.min(4, (this.comboCount || 1) + 1);
      this.comboTimer = 0.95; // 950ms combo chaining window
      // Rapid momentum transfer: combo strikes fire 18% faster!
      effectiveDuration *= 0.82;
      this.isComboStrike = true;
    } else {
      this.comboCount = 1;
      this.comboTimer = 0.95;
      this.isComboStrike = false;
    }

    this.state = 'STRIKING';
    this.strikeType = type;
    this.strikeDuration = effectiveDuration;
    this.strikeProgress = 0;
    this.strikeCooldown = effectiveDuration + 0.04;
  }

  cannotAct() {
    if (this.isKnockedOut || this.limp || this.getUpTimer > 0 || this.state === 'FLASH_KD') return true;
    if (this.state === 'STRIKING') {
      // EA UFC COMBO SYSTEM: Allow chaining next strike if current strike has passed apex (progress >= 0.45)
      return this.strikeProgress < 0.45;
    }
    return false;
  }

  triggerFlashKnockdown() {
    if (this.isKnockedOut || this.limp || this.state === 'FLASH_KD') return;
    this.state = 'FLASH_KD';
    this.flashKdTimer = 1.15; // 1.15s struggle on hands and knees
    this.flashKdCount++;
    this.isRocked = true;
    this.rockTimer = 2.5;
    this.stamina = Math.max(30, this.stamina);
    // Restore emergency vitality buffer so fighter survives during the scramble
    this.headHealth = Math.max(this.headHealth, 45);
    this.bodyHealth = Math.max(this.bodyHealth, 45);
    this.legHealth = Math.max(this.legHealth, 45);
    sounds.playHeavyImpact(true);
  }

  // --- HIT RECEPTION & KNOCKOUT ---

  receivePhysicalHit(hitData) {
    if (this.isKnockedOut || this.limp) return;

    const { damage = 15, isHeadshot = false, isCounter = false, kineticEnergy = 50, impulseMagnitude = 20, targetBody } = hitData;
    let finalDmg = damage;
    if (this.guardUp && !isCounter) finalDmg *= 0.4;

    // Concussion accumulates gradually on clean head connections (mitigated by CHIN stat)
    if (isHeadshot) {
      const chinResist = this.chinMultiplier || 1.0;
      this.concussionLevel = Math.min(100, this.concussionLevel + Math.min(8.0, (kineticEnergy * 0.05) / chinResist));
    }

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

    // UFC 4 GROUND-AND-POUND / FLASH KNOCKDOWN MECHANIC
    if (this.state === 'FLASH_KD') {
      // Direct clean strike while already grounded triggers immediate Finish TKO!
      this.knockout({ targetBody, isHeadshot });
      return;
    }

    const isAnyBarDepleted = (this.headHealth <= 0 || this.bodyHealth <= 0 || this.legHealth <= 0);
    if (isAnyBarDepleted) {
      if (this.flashKdCount < 2 && !this.isKnockedOut) {
        // First & second vital bar depletion: Flash Knockdown drop to knee and struggle to scramble up!
        this.triggerFlashKnockdown();
      } else if (!this.isKnockedOut) {
        this.knockout();
      }
    } else if (finalDmg > 11 || isCounter || (isHeadshot && finalDmg > 7)) {
      // EA Sports UFC Stagger / Rocked State: Fighter wobbles and tries to survive on jelly legs while remaining upright!
      this.isRocked = true;
      this.rockTimer = isCounter ? 2.2 : 1.5;
      this.stumbleTimer = Math.min(0.85, 0.40 + finalDmg * 0.02);
      this.state = 'STUMBLE';
      this.stamina = Math.max(0, this.stamina - (isCounter ? 6 : 3));
    }
  }

  // Enforce human physiological joint limits and anti-tunneling floor cushioning
  enforceAnatomicalJointLimits(delta) {
    // 1. Anti-Hyperextension for Knees (Strict hinge: flexion towards hamstring only, clamps forward extension)
    const checkKnee = (thigh, shin) => {
      const relPos = shin.position.vsub(thigh.position);
      const facingSign = this.facingDir || 1;
      const fwdThigh = thigh.quaternion.vmult(new CANNON.Vec3(facingSign, 0, 0));
      const fwdDot = relPos.dot(fwdThigh);
      if (fwdDot > 0.08) {
        // Hyperextension detected: clamp shin position back to neutral axis
        shin.position.vsub(fwdThigh.scale((fwdDot - 0.08) * 0.85), shin.position);
        const vDot = shin.velocity.dot(fwdThigh);
        if (vDot > 0) {
          shin.velocity.vsub(fwdThigh.scale(vDot * 1.6), shin.velocity);
        }
      }
    };
    checkKnee(this.leftThigh, this.leftShin);
    checkKnee(this.rightThigh, this.rightShin);

    // 2. Anti-Hyperextension for Elbows (Forearm only flexes inward towards chest/bicep)
    const checkElbow = (upper, fore) => {
      const relPos = fore.position.vsub(upper.position);
      const backUpper = upper.quaternion.vmult(new CANNON.Vec3(-1, 0, 0));
      const backDot = relPos.dot(backUpper);
      if (backDot > 0.09) {
        fore.position.vsub(backUpper.scale((backDot - 0.09) * 0.85), fore.position);
        const vDot = fore.velocity.dot(backUpper);
        if (vDot > 0) {
          fore.velocity.vsub(backUpper.scale(vDot * 1.6), fore.velocity);
        }
      }
    };
    checkElbow(this.leftUpperArm, this.leftForearm);
    checkElbow(this.rightUpperArm, this.rightForearm);

    // 3. Strict UFC Canvas Contact & Inelastic Energy Dissipation (Anti-Clipping & Anti-Jitter)
    const floorYLimits = {
      pelvis: 0.10,
      abdomen: 0.09,
      chest: 0.11,
      neck: 0.12,
      head: 0.13,
      leftThigh: 0.085,
      rightThigh: 0.085,
      leftShin: 0.07,
      rightShin: 0.07,
      leftFoot: 0.04,
      rightFoot: 0.04,
      leftUpperArm: 0.075,
      rightUpperArm: 0.075,
      leftForearm: 0.065,
      rightForearm: 0.065,
      leftGlove: 0.05,
      rightGlove: 0.05,
    };

    for (const body of this.bodies) {
      const minY = floorYLimits[body.partName] || 0.06;
      if (body.position.y < minY) {
        body.position.y = minY;
        if (body.velocity.y < 0) {
          // Deadened canvas thud (96% inelastic dissipation)
          body.velocity.y = -body.velocity.y * 0.04;
        }
        // Heavy canvas fabric sliding friction (damps jitter)
        body.velocity.x *= 0.92;
        body.velocity.z *= 0.92;
        body.angularVelocity.x *= 0.88;
        body.angularVelocity.y *= 0.88;
        body.angularVelocity.z *= 0.88;
      }
    }
  }

  knockout(koData = {}) {
    if (this.isKnockedOut && this.limp) return;
    this.health = 0;
    this.isKnockedOut = true;
    this.limp = true;
    this.ragdollMode = 'PASSIVE';
    this.state = 'KO';
    this.autoRecoverTimer = 0;
    sounds.playKnockout();

    if (this.onKnockout) {
      this.onKnockout(this, koData);
    }

    // Switch all 17 bodies to dynamic so Cannon-es simulates full gravity, joints & collisions
    this.setBodiesPhysicsType(CANNON.Body.DYNAMIC);

    const {
      targetBody,
      impactVec,
      impactPoint,
      rotationalTorque = 0,
      strikeType = null,
      isHeadshot = false,
      isBodyHit = false,
      isLegHit = false,
    } = koData;

    // Default directional vector away from opponent if not provided
    let fallbackDir = -this.facingDir;
    if (this.targetOpponent) {
      const oppPos = this.targetOpponent.rootPosition || this.targetOpponent.position;
      if (oppPos) {
        fallbackDir = Math.sign(this.rootPosition.x - oppPos.x) || -this.facingDir;
      }
    }

    const impulse = impactVec ? impactVec.clone() : new CANNON.Vec3(fallbackDir * 16, -4, (Math.random() - 0.5) * 6);
    const hitPoint = impactPoint ? impactPoint.clone() : (targetBody ? targetBody.position.clone() : this.head.position.clone());

    // REALISTIC ANATOMICAL KNOCKOUT IMPULSE & FLACCID COLLAPSE
    if (isLegHit) {
      // --- 1. LEG KICK TKO (Base Swept, Lateral Hip Tumble) ---
      const legTarget = targetBody || (Math.random() > 0.5 ? this.leftThigh : this.rightThigh);
      legTarget.applyImpulse(impulse.scale(3.2), hitPoint);
      this.pelvis.applyImpulse(new CANNON.Vec3(impulse.x * 0.9, -5.2, impulse.z * 1.2), this.pelvis.position);
      // Sudden loss of balance and postural tone
      this.chest.velocity.set(impulse.x * 0.3, -2.2, impulse.z * 0.4);
      this.head.velocity.set(impulse.x * 0.3, -2.2, impulse.z * 0.4);

    } else if (isBodyHit || strikeType === 'BODY_KICK') {
      // --- 2. BODY SHOT TKO (Liver / Solar Plexus Fetal Collapse) ---
      const bodyTarget = targetBody || this.abdomen;
      bodyTarget.applyImpulse(impulse.scale(2.2), hitPoint);
      // Sudden torso crunch: chest and pelvis fold forward, knees drop to canvas
      this.pelvis.applyImpulse(new CANNON.Vec3(impulse.x * 0.5, -7.5, impulse.z * 0.5), this.pelvis.position);
      this.chest.applyImpulse(new CANNON.Vec3(this.facingDir * 3.5, -5.5, 0), this.chest.position);
      // Arms instinctively collapse inward to hug ribs
      this.leftForearm.velocity.set(0, -3.2, 0);
      this.rightForearm.velocity.set(0, -3.2, 0);

    } else if (strikeType === 'UPPERCUT') {
      // --- 3. UPPERCUT KNOCKOUT (Jaw Scoop, Stiff Backward Canvas Slam) ---
      const headTarget = this.head;
      // Explosive upward & backward jaw drive
      const uppercutImpulse = new CANNON.Vec3(fallbackDir * 14.0, 16.5, impulse.z * 0.5);
      headTarget.applyImpulse(uppercutImpulse, hitPoint);
      this.neck.applyImpulse(uppercutImpulse.scale(0.5), this.neck.position);
      // Torso snapped backwards
      this.chest.applyImpulse(new CANNON.Vec3(fallbackDir * 11.0, 6.0, impulse.z * 0.3), this.chest.position);
      // Knees buckle completely, legs collapse underneath
      this.pelvis.applyImpulse(new CANNON.Vec3(fallbackDir * 4.0, -6.5, 0), this.pelvis.position);
      this.leftThigh.applyImpulse(new CANNON.Vec3(0, -4.0, 0), this.leftThigh.position);
      this.rightThigh.applyImpulse(new CANNON.Vec3(0, -4.0, 0), this.rightThigh.position);

    } else if (strikeType === 'HOOK' || strikeType === 'OVERHAND') {
      // --- 4. HOOK / OVERHAND KNOCKOUT (Rotational Whiplash & Shoulder Roll Faceplant) ---
      const headTarget = this.head;
      headTarget.applyImpulse(impulse.scale(2.8), hitPoint);

      // Strong rotational torque around cervical axis
      const torqueMag = Math.max(34, rotationalTorque * 4.2);
      const torqueDir = new CANNON.Vec3(
        (Math.random() - 0.5) * torqueMag * 0.5,
        (impulse.z !== 0 ? Math.sign(impulse.z) : (Math.random() - 0.5)) * torqueMag * 1.8,
        (Math.random() - 0.5) * torqueMag * 0.5
      );
      headTarget.applyTorque(torqueDir);
      this.neck.applyTorque(torqueDir.scale(0.7));

      // Upper torso carried along with punch rotational arc
      this.chest.applyImpulse(impulse.scale(1.4), this.chest.position);
      this.chest.applyTorque(torqueDir.scale(0.5));

      // Pelvis drops with slight twist
      this.pelvis.applyImpulse(new CANNON.Vec3(impulse.x * 0.4, -6.2, impulse.z * 0.5), this.pelvis.position);
      this.leftThigh.applyImpulse(new CANNON.Vec3(0, -3.5, 0), this.leftThigh.position);
      this.rightThigh.applyImpulse(new CANNON.Vec3(0, -3.5, 0), this.rightThigh.position);

    } else {
      // --- 5. JAB / CROSS / STANDARD HEADSHOT KNOCKOUT (Crumpled Drop) ---
      const headTarget = this.head;
      headTarget.applyImpulse(impulse.scale(2.6), hitPoint);

      const torqueMag = Math.max(24, rotationalTorque * 3.2);
      const torqueDir = new CANNON.Vec3(
        (Math.random() - 0.5) * torqueMag,
        (impulse.z !== 0 ? Math.sign(impulse.z) : (Math.random() - 0.5)) * torqueMag * 1.4,
        (Math.random() - 0.5) * torqueMag
      );
      headTarget.applyTorque(torqueDir);
      this.neck.applyTorque(torqueDir.scale(0.6));

      // Upper torso pushed straight back
      this.chest.applyImpulse(impulse.scale(1.2), this.chest.position);

      // Instant motor tone collapse: knees buckle and pelvis drops straight down
      this.pelvis.applyImpulse(new CANNON.Vec3(impulse.x * 0.35, -6.2, impulse.z * 0.35), this.pelvis.position);
      this.leftThigh.applyImpulse(new CANNON.Vec3(0, -3.6, 0), this.leftThigh.position);
      this.rightThigh.applyImpulse(new CANNON.Vec3(0, -3.6, 0), this.rightThigh.position);
    }

    // Flash the impacted body part red
    const flashPart = targetBody ? targetBody.partName : (isHeadshot ? 'head' : (isBodyHit ? 'abdomen' : 'leftThigh'));
    this.triggerDamageFlash(flashPart, 1.8, 0.85);

    // In official RFC Octagon bouts, knockout is final (stoppage)
    this.autoRecoverTimer = 0;
  }

  // Recovery: Physical get-up from floor back into stance
  standUp() {
    this.headHealth = this.maxHeadHealth;
    this.bodyHealth = this.maxBodyHealth;
    this.legHealth = this.maxLegHealth;
    this.blockHealth = this.maxBlockHealth;
    this.headDamageTimer = 0;
    this.bodyDamageTimer = 0;
    this.legDamageTimer = 0;
    this.health = this.maxHealth;
    if (this.staminaSystem) this.staminaSystem.reset();
    else this.stamina = 100;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.limp = false;
    this.isRocked = false;
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
    this.headHealth = this.maxHeadHealth;
    this.bodyHealth = this.maxBodyHealth;
    this.legHealth = this.maxLegHealth;
    this.blockHealth = this.maxBlockHealth;
    this.headDamageTimer = 0;
    this.bodyDamageTimer = 0;
    this.legDamageTimer = 0;
    this.health = this.maxHealth;
    if (this.staminaSystem) this.staminaSystem.reset();
    else this.stamina = 100;
    this.concussionLevel = 0;
    this.isKnockedOut = false;
    this.limp = false;
    this.isRocked = false;
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

    // Dynamic red damage trauma glow and flash updates
    this.updateDamageVisuals(this.lastDelta || 0.016);
  }

  // --- TELEMETRY ---

  getTorsoPosition() { return this.chest.position; }
  getHeadPosition() { return this.head.position; }
  getPelvisPosition() { return this.pelvis.position; }

  setVisible(visible) {
    if (this.meshGroup) {
      this.meshGroup.visible = !!visible;
    }
  }

  // Clean tear-down for switching fighters without memory leaks
  destroy() {
    if (this.meshGroup && this.scene) {
      this.scene.remove(this.meshGroup);
      this.meshGroup.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        }
      });
    }

    if (this.world) {
      for (const c of this.constraints) {
        this.world.removeConstraint(c);
      }
      for (const b of this.bodies) {
        this.world.removeBody(b);
      }
    }

    this.constraints = [];
    this.bodies = [];
    this.bodyPartMap.clear();
    this.damageFlashTimers.clear();
    this.bodyMeshesMap.clear();
  }
}
