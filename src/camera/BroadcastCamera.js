import * as THREE from 'three';

// UFC Dynamic Camera System with Solo Training & Broadcast Modes
export class BroadcastCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Modes: 'SOLO_FOLLOW', 'BROADCAST_SIDE', 'ORBIT'
    this.mode = 'SOLO_FOLLOW';

    // Target positions
    this.currentLookAt = new THREE.Vector3(0, 1.2, 0);
    this.targetLookAt = new THREE.Vector3(0, 1.2, 0);
    this.desiredPos = new THREE.Vector3(0, 1.8, 4.5);

    this.trauma = 0;
    this.smoothSpeed = 0.08;

    // Orbit controls support
    this.isMouseDown = false;
    this.orbitYaw = 0;
    this.orbitPitch = 0.25;
    this.orbitDistance = 3.2;

    this.initOrbitListeners();
  }

  initOrbitListeners() {
    window.addEventListener('mousedown', (e) => {
      // Right click or middle click drags orbit
      if (e.button === 2 || e.button === 1) {
        this.isMouseDown = true;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isMouseDown) {
        this.orbitYaw -= e.movementX * 0.006;
        this.orbitPitch = Math.max(-0.2, Math.min(1.1, this.orbitPitch + e.movementY * 0.006));
      }
    });

    window.addEventListener('wheel', (e) => {
      this.orbitDistance = Math.max(2.2, Math.min(8.5, this.orbitDistance + e.deltaY * 0.004));
    });
  }

  addTrauma(amount = 0.4) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  setMode(mode) {
    this.mode = mode;
  }

  update(delta, player, opponent = null) {
    if (!player) return;

    const pPos = player.getTorsoPosition();

    if (opponent) {
      // Authentic EA Sports UFC Broadcast side-angle tracking
      const oPos = opponent.getTorsoPosition ? opponent.getTorsoPosition() : opponent.position;
      const midX = (pPos.x + oPos.x) * 0.5;
      const midY = (pPos.y + oPos.y) * 0.5;
      const midZ = (pPos.z + oPos.z) * 0.5;
      const dist = Math.hypot(pPos.x - oPos.x, pPos.z - oPos.z);

      this.targetLookAt.set(midX, Math.max(1.05, midY + 0.18), midZ);

      // Camera sits perpendicular to the line connecting fighter and opponent/bag
      const fDirX = oPos.x - pPos.x;
      const fDirZ = oPos.z - pPos.z;

      // Allow smooth orbit exploration during broadcast mode, gently returning to true broadcast view
      if (!this.isMouseDown) {
        this.orbitYaw *= 0.95;
        this.orbitPitch = THREE.MathUtils.lerp(this.orbitPitch, 0.20, 0.05);
      }
      const angle = Math.atan2(fDirZ, fDirX) + Math.PI / 2 + this.orbitYaw;
      const camDist = THREE.MathUtils.clamp(dist * 1.15 + 1.9, 2.9, 3.8);
      const camY = Math.max(1.15, midY + 0.18 + Math.sin(this.orbitPitch) * camDist);
      const radXZ = Math.cos(this.orbitPitch) * camDist;

      this.desiredPos.set(
        midX + Math.cos(angle) * radXZ,
        camY,
        midZ + Math.sin(angle) * radXZ
      );
    } else {
      // SOLO MOVEMENT FOCUS TRACKING
      this.targetLookAt.set(pPos.x, Math.max(0.9, pPos.y + 0.15), pPos.z);

      if (this.mode === 'SOLO_FOLLOW') {
        // Dynamic angle facing the front-side of the fighter
        const angle = this.orbitYaw + Math.PI / 2;
        const camDist = this.orbitDistance;
        const camY = Math.max(0.6, pPos.y + 0.5 + Math.sin(this.orbitPitch) * camDist);
        const radiusXZ = Math.cos(this.orbitPitch) * camDist;

        this.desiredPos.set(
          pPos.x + Math.cos(angle) * radiusXZ,
          camY,
          pPos.z + Math.sin(angle) * radiusXZ
        );
      } else if (this.mode === 'BROADCAST_SIDE') {
        // High broadcast press angle from side of ring
        this.desiredPos.set(0, 2.5, 6.8);
      }
    }

    // Smooth position & lookAt dampening
    this.camera.position.lerp(this.desiredPos, this.smoothSpeed);
    this.currentLookAt.lerp(this.targetLookAt, this.smoothSpeed);
    this.camera.lookAt(this.currentLookAt);

    // Screen Shake Trauma decay
    if (this.trauma > 0) {
      const shakeAmount = this.trauma * this.trauma;
      const now = performance.now() * 0.001;
      this.camera.position.x += Math.sin(now * 40) * 0.07 * shakeAmount;
      this.camera.position.y += Math.cos(now * 45) * 0.07 * shakeAmount;
      this.trauma = Math.max(0, this.trauma - delta * 2.5);
    }
  }
}
