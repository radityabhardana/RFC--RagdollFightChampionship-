import * as THREE from 'three';

// UFC Dynamic Camera System with Solo Training & Broadcast Modes
export class BroadcastCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Modes: 'SOLO_FOLLOW', 'BROADCAST_SIDE', 'ORBIT'
    this.mode = 'SOLO_FOLLOW';

    // Target positions (EA Sports UFC eye-level broadcast camera)
    this.currentLookAt = new THREE.Vector3(0, 1.30, 0);
    this.targetLookAt = new THREE.Vector3(0, 1.30, 0);
    this.desiredPos = new THREE.Vector3(0, 1.60, 3.2);

    this.trauma = 0;
    this.smoothSpeed = 0.08;

    // Orbit controls support (Eye-level UFC broadcast camera)
    this.isMouseDown = false;
    this.orbitYaw = 0;
    this.orbitPitch = 0.05; // Slightly angled down towards canvas (~2.8°)
    this.orbitDistance = 3.2;
    this.lockedBroadcastAngle = Math.PI / 2; // Primary stable UFC broadcast sideline angle
    this.currentCameraAngle = Math.PI / 2;
    this.baseFov = this.camera.fov || 44;

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
        this.orbitPitch = Math.max(-0.25, Math.min(0.95, this.orbitPitch + e.movementY * 0.006));
      }
    });

    window.addEventListener('wheel', (e) => {
      this.orbitDistance = Math.max(2.0, Math.min(7.5, this.orbitDistance + e.deltaY * 0.004));
    });
  }

  addTrauma(amount = 0.4) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Snaps the camera cleanly to the official EA Sports UFC broadcast sideline perspective
   */
  resetToBroadcast(player, opponent) {
    this.orbitYaw = 0;
    this.orbitPitch = 0.05;
    this.orbitDistance = 3.2;
    this.trauma = 0;

    const pPos = player ? player.getTorsoPosition() : { x: -1.35, y: 1.25, z: 0 };
    const oPos = opponent ? (opponent.getTorsoPosition ? opponent.getTorsoPosition() : opponent.position) : { x: 1.35, y: 1.25, z: 0 };

    const midX = (pPos.x + oPos.x) * 0.5;
    const midY = (pPos.y + oPos.y) * 0.5;
    const midZ = (pPos.z + oPos.z) * 0.5;

    this.currentLookAt.set(midX, Math.max(1.22, midY + 0.16), midZ);
    this.targetLookAt.copy(this.currentLookAt);

    this.desiredPos.set(midX, 1.62, midZ + 3.2);
    this.camera.position.copy(this.desiredPos);
    this.camera.lookAt(this.currentLookAt);
    this.camera.fov = 44;
    this.camera.updateProjectionMatrix();
  }

  update(delta, player, opponent = null) {
    if (!player) return;

    const pPos = player.getTorsoPosition();

    if (opponent) {
      // 1. Torso centers & Inter-fighter distance
      const oPos = opponent.getTorsoPosition ? opponent.getTorsoPosition() : opponent.position;
      const midX = (pPos.x + oPos.x) * 0.5;
      const midY = (pPos.y + oPos.y) * 0.5;
      const midZ = (pPos.z + oPos.z) * 0.5;
      const dist = Math.hypot(pPos.x - oPos.x, pPos.z - oPos.z);

      // 2. LookAt strictly at upper-chest/head level (1.25m - 1.35m, stable broadcast focus)
      this.targetLookAt.set(midX, Math.max(1.22, midY + 0.16), midZ);

      // 3. Dynamic Adaptive FOV:
      // When fighters are in opposing corners (dist up to 6-7m), smoothly widen FOV so BOTH fighters stay fully framed
      const targetFov = THREE.MathUtils.clamp(44 + Math.max(0, dist - 1.8) * 2.5, 44, 54);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1.0, delta * 3.5));
      this.camera.updateProjectionMatrix();

      // 4. Dynamic camera distance scaling
      const camDist = THREE.MathUtils.clamp(dist * 0.55 + 2.2, 2.9, 4.2);

      // 5. Authentic Stable EA Sports UFC Broadcast Sideline Camera:
      // The camera stays fixed to the primary broadcast vantage facing into the octagon (+Z looking to -Z).
      // It follows the fighters laterally and smoothly zooms with distance.
      // It NEVER flips 180° into the reverse stands, preventing control inversion and disorientation.
      const baseSidelineAngle = Math.PI / 2; // Front broadcast sideline
      
      // Subtle dynamic sideline parallax based on fighters' lateral stance
      const lateralParallax = THREE.MathUtils.clamp((midX / 3.0) * 0.12, -0.20, 0.20);
      const finalAngle = baseSidelineAngle + this.orbitYaw + lateralParallax;

      // 6. Upright Eye-Level Broadcast Height (1.52m - 1.82m)
      if (!this.isMouseDown) {
        this.orbitYaw *= 0.95;
        this.orbitPitch = THREE.MathUtils.lerp(this.orbitPitch, 0.05, 0.05);
      }

      const camY = THREE.MathUtils.clamp(
        midY + 0.38 + Math.sin(this.orbitPitch) * camDist,
        1.50,
        1.85
      );
      const radXZ = Math.cos(this.orbitPitch) * camDist;

      this.desiredPos.set(
        midX + Math.cos(finalAngle) * radXZ,
        camY,
        midZ + Math.sin(finalAngle) * radXZ
      );

      // 7. Strict Inner Cage Boundary Clamping
      const maxCameraRadius = 3.65;
      const camDistFromCenter = Math.hypot(this.desiredPos.x, this.desiredPos.z);
      if (camDistFromCenter > maxCameraRadius) {
        const clampRatio = maxCameraRadius / camDistFromCenter;
        this.desiredPos.x *= clampRatio;
        this.desiredPos.z *= clampRatio;
      }
      this.desiredPos.y = THREE.MathUtils.clamp(this.desiredPos.y, 1.48, 1.85);
    } else {
      // SOLO MOVEMENT FOCUS TRACKING
      this.targetLookAt.set(pPos.x, Math.max(1.15, pPos.y + 0.20), pPos.z);

      if (this.mode === 'SOLO_FOLLOW') {
        const angle = this.orbitYaw + Math.PI / 2;
        const camDist = Math.min(3.4, this.orbitDistance);
        const camY = THREE.MathUtils.clamp(pPos.y + 0.45 + Math.sin(this.orbitPitch) * camDist, 1.48, 1.85);
        const radiusXZ = Math.cos(this.orbitPitch) * camDist;

        this.desiredPos.set(
          pPos.x + Math.cos(angle) * radiusXZ,
          camY,
          pPos.z + Math.sin(angle) * radiusXZ
        );

        const maxCameraRadius = 3.65;
        const camDistFromCenter = Math.hypot(this.desiredPos.x, this.desiredPos.z);
        if (camDistFromCenter > maxCameraRadius) {
          const clampRatio = maxCameraRadius / camDistFromCenter;
          this.desiredPos.x *= clampRatio;
          this.desiredPos.z *= clampRatio;
        }
      } else if (this.mode === 'BROADCAST_SIDE') {
        this.desiredPos.set(0, 1.70, 3.8);
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
