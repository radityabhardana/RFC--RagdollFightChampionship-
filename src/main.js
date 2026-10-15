import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import './style.css';

import { Octagon } from './arena/Octagon.js';
import { BroadcastCamera } from './camera/BroadcastCamera.js';
import { RagdollFighter } from './fighter/RagdollFighter.js';
import { FighterAI } from './ai/FighterAI.js';
import { CombatEngine } from './combat/CombatEngine.js';
import { BroadcastHUD } from './ui/BroadcastHUD.js';
import { sounds } from './audio/SoundManager.js';

class UFCGame {
  constructor() {
    this.container = document.querySelector('#app');
    this.clock = new THREE.Clock();
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;

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
    // 3D Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1017);
    this.scene.fog = new THREE.Fog(0x0c1017, 22, 65);

    // Perspective Camera (optimized near/far for maximum 24-bit z-buffer depth precision)
    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.4,
      80
    );
    this.camera.position.set(0, 2.0, 7.8);

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

    // Broadcast Side Camera Controller
    this.cameraController = new BroadcastCamera(this.camera, this.renderer.domElement);
  }

  initPhysics() {
    this.world = new CANNON.World();
    // Real-world Earth gravity: -9.81 m/s^2
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 16;
    this.world.solver.tolerance = 0.0005;
  }

  initGameObjects() {
    // 1. Octagon Arena (Canvas, Cage, Posts, Stadium Lights)
    this.octagon = new Octagon(this.scene, this.world);

    // 2. Player (Red Corner)
    this.player = new RagdollFighter(this.scene, this.world, {
      isPlayer: true,
      name: 'ALEX "THE VIPER"',
      corner: 'RED',
      shortsColor: 0xd4af37, // Gold Champion Shorts
      startX: -2.0,
      startZ: 0,
    });

    // 3. AI Opponent (Blue Corner)
    this.aiFighter = new RagdollFighter(this.scene, this.world, {
      isPlayer: false,
      name: 'ISLAM "THE SMESH"',
      corner: 'BLUE',
      shortsColor: 0xd20a0a, // Red Contender Shorts
      startX: 2.0,
      startZ: 0,
    });

    // Pair opponents
    this.player.setOpponent(this.aiFighter);
    this.aiFighter.setOpponent(this.player);

    // 4. AI Brain
    this.aiBrain = new FighterAI(this.aiFighter, this.player);

    // 5. Broadcast HUD
    this.hud = new BroadcastHUD(
      this.container,
      (arch) => {
        this.aiBrain.setArchetype(arch);
        this.hud.setAIName(this.aiFighter.name);
        this.hud.showEventBanner(`OPPONENT STYLE: ${arch}`);
      },
      () => {
        this.restartMatch();
      }
    );

    // 6. Combat Engine (Physics collisions, damage, trauma)
    this.combatEngine = new CombatEngine(this.world, this.cameraController, this.hud);
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;

      // Single action triggers
      switch (e.key.toLowerCase()) {
        case 'j':
          this.player.throwJab();
          break;
        case 'k':
          this.player.throwCross();
          break;
        case 'l':
          this.player.throwHeadkick();
          break;
        case 'f':
        case 'i':
          this.player.shootTakedown();
          this.hud.showEventBanner('DOUBLE-LEG TAKEDOWN!');
          break;
        case 'u':
          if (this.player.isGrounded && this.player.groundRole === 'TOP') {
            this.player.groundAndPoundStrike();
            this.hud.showEventBanner('GROUND & POUND!');
          } else {
            this.player.throwHook();
          }
          break;
        case 'q':
          this.player.slip(-1); // Slip left
          break;
        case 'e':
          this.player.slip(1); // Slip right
          break;
        case ' ':
          this.player.guardUp = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.key === ' ') {
        this.player.guardUp = false;
      }
    });

    // Mouse quick clicks
    window.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      if (e.button === 0) {
        // Left click = Jab or Ground & Pound
        if (this.player.isGrounded && this.player.groundRole === 'TOP') {
          this.player.groundAndPoundStrike();
        } else {
          this.player.throwJab();
        }
      } else if (e.button === 2) {
        // Right click = Power Hook
        this.player.throwHook();
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  handlePlayerMovement() {
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['w'] || this.keys['arrowup']) moveZ -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1;
    if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.hypot(moveX, moveZ);
      this.player.move(moveX / len, moveZ / len);
    }
  }

  restartMatch() {
    this.player.reset(-2.0, 0);
    this.aiFighter.reset(2.0, 0);
    this.cameraController.reset();
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;
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

    const rawDelta = Math.min(this.clock.getDelta(), 0.05);

    // Knockout slow-motion effect handling
    if (this.player.isKnockedOut || this.aiFighter.isKnockedOut) {
      this.targetTimeScale = 0.18; // Cinematic Slow-Mo
      if (this.cameraController.mode !== 'CINEMATIC_KO') {
        const koFighter = this.player.isKnockedOut ? this.player : this.aiFighter;
        this.cameraController.triggerKOCam(koFighter);
      }
    } else {
      this.targetTimeScale = 1.0;
    }

    // Smooth time scale lerp
    this.timeScale += (this.targetTimeScale - this.timeScale) * 0.08;
    const delta = rawDelta * this.timeScale;

    // 1. Player Input
    this.handlePlayerMovement();

    // 2. AI Brain Decisions
    this.aiBrain.update(delta);

    // 3. Active Ragdoll Balance Stabilization
    this.player.updateActiveRagdoll(delta);
    this.aiFighter.updateActiveRagdoll(delta);

    // 4. Physics Simulation Step (5 substeps for continuous high-speed collision resolution)
    this.world.step(1 / 60, delta, 5);

    // 5. Update Visual Meshes to Physics Transforms
    this.player.updateMeshTransforms();
    this.aiFighter.updateMeshTransforms();

    // 6. Broadcast Camera Updates (Side Angle Tracking)
    this.cameraController.update(delta, this.player, this.aiFighter);

    // 7. Broadcast HUD Updates (Health, Stamina, Clock)
    this.hud.update(delta, this.player, this.aiFighter, this.camera);

    // 8. Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap Game
window.addEventListener('DOMContentLoaded', () => {
  new UFCGame();
});
