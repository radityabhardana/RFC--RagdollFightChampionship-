import confetti from 'canvas-confetti';
import * as THREE from 'three';

export class BroadcastHUD {
  constructor(container, onSelectArchetype, onRestart) {
    this.container = container;
    this.onSelectArchetype = onSelectArchetype;
    this.onRestart = onRestart;

    this.roundTime = 300; // 5:00 minutes round
    this.isPaused = false;
    this.isMatchOver = false;

    this.initDOM();
  }

  initDOM() {
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'hud-overlay';
    this.hudElement.className = 'hud-overlay-root';
    this.hudElement.innerHTML = `
      <!-- TOP UFC BROADCAST SCOREBOARD -->
      <div class="ufc-broadcast-bar">
        <!-- RED CORNER (PLAYER) -->
        <div class="fighter-corner red-corner">
          <div class="corner-badge red">RED CORNER</div>
          <div class="fighter-info">
            <span class="fighter-name" id="player-name">ALEX "THE VIPER"</span>
            <span class="fighter-record">21-1-0 • CHAMPION</span>
          </div>
          <div class="meters-container">
            <div class="health-bar-wrapper">
              <div class="health-bar red" id="player-health-bar" style="width: 100%"></div>
            </div>
            <div class="stamina-bar-wrapper">
              <div class="stamina-bar" id="player-stamina-bar" style="width: 100%"></div>
            </div>
          </div>
        </div>

        <!-- CENTER ROUND & FIGHT CLOCK -->
        <div class="broadcast-center">
          <div class="ufc-logo-badge">
            <span class="ufc-text">UFC</span>
            <span class="fight-night-text">FIGHT NIGHT</span>
          </div>
          <div class="round-indicator">ROUND 1</div>
          <div class="fight-clock" id="fight-clock">05:00</div>
          <div class="fight-status-pill" id="fight-status-pill">STAND & BANG</div>
        </div>

        <!-- BLUE CORNER (AI) -->
        <div class="fighter-corner blue-corner">
          <div class="corner-badge blue">BLUE CORNER</div>
          <div class="fighter-info">
            <span class="fighter-name" id="ai-name">ISLAM "THE SMESH"</span>
            <span class="fighter-record" id="ai-record">25-1-0 • #1 CONTENDER</span>
          </div>
          <div class="meters-container">
            <div class="health-bar-wrapper">
              <div class="health-bar blue" id="ai-health-bar" style="width: 100%"></div>
            </div>
            <div class="stamina-bar-wrapper">
              <div class="stamina-bar" id="ai-stamina-bar" style="width: 100%"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- DYNAMIC STATUS BANNER -->
      <div class="event-banner" id="event-banner">
        <span class="event-title" id="event-title">SIGNIFICANT STRIKE</span>
      </div>

      <!-- FLOATING HIT TEXT CONTAINER -->
      <div class="hit-text-container" id="hit-text-container"></div>

      <!-- BOTTOM CONTROL DASHBOARD & ARCHETYPE SELECTOR -->
      <div class="bottom-control-dashboard">
        <div class="ai-selector-box">
          <span class="selector-label">OPPONENT AI STYLE:</span>
          <div class="archetype-buttons">
            <button class="arch-btn active" data-arch="DAGISTANI">DAGISTANI SMESH (WRESTLER)</button>
            <button class="arch-btn" data-arch="BRAWLER">JUST BLEED BRAWLER</button>
            <button class="arch-btn" data-arch="SNIPER">COUNTER SNIPER</button>
          </div>
        </div>

        <div class="controls-legend">
          <div class="ctrl-group">
            <span class="ctrl-badge">W A S D</span> Move
          </div>
          <div class="ctrl-group">
            <span class="ctrl-badge">J</span> Jab
            <span class="ctrl-badge">K</span> Power Hook / Cross
            <span class="ctrl-badge">L</span> Headkick
          </div>
          <div class="ctrl-group">
            <span class="ctrl-badge">F</span> Double-Leg Takedown
            <span class="ctrl-badge">U</span> Ground & Pound
          </div>
          <div class="ctrl-group">
            <span class="ctrl-badge">Q / E</span> Slip Head
            <span class="ctrl-badge">SPACE</span> Guard / Sprawl
          </div>
        </div>
      </div>

      <!-- MOBILE / TOUCH ON-SCREEN ACTION BUTTONS -->
      <div class="touch-actions-cluster">
        <div class="touch-row">
          <button class="touch-btn strike" id="touch-jab">JAB (J)</button>
          <button class="touch-btn strike" id="touch-hook">HOOK (K)</button>
          <button class="touch-btn strike" id="touch-kick">KICK (L)</button>
        </div>
        <div class="touch-row">
          <button class="touch-btn grapple" id="touch-takedown">TAKEDOWN (F)</button>
          <button class="touch-btn defense" id="touch-slip">SLIP (Q)</button>
          <button class="touch-btn gnp" id="touch-gnp">G&P (U)</button>
        </div>
      </div>

      <!-- KNOCKOUT VICTORY MODAL OVERLAY -->
      <div class="ko-modal-overlay" id="ko-modal">
        <div class="ko-modal-content">
          <div class="ko-glitch-header">KNOCKOUT!</div>
          <div class="ko-sub-title" id="ko-winner-text">AND STILL THE UNDISPUTED CHAMPION!</div>
          <div class="ko-details" id="ko-details-text">WINNER BY UNANIMOUS FLASH KNOCKOUT</div>
          <button class="rematch-btn" id="rematch-btn">START REMATCH</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.hudElement);
    this.bindEvents();
  }

  bindEvents() {
    // Archetype selector buttons
    const btns = this.container.querySelectorAll('.arch-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const arch = btn.getAttribute('data-arch');
        if (this.onSelectArchetype) this.onSelectArchetype(arch);
      });
    });

    // Rematch button
    const rematchBtn = this.container.querySelector('#rematch-btn');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', () => {
        this.hideKO();
        if (this.onRestart) this.onRestart();
      });
    }

    // Touch controls bindings
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
    bindTouch('#touch-hook', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' })));
    bindTouch('#touch-kick', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' })));
    bindTouch('#touch-takedown', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })));
    bindTouch('#touch-slip', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' })));
    bindTouch('#touch-gnp', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' })));
  }

  update(delta, player, ai, camera) {
    if (this.isMatchOver) return;

    // Update Round Clock
    this.roundTime = Math.max(0, this.roundTime - delta);
    const mins = Math.floor(this.roundTime / 60);
    const secs = Math.floor(this.roundTime % 60);
    const clockEl = this.container.querySelector('#fight-clock');
    if (clockEl) {
      clockEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Update Health & Stamina Bars
    const pHealthEl = this.container.querySelector('#player-health-bar');
    const pStaminaEl = this.container.querySelector('#player-stamina-bar');
    if (pHealthEl && pStaminaEl) {
      pHealthEl.style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
      pStaminaEl.style.width = `${Math.max(0, (player.stamina / player.maxStamina) * 100)}%`;
      if (player.isRocked) pHealthEl.classList.add('danger-pulse');
      else pHealthEl.classList.remove('danger-pulse');
    }

    const aiHealthEl = this.container.querySelector('#ai-health-bar');
    const aiStaminaEl = this.container.querySelector('#ai-stamina-bar');
    if (aiHealthEl && aiStaminaEl) {
      aiHealthEl.style.width = `${Math.max(0, (ai.health / ai.maxHealth) * 100)}%`;
      aiStaminaEl.style.width = `${Math.max(0, (ai.stamina / ai.maxStamina) * 100)}%`;
      if (ai.isRocked) aiHealthEl.classList.add('danger-pulse');
      else aiHealthEl.classList.remove('danger-pulse');
    }

    // Status Pill
    const statusPill = this.container.querySelector('#fight-status-pill');
    if (statusPill) {
      if (player.isGrounded || ai.isGrounded) {
        statusPill.textContent = 'GROUND & POUND';
        statusPill.style.backgroundColor = '#d20a0a';
      } else if (player.isRocked || ai.isRocked) {
        statusPill.textContent = 'FIGHTER ROCKED!';
        statusPill.style.backgroundColor = '#ff6b00';
      } else {
        statusPill.textContent = 'STAND & BANG';
        statusPill.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
      }
    }

    // Check Knockout State
    if ((player.isKnockedOut || ai.isKnockedOut) && !this.isMatchOver) {
      this.isMatchOver = true;
      const winner = player.isKnockedOut ? ai : player;
      const loser = player.isKnockedOut ? player : ai;
      this.showKO(winner, loser);
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

    // Random slight offset on screen center
    const x = (window.innerWidth / 2) + (Math.random() * 200 - 100);
    const y = (window.innerHeight / 2) - 80 + (Math.random() * 80 - 40);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1100);
  }

  showKO(winner, loser) {
    const modal = this.container.querySelector('#ko-modal');
    const winnerText = this.container.querySelector('#ko-winner-text');
    const details = this.container.querySelector('#ko-details-text');

    if (modal && winnerText) {
      winnerText.textContent = `${winner.name} WINS BY KNOCKOUT!`;
      details.textContent = `${winner.corner === 'RED' ? 'RED' : 'BLUE'} CORNER DEFEATS ${loser.name}`;
      modal.classList.add('visible');

      // Celebration Confetti
      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  }

  hideKO() {
    const modal = this.container.querySelector('#ko-modal');
    if (modal) modal.classList.remove('visible');
    this.isMatchOver = false;
    this.roundTime = 300;
  }

  setAIName(name) {
    const el = this.container.querySelector('#ai-name');
    if (el) el.textContent = name;
  }
}
