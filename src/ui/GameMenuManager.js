import { UFC_DIVISIONS, UFC_FIGHTERS } from '../data/UFCFighters.js';
import { sounds } from '../audio/SoundManager.js';

/**
 * RFC (Ragdoll Fighting Championship) Multi-Stage Menu & Fight Flow Manager
 * 
 * Phased Console AAA Step-by-Step Experience:
 * Step 1: Main Title Screen - Modern Game UI with McGregor Spotlight Swagger Emote
 * Step 2: Weight Class / Division Select (Featherweight, Lightweight, Middleweight, Light Heavyweight)
 * Step 3: Red Corner (Player 1) Fighter Selection & Lock-In
 * Step 4: Blue Corner (Opponent / CPU) Selection, AI Difficulty (Rookie, Pro, Champion) & Lock-In
 * Step 5: Bout Settings (Rounds: 3 vs 5, Knockdown Rules, Arena Lighting)
 * Step 6: Tale of the Tape & Bruce Buffer Official Intro
 * Step 7: Octagon In-Fight with full RFC Broadcast HUD
 * Step 8: In-Game Pause Menu (ESC)
 * Step 9: Post-Fight Official Decision / KO Screen
 */
export class GameMenuManager {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks; // onStartFight, onFighterSelected, onGameStateChange

    // Fight Config & State
    this.currentScreen = 'TITLE';
    this.gameMode = 'FIGHT_NOW';
    this.selectedDivisionId = 'LIGHTWEIGHT';
    this.playerFighter = UFC_FIGHTERS.find(f => f.id === 'conor_mcgregor') || UFC_FIGHTERS[0];
    this.opponentFighter = UFC_FIGHTERS.find(f => f.id === 'islam_makhachev') || UFC_FIGHTERS[1];
    
    this.aiDifficulty = 'PRO'; // 'ROOKIE' | 'PRO' | 'CHAMPION'
    this.aiEnabled = true;
    this.roundCount = 5; // 3 or 5 rounds
    this.ruleMode = 'UFC_STANDARD'; // 'UFC_STANDARD' | 'SUDDEN_DEATH'
    this.arenaLighting = 'VEGAS'; // 'VEGAS' | 'APEX'

    // Match telemetry stats
    this.matchStats = {
      winner: null,
      method: 'KNOCKOUT',
      roundTime: '1:45',
      playerStrikes: 0,
      opponentStrikes: 0,
      playerDamage: 0,
      opponentDamage: 0,
      playerKnockdowns: 0,
      opponentKnockdowns: 0,
    };

    this.loadSettings();
    this.initDOM();
    this.bindEvents();
    this.syncSettingsUI();
    this.showScreen('TITLE');
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('RFC_BOUT_SETTINGS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.roundCount) this.roundCount = parsed.roundCount;
        if (parsed.ruleMode) this.ruleMode = parsed.ruleMode;
        if (parsed.arenaLighting) this.arenaLighting = parsed.arenaLighting;
        if (parsed.aiDifficulty) this.aiDifficulty = parsed.aiDifficulty;
      }
    } catch (e) {
      console.warn('Could not load saved bout settings:', e);
    }
  }

  saveSettings() {
    try {
      const payload = {
        roundCount: this.roundCount,
        ruleMode: this.ruleMode,
        arenaLighting: this.arenaLighting,
        aiDifficulty: this.aiDifficulty,
      };
      localStorage.setItem('RFC_BOUT_SETTINGS', JSON.stringify(payload));
    } catch (e) {
      console.warn('Could not save bout settings:', e);
    }
  }

  getWizardHTML(activeStep = 1) {
    const steps = [
      { num: 1, label: 'Mode' },
      { num: 2, label: 'RFC Division' },
      { num: 3, label: 'Fighter (P1)' },
      { num: 4, label: 'Opponent (CPU)' },
      { num: 5, label: 'Tale of Tape' },
    ];

    return `
      <div class="ufc-step-wizard">
        ${steps.map((st, i) => {
          const isDone = st.num < activeStep;
          const isActive = st.num === activeStep;
          const cls = isActive ? 'active' : (isDone ? 'done' : '');
          const check = isDone ? '✓ ' : `${st.num}. `;
          const arrow = i < steps.length - 1 ? `<span class="step-arrow">➔</span>` : '';
          return `
            <div class="step-item ${cls}">
              <span>${check}${st.label}</span>
            </div>
            ${arrow}
          `;
        }).join('')}
      </div>
    `;
  }

  initDOM() {
    this.root = document.createElement('div');
    this.root.className = 'ufc-menu-system-root';
    this.root.innerHTML = `
      <!-- ================================================================= -->
      <!-- 1. TITLE SCREEN: CONSOLE AAA MODERN MAIN MENU                     -->
      <!-- ================================================================= -->
      <div class="menu-screen title-screen active" id="screen-title">
        <!-- Top Left Brand Badge -->
        <header class="title-top-brand">
          <div class="rfc-logo-box">
            <span class="rfc-logo-text">RFC</span>
            <div class="rfc-sub-badge">CHAMPIONSHIP</div>
          </div>
          <div class="title-headline-group">
            <h1 class="rfc-title-text">RAGDOLL FIGHTING CHAMPIONSHIP</h1>
            <span class="rfc-sub-headline">OFFICIAL NEXT-GEN 3D BIOMECHANICAL COMBAT SIMULATOR</span>
          </div>
        </header>

        <!-- Left Modern Game Menu Sidebar -->
        <div class="title-menu-panel">
          <div class="panel-eyebrow">SELECT GAME MODE</div>
          <div class="title-nav-buttons">
            <button class="nav-btn primary" id="btn-mode-fightnow">
              <span class="btn-glow-bar"></span>
              <span class="btn-num">01</span>
              <div class="btn-text-wrap">
                <span class="btn-title">FIGHT NOW</span>
                <span class="btn-sub">Official RFC 3 or 5 Round Bout</span>
              </div>
              <span class="btn-arrow">➔</span>
            </button>
            <button class="nav-btn" id="btn-nav-roster">
              <span class="btn-glow-bar"></span>
              <span class="btn-num">02</span>
              <div class="btn-text-wrap">
                <span class="btn-title">FIGHTER ROSTER</span>
                <span class="btn-sub">12 Legendary Fighters in 4 RFC Divisions</span>
              </div>
              <span class="btn-arrow">➔</span>
            </button>

            <button class="nav-btn" id="btn-nav-controls">
              <span class="btn-glow-bar"></span>
              <span class="btn-num">03</span>
              <div class="btn-text-wrap">
                <span class="btn-title">CONTROLS GUIDE</span>
                <span class="btn-sub">Strike, Kick & Head Movement Keybindings</span>
              </div>
              <span class="btn-arrow">➔</span>
            </button>
          </div>
        </div>

        <!-- Controls Modal (Popup when clicking Controls Guide) -->
        <div class="controls-modal" id="modal-controls" style="display: none;">
          <div class="modal-card">
            <div class="modal-header">
              <h3>RFC COMPLETE CONTROLS GUIDE</h3>
              <button class="modal-close" id="btn-close-controls">×</button>
            </div>
            <div class="modal-body-controls">
              <div class="ctrl-group">
                <h4>MOVEMENT & FOOTWORK (WASD / ARROWS)</h4>
                <p><strong>W/A/S/D</strong> or Arrows: Dynamic footwork & repositioning</p>
                <p><strong>SHIFT + A/D</strong>: Sprint & close distance</p>
                <p><strong>SPACE</strong>: Stance Hop</p>
                <p><strong>C</strong>: Crouch / Duck Level Change</p>
                <p><strong>Z</strong>: Switch Stance (Orthodox / Southpaw)</p>
              </div>
              <div class="ctrl-group">
                <h4>PUNCHES (HAND STRIKES)</h4>
                <p><strong>J</strong>: Lead Jab (Fast, 6 stamina)</p>
                <p><strong>K</strong>: Rear Cross / Straight (Power, 11 stamina)</p>
                <p><strong>U</strong>: Lead Hook (Side arc, 14 stamina)</p>
                <p><strong>I</strong>: Rear Uppercut (Chin lift, 13 stamina)</p>
                <p><strong>H</strong>: Overhand Bomb (KO Power, 19 stamina)</p>
              </div>
              <div class="ctrl-group">
                <h4>KICKS</h4>
                <p><strong>L</strong>: High Headkick (Head damage, 23 stamina)</p>
                <p><strong>B</strong>: Body Roundhouse Kick (Rib damage & stamina drain)</p>
                <p><strong>M</strong> / <strong>N</strong>: Chopping Low Legkick (Compromise opponent legs)</p>
                <p><strong>T</strong>: Front Push Teep (Push opponent back)</p>
              </div>
              <div class="ctrl-group">
                <h4>DEFENSE & SLIPS</h4>
                <p><strong>F</strong> (Hold): Double High Guard Block</p>
                <p><strong>Q</strong>: Deep Slip Inside (Slip left)</p>
                <p><strong>E</strong>: Deep Slip Outside (Slip right)</p>
                <p><strong>R</strong>: Pull Slip (Lean back counter)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 2. DIVISION SELECTION (WEIGHT CLASS)                              -->
      <!-- ================================================================= -->
      <div class="menu-screen division-screen" id="screen-division">
        <div id="wizard-slot-division"></div>
        <div class="menu-header-bar">
          <button class="ufc-btn-back" id="btn-div-back">‹ MAIN MENU</button>
          <div class="menu-title-group">
            <span class="menu-eyebrow">STEP 2 OF 5</span>
            <h2 class="menu-main-title">SELECT RFC WEIGHT CLASS & DIVISION</h2>
          </div>
          <div class="division-badge-slot">
            <button class="ufc-btn-gold btn-div-settings" id="btn-open-bout-settings">
              <span>BOUT & BOT SETTINGS</span>
            </button>
          </div>
        </div>

        <div class="division-grid" id="division-cards-container"></div>

        <!-- POPUP MODAL: BOUT RULES & BOT SPECS (PERSISTENT SETTINGS) -->
        <div class="controls-modal settings-modal-overlay" id="modal-bout-settings" style="display: none;">
          <div class="modal-card settings-modal-card">
            <div class="modal-header">
              <div class="modal-title-wrap">
                <span class="modal-eyebrow">SAVED PRESET (PERSISTENT)</span>
                <h3>BOUT SETTINGS & BOT SPECIFICATIONS</h3>
              </div>
              <button class="modal-close" id="btn-close-bout-settings">×</button>
            </div>
            <div class="modal-body-settings">
              <div class="settings-grid">
                <!-- 1. Rounds -->
                <div class="setting-card">
                  <h3 class="setting-card-title">ROUND COUNT</h3>
                  <button class="setting-option-btn active" id="opt-rounds-5" data-rounds="5">
                    <span>5 ROUNDS (TITLE FIGHT)</span>
                    <span class="opt-sub">Standard RFC Championship Main Event</span>
                  </button>
                  <button class="setting-option-btn" id="opt-rounds-3" data-rounds="3">
                    <span>3 ROUNDS (MAIN CARD)</span>
                    <span class="opt-sub">Fast-paced standard bout</span>
                  </button>
                </div>

                <!-- 2. Knockdown Rules -->
                <div class="setting-card">
                  <h3 class="setting-card-title">KNOCKOUT RULES</h3>
                  <button class="setting-option-btn active" id="opt-rule-tko" data-rule="UFC_STANDARD">
                    <span>RFC STANDARD (3 FLASH KD)</span>
                    <span class="opt-sub">Scramble recover from canvas until TKO</span>
                  </button>
                  <button class="setting-option-btn" id="opt-rule-sudden" data-rule="SUDDEN_DEATH">
                    <span>SUDDEN DEATH (1 CLEAN KO)</span>
                    <span class="opt-sub">First clean knockout ends the bout</span>
                  </button>
                </div>

                <!-- 3. Lighting & Venue -->
                <div class="setting-card">
                  <h3 class="setting-card-title">VENUE & LIGHTING</h3>
                  <button class="setting-option-btn active" id="opt-venue-vegas" data-venue="VEGAS">
                    <span>LAS VEGAS SHOWCASE</span>
                    <span class="opt-sub">Bright arena floodlights & cheering crowd</span>
                  </button>
                  <button class="setting-option-btn" id="opt-venue-apex" data-venue="APEX">
                    <span>RFC APEX (DARK MOODY)</span>
                    <span class="opt-sub">Focused dark canvas & acoustic reverb</span>
                  </button>
                </div>

                <!-- 4. CPU AI Difficulty Setting -->
                <div class="setting-card">
                  <h3 class="setting-card-title">AI DIFFICULTY</h3>
                  <button class="setting-option-btn" id="opt-ai-rookie" data-aidiff="ROOKIE">
                    <span>ROOKIE (BEGINNER)</span>
                    <span class="opt-sub">Slow reaction, rare slips & 1-hit strikes</span>
                  </button>
                  <button class="setting-option-btn active" id="opt-ai-pro" data-aidiff="PRO">
                    <span>PRO RFC (STANDARD)</span>
                    <span class="opt-sub">Disciplined defense & 2-strike combos</span>
                  </button>
                  <button class="setting-option-btn" id="opt-ai-champion" data-aidiff="CHAMPION">
                    <span>CHAMPION (ELITE)</span>
                    <span class="opt-sub">Active slip-counters, 82% block & 3-strike combos</span>
                  </button>
                  <button class="setting-option-btn" id="opt-ai-goat" data-aidiff="GOAT">
                    <span>GOAT (LEGENDARY)</span>
                    <span class="opt-sub">Lightning 60ms reaction, pull-counters & 95% block</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer-settings">
              <span class="save-status-indicator">Preset saved automatically on device</span>
              <button class="ufc-btn-gold" id="btn-close-save-settings">SAVE & CLOSE</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 3. FIGHTER SELECT P1 (RED CORNER)                                 -->
      <!-- ================================================================= -->
      <div class="menu-screen fighter-screen" id="screen-fighter-p1">
        <div id="wizard-slot-p1"></div>
        <div class="menu-header-bar">
          <button class="ufc-btn-back" id="btn-p1-back">‹ CHANGE DIVISION</button>
          <div class="menu-title-group">
            <span class="menu-eyebrow" id="p1-div-heading">LIGHTWEIGHT DIVISION</span>
            <h2 class="menu-main-title">CHOOSE YOUR FIGHTER (RED CORNER)</h2>
          </div>
          <button class="ufc-btn-gold" id="btn-p1-lockin-top">
            <span>LOCK IN FIGHTER (P1) ➔</span>
          </button>
        </div>

        <div class="fighter-single-stage">
          <!-- Spotlight Column (Left) -->
          <div class="fighter-spotlight-card red" id="p1-spotlight-card">
            <div class="spotlight-header">
              <span class="spotlight-corner-tag red">RED CORNER (PLAYER)</span>
              <span class="select-hint-tag">CURRENT SELECTION</span>
            </div>
            <h3 class="spotlight-side-name" id="p1-hero-name">CONOR MCGREGOR</h3>
            <span class="spotlight-side-nick" id="p1-hero-nick">"THE NOTORIOUS"</span>

            <div class="spotlight-meta-row">
              <span id="p1-hero-country">IRELAND</span>
              <span id="p1-hero-record">22-6-0</span>
              <span id="p1-hero-stance">SOUTHPAW</span>
              <span id="p1-hero-rank">CHAMPION</span>
            </div>

            <div class="spotlight-bio-box">
              <p id="p1-hero-bio">Lethal counter-striker with surgical left-hand straight and lightning KO power.</p>
            </div>

            <div class="fighter-stat-bars" id="p1-hero-stats"></div>

            <div class="spotlight-lockin-area">
              <button class="ufc-btn-gold btn-lockin" id="btn-p1-lockin">
                LOCK IN FIGHTER (P1) ➔
              </button>
            </div>
          </div>

          <!-- Roster Grid Column (Right) -->
          <div class="roster-browser">
            <div class="roster-grid" id="p1-roster-grid"></div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 4. FIGHTER SELECT CPU (BLUE CORNER)                               -->
      <!-- ================================================================= -->
      <div class="menu-screen fighter-screen" id="screen-fighter-cpu">
        <div id="wizard-slot-cpu"></div>
        <div class="menu-header-bar">
          <button class="ufc-btn-back" id="btn-cpu-back">‹ CHANGE YOUR FIGHTER</button>
          <div class="menu-title-group">
            <span class="menu-eyebrow" id="cpu-div-heading">LIGHTWEIGHT DIVISION</span>
            <h2 class="menu-main-title">SELECT OPPONENT & CHALLENGE (BLUE CORNER)</h2>
          </div>
          <button class="ufc-btn-gold" id="btn-cpu-lockin-top">
            <span>LOCK IN OPPONENT (CPU) ➔</span>
          </button>
        </div>

        <div class="fighter-single-stage">
          <!-- Spotlight Column (Left) -->
          <div class="fighter-spotlight-card blue" id="cpu-spotlight-card">
            <div class="spotlight-header">
              <span class="spotlight-corner-tag blue">BLUE CORNER (OPPONENT)</span>
              <span class="select-hint-tag">OPPONENT SELECTION</span>
            </div>
            <h3 class="spotlight-side-name" id="cpu-hero-name">ISLAM MAKHACHEV</h3>
            <span class="spotlight-side-nick" id="cpu-hero-nick">"THE EAGLE HEIR"</span>

            <div class="spotlight-meta-row">
              <span id="cpu-hero-country">RUSSIA</span>
              <span id="cpu-hero-record">26-1-0</span>
              <span id="cpu-hero-stance">SOUTHPAW</span>
              <span id="cpu-hero-rank">CHAMPION</span>
            </div>

            <!-- AI Difficulty Selection Pills -->
            <div class="ai-diff-container" id="ai-diff-container">
              <span class="ai-diff-title">AI DIFFICULTY:</span>
              <div class="ai-diff-pills">
                <button class="diff-pill" data-diff="ROOKIE">ROOKIE</button>
                <button class="diff-pill active" data-diff="PRO">PRO RFC</button>
                <button class="diff-pill" data-diff="CHAMPION">CHAMPION</button>
                <button class="diff-pill" data-diff="GOAT">GOAT</button>
              </div>
            </div>

            <div class="spotlight-bio-box">
              <p id="cpu-hero-bio">Dominant sambo master with smothering top control and heavy head kicks.</p>
            </div>

            <div class="fighter-stat-bars" id="cpu-hero-stats"></div>

            <div class="spotlight-lockin-area">
              <button class="ufc-btn-gold btn-lockin" id="btn-cpu-lockin">
                LOCK IN OPPONENT (CPU) ➔
              </button>
            </div>
          </div>

          <!-- Roster Grid Column (Right) -->
          <div class="roster-browser">
            <div class="roster-grid" id="cpu-roster-grid"></div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 5. TALE OF THE TAPE INTRO SCREEN                                  -->
      <!-- ================================================================= -->
      <div class="menu-screen tale-screen" id="screen-tale">
        <div id="wizard-slot-tale"></div>
        <div class="tale-content-container">
          <div class="menu-header-bar" style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
            <button class="ufc-btn-back" id="btn-tale-back">‹ CHANGE OPPONENT (CPU)</button>
            <div class="menu-title-group">
              <span class="menu-eyebrow">STEP 5 OF 5</span>
              <h2 class="menu-main-title" style="font-size: 20px; margin: 0;">OFFICIAL RFC BOUT INTRO</h2>
            </div>
            <div class="division-badge-slot">RFC FIGHT NIGHT</div>
          </div>
          <div class="tale-header">
            <span class="tale-event" id="tale-round-banner">RFC CHAMPIONSHIP BOUT • 5 ROUNDS</span>
            <h2 class="tale-division" id="tale-division-title">LIGHTWEIGHT CHAMPIONSHIP</h2>
          </div>

          <div class="tale-columns-wrapper">
            <!-- Red Fighter Tale -->
            <div class="tale-column red">
              <span class="tale-corner-label">RED CORNER</span>
              <h3 class="tale-name" id="tale-red-name">CONOR MCGREGOR</h3>
              <span class="tale-nick" id="tale-red-nick">"THE NOTORIOUS"</span>
              <div class="tale-stats-list">
                <div class="tale-stat-row"><span class="lbl">RECORD</span><strong class="val" id="tale-red-rec">22-6-0</strong></div>
                <div class="tale-stat-row"><span class="lbl">HEIGHT</span><strong class="val" id="tale-red-ht">5'9" (175 cm)</strong></div>
                <div class="tale-stat-row"><span class="lbl">REACH</span><strong class="val" id="tale-red-reach">74" (188 cm)</strong></div>
                <div class="tale-stat-row"><span class="lbl">STANCE</span><strong class="val" id="tale-red-stance">SOUTHPAW</strong></div>
              </div>
            </div>

            <!-- VS Center Graphic -->
            <div class="tale-center-vs">
              <div class="vs-circle">VS</div>
              <div class="tale-belt-badge">CHAMPIONSHIP</div>
              <span class="tale-tap-hint">CLICK / PRESS [SPACE] TO TOUCH GLOVES</span>
            </div>

            <!-- Blue Fighter Tale -->
            <div class="tale-column blue">
              <span class="tale-corner-label">BLUE CORNER</span>
              <h3 class="tale-name" id="tale-blue-name">ISLAM MAKHACHEV</h3>
              <span class="tale-nick" id="tale-blue-nick">"THE EAGLE HEIR"</span>
              <div class="tale-stats-list">
                <div class="tale-stat-row"><span class="lbl">RECORD</span><strong class="val" id="tale-blue-rec">26-1-0</strong></div>
                <div class="tale-stat-row"><span class="lbl">HEIGHT</span><strong class="val" id="tale-blue-ht">5'10" (178 cm)</strong></div>
                <div class="tale-stat-row"><span class="lbl">REACH</span><strong class="val" id="tale-blue-reach">70" (178 cm)</strong></div>
                <div class="tale-stat-row"><span class="lbl">STANCE</span><strong class="val" id="tale-blue-stance">SOUTHPAW</strong></div>
              </div>
            </div>
          </div>

          <div class="tale-touch-gloves-btn">
            <button class="ufc-btn-gold pulse-btn" id="btn-touch-gloves">
              TOUCH GLOVES & ENTER OCTAGON (SPACE)
            </button>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 7. PAUSE MENU OVERLAY (ESC)                                       -->
      <!-- ================================================================= -->
      <div class="menu-screen pause-screen" id="screen-pause">
        <div class="pause-card">
          <div class="pause-top-badge">RFC BOUT PAUSED</div>
          <h2 class="pause-title">BOUT PAUSED</h2>

          <!-- Live CPU AI Capability Tuning in Pause Screen -->
          <div class="pause-settings-box">
            <span class="pause-settings-title">CPU AI DIFFICULTY:</span>
            <div class="pause-diff-pills" id="pause-ai-diff-pills">
              <button class="pause-diff-btn" data-diff="ROOKIE">ROOKIE</button>
              <button class="pause-diff-btn active" data-diff="PRO">PRO</button>
              <button class="pause-diff-btn" data-diff="CHAMPION">CHAMPION</button>
              <button class="pause-diff-btn" data-diff="GOAT">GOAT</button>
            </div>
          </div>

          <div class="pause-actions">
            <button class="ufc-btn-gold" id="btn-pause-resume">RESUME BOUT (ESC)</button>
            <button class="ufc-btn-dark" id="btn-pause-restart">RESTART ROUND</button>
            <button class="ufc-btn-dark" id="btn-pause-change">CHANGE FIGHTERS</button>
            <button class="ufc-btn-dark" id="btn-pause-main">MAIN MENU</button>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 8. POST-FIGHT OFFICIAL DECISION / KO SCREEN                       -->
      <!-- ================================================================= -->
      <div class="menu-screen result-screen" id="screen-result">
        <div class="result-card">
          <div class="bruce-buffer-banner">
            <span class="buffer-tag">OFFICIAL RESULT</span>
            <h2 class="buffer-verdict" id="res-verdict">KNOCKOUT! (OUT COLD)</h2>
            <p class="buffer-announcement" id="res-announcement">
              "AND THE WINNER BY KNOCKOUT... CONOR 'THE NOTORIOUS' MCGREGOR!"
            </p>
          </div>

          <div class="result-stats-table">
            <div class="res-col red">
              <h4 id="res-red-name">CONOR MCGREGOR</h4>
              <div class="res-stat-row"><span>SIG. STRIKES:</span><strong id="res-red-strikes">18</strong></div>
              <div class="res-stat-row"><span>TOTAL DAMAGE:</span><strong id="res-red-dmg">142 DMG</strong></div>
              <div class="res-stat-row"><span>KNOCKDOWNS:</span><strong id="res-red-kd">2</strong></div>
            </div>

            <div class="res-col-center">
              <span class="res-round-tag">ROUND 1</span>
              <span class="res-time-tag" id="res-time">TIME: 1:48</span>
              <div class="res-belt-badge">RFC OFFICIAL</div>
            </div>

            <div class="res-col blue">
              <h4 id="res-blue-name">ISLAM MAKHACHEV</h4>
              <div class="res-stat-row"><span>SIG. STRIKES:</span><strong id="res-blue-strikes">12</strong></div>
              <div class="res-stat-row"><span>TOTAL DAMAGE:</span><strong id="res-blue-dmg">98 DMG</strong></div>
              <div class="res-stat-row"><span>KNOCKDOWNS:</span><strong id="res-blue-kd">1</strong></div>
            </div>
          </div>

          <div class="result-actions">
            <button class="ufc-btn-gold" id="btn-res-rematch">REMATCH</button>
            <button class="ufc-btn-dark" id="btn-res-newfight">SELECT NEW FIGHTERS</button>
            <button class="ufc-btn-dark" id="btn-res-menu">MAIN MENU</button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.root);
  }

  bindEvents() {
    // Mode Buttons on Title Screen
    this.root.querySelector('#btn-mode-fightnow').addEventListener('click', () => {
      sounds.playMenuClick();
      this.gameMode = 'FIGHT_NOW';
      this.aiEnabled = true;
      this.ruleMode = 'UFC_STANDARD';
      this.showScreen('DIVISION_SELECT');
    });

    // Roster & Controls buttons on Title Screen
    this.root.querySelector('#btn-nav-roster').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('DIVISION_SELECT');
    });

    this.root.querySelector('#btn-nav-controls').addEventListener('click', () => {
      sounds.playMenuClick();
      const modal = this.root.querySelector('#modal-controls');
      if (modal) modal.style.display = 'flex';
    });

    this.root.querySelector('#btn-close-controls').addEventListener('click', () => {
      sounds.playMenuClick();
      const modal = this.root.querySelector('#modal-controls');
      if (modal) modal.style.display = 'none';
    });

    // Division Back
    this.root.querySelector('#btn-div-back').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('TITLE');
    });

    // P1 Selection Back & Lock In
    this.root.querySelector('#btn-p1-back').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('DIVISION_SELECT');
    });

    const lockInP1 = () => {
      sounds.playFighterSelect();
      this.showScreen('FIGHTER_SELECT_CPU');
    };
    this.root.querySelector('#btn-p1-lockin').addEventListener('click', lockInP1);
    this.root.querySelector('#btn-p1-lockin-top').addEventListener('click', lockInP1);

    // CPU Selection Back & Lock In
    this.root.querySelector('#btn-cpu-back').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('FIGHTER_SELECT_P1');
    });

    const lockInCPU = () => {
      sounds.playFighterSelect();
      this.showScreen('TALE_OF_TAPE');
    };
    this.root.querySelector('#btn-cpu-lockin').addEventListener('click', lockInCPU);
    this.root.querySelector('#btn-cpu-lockin-top').addEventListener('click', lockInCPU);

    // AI Difficulty Pills (Step 4)
    this.root.querySelectorAll('.diff-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playMenuClick();
        const diff = btn.getAttribute('data-diff');
        this.setAIDifficulty(diff);
      });
    });

    // Division Screen Bout & Bot Settings Modal
    const btnOpenSettings = this.root.querySelector('#btn-open-bout-settings');
    const modalSettings = this.root.querySelector('#modal-bout-settings');
    if (btnOpenSettings && modalSettings) {
      btnOpenSettings.addEventListener('click', () => {
        sounds.playMenuClick();
        this.syncSettingsUI();
        modalSettings.style.display = 'flex';
      });
    }

    const closeSettings = () => {
      sounds.playMenuClick();
      this.saveSettings();
      if (modalSettings) modalSettings.style.display = 'none';
    };
    const btnCloseSettings = this.root.querySelector('#btn-close-bout-settings');
    const btnSaveSettings = this.root.querySelector('#btn-close-save-settings');
    if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettings);

    // Tale of the Tape Back Button
    const btnTaleBack = this.root.querySelector('#btn-tale-back');
    if (btnTaleBack) {
      btnTaleBack.addEventListener('click', () => {
        sounds.playMenuClick();
        this.showScreen('FIGHTER_SELECT_CPU');
      });
    }

    // Settings option clicks (with persistent saving)
    const setupToggleGroup = (selector, onSelect) => {
      const btns = this.root.querySelectorAll(selector);
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          sounds.playMenuClick();
          btns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          onSelect(btn);
          this.saveSettings();
        });
      });
    };

    setupToggleGroup('#opt-rounds-5, #opt-rounds-3', (btn) => {
      this.roundCount = parseInt(btn.getAttribute('data-rounds'), 10);
      const roundBanner = this.root.querySelector('#tale-round-banner');
      if (roundBanner) roundBanner.textContent = `RFC CHAMPIONSHIP BOUT • ${this.roundCount} ROUNDS`;
    });

    setupToggleGroup('#opt-rule-tko, #opt-rule-sudden', (btn) => {
      this.ruleMode = btn.getAttribute('data-rule');
    });

    setupToggleGroup('#opt-venue-vegas, #opt-venue-apex', (btn) => {
      this.arenaLighting = btn.getAttribute('data-venue');
    });

    // AI Difficulty setting in modal
    setupToggleGroup('#opt-ai-rookie, #opt-ai-pro, #opt-ai-champion, #opt-ai-goat', (btn) => {
      const diff = btn.getAttribute('data-aidiff');
      this.setAIDifficulty(diff);
    });

    // Pause Screen AI Difficulty Pills
    this.root.querySelectorAll('.pause-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playMenuClick();
        const diff = btn.getAttribute('data-diff');
        this.setAIDifficulty(diff);
      });
    });



    // Tale of the Tape Touch Gloves Button
    this.root.querySelector('#btn-touch-gloves').addEventListener('click', () => {
      sounds.playGong();
      this.startFight();
    });

    // Pause Menu
    this.root.querySelector('#btn-pause-resume').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('IN_FIGHT');
    });

    this.root.querySelector('#btn-pause-restart').addEventListener('click', () => {
      sounds.playMenuClick();
      this.startFight();
    });

    this.root.querySelector('#btn-pause-change').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('FIGHTER_SELECT_P1');
    });

    this.root.querySelector('#btn-pause-main').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('TITLE');
    });

    // Result Menu
    this.root.querySelector('#btn-res-rematch').addEventListener('click', () => {
      sounds.playGong();
      this.startFight();
    });

    this.root.querySelector('#btn-res-newfight').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('FIGHTER_SELECT_P1');
    });

    this.root.querySelector('#btn-res-menu').addEventListener('click', () => {
      sounds.playMenuClick();
      this.showScreen('TITLE');
    });

    // Keyboard ESC & Space
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = this.root.querySelector('#modal-controls');
        if (modal && modal.style.display === 'flex') {
          modal.style.display = 'none';
          return;
        }

        if (this.currentScreen === 'IN_FIGHT') {
          this.showScreen('PAUSE');
        } else if (this.currentScreen === 'PAUSE') {
          this.showScreen('IN_FIGHT');
        }
      } else if (e.code === 'Space') {
        if (this.currentScreen === 'TALE_OF_TAPE') {
          sounds.playGong();
          this.startFight();
        }
      }
    });
  }

  showScreen(screenName) {
    this.currentScreen = screenName;
    const screens = this.root.querySelectorAll('.menu-screen');
    screens.forEach(s => s.classList.remove('active'));

    const screenMap = {
      TITLE: 'screen-title',
      DIVISION_SELECT: 'screen-division',
      FIGHTER_SELECT_P1: 'screen-fighter-p1',
      FIGHTER_SELECT_CPU: 'screen-fighter-cpu',
      TALE_OF_TAPE: 'screen-tale',
      PAUSE: 'screen-pause',
      POST_FIGHT: 'screen-result',
    };

    const targetId = screenMap[screenName];
    if (targetId) {
      const el = this.root.querySelector(`#${targetId}`);
      if (el) el.classList.add('active');
    }

    // Update wizard breadcrumbs (5-step streamlined flow)
    if (screenName === 'DIVISION_SELECT') {
      this.root.querySelector('#wizard-slot-division').innerHTML = this.getWizardHTML(2);
      this.renderDivisions();
    } else if (screenName === 'FIGHTER_SELECT_P1') {
      this.root.querySelector('#wizard-slot-p1').innerHTML = this.getWizardHTML(3);
      this.renderFighterSelectP1();
    } else if (screenName === 'FIGHTER_SELECT_CPU') {
      this.root.querySelector('#wizard-slot-cpu').innerHTML = this.getWizardHTML(4);
      this.renderFighterSelectCPU();
    } else if (screenName === 'TALE_OF_TAPE') {
      this.root.querySelector('#wizard-slot-tale').innerHTML = this.getWizardHTML(5);
      this.renderTaleOfTape();
    }

    if (this.callbacks.onGameStateChange) {
      this.callbacks.onGameStateChange(screenName);
    }
  }

  syncSettingsUI() {
    // Rounds
    this.root.querySelectorAll('#opt-rounds-5, #opt-rounds-3').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-rounds'), 10) === this.roundCount);
    });

    // Rules
    this.root.querySelectorAll('#opt-rule-tko, #opt-rule-sudden').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-rule') === this.ruleMode);
    });

    // Venue
    this.root.querySelectorAll('#opt-venue-vegas, #opt-venue-apex').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-venue') === this.arenaLighting);
    });

    // AI Difficulty
    this.root.querySelectorAll('.setting-option-btn[data-aidiff]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-aidiff') === this.aiDifficulty);
    });
    this.root.querySelectorAll('.diff-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-diff') === this.aiDifficulty);
    });
    this.root.querySelectorAll('.pause-diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-diff') === this.aiDifficulty);
    });
  }

  renderDivisions() {
    const container = this.root.querySelector('#division-cards-container');
    container.innerHTML = '';

    UFC_DIVISIONS.forEach(div => {
      const card = document.createElement('div');
      card.className = `division-card ${div.id === this.selectedDivisionId ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="div-top-tag">RFC WEIGHT CLASS</div>
        <h3 class="div-name">${div.name}</h3>
        <span class="div-weight">${div.weightLimit}</span>
        <div class="div-champion">
          <span class="belt-ico">CHAMPION:</span>
          <span class="champ-name">${div.beltHolder}</span>
        </div>
        <p class="div-desc">${div.description}</p>
        <button class="ufc-btn-select-div">SELECT DIVISION ➔</button>
      `;

      card.addEventListener('click', () => {
        sounds.playMenuClick();
        this.selectedDivisionId = div.id;
        const fighters = UFC_FIGHTERS.filter(f => f.division === div.id);
        if (fighters.length > 0) {
          this.playerFighter = fighters[0];
          this.opponentFighter = fighters[1] || fighters[0];
        }
        this.showScreen('FIGHTER_SELECT_P1');
      });

      container.appendChild(card);
    });
  }

  renderFighterSelectP1() {
    const divMeta = UFC_DIVISIONS.find(d => d.id === this.selectedDivisionId);
    this.root.querySelector('#p1-div-heading').textContent = `${divMeta ? divMeta.name : 'RFC'} DIVISION (${divMeta ? divMeta.weightLimit : ''})`;

    this.updateSpotlightCard('p1', this.playerFighter);

    const rosterGrid = this.root.querySelector('#p1-roster-grid');
    rosterGrid.innerHTML = '';

    const fighters = UFC_FIGHTERS.filter(f => f.division === this.selectedDivisionId);
    fighters.forEach(f => {
      const isSelected = this.playerFighter.id === f.id;
      const card = document.createElement('div');
      card.className = `roster-item-card ${isSelected ? 'is-red' : ''}`;
      card.innerHTML = `
        <div class="roster-card-header">
          <span class="badge-champ">${f.rank}</span>
          <span class="roster-card-country">${f.country.split(' ')[0]}</span>
        </div>
        <h4 class="roster-card-name">${f.name}</h4>
        <span class="roster-card-nick">"${f.nickname}"</span>
        <div class="roster-card-stats-preview">
          <span>PWR <strong>${f.stats.power}</strong></span>
          <span>SPD <strong>${f.stats.speed}</strong></span>
          <span>CHN <strong>${f.stats.chin}</strong></span>
        </div>
      `;

      card.addEventListener('click', () => {
        sounds.playMenuClick();
        this.playerFighter = f;
        this.updateSpotlightCard('p1', f);
        if (this.callbacks.onFighterSelected) {
          this.callbacks.onFighterSelected('RED', f);
        }
        this.renderFighterSelectP1();
      });

      rosterGrid.appendChild(card);
    });
  }

  renderFighterSelectCPU() {
    const divMeta = UFC_DIVISIONS.find(d => d.id === this.selectedDivisionId);
    this.root.querySelector('#cpu-div-heading').textContent = `${divMeta ? divMeta.name : 'RFC'} DIVISION (${divMeta ? divMeta.weightLimit : ''})`;

    this.updateSpotlightCard('cpu', this.opponentFighter);

    // Sync AI difficulty buttons
    this.root.querySelectorAll('.diff-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-diff') === this.aiDifficulty);
    });

    const rosterGrid = this.root.querySelector('#cpu-roster-grid');
    rosterGrid.innerHTML = '';

    const fighters = UFC_FIGHTERS.filter(f => f.division === this.selectedDivisionId);
    fighters.forEach(f => {
      const isSelected = this.opponentFighter.id === f.id;
      const card = document.createElement('div');
      card.className = `roster-item-card ${isSelected ? 'is-blue' : ''}`;
      card.innerHTML = `
        <div class="roster-card-header">
          <span class="badge-champ">${f.rank}</span>
          <span class="roster-card-country">${f.country.split(' ')[0]}</span>
        </div>
        <h4 class="roster-card-name">${f.name}</h4>
        <span class="roster-card-nick">"${f.nickname}"</span>
        <div class="roster-card-stats-preview">
          <span>PWR <strong>${f.stats.power}</strong></span>
          <span>SPD <strong>${f.stats.speed}</strong></span>
          <span>CHN <strong>${f.stats.chin}</strong></span>
        </div>
      `;

      card.addEventListener('click', () => {
        sounds.playMenuClick();
        this.opponentFighter = f;
        this.updateSpotlightCard('cpu', f);
        if (this.callbacks.onFighterSelected) {
          this.callbacks.onFighterSelected('BLUE', f);
        }
        this.renderFighterSelectCPU();
      });

      rosterGrid.appendChild(card);
    });
  }

  updateSpotlightCard(prefix, fighter) {
    this.root.querySelector(`#${prefix}-hero-name`).textContent = fighter.name;
    this.root.querySelector(`#${prefix}-hero-nick`).textContent = `"${fighter.nickname}"`;
    this.root.querySelector(`#${prefix}-hero-country`).textContent = fighter.country;
    this.root.querySelector(`#${prefix}-hero-record`).textContent = fighter.record;
    this.root.querySelector(`#${prefix}-hero-stance`).textContent = fighter.stance;
    this.root.querySelector(`#${prefix}-hero-rank`).textContent = fighter.rank;
    this.root.querySelector(`#${prefix}-hero-bio`).textContent = fighter.bio || 'Elite professional RFC athlete with complete mixed martial arts mastery.';

    const statsEl = this.root.querySelector(`#${prefix}-hero-stats`);
    statsEl.innerHTML = `
      <div class="stat-bar-item">
        <div class="stat-lbl-row"><span>POWER (KO)</span><strong>${fighter.stats.power}</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${fighter.stats.power}%"></div></div>
      </div>
      <div class="stat-bar-item">
        <div class="stat-lbl-row"><span>SPEED & SNAP</span><strong>${fighter.stats.speed}</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${fighter.stats.speed}%"></div></div>
      </div>
      <div class="stat-bar-item">
        <div class="stat-lbl-row"><span>STAMINA (CARDIO)</span><strong>${fighter.stats.stamina}</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${fighter.stats.stamina}%"></div></div>
      </div>
      <div class="stat-bar-item">
        <div class="stat-lbl-row"><span>CHIN & HEALTH</span><strong>${fighter.stats.chin}</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${fighter.stats.chin}%"></div></div>
      </div>
      <div class="stat-bar-item">
        <div class="stat-lbl-row"><span>REACH LEVERAGE</span><strong>${fighter.stats.reach}</strong></div>
        <div class="stat-track"><div class="stat-fill" style="width: ${fighter.stats.reach}%"></div></div>
      </div>
    `;
  }

  renderTaleOfTape() {
    const div = UFC_DIVISIONS.find(d => d.id === this.selectedDivisionId);
    this.root.querySelector('#tale-division-title').textContent = `${div ? div.name : 'RFC'} CHAMPIONSHIP BOUT`;
    this.root.querySelector('#tale-round-banner').textContent = `RFC CHAMPIONSHIP BOUT • ${this.roundCount} ROUNDS • ${this.ruleMode === 'SUDDEN_DEATH' ? 'SUDDEN DEATH' : 'STANDARD RULES'}`;

    // Red
    this.root.querySelector('#tale-red-name').textContent = this.playerFighter.name;
    this.root.querySelector('#tale-red-nick').textContent = `"${this.playerFighter.nickname}"`;
    this.root.querySelector('#tale-red-rec').textContent = this.playerFighter.record;
    this.root.querySelector('#tale-red-ht').textContent = this.playerFighter.height;
    this.root.querySelector('#tale-red-reach').textContent = this.playerFighter.reach;
    this.root.querySelector('#tale-red-stance').textContent = this.playerFighter.stance;

    // Blue
    this.root.querySelector('#tale-blue-name').textContent = this.opponentFighter.name;
    this.root.querySelector('#tale-blue-nick').textContent = `"${this.opponentFighter.nickname}"`;
    this.root.querySelector('#tale-blue-rec').textContent = this.opponentFighter.record;
    this.root.querySelector('#tale-blue-ht').textContent = this.opponentFighter.height;
    this.root.querySelector('#tale-blue-reach').textContent = this.opponentFighter.reach;
    this.root.querySelector('#tale-blue-stance').textContent = this.opponentFighter.stance;
  }

  setAIDifficulty(diff) {
    this.aiDifficulty = diff;

    // Step 4 pills sync
    this.root.querySelectorAll('.diff-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-diff') === diff);
    });

    // Step 5 buttons sync
    this.root.querySelectorAll('.setting-option-btn[data-aidiff]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-aidiff') === diff);
    });

    // Pause pills sync
    this.root.querySelectorAll('.pause-diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-diff') === diff);
    });

    this.saveSettings();

    if (this.callbacks.onAIDifficultyChange) {
      this.callbacks.onAIDifficultyChange(diff);
    }
  }

  setAIEnabled(enabled) {
    this.aiEnabled = enabled;
    const btn = this.root.querySelector('#btn-pause-toggle-ai');
    if (btn) {
      btn.classList.toggle('active', enabled);
      btn.textContent = enabled ? 'AI SPARRING: ACTIVE' : 'PASSIVE DUMMY (INACTIVE)';
    }

    if (this.callbacks.onAIToggle) {
      this.callbacks.onAIToggle(enabled);
    }
  }

  startFight() {
    this.showScreen('IN_FIGHT');
    if (this.callbacks.onStartFight) {
      this.callbacks.onStartFight({
        playerFighter: this.playerFighter,
        opponentFighter: this.opponentFighter,
        aiEnabled: this.aiEnabled,
        aiDifficulty: this.aiDifficulty,
        roundCount: this.roundCount,
        ruleMode: this.ruleMode,
        arenaLighting: this.arenaLighting,
      });
    }
  }

  triggerPostFightResult(resultData) {
    this.matchStats = { ...this.matchStats, ...resultData };
    
    const isPlayerWin = this.matchStats.winner === 'RED' || this.matchStats.winner === this.playerFighter.name;
    const winnerName = isPlayerWin ? this.playerFighter.name : this.opponentFighter.name;
    const winnerNick = isPlayerWin ? this.playerFighter.nickname : this.opponentFighter.nickname;

    this.root.querySelector('#res-verdict').textContent = this.matchStats.method || 'KNOCKOUT! (OUT COLD)';
    this.root.querySelector('#res-announcement').textContent = `
      "AND THE WINNER BY KNOCKOUT... ${winnerName} '${winnerNick}'!"
    `;

    this.root.querySelector('#res-red-name').textContent = this.playerFighter.name;
    this.root.querySelector('#res-red-strikes').textContent = this.matchStats.playerStrikes || 0;
    this.root.querySelector('#res-red-dmg').textContent = `${Math.round(this.matchStats.playerDamage || 0)} DMG`;
    this.root.querySelector('#res-red-kd').textContent = this.matchStats.playerKnockdowns || 0;

    this.root.querySelector('#res-blue-name').textContent = this.opponentFighter.name;
    this.root.querySelector('#res-blue-strikes').textContent = this.matchStats.opponentStrikes || 0;
    this.root.querySelector('#res-blue-dmg').textContent = `${Math.round(this.matchStats.opponentDamage || 0)} DMG`;
    this.root.querySelector('#res-blue-kd').textContent = this.matchStats.opponentKnockdowns || 0;

    this.root.querySelector('#res-time').textContent = `ROUND TIME: ${this.matchStats.roundTime || '1:45'}`;

    this.showScreen('POST_FIGHT');
  }
}
