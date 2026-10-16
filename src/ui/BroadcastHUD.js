/**
 * Minimalist Clean UFC Fighter HUD
 * 
 * Clean broadcast lower-third nameplate at the bottom of the screen:
 * - Fighter Name: ALEX "THE VIPER"
 * - Official UFC Red Corner branding & Champion distinction
 * - Clean, sleek health & stamina indicator
 */
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
      <!-- MINIMALIST CLEAN UFC DUAL FIGHTER NAMEPLATES AT THE BOTTOM -->
      <footer class="ufc-clean-bottom-bar dual-corners">
        <!-- RED CORNER (PLAYER) -->
        <div class="clean-fighter-card red-corner">
          <div class="clean-corner-bar red"></div>
          <div class="clean-fighter-info">
            <div class="clean-meta-line">
              <span class="clean-rank-badge">CHAMP</span>
              <span class="clean-country">🇮🇩</span>
              <span class="clean-record">24-2-0 • 77.0 KG</span>
              <span class="clean-divider">•</span>
              <span class="clean-state-pill" id="action-status-pill">ORTHODOX STANCE</span>
            </div>
            <div class="clean-name-line">
              ALEX <span class="clean-nickname">"THE VIPER"</span>
            </div>
            <div class="clean-meters-container">
              <div class="clean-meter-track health-track">
                <div class="clean-meter-fill health-fill" id="player-health-bar" style="width: 100%"></div>
              </div>
              <div class="clean-meter-track stamina-track">
                <div class="clean-meter-fill stamina-fill" id="player-stamina-bar" style="width: 100%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- CENTER MATCH & MODE PILL -->
        <div class="clean-center-panel">
          <div class="clean-vs-badge">VS</div>
          <button class="clean-mode-badge" id="hud-mode-badge" title="Press [P] or click to toggle AI Sparring">
            🎯 DUMMY MODE [P]
          </button>
        </div>

        <!-- BLUE CORNER (RAGDOLL DUMMY / SPARRING PARTNER) -->
        <div class="clean-fighter-card blue-corner">
          <div class="clean-fighter-info right-align">
            <div class="clean-meta-line right-align">
              <span class="clean-state-pill" id="dummy-status-pill">STAND IDLE</span>
              <span class="clean-divider">•</span>
              <span class="clean-record" id="dummy-meta">TARGET • 80.0 KG</span>
              <span class="clean-country" id="dummy-badge-icon">🤖</span>
              <span class="clean-rank-badge blue" id="dummy-role-badge">DUMMY</span>
            </div>
            <div class="clean-name-line">
              <span class="clean-nickname" id="dummy-title">RAGDOLL</span> <span id="dummy-name">DUMMY</span>
            </div>
            <div class="clean-meters-container">
              <div class="clean-meter-track health-track">
                <div class="clean-meter-fill health-fill blue" id="dummy-health-bar" style="width: 100%"></div>
              </div>
              <div class="clean-meter-track stamina-track">
                <div class="clean-meter-fill concussion-fill" id="dummy-concussion-bar" style="width: 0%"></div>
              </div>
            </div>
          </div>
          <div class="clean-corner-bar blue"></div>
        </div>
      </footer>

      <!-- FLOATING ACTION HIT TEXT -->
      <div class="hit-text-container" id="hit-text-container"></div>
    `;

    this.container.appendChild(this.hudElement);

    const modeBtn = this.hudElement.querySelector('#hud-mode-badge');
    if (modeBtn && this.callbacks.onToggleAI) {
      modeBtn.addEventListener('click', () => {
        this.callbacks.onToggleAI();
      });
    }
  }

  // Compatibility stubs for main.js calls
  recordStrikeAttempt(type) {}

  update(delta, player, dummy = null, aiEnabled = false) {
    if (!player) return;

    // --- PLAYER TELEMETRY ---
    const pHealthEl = this.container.querySelector('#player-health-bar');
    if (pHealthEl) {
      const hpPct = Math.max(0, (player.health / player.maxHealth) * 100);
      pHealthEl.style.width = `${hpPct}%`;
      pHealthEl.classList.toggle('danger-pulse', hpPct < 30);
    }

    const pStaminaEl = this.container.querySelector('#player-stamina-bar');
    if (pStaminaEl) {
      pStaminaEl.style.width = `${Math.max(0, (player.stamina / player.maxStamina) * 100)}%`;
    }

    const pill = this.container.querySelector('#action-status-pill');
    if (pill) {
      if (player.limp || player.isKnockedOut || player.ragdollMode === 'PASSIVE') {
        pill.textContent = 'KNOCKED OUT (LIMP)';
        pill.style.color = '#ff4d4f';
      } else if (player.getUpTimer > 0) {
        pill.textContent = 'RECOVERING TO STANCE';
        pill.style.color = '#faad14';
      } else if (player.state === 'STRIKING') {
        if (player.slipTimer > 0) {
          pill.textContent = `SLIP-${player.strikeType || 'STRIKE'}!`;
          pill.style.color = '#00e5ff';
        } else {
          pill.textContent = `${player.strikeType || 'STRIKE'}!`;
          pill.style.color = '#ffd700';
        }
      } else if (player.state === 'SLIPPING' || (player.slipTimer && player.slipTimer > 0)) {
        pill.textContent = player.slipDirection > 0 ? 'SLIP OUTSIDE (RIGHT)' : 'SLIP INSIDE (LEFT)';
        pill.style.color = '#52c41a';
      } else if (player.isCrouching) {
        pill.textContent = 'LEVEL CHANGE';
        pill.style.color = '#00e5ff';
      } else if (player.rootPosition && player.rootPosition.y > 0.05) {
        pill.textContent = 'STANCE HOP';
        pill.style.color = '#b37feb';
      } else {
        const vel = player.rootVelocity ? Math.hypot(player.rootVelocity.x, player.rootVelocity.z) : 0;
        if (vel > 0.3) {
          pill.textContent = vel > 2.5 ? 'SPRINT' : 'STEP-AND-DRAG';
          pill.style.color = '#ffffff';
        } else {
          const isSouthpaw = player.stance === 'SOUTHPAW';
          pill.textContent = isSouthpaw ? 'SOUTHPAW STANCE' : 'ORTHODOX STANCE';
          pill.style.color = isSouthpaw ? '#00e5ff' : '#00ff88';
        }
      }
    }

    // --- DUMMY / OPPONENT TELEMETRY ---
    if (dummy) {
      const dHealthEl = this.container.querySelector('#dummy-health-bar');
      if (dHealthEl) {
        const hpPct = Math.max(0, (dummy.health / dummy.maxHealth) * 100);
        dHealthEl.style.width = `${hpPct}%`;
        dHealthEl.classList.toggle('danger-pulse', hpPct < 30);
      }

      const dConcEl = this.container.querySelector('#dummy-concussion-bar');
      if (dConcEl) {
        const concPct = Math.min(100, (dummy.concussionLevel || 0));
        dConcEl.style.width = `${concPct}%`;
      }

      const dPill = this.container.querySelector('#dummy-status-pill');
      if (dPill) {
        if (dummy.limp || dummy.isKnockedOut || dummy.ragdollMode === 'PASSIVE') {
          const timeRem = dummy.autoRecoverTimer ? ` (${dummy.autoRecoverTimer.toFixed(1)}s)` : '';
          dPill.textContent = `KNOCKED OUT (LIMP)${timeRem}`;
          dPill.style.color = '#ff4d4f';
        } else if (dummy.getUpTimer > 0) {
          dPill.textContent = 'RECOVERING TO STANCE';
          dPill.style.color = '#faad14';
        } else if (dummy.state === 'STUMBLE' || dummy.isRocked) {
          dPill.textContent = 'ROCKED / STUMBLING';
          dPill.style.color = '#ff7875';
        } else if (dummy.state === 'STRIKING') {
          dPill.textContent = `${dummy.strikeType || 'STRIKE'}!`;
          dPill.style.color = '#ffd700';
        } else {
          dPill.textContent = aiEnabled ? 'SPARRING STANCE' : 'TRAINING DUMMY';
          dPill.style.color = aiEnabled ? '#40a9ff' : '#52c41a';
        }
      }

      const modeBadge = this.container.querySelector('#hud-mode-badge');
      if (modeBadge) {
        modeBadge.textContent = aiEnabled ? '🥊 SPARRING AI [P]' : '🎯 DUMMY MODE [P]';
        modeBadge.style.color = aiEnabled ? '#ffd700' : '#00e5ff';
        modeBadge.style.borderColor = aiEnabled ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 229, 255, 0.3)';
      }
    }
  }

  showEventBanner(text) {
    // Subtle hit text presentation instead of giant banner
    this.spawnHitText(text, null, 'NORMAL');
  }

  spawnHitText(text, worldPos, type = 'NORMAL') {
    const container = this.container.querySelector('#hit-text-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `floating-hit-text ${type.toLowerCase()}`;
    el.textContent = text;

    const x = (window.innerWidth / 2) + (Math.random() * 120 - 60);
    const y = (window.innerHeight / 2) - 40 + (Math.random() * 40 - 20);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1000);
  }
}
