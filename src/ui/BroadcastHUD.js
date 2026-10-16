/**
 * UFC 4 Authentic Broadcast HUD
 * 
 * Features exact UFC 4 visual layout:
 * - Top HUD: Red Corner (SEEMONSTER) vs Blue Corner (ST-PIERRE)
 * - Stamina bar with embedded label
 * - 4-track anatomical damage bars: HEAD, BODY, BLOCK, LEG
 * - Center momentum/grapple advantage indicator [ | | | █ | | | ]
 * - Bottom collapsible controls card with Block (F) and Pull Slip (R)
 */
export class BroadcastHUD {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = typeof callbacks === 'function' ? { onResetPosition: callbacks } : callbacks;
    this.momentumValue = 0.5; // 0.0 (full red advantage) to 1.0 (full blue advantage)

    // Screen Edge Red Danger Vignette Timers
    this.enemyFlashTimer = 0;
    this.enemyFlashMax = 0.45;
    this.enemyFlashIntensity = 1.0;
    this.playerFlashTimer = 0;
    this.playerFlashMax = 0.45;
    this.playerFlashIntensity = 1.0;

    this.initDOM();
  }

  initDOM() {
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'hud-overlay';
    this.hudElement.className = 'hud-overlay-root';
    this.hudElement.innerHTML = `
      <!-- ================================================================= -->
      <!-- UFC 4 TOP BROADCAST HEADER (IDENTICAL TO UFC 4 BROADCAST)        -->
      <!-- ================================================================= -->
      <header class="ufc4-top-hud">
        <!-- RED CORNER (LEFT) -->
        <div class="ufc4-corner-block red-corner">
          <div class="ufc4-name-tag red" id="player-name-tag">SEEMONSTER</div>
          <div class="ufc4-stamina-container">
            <div class="ufc4-stamina-track">
              <div class="ufc4-stamina-fill" id="p-stamina-bar" style="width: 100%;">
                <span class="ufc4-stamina-label">STAMINA</span>
              </div>
            </div>
          </div>
          <div class="ufc4-vitals-column">
            <div class="ufc4-vital-row">
              <span class="ufc4-vital-name">HEAD</span>
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar red" id="p-head-bar" style="width: 100%;"></div></div>
            </div>
            <div class="ufc4-vital-row">
              <span class="ufc4-vital-name">BODY</span>
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar red" id="p-body-bar" style="width: 100%;"></div></div>
            </div>
            <div class="ufc4-vital-row">
              <span class="ufc4-vital-name">BLOCK</span>
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar cyan" id="p-block-bar" style="width: 100%;"></div></div>
            </div>
            <div class="ufc4-vital-row">
              <span class="ufc4-vital-name">L.LEG</span>
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar red" id="p-leg-bar" style="width: 100%;"></div></div>
            </div>
          </div>
        </div>

        <!-- CENTER MOMENTUM / ADVANTAGE METER -->
        <div class="ufc4-center-momentum">
          <div class="ufc4-momentum-wrapper">
            <div class="ufc4-momentum-ticks">[ : : : : : : : : : : : : : : : : ]</div>
            <div class="ufc4-momentum-bar-base">
              <div class="ufc4-momentum-cursor" id="ufc4-momentum-cursor"></div>
            </div>
          </div>
          <button class="ufc4-mode-pill" id="hud-mode-badge" title="Press [P] or click to toggle AI Sparring">
            🎯 DUMMY MODE [P]
          </button>
        </div>

        <!-- BLUE CORNER (RIGHT) -->
        <div class="ufc4-corner-block blue-corner">
          <div class="ufc4-name-tag blue" id="dummy-name-tag">ST-PIERRE</div>
          <div class="ufc4-stamina-container mirror">
            <div class="ufc4-stamina-track mirror">
              <div class="ufc4-stamina-fill mirror" id="d-stamina-bar" style="width: 100%;">
                <span class="ufc4-stamina-label mirror">STAMINA</span>
              </div>
            </div>
          </div>
          <div class="ufc4-vitals-column mirror">
            <div class="ufc4-vital-row mirror">
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar red mirror" id="d-head-bar" style="width: 100%;"></div></div>
              <span class="ufc4-vital-name mirror">HEAD</span>
            </div>
            <div class="ufc4-vital-row mirror">
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar red mirror" id="d-body-bar" style="width: 100%;"></div></div>
              <span class="ufc4-vital-name mirror">BODY</span>
            </div>
            <div class="ufc4-vital-row mirror">
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar cyan mirror" id="d-block-bar" style="width: 100%;"></div></div>
              <span class="ufc4-vital-name mirror">BLOCK</span>
            </div>
            <div class="ufc4-vital-row mirror">
              <div class="ufc4-vital-track"><div class="ufc4-vital-bar red mirror" id="d-leg-bar" style="width: 100%;"></div></div>
              <span class="ufc4-vital-name mirror">R.LEG</span>
            </div>
          </div>
        </div>
      </header>

      <!-- BOTTOM DASHBOARD: FIGHTER STATUS + COLLAPSIBLE CONTROLS CARD -->
      <footer class="ufc-bottom-dashboard">
        <!-- SUBTLE ACTION CALLOUT PILL -->
        <div class="ufc-status-row">
          <span class="clean-state-pill" id="action-status-pill">ORTHODOX STANCE</span>
          <span class="clean-divider">•</span>
          <span class="clean-state-pill" id="dummy-status-pill">TRAINING DUMMY</span>
        </div>

        <!-- WIDE LONG CONTROLS CARD -->
        <div class="ufc-controls-card" id="ufc-controls-card">
          <div class="controls-card-header">
            <span class="controls-title">🎮 KONTROL COMBAT & RAGDOLL PHYSICS</span>
            <button class="controls-toggle-btn" id="toggle-controls-btn" title="Toggle Tampilan Kontrol">
              <span class="toggle-icon">−</span> <span class="toggle-text">SEMBUNYIKAN</span>
            </button>
          </div>
          <div class="controls-grid" id="controls-grid">
            <!-- 1. Pergerakan -->
            <div class="ctrl-group">
              <span class="ctrl-group-title">🕹️ FOOTWORK</span>
              <div class="ctrl-items">
                <div class="ctrl-item"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Jalan 3D</span></div>
                <div class="ctrl-item"><kbd>Shift</kbd><span>Sprint</span></div>
                <div class="ctrl-item"><kbd>Space</kbd><span>Stance Hop</span></div>
                <div class="ctrl-item"><kbd>C</kbd><span>Level Change / Crouch</span></div>
              </div>
            </div>

            <!-- 2. Pukulan -->
            <div class="ctrl-group">
              <span class="ctrl-group-title">🥊 PUNCHES</span>
              <div class="ctrl-items">
                <div class="ctrl-item"><kbd>J</kbd><span>Lead Jab</span></div>
                <div class="ctrl-item"><kbd>K</kbd><span>Power Cross</span></div>
                <div class="ctrl-item"><kbd>U</kbd><span>Lead Hook</span></div>
                <div class="ctrl-item"><kbd>I</kbd><span>Uppercut</span></div>
                <div class="ctrl-item"><kbd>H</kbd><span>Overhand Bomb</span></div>
              </div>
            </div>

            <!-- 3. Tendangan -->
            <div class="ctrl-group">
              <span class="ctrl-group-title">🥋 KICKS</span>
              <div class="ctrl-items">
                <div class="ctrl-item"><kbd>L</kbd><span>Headkick (High)</span></div>
                <div class="ctrl-item"><kbd>B</kbd><span>Body Roundhouse</span></div>
                <div class="ctrl-item"><kbd>M</kbd><span>Low Chop Kick</span></div>
                <div class="ctrl-item"><kbd>T</kbd><span>Push Teep</span></div>
              </div>
            </div>

            <!-- 4. Defense & Counter -->
            <div class="ctrl-group">
              <span class="ctrl-group-title">🛡️ DEFENSE & COUNTER</span>
              <div class="ctrl-items">
                <div class="ctrl-item"><kbd>F</kbd><span>High Block (Tahan)</span></div>
                <div class="ctrl-item"><kbd>R</kbd><span>Slip Back (Pull-Counter)</span></div>
                <div class="ctrl-item"><kbd>Q</kbd><kbd>E</kbd><span>Deep Slip Kiri/Kanan</span></div>
                <div class="ctrl-item"><kbd>Z</kbd><span>Switch Stance</span></div>
                <div class="ctrl-item"><kbd>X</kbd><span>Duck / Slip Bawah</span></div>
              </div>
            </div>

            <!-- 5. Ragdoll & AI -->
            <div class="ctrl-group">
              <span class="ctrl-group-title">💀 RAGDOLL & AI</span>
              <div class="ctrl-items">
                <div class="ctrl-item"><kbd>P</kbd><span>Aktifkan Sparring AI</span></div>
                <div class="ctrl-item"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><span>Hybrid / Limp / Active</span></div>
                <div class="ctrl-item"><kbd>O</kbd><span>Flash Knockout</span></div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <!-- FLOATING ACTION HIT TEXT -->
      <div class="hit-text-container" id="hit-text-container"></div>

      <!-- SCREEN EDGE RED DANGER VIGNETTES (ENEMY & PLAYER SIDES) -->
      <div class="screen-edge-vignette left player-edge" id="player-danger-edge"></div>
      <div class="screen-edge-vignette right enemy-edge" id="enemy-danger-edge"></div>
    `;

    this.container.appendChild(this.hudElement);

    const modeBtn = this.hudElement.querySelector('#hud-mode-badge');
    if (modeBtn && this.callbacks.onToggleAI) {
      modeBtn.addEventListener('click', () => {
        this.callbacks.onToggleAI();
      });
    }

    const toggleBtn = this.hudElement.querySelector('#toggle-controls-btn');
    const controlsCard = this.hudElement.querySelector('#ufc-controls-card');
    if (toggleBtn && controlsCard) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = controlsCard.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('.toggle-icon');
        const text = toggleBtn.querySelector('.toggle-text');
        if (isCollapsed) {
          if (icon) icon.textContent = '+';
          if (text) text.textContent = 'KONTROL';
        } else {
          if (icon) icon.textContent = '−';
          if (text) text.textContent = 'SEMBUNYIKAN';
        }
      });
    }
  }

  recordStrikeAttempt(type) {}

  update(delta, player, dummy = null, aiEnabled = false) {
    if (!player) return;

    // --- 1. PLAYER (RED CORNER) METRICS ---
    const pStaminaEl = this.container.querySelector('#p-stamina-bar');
    if (pStaminaEl) {
      const stPct = Math.max(0, Math.min(100, (player.stamina / (player.maxStamina || 100)) * 100));
      pStaminaEl.style.width = `${stPct}%`;
    }

    const pHeadEl = this.container.querySelector('#p-head-bar');
    if (pHeadEl) {
      const pct = Math.max(0, Math.min(100, (player.headHealth / (player.maxHeadHealth || 100)) * 100));
      pHeadEl.style.width = `${pct}%`;
      pHeadEl.classList.toggle('danger-pulse', pct < 25);
    }

    const pBodyEl = this.container.querySelector('#p-body-bar');
    if (pBodyEl) {
      const pct = Math.max(0, Math.min(100, (player.bodyHealth / (player.maxBodyHealth || 100)) * 100));
      pBodyEl.style.width = `${pct}%`;
      pBodyEl.classList.toggle('danger-pulse', pct < 25);
    }

    const pBlockEl = this.container.querySelector('#p-block-bar');
    if (pBlockEl) {
      const pct = Math.max(0, Math.min(100, (player.blockHealth / (player.maxBlockHealth || 100)) * 100));
      pBlockEl.style.width = `${pct}%`;
      pBlockEl.classList.toggle('guard-active', player.isBlocking);
      pBlockEl.classList.toggle('block-broken', player.blockBrokenTimer > 0);
    }

    const pLegEl = this.container.querySelector('#p-leg-bar');
    if (pLegEl) {
      const pct = Math.max(0, Math.min(100, (player.legHealth / (player.maxLegHealth || 100)) * 100));
      pLegEl.style.width = `${pct}%`;
      pLegEl.classList.toggle('danger-pulse', pct < 25);
    }

    // --- 2. DUMMY (BLUE CORNER) METRICS ---
    if (dummy) {
      const dStaminaEl = this.container.querySelector('#d-stamina-bar');
      if (dStaminaEl) {
        const stPct = Math.max(0, Math.min(100, (dummy.stamina / (dummy.maxStamina || 100)) * 100));
        dStaminaEl.style.width = `${stPct}%`;
      }

      const dHeadEl = this.container.querySelector('#d-head-bar');
      if (dHeadEl) {
        const pct = Math.max(0, Math.min(100, (dummy.headHealth / (dummy.maxHeadHealth || 100)) * 100));
        dHeadEl.style.width = `${pct}%`;
        dHeadEl.classList.toggle('danger-pulse', pct < 25);
      }

      const dBodyEl = this.container.querySelector('#d-body-bar');
      if (dBodyEl) {
        const pct = Math.max(0, Math.min(100, (dummy.bodyHealth / (dummy.maxBodyHealth || 100)) * 100));
        dBodyEl.style.width = `${pct}%`;
        dBodyEl.classList.toggle('danger-pulse', pct < 25);
      }

      const dBlockEl = this.container.querySelector('#d-block-bar');
      if (dBlockEl) {
        const pct = Math.max(0, Math.min(100, (dummy.blockHealth / (dummy.maxBlockHealth || 100)) * 100));
        dBlockEl.style.width = `${pct}%`;
        dBlockEl.classList.toggle('guard-active', dummy.isBlocking);
        dBlockEl.classList.toggle('block-broken', dummy.blockBrokenTimer > 0);
      }

      const dLegEl = this.container.querySelector('#d-leg-bar');
      if (dLegEl) {
        const pct = Math.max(0, Math.min(100, (dummy.legHealth / (dummy.maxLegHealth || 100)) * 100));
        dLegEl.style.width = `${pct}%`;
        dLegEl.classList.toggle('danger-pulse', pct < 25);
      }

      // --- 3. CENTER MOMENTUM GAUGE ---
      const cursor = this.container.querySelector('#ufc4-momentum-cursor');
      if (cursor) {
        // Target momentum based on composite damage delta
        const playerHp = (player.headHealth + player.bodyHealth + player.legHealth) / 3;
        const dummyHp = (dummy.headHealth + dummy.bodyHealth + dummy.legHealth) / 3;
        const diff = (playerHp - dummyHp) / 100; // -1 to +1
        // Smoothly interpolate momentum
        const targetMomentum = 0.5 - (diff * 0.40); // 0.1 to 0.9 (left = red advantage, right = blue)
        this.momentumValue += (targetMomentum - this.momentumValue) * 0.08;
        cursor.style.left = `${this.momentumValue * 100}%`;
      }

      // Mode Badge Text
      const modeBadge = this.container.querySelector('#hud-mode-badge');
      if (modeBadge) {
        modeBadge.textContent = aiEnabled ? '🥊 SPARRING AI [P]' : '🎯 DUMMY MODE [P]';
        modeBadge.style.color = aiEnabled ? '#ffd700' : '#00e5ff';
        modeBadge.style.borderColor = aiEnabled ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 229, 255, 0.3)';
      }
    }

    // --- 4. ACTION STATUS CALLOUTS ---
    const pill = this.container.querySelector('#action-status-pill');
    if (pill) {
      if (player.limp || player.isKnockedOut || player.ragdollMode === 'PASSIVE') {
        pill.textContent = 'KNOCKED OUT (LIMP)';
        pill.style.color = '#ff4d4f';
      } else if (player.getUpTimer > 0) {
        pill.textContent = 'RECOVERING TO STANCE';
        pill.style.color = '#faad14';
      } else if (player.blockBrokenTimer > 0) {
        pill.textContent = 'GUARD BROKEN (STUNNED)';
        pill.style.color = '#ff4d4f';
      } else if (player.state === 'SLIPPING' || (player.slipTimer && player.slipTimer > 0)) {
        if (player.isBlocking) {
          if (player.slipType === 'BACK') {
            pill.textContent = '🛡️ GUARDED PULL SLIP [R+F]';
            pill.style.color = '#00e5a3';
          } else {
            pill.textContent = player.slipDirection > 0 ? '🛡️ GUARDED SLIP OUTSIDE [E+F]' : '🛡️ GUARDED SLIP INSIDE [Q+F]';
            pill.style.color = '#00e5a3';
          }
        } else {
          if (player.slipType === 'BACK') {
            pill.textContent = 'PULL SLIP (LEAN BACK) [R]';
            pill.style.color = '#00e5ff';
          } else {
            pill.textContent = player.slipDirection > 0 ? 'DEEP SLIP OUTSIDE [E]' : 'DEEP SLIP INSIDE [Q]';
            pill.style.color = '#52c41a';
          }
        }
      } else if (player.isBlocking) {
        pill.textContent = 'HIGH DOUBLE GUARD [F]';
        pill.style.color = '#00e5a3';
      } else if (player.state === 'STRIKING') {
        if (player.slipTimer > 0) {
          const prefix = player.slipType === 'BACK' ? 'PULL-COUNTER' : 'SLIP-COUNTER';
          pill.textContent = `${prefix} ${player.strikeType || 'STRIKE'}!`;
          pill.style.color = '#00e5ff';
        } else {
          pill.textContent = `${player.strikeType || 'STRIKE'}!`;
          pill.style.color = '#ffd700';
        }
      } else if (player.isCrouching) {
        pill.textContent = 'LEVEL CHANGE / DUCK [C]';
        pill.style.color = '#00e5ff';
      } else if (player.rootPosition && player.rootPosition.y > 0.05) {
        pill.textContent = 'STANCE HOP [SPACE]';
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

    if (dummy) {
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
    }

    // --- 5. SCREEN EDGE RED DANGER VIGNETTES (HANYA KETIKA SUDAH MAU HABIS / KO) ---
    const enemyEdgeEl = this.container.querySelector('#enemy-danger-edge');
    if (enemyEdgeEl && dummy) {
      // Efek layar setengah merah HANYA ketika darah musuh sudah mau habis (head, body, leg <= 25) atau saat KO
      const isDummyNearlyFinished = (
        (dummy.headHealth !== undefined && dummy.headHealth <= 25) ||
        (dummy.bodyHealth !== undefined && dummy.bodyHealth <= 25) ||
        (dummy.legHealth !== undefined && dummy.legHealth <= 25) ||
        dummy.isKnockedOut || dummy.limp
      );

      let enemyOpacity = 0;

      if (isDummyNearlyFinished) {
        const time = performance.now() * 0.001;
        const pulse = Math.sin(time * 7.5) * 0.5 + 0.5; // 0 to 1
        enemyOpacity = 0.52 + pulse * 0.36;
        enemyEdgeEl.classList.add('pulsing-danger');
      } else {
        enemyEdgeEl.classList.remove('pulsing-danger');
      }

      enemyEdgeEl.style.opacity = enemyOpacity.toFixed(3);
    }

    const playerEdgeEl = this.container.querySelector('#player-danger-edge');
    if (playerEdgeEl && player) {
      // Efek layar setengah merah HANYA ketika darah player sudah mau habis (head, body, leg <= 25) atau saat KO
      const isPlayerNearlyFinished = (
        (player.headHealth !== undefined && player.headHealth <= 25) ||
        (player.bodyHealth !== undefined && player.bodyHealth <= 25) ||
        (player.legHealth !== undefined && player.legHealth <= 25) ||
        player.isKnockedOut || player.limp
      );

      let playerOpacity = 0;

      if (isPlayerNearlyFinished) {
        const time = performance.now() * 0.001;
        const pulse = Math.sin(time * 7.5) * 0.5 + 0.5;
        playerOpacity = 0.52 + pulse * 0.36;
        playerEdgeEl.classList.add('pulsing-danger');
      } else {
        playerEdgeEl.classList.remove('pulsing-danger');
      }

      playerEdgeEl.style.opacity = playerOpacity.toFixed(3);
    }
  }

  triggerScreenDangerFlash(side = 'enemy', intensity = 1.0, duration = 0.45) {
    const dur = Math.max(0.2, duration);
    const intens = Math.min(1.5, Math.max(0.4, intensity));
    if (side === 'enemy' || side === 'dummy') {
      this.enemyFlashTimer = dur;
      this.enemyFlashMax = dur;
      this.enemyFlashIntensity = intens;
    } else {
      this.playerFlashTimer = dur;
      this.playerFlashMax = dur;
      this.playerFlashIntensity = intens;
    }
  }

  showEventBanner(text) {
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
