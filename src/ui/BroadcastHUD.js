export class BroadcastHUD {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = typeof callbacks === 'function' ? { onResetPosition: callbacks } : callbacks;

    this.initDOM();
  }

  initDOM() {
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'hud-overlay';
    this.hudElement.className = 'hud-overlay-root';
    this.hudElement.innerHTML = `
      <!-- TOP UFC MOVEMENT TELEMETRY BAR -->
      <div class="ufc-broadcast-bar movement-lab-bar">
        <!-- PLAYER METRICS CARD -->
        <div class="fighter-corner red-corner solo-card">
          <div class="corner-badge red">GOREBOX RAGDOLL</div>
          <div class="fighter-info">
            <span class="fighter-name">ALEX "THE VIPER"</span>
            <span class="fighter-record">77.0 KG • MMA ATHLETE • ORTHODOX STANCE</span>
          </div>
          <div class="meters-container">
            <div class="stamina-bar-wrapper">
              <div class="stamina-bar" id="player-stamina-bar" style="width: 100%"></div>
            </div>
          </div>
        </div>

        <!-- CENTER TELEMETRY DISPLAY -->
        <div class="broadcast-center telemetry-center">
          <div class="ufc-logo-badge">
            <span class="ufc-text">UFC</span>
            <span class="fight-night-text">MOVEMENT LAB</span>
          </div>
          <div class="telemetry-readout" id="speed-readout">0.0 m/s</div>
          <div class="fight-status-pill" id="action-status-pill">ORTHODOX STANCE</div>
        </div>

        <!-- CAMERA & OCTAGON INFO CARD -->
        <div class="fighter-corner blue-corner solo-card">
          <div class="corner-badge blue">RAGDOLL SYSTEM</div>
          <div class="fighter-info">
            <span class="fighter-name" id="hud-ragdoll-mode-label">HYBRID MODE</span>
            <span class="fighter-record">INDESTRUCTIBLE JOINTS • SOLID RIG</span>
          </div>
          <div class="camera-info-note">
            <span>🖱️ Klik Kanan + Drag: Orbit 360° Kamera</span>
          </div>
        </div>
      </div>

      <!-- DYNAMIC STATUS BANNER -->
      <div class="event-banner" id="event-banner">
        <span class="event-title" id="event-title">HYBRID RAGDOLL ACTIVATED</span>
      </div>

      <!-- FLOATING ACTION TEXT -->
      <div class="hit-text-container" id="hit-text-container"></div>

      <!-- RAGDOLL MODE CONTROLLER CLUSTER (TOP-LEFT / CENTER) -->
      <div class="ragdoll-mode-selector">
        <div class="ragdoll-selector-title">RAGDOLL ARCHITECTURE:</div>
        <div class="ragdoll-btn-group">
          <button class="ragdoll-mode-btn active" id="btn-mode-hybrid" title="Kinematic Orthodox Stance + Tactile Footwork + Active Colliders">
            <span class="mode-key">1</span> HYBRID STANCE
          </button>
          <button class="ragdoll-mode-btn" id="btn-mode-active" title="Physics Motor Springs + Dynamic Balance + Flinching">
            <span class="mode-key">2</span> ACTIVE BALANCE
          </button>
          <button class="ragdoll-mode-btn" id="btn-mode-passive" title="100% Limp Ragdoll Collapse on Canvas">
            <span class="mode-key">3</span> PASSIVE (LIMP)
          </button>
        </div>
        <div class="ragdoll-quick-triggers">
          <button class="ragdoll-trigger-btn ko-trigger" id="btn-trigger-ko" title="Simulate Flash Knockout">
            ⚡ TEST KNOCKOUT (O)
          </button>
          <button class="ragdoll-trigger-btn recover-trigger" id="btn-trigger-stand" title="Recover from floor to stance">
            🥋 STAND UP (R)
          </button>
        </div>
      </div>

      <!-- BOTTOM CONTROL DASHBOARD (MOVEMENT & SHADOWBOXING) -->
      <div class="bottom-control-dashboard solo-dashboard">
        <div class="controls-legend solo-legend">
          <div class="ctrl-group">
            <span class="ctrl-badge">W A S D</span> Footwork Step
            <span class="ctrl-badge">SHIFT</span> Sprint
            <span class="ctrl-badge">SPACE</span> Hop
            <span class="ctrl-badge">C</span> Crouch
          </div>
          <div class="ctrl-group">
            <span class="ctrl-badge">J</span> Jab
            <span class="ctrl-badge">K</span> Cross
            <span class="ctrl-badge">U</span> Hook
            <span class="ctrl-badge">I</span> Uppercut
            <span class="ctrl-badge">L</span> Headkick
            <span class="ctrl-badge">M</span> Lowkick
          </div>
          <div class="ctrl-group">
            <span class="ctrl-badge">1 / 2 / 3</span> Switch Ragdoll Mode
            <span class="ctrl-badge">O</span> Knockout
            <span class="ctrl-badge">R</span> Stand Up
          </div>
        </div>

        <button class="reset-pos-btn" id="reset-pos-btn">RESET POSITION</button>
      </div>

      <!-- ON-SCREEN QUICK ACTION BUTTONS -->
      <div class="touch-actions-cluster">
        <div class="touch-row">
          <button class="touch-btn strike" id="touch-jab">JAB (J)</button>
          <button class="touch-btn strike" id="touch-cross">CROSS (K)</button>
          <button class="touch-btn strike" id="touch-hook">HOOK (U)</button>
          <button class="touch-btn strike" id="touch-upper">UPPERCUT (I)</button>
        </div>
        <div class="touch-row">
          <button class="touch-btn grapple" id="touch-kick">HEADKICK (L)</button>
          <button class="touch-btn grapple" id="touch-lowkick">LOWKICK (M)</button>
          <button class="touch-btn defense" id="touch-jump">JUMP (SPACE)</button>
          <button class="touch-btn defense" id="touch-crouch">CROUCH (C)</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.hudElement);
    this.bindEvents();
  }

  bindEvents() {
    const resetBtn = this.container.querySelector('#reset-pos-btn');
    if (resetBtn && this.callbacks.onResetPosition) {
      resetBtn.addEventListener('click', () => {
        this.callbacks.onResetPosition();
        this.showEventBanner('POSITION RESET TO CENTER');
      });
    }

    // Ragdoll Mode buttons
    const btnHybrid = this.container.querySelector('#btn-mode-hybrid');
    const btnActive = this.container.querySelector('#btn-mode-active');
    const btnPassive = this.container.querySelector('#btn-mode-passive');
    const btnKO = this.container.querySelector('#btn-trigger-ko');
    const btnStand = this.container.querySelector('#btn-trigger-stand');

    const updateActiveButton = (activeId) => {
      [btnHybrid, btnActive, btnPassive].forEach(btn => {
        if (btn) btn.classList.toggle('active', btn.id === activeId);
      });
    };

    if (btnHybrid) {
      btnHybrid.addEventListener('click', () => {
        if (this.callbacks.onSetRagdollMode) this.callbacks.onSetRagdollMode('HYBRID');
        updateActiveButton('btn-mode-hybrid');
        this.showEventBanner('HYBRID RAGDOLL: ORTHODOX STANCE');
      });
    }

    if (btnActive) {
      btnActive.addEventListener('click', () => {
        if (this.callbacks.onSetRagdollMode) this.callbacks.onSetRagdollMode('ACTIVE');
        updateActiveButton('btn-mode-active');
        this.showEventBanner('ACTIVE RAGDOLL: DYNAMIC BALANCE');
      });
    }

    if (btnPassive) {
      btnPassive.addEventListener('click', () => {
        if (this.callbacks.onSetRagdollMode) this.callbacks.onSetRagdollMode('PASSIVE');
        updateActiveButton('btn-mode-passive');
        this.showEventBanner('PASSIVE RAGDOLL: LIMP COLLAPSE');
      });
    }

    if (btnKO) {
      btnKO.addEventListener('click', () => {
        if (this.callbacks.onKnockout) this.callbacks.onKnockout();
        updateActiveButton('btn-mode-passive');
        this.showEventBanner('⚡ FLASH KNOCKOUT! (LIMP)');
      });
    }

    if (btnStand) {
      btnStand.addEventListener('click', () => {
        if (this.callbacks.onStandUp) this.callbacks.onStandUp();
        updateActiveButton('btn-mode-hybrid');
        this.showEventBanner('🥋 ATHLETE RECOVERED TO STANCE');
      });
    }

    const bindTouch = (id, action) => {
      const el = this.container.querySelector(id);
      if (el) {
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          action();
        });
      }
    };

    bindTouch('#touch-jab', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' })));
    bindTouch('#touch-cross', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' })));
    bindTouch('#touch-hook', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' })));
    bindTouch('#touch-upper', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' })));
    bindTouch('#touch-kick', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' })));
    bindTouch('#touch-lowkick', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })));
    bindTouch('#touch-jump', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })));
    bindTouch('#touch-crouch', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'c' })), 400);
    });
  }

  update(delta, player) {
    if (!player) return;

    // Stamina Gauge
    const pStaminaEl = this.container.querySelector('#player-stamina-bar');
    if (pStaminaEl) {
      pStaminaEl.style.width = `${Math.max(0, (player.stamina / player.maxStamina) * 100)}%`;
    }

    // Velocity & Speed Readout
    const speedEl = this.container.querySelector('#speed-readout');
    if (speedEl && player.pelvis) {
      const vel = player.pelvis.velocity;
      const horizontalSpeed = Math.hypot(vel.x, vel.z);
      speedEl.textContent = `${horizontalSpeed.toFixed(1)} m/s`;
    }

    // Mode label
    const modeLabel = this.container.querySelector('#hud-ragdoll-mode-label');
    if (modeLabel) {
      modeLabel.textContent = `${player.ragdollMode} MODE`;
    }

    // Action Status Pill
    const pill = this.container.querySelector('#action-status-pill');
    if (pill) {
      if (player.ragdollMode === 'PASSIVE' || player.isKnockedOut) {
        pill.textContent = 'KNOCKED OUT (LIMP)';
        pill.style.backgroundColor = '#d20a0a';
      } else if (player.ragdollMode === 'ACTIVE') {
        pill.textContent = 'ACTIVE BALANCE';
        pill.style.backgroundColor = '#fa8c16';
      } else if (player.state === 'STRIKING') {
        pill.textContent = `${player.strikeType || 'STRIKE'}!`;
        pill.style.backgroundColor = '#d4af37';
      } else if (player.state === 'SLIPPING') {
        pill.textContent = 'SLIP / HEAD MOVEMENT';
        pill.style.backgroundColor = '#52c41a';
      } else if (player.isCrouching) {
        pill.textContent = 'LEVEL CHANGE / CROUCH';
        pill.style.backgroundColor = '#00e5ff';
      } else if (player.rootPosition && player.rootPosition.y > 0.05) {
        pill.textContent = 'STANCE HOP';
        pill.style.backgroundColor = '#722ed1';
      } else {
        const vel = player.rootVelocity ? Math.hypot(player.rootVelocity.x, player.rootVelocity.z) : 0;
        if (vel > 0.3) {
          pill.textContent = vel > 2.5 ? 'SPRINT RUSH' : 'STEP-AND-DRAG GAIT';
          pill.style.backgroundColor = 'rgba(210, 10, 10, 0.85)';
        } else {
          pill.textContent = 'ORTHODOX STANCE';
          pill.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
        }
      }
    }
  }

  showEventBanner(text) {
    const banner = this.container.querySelector('#event-banner');
    const title = this.container.querySelector('#event-title');
    if (banner && title) {
      title.textContent = text;
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 1600);
    }
  }

  spawnHitText(text, worldPos, type = 'NORMAL') {
    const container = this.container.querySelector('#hit-text-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `floating-hit-text ${type.toLowerCase()}`;
    el.textContent = text;

    const x = (window.innerWidth / 2) + (Math.random() * 160 - 80);
    const y = (window.innerHeight / 2) - 60 + (Math.random() * 60 - 30);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1000);
  }
}
