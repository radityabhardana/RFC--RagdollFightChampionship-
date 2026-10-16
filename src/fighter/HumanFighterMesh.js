import * as THREE from 'three';

/**
 * Clean GoreBox-Style Stylized Humanoid Fighter Mesh (17-Segment Anatomical Architecture)
 * 
 * Features:
 * - 17 Fully Articulated Anatomical Segments:
 *   1. Pelvis (UFC fight shorts & waistband)
 *   2. Abdomen (Tapered core & 6-pack abs)
 *   3. Chest (V-taper pectorals & deltoid caps)
 *   4. Neck (Cervical column & chin tuck)
 *   5. Head (Chiseled jaw, brow, nose, ears, fade buzzcut, mouthguard)
 *   6-7. Left & Right Upper Arms (Biceps & triceps)
 *   8-9. Left & Right Forearms (Muscular forearms & wrist sockets)
 *   10-11. Left & Right 4oz UFC Combat Gloves (Fists & corner tape)
 *   12-13. Left & Right Thighs (Shorts sleeves & quadriceps)
 *   14-15. Left & Right Shins (Calf muscles & ankle sockets)
 *   16-17. Left & Right Combat Feet (Articulated ankles, tape & grip soles)
 * 
 * Aesthetics:
 * - Clean stylized athletic proportions (GoreBox / Action Figure combat look).
 * - Zero stray spheres, floating geometry, or black censor bars.
 * - Perfectly aligned local coordinates matching physics collision hulls.
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

    // Foot Soles (High-grip canvas rubber)
    this.matSole = new THREE.MeshStandardMaterial({
      color: 0x1f2126,
      roughness: 0.85,
    });
  }

  // 1. PELVIS & UFC FIGHT SHORTS (Mass hub)
  buildPelvisMesh() {
    const group = new THREE.Group();

    // Shorts Trunk Base
    const pelvisGeo = new THREE.BoxGeometry(0.28, 0.20, 0.36);
    const pelvis = new THREE.Mesh(pelvisGeo, this.matShorts);
    pelvis.position.set(0, 0, 0);
    pelvis.castShadow = true;
    group.add(pelvis);

    // Elastic UFC Waistband
    const bandGeo = new THREE.BoxGeometry(0.286, 0.06, 0.366);
    const band = new THREE.Mesh(bandGeo, this.matWaistband);
    band.position.set(0, 0.08, 0);
    band.castShadow = true;
    group.add(band);

    // Inner Waist Joint Socket (Solid core bevel inside waistband preventing hollow gaps during bends)
    const socketGeo = new THREE.CylinderGeometry(0.125, 0.135, 0.06, 16);
    const socket = new THREE.Mesh(socketGeo, this.matSkin);
    socket.position.set(0, 0.10, 0);
    group.add(socket);

    // Left & Right Leg Cuffs for Thigh Sockets
    [-0.15, 0.15].forEach(z => {
      const cuffGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.04, 12);
      const cuff = new THREE.Mesh(cuffGeo, this.matShorts);
      cuff.position.set(0, -0.09, z);
      group.add(cuff);
    });

    // UFC Center Belt Emblem
    const emblemGeo = new THREE.BoxGeometry(0.025, 0.04, 0.065);
    const emblemMat = new THREE.MeshStandardMaterial({ color: 0xd20a0a, roughness: 0.4 });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0.145, 0.08, 0);
    group.add(emblem);

    return group;
  }

  // 2. ABDOMEN & 6-PACK CORE (Lumbar Spine)
  buildAbdomenMesh() {
    const group = new THREE.Group();

    // Core tapered waist block
    const coreGeo = new THREE.BoxGeometry(0.26, 0.16, 0.32);
    const core = new THREE.Mesh(coreGeo, this.matSkin);
    core.position.set(0, 0, 0);
    core.castShadow = true;
    group.add(core);

    // Bottom Spherical Core Plug (Nests seamlessly into pelvis waistband, eliminating separation)
    const botPlugGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16);
    const botPlug = new THREE.Mesh(botPlugGeo, this.matSkin);
    botPlug.position.set(0, -0.075, 0);
    group.add(botPlug);

    // Top Spherical Core Plug (Nests seamlessly into ribcage cavity, eliminating separation during slips)
    const topPlugGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16);
    const topPlug = new THREE.Mesh(topPlugGeo, this.matSkin);
    topPlug.position.set(0, 0.075, 0);
    group.add(topPlug);

    // Abdominal 6-Pack Plate in front
    const absGeo = new THREE.BoxGeometry(0.035, 0.13, 0.16);
    const abs = new THREE.Mesh(absGeo, this.matMuscle);
    abs.position.set(0.125, 0, 0);
    abs.castShadow = true;
    group.add(abs);

    // Left & Right Oblique Muscle Contours
    [-0.14, 0.14].forEach(z => {
      const oblGeo = new THREE.BoxGeometry(0.16, 0.11, 0.025);
      const obl = new THREE.Mesh(oblGeo, this.matMuscle);
      obl.position.set(0.02, 0, z);
      group.add(obl);
    });

    return group;
  }

  // 3. CHEST & BROAD SHOULDERS (Thoracic Spine)
  buildChestMesh() {
    const group = new THREE.Group();

    // Ribcage / Upper Torso Block
    const chestGeo = new THREE.BoxGeometry(0.30, 0.22, 0.40);
    const chest = new THREE.Mesh(chestGeo, this.matSkin);
    chest.position.set(0, 0, 0);
    chest.castShadow = true;
    group.add(chest);

    // Bottom Ribcage Bevel Socket (Encloses top of abdomen core)
    const ribSocketGeo = new THREE.BoxGeometry(0.27, 0.04, 0.33);
    const ribSocket = new THREE.Mesh(ribSocketGeo, this.matSkin);
    ribSocket.position.set(0, -0.10, 0);
    group.add(ribSocket);

    // Twin Pectoral Muscles (Sculpted chest slabs)
    const pecGeo = new THREE.BoxGeometry(0.04, 0.12, 0.15);
    [-0.09, 0.09].forEach(z => {
      const pec = new THREE.Mesh(pecGeo, this.matMuscle);
      pec.position.set(0.14, 0.02, z);
      pec.castShadow = true;
      group.add(pec);
    });

    // Deltoid Shoulder Caps at lateral extremes (Deep anatomical socket housing upper arm joint)
    [-0.21, 0.21].forEach(z => {
      const deltGeo = new THREE.SphereGeometry(0.096, 16, 16);
      const delt = new THREE.Mesh(deltGeo, this.matSkin);
      delt.position.set(0, 0.06, z);
      delt.castShadow = true;
      group.add(delt);
    });

    // Clavicle Collar Socket for Neck Base
    const collarGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.03, 14);
    const collar = new THREE.Mesh(collarGeo, this.matSkin);
    collar.position.set(0.02, 0.11, 0);
    group.add(collar);

    return group;
  }

  // 4. NECK (Cervical Column)
  buildNeckMesh() {
    const group = new THREE.Group();

    const neckGeo = new THREE.CylinderGeometry(0.072, 0.082, 0.11, 12);
    const neck = new THREE.Mesh(neckGeo, this.matSkin);
    neck.castShadow = true;
    group.add(neck);

    return group;
  }

  // 5. HEAD & FACIAL SCULPT (Clean stylized fighter features)
  buildHeadMesh(facingDir = 1) {
    const group = new THREE.Group();

    // Cranium / Head Block
    const headGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const head = new THREE.Mesh(headGeo, this.matSkin);
    head.position.set(0, 0.02, 0);
    head.castShadow = true;
    group.add(head);

    // Chiseled Jawline
    const jawGeo = new THREE.BoxGeometry(0.18, 0.10, 0.18);
    const jaw = new THREE.Mesh(jawGeo, this.matSkin);
    jaw.position.set(0.03 * facingDir, -0.08, 0);
    jaw.castShadow = true;
    group.add(jaw);

    // Subtle Nose Protrusion
    const noseGeo = new THREE.BoxGeometry(0.04, 0.05, 0.04);
    const nose = new THREE.Mesh(noseGeo, this.matSkin);
    nose.position.set(0.12 * facingDir, 0.01, 0);
    group.add(nose);

    // Subtle Brow Ridge
    const browGeo = new THREE.BoxGeometry(0.03, 0.03, 0.14);
    const brow = new THREE.Mesh(browGeo, this.matMuscle);
    brow.position.set(0.115 * facingDir, 0.05, 0);
    group.add(brow);

    // Mouthguard inside lips
    const mouthGeo = new THREE.BoxGeometry(0.02, 0.02, 0.07);
    const mouth = new THREE.Mesh(mouthGeo, this.matMouthguard);
    mouth.position.set(0.12 * facingDir, -0.05, 0);
    group.add(mouth);

    // Ears
    [-0.12, 0.12].forEach(z => {
      const earGeo = new THREE.BoxGeometry(0.03, 0.06, 0.03);
      const ear = new THREE.Mesh(earGeo, this.matSkin);
      ear.position.set(-0.01 * facingDir, 0.01, z);
      group.add(ear);
    });

    // Athletic Fade Buzzcut Hair
    const hairGeo = new THREE.BoxGeometry(0.226, 0.065, 0.226);
    const hair = new THREE.Mesh(hairGeo, this.matHair);
    hair.position.set(-0.01 * facingDir, 0.135, 0);
    hair.castShadow = true;
    group.add(hair);

    return group;
  }

  // 6. UPPER ARM (Biceps & Triceps)
  // Aligned along Y: Top is shoulder (0, +0.125, 0), Bottom is elbow (0, -0.125, 0)
  buildUpperArmMesh() {
    const group = new THREE.Group();

    // Upper arm cylinder
    const armGeo = new THREE.CylinderGeometry(0.076, 0.066, 0.25, 12);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.castShadow = true;
    group.add(arm);

    // Shoulder sphere joint cap at top (Nests inside chest deltoid socket with zero gap)
    const shoulderGeo = new THREE.SphereGeometry(0.086, 14, 14);
    const shoulder = new THREE.Mesh(shoulderGeo, this.matSkin);
    shoulder.position.set(0, 0.125, 0);
    group.add(shoulder);

    // Elbow sphere joint at bottom
    const elbowGeo = new THREE.SphereGeometry(0.068, 12, 12);
    const elbow = new THREE.Mesh(elbowGeo, this.matSkin);
    elbow.position.set(0, -0.125, 0);
    elbow.castShadow = true;
    group.add(elbow);

    return group;
  }

  // 7. FOREARM (Muscular forearm & wrist socket)
  // Aligned along Y: Top is elbow socket (0, +0.11, 0), Bottom is wrist (0, -0.11, 0)
  buildForearmMesh() {
    const group = new THREE.Group();

    // Elbow socket joint cap at top (Nests seamlessly into upper arm elbow sphere)
    const elbowSocketGeo = new THREE.SphereGeometry(0.066, 12, 12);
    const elbowSocket = new THREE.Mesh(elbowSocketGeo, this.matSkin);
    elbowSocket.position.set(0, 0.11, 0);
    group.add(elbowSocket);

    // Forearm tapered muscle cylinder
    const armGeo = new THREE.CylinderGeometry(0.066, 0.055, 0.22, 12);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.castShadow = true;
    group.add(arm);

    // Wrist Joint Sphere at bottom
    const wristGeo = new THREE.SphereGeometry(0.058, 12, 12);
    const wrist = new THREE.Mesh(wristGeo, this.matSkin);
    wrist.position.set(0, -0.11, 0);
    wrist.castShadow = true;
    group.add(wrist);

    return group;
  }

  // 8. 4OZ UFC COMBAT GLOVE & FIST
  // Aligned along Y: Top is knuckles (0, +0.06, 0), Bottom is wrist socket (0, -0.06, 0)
  buildGloveMesh() {
    const group = new THREE.Group();

    // Corner Wrist Tape Wrap (Nests over forearm wrist sphere)
    const tapeGeo = new THREE.CylinderGeometry(0.066, 0.064, 0.06, 14);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.position.set(0, -0.045, 0);
    tape.castShadow = true;
    group.add(tape);

    // 4oz UFC Combat Leather Glove Block (Fist)
    const gloveGeo = new THREE.BoxGeometry(0.12, 0.10, 0.12);
    const glove = new THREE.Mesh(gloveGeo, this.matGloveLeather);
    glove.position.set(0, 0.03, 0);
    glove.castShadow = true;
    group.add(glove);

    // Finger loop / Open fingers
    const fingersGeo = new THREE.BoxGeometry(0.08, 0.03, 0.09);
    const fingers = new THREE.Mesh(fingersGeo, this.matSkin);
    fingers.position.set(0, 0.085, 0);
    group.add(fingers);

    return group;
  }

  // 9. THIGH & FIGHT SHORTS SLEEVE
  // Aligned along Y: Top is hip (0, +0.21, 0), Bottom is knee (0, -0.21, 0), total length 0.42m
  buildThighMesh() {
    const group = new THREE.Group();

    // Shorts cuff on upper thigh
    const cuffGeo = new THREE.CylinderGeometry(0.108, 0.096, 0.22, 12);
    const cuff = new THREE.Mesh(cuffGeo, this.matShorts);
    cuff.position.set(0, 0.10, 0);
    cuff.castShadow = true;
    group.add(cuff);

    // Quadriceps lower thigh
    const quadGeo = new THREE.CylinderGeometry(0.094, 0.078, 0.22, 12);
    const quad = new THREE.Mesh(quadGeo, this.matSkin);
    quad.position.set(0, -0.10, 0);
    quad.castShadow = true;
    group.add(quad);

    // Knee Sphere Joint at bottom
    const kneeGeo = new THREE.SphereGeometry(0.075, 10, 10);
    const knee = new THREE.Mesh(kneeGeo, this.matSkin);
    knee.position.set(0, -0.21, 0);
    knee.castShadow = true;
    group.add(knee);

    return group;
  }

  // 10. SHIN & CALF
  // Aligned along Y: Top is knee socket (0, +0.20, 0), Bottom is ankle (0, -0.20, 0), total length 0.40m
  buildShinMesh() {
    const group = new THREE.Group();

    // Muscular Calf / Shin
    const calfGeo = new THREE.CylinderGeometry(0.076, 0.058, 0.40, 12);
    const calf = new THREE.Mesh(calfGeo, this.matSkin);
    calf.position.set(0, 0, 0);
    calf.castShadow = true;
    group.add(calf);

    // Ankle Sphere Joint at bottom
    const ankleGeo = new THREE.SphereGeometry(0.060, 10, 10);
    const ankle = new THREE.Mesh(ankleGeo, this.matSkin);
    ankle.position.set(0, -0.20, 0);
    ankle.castShadow = true;
    group.add(ankle);

    return group;
  }

  // 11. COMBAT FOOT & GRIPPER SOLE
  // Foot extends forward along +X, sole sits on canvas
  buildFootMesh() {
    const group = new THREE.Group();

    // Corner Ankle Wrap / Compression Tape at ankle base
    const tapeGeo = new THREE.CylinderGeometry(0.064, 0.064, 0.05, 12);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.position.set(-0.02, 0.03, 0);
    tape.castShadow = true;
    group.add(tape);

    // Athletic Combat Foot - extends forward along +X
    const footGeo = new THREE.BoxGeometry(0.20, 0.055, 0.11);
    const foot = new THREE.Mesh(footGeo, this.matSkin);
    foot.position.set(0.04, 0, 0);
    foot.castShadow = true;
    group.add(foot);

    // Canvas Gripper Sole underneath
    const soleGeo = new THREE.BoxGeometry(0.205, 0.015, 0.115);
    const sole = new THREE.Mesh(soleGeo, this.matSole);
    sole.position.set(0.04, -0.032, 0);
    group.add(sole);

    return group;
  }
}
