import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import './style.css';

import { Octagon } from './arena/Octagon.js';
import { ArenaCrowd } from './arena/ArenaCrowd.js';
import { BroadcastCamera } from './camera/BroadcastCamera.js';
import { RagdollFighter } from './fighter/RagdollFighter.js';
import { CombatEngine } from './combat/CombatEngine.js';
import { FighterAI } from './ai/FighterAI.js';
import { BroadcastHUD } from './ui/BroadcastHUD.js';
import { sounds } from './audio/SoundManager.js';

class UFCGame {
  constructor() {
    this.container = document.querySelector('#app');
    this.clock = new THREE.Clock();
    this.keys = {};

    this.initThree();
    this.initPhysics();
    this.initGameObjects();
    this.initInput();
    this.initResize();

    // Start Audio on first interaction
    const initAudio = () => {
      sounds.init();
      sounds.playBell();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('pointerdown', initAudio);
    window.addEventListener('keydown', initAudio);

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // 3D Scene (Moody, darkened arena with bright Octagon focus)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050608);
    this.scene.fog = new THREE.Fog(0x050608, 22, 78);

    // Perspective Camera (Cinematic EA Sports UFC broadcast focal compression)
    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.3,
      110
    );
    this.camera.position.set(0, 1.25, 3.2);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.renderer.domElement.id = 'webgl-canvas';
    this.container.appendChild(this.renderer.domElement);

    // Dynamic Camera Controller (Solo Follow & 360 Orbit)
    this.cameraController = new BroadcastCamera(this.camera, this.renderer.domElement);
  }

  initPhysics() {
    this.world = new CANNON.World();
    // Real-world Earth gravity: -9.81 m/s^2
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    // 24 solver iterations ensures joint anchors never separate or stretch
    this.world.solver.iterations = 24;
    this.world.solver.tolerance = 0.0001;
  }

  initGameObjects() {
    // 1. Octagon Arena (Canvas, Cage, Posts, Stadium Lights)
    this.octagon = new Octagon(this.scene, this.world);

    // 2. Immersive 360° UFC Stadium Bleachers, Commentary Desk & 1,400+ Animated Fans
    this.crowd = new ArenaCrowd(this.scene);

    // 3. Solo Player Fighter (Red Corner) - Authentic GoreBox Phil Timsky Aesthetic
    this.player = new RagdollFighter(this.scene, this.world, {
      isPlayer: true,
      name: 'PHIL "GOREBOX"',
      corner: 'RED',
      skinColor: 0xd6a383,
      shirtColor: 0x2e343b, // Signature charcoal grey t-shirt
      pantsColor: 0x2f415c, // Classic blue denim jeans
      bootsColor: 0x483224, // Rugged brown combat boots
      gloveColor: 0x4a3728, // Brown fingerless combat gloves
      hairColor: 0x221a15,
      startX: -1.35,
      startZ: 0,
    });

    // 4. Human Ragdoll Dummy / Opponent (Blue Corner) at Center of Octagon (0, 0, 0)
    this.dummy = new RagdollFighter(this.scene, this.world, {
      isPlayer: false,
      name: 'RAGDOLL DUMMY',
      corner: 'BLUE',
      skinColor: 0xcfa07e,
      shirtColor: 0x242d38, // Dark navy blue-grey t-shirt
      pantsColor: 0x283446, // Dark slate denim jeans
      bootsColor: 0x3d2b1f,
      gloveColor: 0x3d2e24,
      hairColor: 0x1b1512,
      startX: 0,
      startZ: 0,
    });
    this.dummy.guardUp = false; // Training dummy starts in relaxed guard for clean hit registration

    // Lock fighters to face each other
    this.player.setOpponent(this.dummy);
    this.player.setLockTarget(this.dummy);
    this.dummy.setOpponent(this.player);
    this.dummy.setLockTarget(this.player);

    // 5. Biomechanical Combat Engine (Newtonian collision impulse, whiplash torque, hit feedback)
    this.combatEngine = new CombatEngine(this.world, this.cameraController, null);
    this.combatEngine.crowd = this.crowd;

    // 6. Sparring AI Controller (toggled via 'P')
    this.dummyAI = new FighterAI(this.dummy, this.player);
    this.dummyAI.setArchetype('BRAWLER');
    this.aiEnabled = false; // Default: Training Dummy mode (stands, reacts, collapses into ragdoll, auto-recovers)

    // 7. Dedicated Movement & Physics Lab HUD with Ragdoll Mode Callbacks
    this.hud = new BroadcastHUD(this.container, {
      onResetPosition: () => this.resetPlayerPosition(),
      onToggleAI: () => this.toggleAI(),
      onSetRagdollMode: (mode) => {
        this.player.setRagdollMode(mode);
        if (mode === 'PASSIVE') {
          this.hud.spawnHitText('FLASH KNOCKOUT!', this.player.getHeadPosition(), 'ROCKED');
          this.hud.showEventBanner('⚡ FLASH KNOCKOUT! (PASSIVE LIMP)');
          this.crowd.triggerExcitement(0.85);
        } else if (mode === 'HYBRID') {
          this.hud.spawnHitText('RECOVERED TO STANCE', this.player.getHeadPosition(), 'NORMAL');
          this.hud.showEventBanner('🥋 ATHLETE IN ORTHODOX STANCE');
        } else if (mode === 'ACTIVE') {
          this.hud.spawnHitText('ACTIVE PHYSICS', this.player.getHeadPosition(), 'NORMAL');
          this.hud.showEventBanner('⚙️ ACTIVE BALANCE RAGDOLL');
        }
      },
      onKnockout: () => {
        this.dummy.knockout();
        this.hud.spawnHitText('DUMMY KNOCKOUT!', this.dummy.getHeadPosition(), 'ROCKED');
        this.crowd.triggerExcitement(1.0);
      },
      onStandUp: () => {
        this.dummy.standUp();
        this.hud.spawnHitText('DUMMY RECOVERED', this.dummy.getHeadPosition(), 'NORMAL');
        this.crowd.triggerExcitement(0.3);
      },
    });
    this.combatEngine.hud = this.hud;
  }

  toggleAI() {
    this.aiEnabled = !this.aiEnabled;
    this.dummy.guardUp = this.aiEnabled;
    const modeName = this.aiEnabled ? '🥊 AI SPARRING PARTNER: ACTIVE' : '🎯 TRAINING DUMMY MODE: ACTIVE';
    this.hud.spawnHitText(this.aiEnabled ? 'AI SPARRING' : 'DUMMY MODE', this.dummy.getHeadPosition(), 'NORMAL');
    this.hud.showEventBanner(modeName);
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // 3-State Ragdoll Hotkeys
      if (key === '1') {
        this.player.setRagdollMode('HYBRID');
        this.hud.spawnHitText('HYBRID STANCE', this.player.getHeadPosition(), 'NORMAL');
        this.hud.showEventBanner('🥋 HYBRID KINEMATIC LOCOMOTION');
        return;
      }
      if (key === '2') {
        this.player.setRagdollMode('PASSIVE');
        this.hud.spawnHitText('FLASH KNOCKOUT!', this.player.getHeadPosition(), 'ROCKED');
        this.hud.showEventBanner('⚡ FLASH KNOCKOUT! (PASSIVE LIMP)');
        return;
      }
      if (key === '3') {
        this.player.setRagdollMode('ACTIVE');
        this.hud.spawnHitText('ACTIVE PHYSICS', this.player.getHeadPosition(), 'NORMAL');
        this.hud.showEventBanner('⚙️ ACTIVE BALANCE RAGDOLL');
        return;
      }
      if (key === 'o') {
        if (this.keys['shift']) {
          this.player.knockout();
          this.hud.spawnHitText('PLAYER KNOCKOUT!', this.player.getHeadPosition(), 'ROCKED');
        } else {
          this.dummy.knockout();
          this.hud.spawnHitText('DUMMY KNOCKOUT!', this.dummy.getHeadPosition(), 'ROCKED');
          this.hud.showEventBanner('⚡ DUMMY COLLAPSED (LIMP RAGDOLL)');
        }
        return;
      }
      if (key === 'r') {
        if (this.dummy.isKnockedOut || this.dummy.limp) {
          this.dummy.standUp();
          this.hud.spawnHitText('DUMMY RECOVERED', this.dummy.getHeadPosition(), 'NORMAL');
        }
        if (this.player.isKnockedOut || this.player.limp) {
          this.player.standUp();
          this.hud.spawnHitText('PLAYER RECOVERED', this.player.getHeadPosition(), 'NORMAL');
        }
        this.hud.showEventBanner('🥋 ATHLETE RECOVERED TO STANCE');
        return;
      }
      if (key === 'p') {
        this.toggleAI();
        return;
      }

      // Shadowboxing & Movement key triggers
      switch (key) {
        case 'j': {
          if (this.keys['f'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          this.player.throwJab();
          this.hud.recordStrikeAttempt('JAB');
          this.hud.spawnHitText(isSlipBack ? 'PULL-COUNTER JAB' : (isSlip ? 'SLIP LEAD JAB' : 'LEAD JAB'), this.player.getHeadPosition(), isSlipBack ? 'ROCKED' : 'NORMAL');
          break;
        }
        case 'k': {
          if (this.keys['f'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          this.player.throwCross();
          this.hud.recordStrikeAttempt('CROSS');
          this.hud.spawnHitText(isSlipBack ? '⚡ PULL-COUNTER CROSS' : (isSlip ? 'SLIP COUNTER CROSS' : 'POWER CROSS'), this.player.getHeadPosition(), 'ROCKED');
          break;
        }
        case 'u': {
          if (this.keys['f'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          this.player.throwHook();
          this.hud.recordStrikeAttempt('HOOK');
          this.hud.spawnHitText(isSlipBack ? 'PULL-COUNTER HOOK' : (isSlip ? 'SLIP COUNTER HOOK' : 'LEAD HOOK'), this.player.getHeadPosition(), isSlipBack ? 'ROCKED' : (isSlip ? 'ROCKED' : 'NORMAL'));
          break;
        }
        case 'i': {
          if (this.keys['f'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          this.player.throwUppercut();
          this.hud.recordStrikeAttempt('UPPERCUT');
          this.hud.spawnHitText(isSlipBack ? 'PULL-COUNTER UPPERCUT' : (isSlip ? 'SLIP UPPERCUT' : 'REAR UPPERCUT'), this.player.getHeadPosition(), isSlipBack ? 'ROCKED' : (isSlip ? 'ROCKED' : 'NORMAL'));
          break;
        }
        case 'h': {
          if (this.keys['f'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          this.player.throwOverhand();
          this.hud.recordStrikeAttempt('OVERHAND');
          this.hud.spawnHitText(isSlip ? 'SLIP OVERHAND BOMB' : 'OVERHAND POWER BOMB', this.player.getHeadPosition(), 'ROCKED');
          break;
        }
        case 'l':
          this.player.throwHeadkick();
          this.hud.recordStrikeAttempt('HEADKICK');
          this.hud.spawnHitText('HIGH HEADKICK', this.player.getHeadPosition(), 'ROCKED');
          break;
        case 'm':
          this.player.throwLowKick();
          this.hud.recordStrikeAttempt('LOWKICK');
          this.hud.spawnHitText('LOW CHOP KICK', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'b':
          this.player.throwBodyKick();
          this.hud.recordStrikeAttempt('BODYKICK');
          this.hud.spawnHitText('BODY ROUNDHOUSE', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 't':
          this.player.throwTeep();
          this.hud.recordStrikeAttempt('TEEP');
          this.hud.spawnHitText('FRONT PUSH TEEP', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'x':
        case 'z': {
          const newStance = this.player.switchStance();
          this.hud.spawnHitText(newStance + ' SWITCH', this.player.getHeadPosition(), 'NORMAL');
          this.hud.showEventBanner('🔄 SWITCHED TO ' + newStance + ' STANCE');
          break;
        }
        case 'f':
          this.player.slipBack();
          this.hud.spawnHitText('PULL SLIP (BACK)', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'q':
          if (this.keys['s']) {
            this.player.slipBack();
            this.hud.spawnHitText('PULL SLIP (BACK)', this.player.getHeadPosition(), 'NORMAL');
          } else {
            this.player.slip(-1);
          }
          break;
        case 'e':
          if (this.keys['s']) {
            this.player.slipBack();
            this.hud.spawnHitText('PULL SLIP (BACK)', this.player.getHeadPosition(), 'NORMAL');
          } else {
            this.player.slip(1);
          }
          break;
        case ' ':
          this.player.jump();
          this.hud.spawnHitText('STANCE HOP', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'c':
        case 'control':
          this.player.crouch(true);
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
      if (key === 'c' || key === 'control') {
        this.player.crouch(false);
      }
    });

    // Mouse Quick Punches
    window.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      if (e.button === 0) {
        // Left click = Jab or Uppercut
        if (this.keys['shift']) {
          this.player.throwUppercut();
        } else {
          this.player.throwJab();
        }
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  handlePlayerMovement() {
    let screenX = 0; // -1 = Left (A), +1 = Right (D)
    let screenZ = 0; // -1 = Down / Toward Camera (S), +1 = Up / Away from Camera (W)

    // Screen-relative fighting controls:
    // D = jalan / maju ke kanan layar (ke arah sasaran saat sasaran di kanan)
    // A = jalan / mundur ke kiri layar (menjauhi sasaran saat sasaran di kanan)
    // W = jalan ke atas layar / melingkar ke sisi dalam
    // S = jalan ke bawah layar / melingkar ke sisi luar mendekati kamera
    if (this.keys['d'] || this.keys['arrowright']) screenX += 1;
    if (this.keys['a'] || this.keys['arrowleft']) screenX -= 1;
    if (this.keys['w'] || this.keys['arrowup']) screenZ += 1;
    if (this.keys['s'] || this.keys['arrowdown']) screenZ -= 1;

    const isSprint = !!this.keys['shift'];

    if (screenX !== 0 || screenZ !== 0) {
      // Compute screen-relative vectors on floor plane
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();

      // camRight points directly to the right side of the screen
      const camRight = new THREE.Vector3();
      camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

      let moveDir = new THREE.Vector3()
        .addScaledVector(camRight, screenX)
        .addScaledVector(camDir, screenZ)
        .normalize();

      // Melee obstacle boundary: prevent walking through the human dummy
      if (this.dummy && !this.dummy.isKnockedOut) {
        const pPos = this.player.rootPosition;
        const dPos = this.dummy.rootPosition;
        const toDummyX = dPos.x - pPos.x;
        const toDummyZ = dPos.z - pPos.z;
        const distToDummy = Math.hypot(toDummyX, toDummyZ);

        if (distToDummy < 0.68 && distToDummy > 0.001) {
          const normDummyX = toDummyX / distToDummy;
          const normDummyZ = toDummyZ / distToDummy;
          const towardDummy = moveDir.x * normDummyX + moveDir.z * normDummyZ;
          if (towardDummy > 0) {
            moveDir.x -= towardDummy * normDummyX;
            moveDir.z -= towardDummy * normDummyZ;
          }
        }
      }

      const moveLen = Math.hypot(moveDir.x, moveDir.z);
      if (moveLen > 0.001) {
        this.player.move(moveDir.x / moveLen, moveDir.z / moveLen, isSprint);
      } else {
        this.player.move(0, 0, false);
      }
    } else {
      this.player.move(0, 0, false);
    }
  }

  resetPlayerPosition() {
    this.player.reset(-1.35, 0);
    this.dummy.reset(0, 0);
    this.player.facingAngle = 0;
    this.dummy.facingAngle = Math.PI;
    this.cameraController.orbitYaw = 0;
    this.cameraController.orbitPitch = 0.04;
    this.cameraController.orbitDistance = 3.0;
    sounds.playBell();
  }

  initResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);

    // 1. Movement Inputs
    this.handlePlayerMovement();

    // 2. Sparring AI Decision Logic (when AI is enabled)
    if (this.aiEnabled && !this.dummy.isKnockedOut && this.dummy.state !== 'KO') {
      this.dummyAI.update(delta);
    }

    // 3. Build the kinematic reference poses (no teleport; PD controller follows it)
    this.player.planReferencePose(delta);
    this.dummy.planReferencePose(delta);

    // 4. Physics Simulation Step (5 substeps for continuous contact resolution)
    this.world.step(1 / 60, delta, 5);

    // 5. Update Visual Meshes to Physics Transforms
    this.player.updateMeshTransforms();
    this.dummy.updateMeshTransforms();

    // 6. Dynamic Camera Updates (Authentic EA Sports UFC Broadcast Tracking for both fighters)
    this.cameraController.update(delta, this.player, this.dummy);

    // 7. Dynamic Stadium Crowd & Camera Flashes Update
    if (this.crowd) {
      this.crowd.update(delta, this.clock.getElapsedTime());
    }

    // 8. Movement Lab HUD Telemetry Updates
    this.hud.update(delta, this.player, this.dummy, this.aiEnabled);

    // 9. Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap Game
window.addEventListener('DOMContentLoaded', () => {
  new UFCGame();
});
