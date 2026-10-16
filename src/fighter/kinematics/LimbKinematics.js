import * as THREE from 'three';

/**
 * LimbKinematics: High-precision, singularity-free biomechanical solvers for human fighters.
 * Shared across all fighting styles to ensure mathematical consistency and performance.
 */

// Analytical 2-Bone Inverse Kinematics (Root -> Mid Joint -> End Effector)
export function solve2BoneIK(root, target, l1, l2, fwdHint) {
  const toTarget = new THREE.Vector3().subVectors(target, root);
  const d = Math.max(0.08, Math.min(l1 + l2 - 0.005, toTarget.length()));
  const dir = toTarget.clone().multiplyScalar(1 / d);

  const cosAlpha = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const alpha = Math.acos(cosAlpha);

  let bendDir = new THREE.Vector3().copy(fwdHint);
  const proj = bendDir.dot(dir);
  bendDir.addScaledVector(dir, -proj);
  if (bendDir.lengthSq() < 0.001) {
    bendDir.set(0, 0, 1);
    const p2 = bendDir.dot(dir);
    bendDir.addScaledVector(dir, -p2);
  }
  bendDir.normalize();

  const mid = root.clone()
    .addScaledVector(dir, l1 * Math.cos(alpha))
    .addScaledVector(bendDir, l1 * Math.sin(alpha));

  return mid;
}

// Singularity-free 3-axis basis matrix quaternion for limbs (Upper Arm, Forearm, Thigh, Shin)
export function safeLimbQuat(fromPt, toPt, hintFwd, hintUp) {
  // Vector pointing from joint bottom to top along model's local +Y bone axis
  const localY = new THREE.Vector3().subVectors(fromPt, toPt);
  const len = localY.length();
  if (len < 1e-4) return new THREE.Quaternion();
  localY.multiplyScalar(1 / len);

  // Anterior (+X) direction orthogonal to bone axis
  let localX = hintFwd ? hintFwd.clone() : new THREE.Vector3(1, 0, 0);
  localX.addScaledVector(localY, -localX.dot(localY));

  if (localX.lengthSq() < 1e-4 && hintUp) {
    localX = hintUp.clone();
    localX.addScaledVector(localY, -localX.dot(localY));
  }
  if (localX.lengthSq() < 1e-4) {
    localX = new THREE.Vector3(1, 0, 0);
    localX.addScaledVector(localY, -localX.dot(localY));
  }
  if (localX.lengthSq() < 1e-4) {
    localX = new THREE.Vector3(0, 0, 1);
    localX.addScaledVector(localY, -localX.dot(localY));
  }
  localX.normalize();

  // Lateral (+Z) axis
  const localZ = new THREE.Vector3().crossVectors(localX, localY).normalize();
  localX.crossVectors(localY, localZ).normalize();

  const rotMatrix = new THREE.Matrix4().makeBasis(localX, localY, localZ);
  return new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
}

// Strike-face orientation for 4oz UFC combat gloves (forearm axis + knuckle impact plane)
export function safeGloveQuat(fromElbow, toWrist, forwardDir, pronationAngle = 0) {
  const dir = new THREE.Vector3().subVectors(toWrist, fromElbow);
  const len = dir.length();
  if (len < 1e-4) return new THREE.Quaternion();
  dir.multiplyScalar(1 / len);

  let knuckleFwd = forwardDir.clone();
  knuckleFwd.addScaledVector(dir, -knuckleFwd.dot(dir));
  if (knuckleFwd.lengthSq() < 1e-4) {
    knuckleFwd = new THREE.Vector3(0, 0, 1);
    knuckleFwd.addScaledVector(dir, -knuckleFwd.dot(dir));
  }
  knuckleFwd.normalize();

  let lateral = new THREE.Vector3().crossVectors(dir, knuckleFwd).normalize();
  let trueKnuckle = new THREE.Vector3().crossVectors(lateral, dir).normalize();

  // Biomechanical Pronation: rotate knuckles around forearm bone axis
  if (pronationAngle !== 0) {
    const qPronate = new THREE.Quaternion().setFromAxisAngle(dir, pronationAngle);
    lateral.applyQuaternion(qPronate);
    trueKnuckle.applyQuaternion(qPronate);
  }

  const rotMatrix = new THREE.Matrix4().makeBasis(lateral, dir, trueKnuckle);
  return new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
}

// Biomechanical Articulated Combat Foot Solver
export function solveArticulatedFoot(ankle, knee, shinQuat, groundPos, groundQuat, isKicking, strikeType, kickExt, F, U) {
  if (!isKicking || kickExt <= 0.001) {
    return { p: groundPos, q: groundQuat };
  }

  // Shin vector pointing from knee to ankle
  const shinVec = new THREE.Vector3().subVectors(ankle, knee);
  const sLen = shinVec.length();
  const shinDir = sLen > 1e-4 ? shinVec.multiplyScalar(1 / sLen) : F.clone();

  let footPos = ankle.clone();
  let footQuat;

  if (strikeType === 'TEEP') {
    // Lead Push Kick: Dorsiflexion (toes pulled back, heel & ball of foot drive forward)
    footPos.addScaledVector(F, 0.12).addScaledVector(U, -0.04);
    footQuat = shinQuat.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2.2)
    );
  } else {
    // Roundhouses (Calf, Body, Head): Plantar flexion (toes pointed like a ballerina, shin line continues)
    footPos.addScaledVector(shinDir, 0.14);
    footQuat = shinQuat.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.12)
    );
  }

  return { p: footPos, q: footQuat };
}
