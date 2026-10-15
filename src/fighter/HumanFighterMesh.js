import * as THREE from 'three';

/**
 * Clean GoreBox-Style Stylized Humanoid Fighter Mesh
 * 
 * Features:
 * - Clean, athletic anatomical proportions (V-taper chest, pectorals, 6-pack abs, UFC shorts, 4oz gloves).
 * - Clean facial sculpting (brow, nose, jawline, ears, fade haircut) - NO black censor bars.
 * - Perfectly aligned local coordinates for seamless 2-bone kinematic chain.
 * - Zero stray spheres or floating balls poking through geometry.
 */
export class HumanFighterMesh {
  constructor(config = {}) {
    this.skinColor = config.skinColor || 0xd99b7d;
    this.shortsColor = config.shortsColor || 0xd4af37;
    this.corner = config.corner || 'RED';
    this.cornerColor = this.corner === 'RED' ? 0xd20a0a : 0x0a5cd2;
    this.isPlayer = config.isPlayer !== false;

    this.initMaterials();
  }

  initMaterials() {
    // Stylized warm skin with soft specular reflection
    this.matSkin = new THREE.MeshStandardMaterial({
      color: this.skinColor,
      roughness: 0.55,
      metalness: 0.05,
    });

    // Muscle contours & joint sockets
    const muscleColor = new THREE.Color(this.skinColor).multiplyScalar(0.88);
    this.matMuscle = new THREE.MeshStandardMaterial({
      color: muscleColor,
      roughness: 0.58,
      metalness: 0.08,
    });

    // UFC Fight Shorts Fabric
    this.matShorts = new THREE.MeshStandardMaterial({
      color: this.shortsColor,
      roughness: 0.65,
      metalness: 0.15,
    });

    // Shorts Elastic Waistband (Dark matte charcoal)
    this.matWaistband = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.7,
      metalness: 0.2,
    });

    // Official 4oz MMA Gloves (Matte black combat leather)
    this.matGloveLeather = new THREE.MeshStandardMaterial({
      color: 0x18191d,
      roughness: 0.38,
      metalness: 0.25,
    });

    // Corner Wrist & Ankle Tape (Red / Blue corner tape)
    this.matTape = new THREE.MeshStandardMaterial({
      color: this.cornerColor,
      roughness: 0.45,
      metalness: 0.1,
    });

    // Athletic Hair
    this.matHair = new THREE.MeshStandardMaterial({
      color: this.isPlayer ? 0x221812 : 0x161412,
      roughness: 0.85,
    });

    // Mouthguard (White)
    this.matMouthguard = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.3,
    });

    // Foot Soles
    this.matSole = new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.8,
    });
  }

  // 1. ANATOMICAL HEAD & FACE (Clean stylized fighter features)
  buildHeadMesh(facingDir = 1) {
    const group = new THREE.Group();

    // Cranium / Head Block
    const headGeo = new THREE.BoxGeometry(0.22, 0.24, 0.22);
    const head = new THREE.Mesh(headGeo, this.matSkin);
    head.position.set(0, 0.02, 0);
    head.castShadow = true;
    group.add(head);

    // Chiseled Jawline
    const jawGeo = new THREE.BoxGeometry(0.18, 0.11, 0.18);
    const jaw = new THREE.Mesh(jawGeo, this.matSkin);
    jaw.position.set(0.03 * facingDir, -0.09, 0);
    jaw.castShadow = true;
    group.add(jaw);

    // Subtle Nose Protrusion
    const noseGeo = new THREE.BoxGeometry(0.04, 0.06, 0.04);
    const nose = new THREE.Mesh(noseGeo, this.matSkin);
    nose.position.set(0.12 * facingDir, 0.0, 0);
    group.add(nose);

    // Subtle Eye Sockets / Brow (Using subtle skin shade, NOT a black bar!)
    const browGeo = new THREE.BoxGeometry(0.03, 0.03, 0.14);
    const brow = new THREE.Mesh(browGeo, this.matMuscle);
    brow.position.set(0.115 * facingDir, 0.05, 0);
    group.add(brow);

    // Mouthguard inside lips
    const mouthGeo = new THREE.BoxGeometry(0.02, 0.02, 0.07);
    const mouth = new THREE.Mesh(mouthGeo, this.matMouthguard);
    mouth.position.set(0.12 * facingDir, -0.06, 0);
    group.add(mouth);

    // Ears
    [-0.12, 0.12].forEach(z => {
      const earGeo = new THREE.BoxGeometry(0.03, 0.06, 0.03);
      const ear = new THREE.Mesh(earGeo, this.matSkin);
      ear.position.set(-0.01 * facingDir, 0.01, z);
      group.add(ear);
    });

    // Athletic Fade Buzzcut Hair
    const hairGeo = new THREE.BoxGeometry(0.226, 0.07, 0.226);
    const hair = new THREE.Mesh(hairGeo, this.matHair);
    hair.position.set(-0.01 * facingDir, 0.145, 0);
    hair.castShadow = true;
    group.add(hair);

    // Neck base
    const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.12, 12);
    const neck = new THREE.Mesh(neckGeo, this.matSkin);
    neck.position.set(0, -0.15, 0);
    neck.castShadow = true;
    group.add(neck);

    return group;
  }

  // 2. V-TAPER TORSO & MUSCULAR CHEST
  buildTorsoMesh() {
    const group = new THREE.Group();

    // Upper Ribcage / Pectoral Block (Broad shoulders)
    const chestGeo = new THREE.BoxGeometry(0.30, 0.24, 0.42);
    const chest = new THREE.Mesh(chestGeo, this.matSkin);
    chest.position.set(0, 0.10, 0);
    chest.castShadow = true;
    group.add(chest);

    // Twin Pectoral Muscles (Subtle slabs)
    const pecGeo = new THREE.BoxGeometry(0.05, 0.12, 0.15);
    [-0.09, 0.09].forEach(z => {
      const pec = new THREE.Mesh(pecGeo, this.matMuscle);
      pec.position.set(0.14, 0.11, z);
      pec.castShadow = true;
      group.add(pec);
    });

    // Lower Torso / Core (Tapered abdomen)
    const coreGeo = new THREE.BoxGeometry(0.26, 0.18, 0.36);
    const core = new THREE.Mesh(coreGeo, this.matSkin);
    core.position.set(-0.01, -0.10, 0);
    core.castShadow = true;
    group.add(core);

    // Abdominal 6-Pack Core Plate
    const abGeo = new THREE.BoxGeometry(0.04, 0.14, 0.16);
    const abs = new THREE.Mesh(abGeo, this.matMuscle);
    abs.position.set(0.125, -0.09, 0);
    group.add(abs);

    // Clean Deltoid Shoulder Caps (At the lateral edges)
    [-0.23, 0.23].forEach(z => {
      const deltGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const delt = new THREE.Mesh(deltGeo, this.matSkin);
      delt.position.set(0, 0.16, z);
      delt.castShadow = true;
      group.add(delt);
    });

    return group;
  }

  // 3. PELVIS & UFC FIGHT SHORTS
  buildPelvisMesh() {
    const group = new THREE.Group();

    // Shorts Base
    const pelvisGeo = new THREE.BoxGeometry(0.28, 0.22, 0.38);
    const pelvis = new THREE.Mesh(pelvisGeo, this.matShorts);
    pelvis.position.set(0, -0.02, 0);
    pelvis.castShadow = true;
    group.add(pelvis);

    // Elastic UFC Waistband
    const bandGeo = new THREE.BoxGeometry(0.29, 0.07, 0.39);
    const band = new THREE.Mesh(bandGeo, this.matWaistband);
    band.position.set(0, 0.10, 0);
    band.castShadow = true;
    group.add(band);

    // UFC Center Belt Emblem
    const emblemGeo = new THREE.BoxGeometry(0.03, 0.045, 0.07);
    const emblemMat = new THREE.MeshStandardMaterial({ color: 0xd20a0a, roughness: 0.4 });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0.15, 0.10, 0);
    group.add(emblem);

    return group;
  }

  // 4. UPPER ARM (Biceps & Triceps)
  // Aligned along Y: Top is shoulder (0, 0.13, 0), Bottom is elbow (0, -0.13, 0)
  buildUpperArmMesh() {
    const group = new THREE.Group();

    // Upper arm cylinder
    const armGeo = new THREE.CylinderGeometry(0.075, 0.068, 0.26, 12);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.castShadow = true;
    group.add(arm);

    // Elbow sphere joint at bottom
    const elbowGeo = new THREE.SphereGeometry(0.065, 10, 10);
    const elbow = new THREE.Mesh(elbowGeo, this.matSkin);
    elbow.position.set(0, -0.13, 0);
    elbow.castShadow = true;
    group.add(elbow);

    return group;
  }

  // 5. FOREARM & 4OZ UFC COMBAT GLOVE
  // Aligned along Y: Bottom is elbow socket (0, -0.13, 0), Top is Glove Knuckles (0, +0.13, 0)
  buildGloveMesh() {
    const group = new THREE.Group();

    // Forearm Muscular Cylinder
    const forearmGeo = new THREE.CylinderGeometry(0.068, 0.062, 0.16, 12);
    const forearm = new THREE.Mesh(forearmGeo, this.matSkin);
    forearm.position.set(0, -0.04, 0);
    forearm.castShadow = true;
    group.add(forearm);

    // Corner Wrist Tape
    const tapeGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.05, 12);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.position.set(0, 0.04, 0);
    tape.castShadow = true;
    group.add(tape);

    // 4oz UFC Combat Leather Glove Block (Fist)
    const gloveGeo = new THREE.BoxGeometry(0.13, 0.13, 0.14);
    const glove = new THREE.Mesh(gloveGeo, this.matGloveLeather);
    glove.position.set(0, 0.11, 0);
    glove.castShadow = true;
    group.add(glove);

    // Finger loop / Open fingers
    const fingersGeo = new THREE.BoxGeometry(0.09, 0.04, 0.11);
    const fingers = new THREE.Mesh(fingersGeo, this.matSkin);
    fingers.position.set(0, 0.18, 0);
    group.add(fingers);

    return group;
  }

  // 6. THIGH & FIGHT SHORTS SLEEVE
  // Aligned along Y: Top is hip (0, 0.18, 0), Bottom is knee (0, -0.18, 0)
  buildThighMesh() {
    const group = new THREE.Group();

    // Shorts cuff on upper thigh
    const cuffGeo = new THREE.CylinderGeometry(0.112, 0.102, 0.18, 12);
    const cuff = new THREE.Mesh(cuffGeo, this.matShorts);
    cuff.position.set(0, 0.08, 0);
    cuff.castShadow = true;
    group.add(cuff);

    // Quadriceps lower thigh
    const quadGeo = new THREE.CylinderGeometry(0.098, 0.082, 0.18, 12);
    const quad = new THREE.Mesh(quadGeo, this.matSkin);
    quad.position.set(0, -0.08, 0);
    quad.castShadow = true;
    group.add(quad);

    // Knee Sphere Joint at bottom
    const kneeGeo = new THREE.SphereGeometry(0.075, 10, 10);
    const knee = new THREE.Mesh(kneeGeo, this.matSkin);
    knee.position.set(0, -0.18, 0);
    knee.castShadow = true;
    group.add(knee);

    return group;
  }

  // 7. SHIN, ANKLE TAPE & FOOT
  // Aligned along Y: Top is knee (0, 0.19, 0), Bottom is foot sole (0, -0.19, 0)
  // Foot extends forward along +X (matching chest and face forward axis)
  buildShinMesh() {
    const group = new THREE.Group();

    // Muscular Calf / Shin
    const calfGeo = new THREE.CylinderGeometry(0.078, 0.062, 0.32, 12);
    const calf = new THREE.Mesh(calfGeo, this.matSkin);
    calf.position.set(0, 0.03, 0);
    calf.castShadow = true;
    group.add(calf);

    // Corner Ankle Wrap / Compression Tape
    const ankleGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.07, 12);
    const ankle = new THREE.Mesh(ankleGeo, this.matTape);
    ankle.position.set(0, -0.12, 0);
    ankle.castShadow = true;
    group.add(ankle);

    // Athletic Combat Foot - extends forward along +X
    const footGeo = new THREE.BoxGeometry(0.20, 0.06, 0.12);
    const foot = new THREE.Mesh(footGeo, this.matSkin);
    foot.position.set(0.05, -0.18, 0);
    foot.castShadow = true;
    group.add(foot);

    // Gripper Sole - extends forward along +X
    const soleGeo = new THREE.BoxGeometry(0.205, 0.015, 0.125);
    const sole = new THREE.Mesh(soleGeo, this.matSole);
    sole.position.set(0.05, -0.21, 0);
    group.add(sole);

    return group;
  }
}
