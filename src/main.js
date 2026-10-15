import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import './style.css';

import { Octagon } from './arena/Octagon.js';
import { BroadcastCamera } from './camera/BroadcastCamera.js';
import { RagdollFighter } from './fighter/RagdollFighter.js';
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
    // 3D Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1017);
    this.scene.fog = new THREE.Fog(0x0c1017, 22, 65);

    // Perspective Camera (optimized near/far for maximum depth precision)
    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.4,
      80
    );
    this.camera.position.set(0, 1.8, 4.5);

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

    // 2. Solo Player Fighter (Spawned at center ring)
    this.player = new RagdollFighter(this.scene, this.world, {
      isPlayer: true,
      name: 'ALEX "THE VIPER"',
      corner: 'RED',
      shortsColor: 0xd4af37, // Gold Champion Shorts
      startX: 0,
      startZ: 0,
    });

    // 3. Dedicated Movement & Physics Lab HUD with Ragdoll Mode Callbacks
    this.hud = new BroadcastHUD(this.container, {
      onResetPosition: () => this.resetPlayerPosition(),
      onSetRagdollMode: (mode) => this.player.setRagdollMode(mode),
      onKnockout: () => {
        this.player.knockout();
        this.hud.spawnHitText('FLASH KNOCKOUT!', this.player.getHeadPosition(), 'ROCKED');
      },
      onStandUp: () => {
        this.player.standUp();
        this.hud.spawnHitText('RECOVERED TO STANCE', this.player.getHeadPosition(), 'NORMAL');
      },
    });
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // Ragdoll Architecture Mode Swapping
      if (key === '1') {
        this.player.setRagdollMode('HYBRID');
        this.hud.showEventBanner('HYBRID RAGDOLL: ORTHODOX STANCE');
        return;
      }
      if (key === '2') {
        this.player.setRagdollMode('ACTIVE');
        this.hud.showEventBanner('ACTIVE RAGDOLL: DYNAMIC BALANCE');
        return;
      }
      if (key === '3') {
        this.player.setRagdollMode('PASSIVE');
        this.hud.showEventBanner('PASSIVE RAGDOLL: LIMP COLLAPSE');
        return;
      }
      if (key === 'o') {
        this.player.knockout();
        this.hud.spawnHitText('FLASH KNOCKOUT!', this.player.getHeadPosition(), 'ROCKED');
        this.hud.showEventBanner('⚡ FLASH KNOCKOUT! (LIMP)');
        return;
      }
      if (key === 'r') {
        this.player.standUp();
        this.hud.spawnHitText('STAND UP', this.player.getHeadPosition(), 'NORMAL');
        this.hud.showEventBanner('🥋 ATHLETE RECOVERED TO STANCE');
        return;
      }

      // Shadowboxing & Movement key triggers
      switch (key) {
        case 'j':
          this.player.throwJab();
          this.hud.spawnHitText('LEAD JAB', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'k':
          this.player.throwCross();
          this.hud.spawnHitText('POWER CROSS', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'u':
          this.player.throwHook();
          this.hud.spawnHitText('LEAD HOOK', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'i':
          this.player.throwUppercut();
          this.hud.spawnHitText('REAR UPPERCUT', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'l':
          this.player.throwHeadkick();
          this.hud.spawnHitText('HIGH HEADKICK', this.player.getHeadPosition(), 'ROCKED');
          break;
        case 'm':
          this.player.throwLowKick();
          this.hud.spawnHitText('LOW CHOP KICK', this.player.getHeadPosition(), 'NORMAL');
          break;
        case 'q':
          this.player.slip(-1);
          break;
        case 'e':
          this.player.slip(1);
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
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['w'] || this.keys['arrowup']) moveZ -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1;
    if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

    const isSprint = !!this.keys['shift'];

    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.hypot(moveX, moveZ);
      this.player.move(moveX / len, moveZ / len, isSprint);
    }
  }

  resetPlayerPosition() {
    this.player.reset(0, 0);
    this.cameraController.orbitYaw = 0;
    this.cameraController.orbitPitch = 0.25;
    this.cameraController.orbitDistance = 4.2;
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

    // 2. Active Ragdoll Balance Stabilization
    this.player.updateActiveRagdoll(delta);

    // 3. Physics Simulation Step (5 substeps for continuous contact resolution)
    this.world.step(1 / 60, delta, 5);

    // 4. Update Visual Meshes to Physics Transforms
    this.player.updateMeshTransforms();

    // 5. Dynamic Camera Updates (Smooth Solo Player Tracking)
    this.cameraController.update(delta, this.player, null);

    // 6. Movement Lab HUD Telemetry Updates
    this.hud.update(delta, this.player);

    // 7. Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap Game
window.addEventListener('DOMContentLoaded', () => {
  new UFCGame();
});
