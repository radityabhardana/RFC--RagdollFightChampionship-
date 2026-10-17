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
import { GameMenuManager } from './ui/GameMenuManager.js';
import { UFC_FIGHTERS } from './data/UFCFighters.js';
import { sounds } from './audio/SoundManager.js';

class RFCGame {
  constructor() {
    this.container = document.querySelector('#app');
    this.clock = new THREE.Clock();
    this.keys = {};

    this.initThree();
    this.initPhysics();
    this.initGameObjects();
    this.initMenus();
    this.initInput();
    this.initResize();

    // Start Audio on first interaction
    const initAudio = () => {
      sounds.init();
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
    this.scene.background = new THREE.Color(0x050608);
    this.scene.fog = new THREE.Fog(0x050608, 22, 78);

    // Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.3,
      110
    );
    this.camera.position.set(0, 1.35, 3.1);

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

    // Dynamic Camera Controller
    this.cameraController = new BroadcastCamera(this.camera, this.renderer.domElement);
  }

  initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 24;
    this.world.solver.tolerance = 0.0001;
  }

  initGameObjects() {
    // 1. Octagon Arena (Canvas, Cage, Posts, Stadium Lights)
    this.octagon = new Octagon(this.scene, this.world);

    // 2. Immersive 360° UFC Stadium Bleachers & Crowd
    this.crowd = new ArenaCrowd(this.scene);

    // Initial default fighters from UFC database (Conor McGregor vs Islam Makhachev)
    const defaultPlayer = UFC_FIGHTERS.find(f => f.id === 'conor_mcgregor') || UFC_FIGHTERS[0];
    const defaultOpponent = UFC_FIGHTERS.find(f => f.id === 'islam_makhachev') || UFC_FIGHTERS[1];

    // 3. Player Fighter (Red Corner)
    this.player = new RagdollFighter(this.scene, this.world, {
      ...defaultPlayer,
      isPlayer: true,
      corner: 'RED',
      startX: -1.35,
      startZ: 0,
      pantsColor: defaultPlayer.trunksColor,
    });

    // 4. Opponent Fighter (Blue Corner)
    this.dummy = new RagdollFighter(this.scene, this.world, {
      ...defaultOpponent,
      isPlayer: false,
      corner: 'BLUE',
      startX: 1.35,
      startZ: 0,
      pantsColor: defaultOpponent.trunksColor,
    });
    this.dummy.guardUp = true;

    // Link opponents
    this.player.setOpponent(this.dummy);
    this.player.setLockTarget(this.dummy);
    this.dummy.setOpponent(this.player);
    this.dummy.setLockTarget(this.player);

    this.setupContactMaterials();

    // 5. Biomechanical Combat Engine
    this.combatEngine = new CombatEngine(this.world, this.cameraController, null);
    this.combatEngine.crowd = this.crowd;

    // 6. Sparring AI Controller
    this.dummyAI = new FighterAI(this.dummy, this.player);
    this.dummyAI.setArchetype('PRESSURE');
    this.aiEnabled = true;

    // 7. In-game Broadcast HUD
    this.hud = new BroadcastHUD(this.container, {
      onResetPosition: () => this.resetPlayerPosition(),
      onToggleAI: () => this.toggleAI(),
      onSetRagdollMode: (mode) => {
        this.player.setRagdollMode(mode);
      },
      onKnockout: () => {
        this.dummy.knockout();
      },
      onStandUp: () => {
        this.dummy.standUp();
      },
    });
    this.combatEngine.hud = this.hud;

    // Initially hide the in-game HUD until player hits Start Fight
    if (this.hud) {
      this.hud.hide();
    }
  }

  setupContactMaterials() {
    const fighterToCanvasMat = new CANNON.ContactMaterial(this.player.fighterMat, this.octagon.groundMaterial, {
      friction: 0.86,
      restitution: 0.04,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(fighterToCanvasMat);

    const fighterToWallMat = new CANNON.ContactMaterial(this.player.fighterMat, this.octagon.wallMaterial, {
      friction: 0.72,
      restitution: 0.12,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(fighterToWallMat);

    const gloveToCanvasMat = new CANNON.ContactMaterial(this.player.gloveMat, this.octagon.groundMaterial, {
      friction: 0.80,
      restitution: 0.05,
    });
    this.world.addContactMaterial(gloveToCanvasMat);

    const fighterToFighterMat = new CANNON.ContactMaterial(this.player.fighterMat, this.dummy.fighterMat, {
      friction: 0.65,
      restitution: 0.05,
    });
    this.world.addContactMaterial(fighterToFighterMat);
  }

  initMenus() {
    this.menuManager = new GameMenuManager(this.container, {
      onGameStateChange: (screenName) => {
        if (screenName === 'IN_FIGHT') {
          this.restoreFightersForFight();
          if (this.hud) this.hud.show();
        } else {
          if (this.hud) this.hud.hide();
          if (screenName === 'TITLE') {
            this.setupTitleShowcase();
          } else {
            // Division / Character select screens: show fighters and stop emoting
            this.player.isEmoting = false;
            this.player.setVisible(true);
            if (this.dummy) {
              this.dummy.setVisible(true);
              this.dummy.rootPosition.set(1.35, 0, 0);
            }
          }
        }
      },
      onFighterSelected: (side, fighterProfile) => {
        this.rebuildFighter(side, fighterProfile);
      },
      onEmoteChange: (emoteType) => {
        if (this.player) {
          this.player.isEmoting = true;
          this.player.emoteType = emoteType;
          this.player.emoteTimer = 0;
        }
      },
      onAIDifficultyChange: (diff) => {
        if (this.dummyAI) {
          this.dummyAI.setDifficulty(diff);
        }
        if (this.hud && this.dummy) {
          const emojiMap = { ROOKIE: '🟢', PRO: '🟡', CHAMPION: '🔴', GOAT: '👑' };
          this.hud.spawnHitText(`CPU: ${emojiMap[diff]} ${diff}`, this.dummy.getHeadPosition(), 'NORMAL');
          this.hud.showEventBanner(`🤖 CPU DIFFICULTY SET TO: ${emojiMap[diff]} ${diff}`);
        }
      },
      onAIToggle: (enabled) => {
        this.aiEnabled = enabled;
        if (this.dummy) this.dummy.guardUp = enabled;
        const modeName = enabled ? '🥊 AI SPARRING PARTNER: ACTIVE' : '🎯 TRAINING DUMMY MODE: ACTIVE';
        if (this.hud && this.dummy) {
          this.hud.spawnHitText(enabled ? 'AI ACTIVE' : 'DUMMY MODE', this.dummy.getHeadPosition(), 'NORMAL');
          this.hud.showEventBanner(modeName);
        }
      },
      onStartFight: ({ playerFighter, opponentFighter, aiEnabled, aiDifficulty, ruleMode, arenaLighting }) => {
        this.restoreFightersForFight();
        this.aiEnabled = aiEnabled;
        this.rebuildFighter('RED', playerFighter);
        this.rebuildFighter('BLUE', opponentFighter);
        this.resetPlayerPosition();
        this.combatEngine.resetStats();
        this.combatEngine.ruleMode = ruleMode || 'RFC_STANDARD';
        if (this.dummyAI) {
          this.dummyAI.setDifficulty(aiDifficulty || 'PRO');
        }
        sounds.playBell();

        if (this.hud) {
          this.hud.setFighterNames(playerFighter.name, opponentFighter.name);
          const modeTag = ruleMode === 'SUDDEN_DEATH' ? 'SUDDEN DEATH (1 CLEAN KO)' : 'OFFICIAL RFC BOUT';
          this.hud.showEventBanner(`🥊 ROUND 1 [${modeTag}] - TOUCH GLOVES AND FIGHT!`);
        }
      },
    });

    this.combatEngine.gameMenuManager = this.menuManager;

    // Immediately trigger McGregor's solo emote on initial title load
    this.setupTitleShowcase();
  }

  setupTitleShowcase() {
    if (!this.player) return;

    // Ensure Conor McGregor is loaded as the showcase fighter
    if (this.player.fighterProfile?.id !== 'conor_mcgregor') {
      const conorProfile = UFC_FIGHTERS.find(f => f.id === 'conor_mcgregor') || UFC_FIGHTERS[0];
      this.rebuildFighter('RED', conorProfile);
    }

    this.player.isEmoting = true;
    this.player.emoteType = 'MCGREGOR_SWAGGER';
    // Offset Conor towards right-center so the left-side AAA menu navigation panel is unobstructed
    this.player.rootPosition.set(0.65, 0, -0.15);
    this.player.rootVelocity.set(0, 0, 0);
    this.player.facingAngle = -0.32;
    this.player.setVisible(true);

    // Opponent is hidden during title screen
    if (this.dummy) {
      this.dummy.setVisible(false);
      this.dummy.rootPosition.set(100, 0, 100);
      this.dummy.rootVelocity.set(0, 0, 0);
    }

    if (this.cameraController) {
      this.cameraController.setMode('SOLO_FOLLOW');
      this.cameraController.orbitYaw = 0;
      this.cameraController.orbitPitch = 0.04;
      this.cameraController.orbitDistance = 2.75;
    }
  }

  restoreFightersForFight() {
    if (!this.player) return;
    this.player.isEmoting = false;
    this.player.setVisible(true);

    if (this.dummy) {
      this.dummy.setVisible(true);
      this.dummy.rootPosition.set(1.35, 0, 0);
      this.dummy.rootVelocity.set(0, 0, 0);
      this.dummy.facingAngle = Math.PI;
    }

    if (this.cameraController) {
      this.cameraController.setMode('BROADCAST_SIDE');
    }
  }

  rebuildFighter(side, profile) {
    const isPlayer = side === 'RED';
    const oldFighter = isPlayer ? this.player : this.dummy;
    const startX = isPlayer ? -1.35 : 1.35;
    const corner = isPlayer ? 'RED' : 'BLUE';

    if (oldFighter) {
      oldFighter.destroy();
    }

    const newFighter = new RagdollFighter(this.scene, this.world, {
      ...profile,
      isPlayer,
      corner,
      startX,
      startZ: 0,
      pantsColor: profile.trunksColor,
    });

    if (isPlayer) {
      this.player = newFighter;
    } else {
      this.dummy = newFighter;
      this.dummy.guardUp = this.aiEnabled;
    }

    // Relink opponents
    this.player.setOpponent(this.dummy);
    this.player.setLockTarget(this.dummy);
    this.dummy.setOpponent(this.player);
    this.dummy.setLockTarget(this.player);

    // Setup AI archetype
    if (this.dummyAI) {
      this.dummyAI.fighter = this.dummy;
      this.dummyAI.opponent = this.player;

      const styleMap = {
        conor_mcgregor: 'SNIPER',
        ilia_topuria: 'SNIPER',
        max_holloway: 'BRAWLER',
        dustin_poirier: 'BRAWLER',
        dricus_du_plessis: 'BRAWLER',
        khabib_nurmagomedov: 'PRESSURE',
        islam_makhachev: 'PRESSURE',
        alex_pereira: 'KICKBOXER',
        israel_adesanya: 'KICKBOXER',
        jon_jones: 'SNIPER',
        jiri_prochazka: 'BRAWLER',
      };
      const arch = styleMap[this.dummy.fighterProfile?.id] || 'BRAWLER';
      this.dummyAI.setArchetype(arch);
    }

    if (this.hud) {
      this.hud.setFighterNames(this.player.name, this.dummy.name);
    }
  }

  toggleAI() {
    this.aiEnabled = !this.aiEnabled;
    this.dummy.guardUp = this.aiEnabled;
    if (this.menuManager) {
      this.menuManager.aiEnabled = this.aiEnabled;
      const btn = this.menuManager.root.querySelector('#btn-pause-toggle-ai');
      if (btn) {
        btn.classList.toggle('active', this.aiEnabled);
        btn.textContent = this.aiEnabled ? '🤖 AI SPARRING: AKTIF' : '🎯 DUMMY PASIF (NON-AKTIF)';
      }
    }
    const modeName = this.aiEnabled ? '🥊 AI SPARRING PARTNER: ACTIVE' : '🎯 TRAINING DUMMY MODE: ACTIVE';
    this.hud.spawnHitText(this.aiEnabled ? 'AI SPARRING' : 'DUMMY MODE', this.dummy.getHeadPosition(), 'NORMAL');
    this.hud.showEventBanner(modeName);
  }

  cycleAIDifficulty() {
    const diffs = ['ROOKIE', 'PRO', 'CHAMPION', 'GOAT'];
    const current = this.dummyAI ? this.dummyAI.difficulty : (this.menuManager ? this.menuManager.aiDifficulty : 'PRO');
    const nextIdx = (diffs.indexOf(current) + 1) % diffs.length;
    const nextDiff = diffs[nextIdx];

    if (this.menuManager) {
      this.menuManager.setAIDifficulty(nextDiff);
    } else if (this.dummyAI) {
      this.dummyAI.setDifficulty(nextDiff);
    }
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // Only process gameplay inputs when in-fight
      if (this.menuManager && this.menuManager.currentScreen !== 'IN_FIGHT') return;

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
      if (key === '9') {
        this.cycleAIDifficulty();
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
      if (key === 'q') {
        this.player.slip(-1, 'LATERAL');
        this.hud.spawnHitText('⚡ SLIP INSIDE (LEFT)', this.player.getHeadPosition(), 'NORMAL');
        return;
      }
      if (key === 'e') {
        this.player.slip(1, 'LATERAL');
        this.hud.spawnHitText('⚡ SLIP OUTSIDE (RIGHT)', this.player.getHeadPosition(), 'NORMAL');
        return;
      }
      if (key === 'r') {
        this.player.slipBack();
        this.hud.spawnHitText(this.player.isBlocking ? '🛡️ GUARDED PULL SLIP' : '⚡ PULL-COUNTER SLIP', this.player.getHeadPosition(), 'NORMAL');
        return;
      }
      if (key === 'f') {
        this.player.setBlocking(true);
        this.hud.spawnHitText('🛡️ HIGH GUARD', this.player.getHeadPosition(), 'NORMAL');
        return;
      }
      if (key === 'p') {
        this.toggleAI();
        return;
      }

      // Striking triggers
      switch (key) {
        case 'j': {
          if (this.keys['r'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          const isSlipDown = isSlip && this.player.slipType === 'DOWN';
          this.player.throwJab();
          this.hud.recordStrikeAttempt('JAB');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          const hitName = isSlipDown ? 'DUCK COUNTER JAB' : (isSlipBack ? 'PULL-COUNTER JAB' : (isSlip ? 'SLIP LEAD JAB' : 'LEAD JAB'));
          this.hud.spawnHitText(comboPrefix + hitName, this.player.getHeadPosition(), (isSlipBack || isSlipDown || this.player.comboCount > 1) ? 'ROCKED' : 'NORMAL');
          break;
        }
        case 'k': {
          if (this.keys['r'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          const isSlipDown = isSlip && this.player.slipType === 'DOWN';
          this.player.throwCross();
          this.hud.recordStrikeAttempt('CROSS');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          const hitName = isSlipDown ? '⚡ DUCK COUNTER CROSS' : (isSlipBack ? '⚡ PULL-COUNTER CROSS' : (isSlip ? 'SLIP COUNTER CROSS' : 'POWER CROSS'));
          this.hud.spawnHitText(comboPrefix + hitName, this.player.getHeadPosition(), 'ROCKED');
          break;
        }
        case 'u': {
          if (this.keys['f'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          const isSlipDown = isSlip && this.player.slipType === 'DOWN';
          this.player.throwHook();
          this.hud.recordStrikeAttempt('HOOK');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          const hitName = isSlipDown ? '⚡ DUCK COUNTER HOOK' : (isSlipBack ? 'PULL-COUNTER HOOK' : (isSlip ? 'SLIP COUNTER HOOK' : 'LEAD HOOK'));
          this.hud.spawnHitText(comboPrefix + hitName, this.player.getHeadPosition(), 'ROCKED');
          break;
        }
        case 'i': {
          if (this.keys['f'] || (this.keys['s'] && (this.keys['q'] || this.keys['e']))) this.player.slipBack();
          else if (this.keys['q']) this.player.slip(-1);
          else if (this.keys['e']) this.player.slip(1);
          const isSlip = this.player.slipTimer > 0;
          const isSlipBack = isSlip && this.player.slipType === 'BACK';
          const isSlipDown = isSlip && this.player.slipType === 'DOWN';
          this.player.throwUppercut();
          this.hud.recordStrikeAttempt('UPPERCUT');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          const hitName = isSlipDown ? '⚡ DUCK COUNTER UPPERCUT' : (isSlipBack ? '⚡ PULL-COUNTER UPPERCUT' : (isSlip ? 'SLIP UPPERCUT' : 'POWER UPPERCUT'));
          this.hud.spawnHitText(comboPrefix + hitName, this.player.getHeadPosition(), 'ROCKED');
          break;
        }
        case 'h': {
          this.player.throwOverhand();
          this.hud.recordStrikeAttempt('OVERHAND');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          this.hud.spawnHitText(comboPrefix + '💥 OVERHAND BOMB', this.player.getHeadPosition(), 'ROCKED');
          break;
        }
        case 'm': {
          this.player.throwHeadkick();
          this.hud.recordStrikeAttempt('HEADKICK');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          this.hud.spawnHitText(comboPrefix + '⚡ HIGH HEADKICK', this.player.getHeadPosition(), 'ROCKED');
          break;
        }
        case 'n': {
          this.player.throwLowKick();
          this.hud.recordStrikeAttempt('LOWKICK');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          this.hud.spawnHitText(comboPrefix + 'CALF KICK', this.player.getHeadPosition(), 'NORMAL');
          break;
        }
        case 'b': {
          this.player.throwBodyKick();
          this.hud.recordStrikeAttempt('BODYKICK');
          const comboPrefix = this.player.comboCount > 1 ? `🔥 COMBO x${this.player.comboCount}: ` : '';
          this.hud.spawnHitText(comboPrefix + 'BODY ROUNDHOUSE', this.player.getHeadPosition(), 'NORMAL');
          break;
        }
        case 't': {
          this.player.throwTeep();
          this.hud.recordStrikeAttempt('TEEP');
          this.hud.spawnHitText('FRONT PUSH TEEP', this.player.getHeadPosition(), 'NORMAL');
          break;
        }
        case 'z': {
          const newStance = this.player.switchStance();
          this.hud.spawnHitText(`STANCE: ${newStance}`, this.player.getHeadPosition(), 'NORMAL');
          break;
        }
        case 'x': {
          this.player.slipDown();
          this.hud.spawnHitText('⚡ DUCK / DIP', this.player.getHeadPosition(), 'NORMAL');
          break;
        }
        case 'c': {
          this.player.crouch(true);
          this.hud.spawnHitText('CROUCH LEVEL CHANGE', this.player.getHeadPosition(), 'NORMAL');
          break;
        }
        case ' ': {
          this.player.jump();
          this.hud.spawnHitText('STANCE HOP', this.player.getHeadPosition(), 'NORMAL');
          break;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
      if (key === 'f') {
        this.player.setBlocking(false);
      }
      if (key === 'c') {
        this.player.crouch(false);
      }
    });
  }

  handlePlayerMovement() {
    if (this.menuManager && this.menuManager.currentScreen !== 'IN_FIGHT') {
      this.player.move(0, 0, false);
      return;
    }

    let inputX = 0; // Screen Horizontal: -1 = Left (A), +1 = Right (D)
    let inputZ = 0; // Screen Depth: +1 = Forward into canvas (W), -1 = Backward toward camera (S)

    if (this.keys['w'] || this.keys['arrowup']) inputZ += 1;
    if (this.keys['s'] || this.keys['arrowdown']) inputZ -= 1;
    if (this.keys['a'] || this.keys['arrowleft']) inputX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) inputX += 1;

    const isSprint = !!this.keys['shift'];

    if (inputX !== 0 || inputZ !== 0) {
      // Calculate true Camera-Relative movement vector
      const camForward = new THREE.Vector3();
      this.camera.getWorldDirection(camForward);
      camForward.y = 0;
      camForward.normalize();

      const camRight = new THREE.Vector3();
      camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

      // Combined world movement vector:
      // inputX moves along camRight (A = left, D = right)
      // inputZ moves along camForward (W = forward, S = backward)
      const worldX = camRight.x * inputX + camForward.x * inputZ;
      const worldZ = camRight.z * inputX + camForward.z * inputZ;

      const moveLen = Math.hypot(worldX, worldZ);
      if (moveLen > 0.001) {
        this.player.move(worldX / moveLen, worldZ / moveLen, isSprint);
      } else {
        this.player.move(0, 0, false);
      }
    } else {
      this.player.move(0, 0, false);
    }
  }

  resetPlayerPosition() {
    this.player.reset(-1.35, 0);
    this.dummy.reset(1.35, 0);
    this.player.facingAngle = 0;
    this.dummy.facingAngle = Math.PI;
    if (this.cameraController) {
      this.cameraController.resetToBroadcast(this.player, this.dummy);
    }
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

    const isInFight = this.menuManager && this.menuManager.currentScreen === 'IN_FIGHT';

    if (isInFight) {
      // 1. In-Fight Movement Inputs
      this.handlePlayerMovement();

      // 2. Sparring AI Decision Logic
      if (this.aiEnabled && !this.dummy.isKnockedOut && this.dummy.state !== 'KO') {
        this.dummyAI.update(delta);
      }

      // 2.5 Solid Personal Space Capsule Collision
      this.combatEngine.resolveFighterInterpenetration(this.player, this.dummy, delta);

      // 3. Build the kinematic reference poses
      this.player.planReferencePose(delta);
      this.dummy.planReferencePose(delta);

      // 4. Physics Simulation Step
      this.world.step(1 / 60, delta, 5);

      // 4.5 Continuous Strike Hit Detection
      this.combatEngine.checkStrikesProximity(this.player, this.dummy);
      this.combatEngine.checkStrikesProximity(this.dummy, this.player);

      // 5. Update Visual Meshes to Physics Transforms
      this.player.updateMeshTransforms();
      this.dummy.updateMeshTransforms();

      // 6. Dynamic Camera Updates
      this.cameraController.update(delta, this.player, this.dummy);

      // 8. HUD Updates
      this.hud.update(delta, this.player, this.dummy, this.aiEnabled);
    } else {
      const isTitleScreen = this.menuManager && this.menuManager.currentScreen === 'TITLE';
      if (isTitleScreen) {
        // Conor McGregor Solo Swagger Emote in Title Screen
        const time = this.clock.getElapsedTime();
        const posX = 0.65 + Math.sin(time * 0.28) * 0.12;
        this.camera.position.set(posX, 1.40, 2.75);
        this.camera.lookAt(0.65, 1.30, -0.15);

        this.player.planReferencePose(delta);
        this.player.updateMeshTransforms();
      } else {
        // Cinematic 3D Turntable Showcase in Menus
        const time = this.clock.getElapsedTime();
        const angle = time * 0.15;
        const radius = 3.3;
        this.camera.position.set(Math.sin(angle) * radius, 1.48, Math.cos(angle) * radius);
        this.camera.lookAt(0, 1.25, 0);

        this.player.planReferencePose(delta);
        this.dummy.planReferencePose(delta);
        this.player.updateMeshTransforms();
        this.dummy.updateMeshTransforms();
      }
    }

    // 7. Dynamic Stadium Crowd
    if (this.crowd) {
      this.crowd.update(delta, this.clock.getElapsedTime());
    }

    // 9. Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap Game
window.addEventListener('DOMContentLoaded', () => {
  new RFCGame();
});
