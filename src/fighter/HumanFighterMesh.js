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
  // 1. PELVIS & UFC FIGHT SHORTS (Anatomical rounded trunk & waistband)
  buildPelvisMesh() {
    const group = new THREE.Group();

    // Rounded Shorts Trunk Base
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.165, 0.20, 24);
    trunkGeo.scale(0.92, 1.0, 1.18);
    const trunk = new THREE.Mesh(trunkGeo, this.matShorts);
    trunk.position.set(0, 0, 0);
    trunk.castShadow = true;
    group.add(trunk);

    // Anatomical Glute Roundings on Rear
    const gluteGeo = new THREE.SphereGeometry(0.09, 14, 12);
    gluteGeo.scale(0.7, 0.95, 0.9);
    [-0.08, 0.08].forEach(z => {
      const glute = new THREE.Mesh(gluteGeo, this.matShorts);
      glute.position.set(-0.07, -0.01, z);
      glute.castShadow = true;
      group.add(glute);
    });

    // Elastic UFC Waistband (Contoured oval belt)
    const bandGeo = new THREE.CylinderGeometry(0.186, 0.182, 0.055, 24);
    bandGeo.scale(0.92, 1.0, 1.18);
    const band = new THREE.Mesh(bandGeo, this.matWaistband);
    band.position.set(0, 0.08, 0);
    band.castShadow = true;
    group.add(band);

    // Inner Waist Joint Socket (Rounded core bevel preventing hollow gaps during bends)
    const socketGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.06, 20);
    const socket = new THREE.Mesh(socketGeo, this.matSkin);
    socket.position.set(0, 0.10, 0);
    group.add(socket);

    // Left & Right Leg Cuffs for Thigh Sockets (Smooth flared sleeves)
    [-0.15, 0.15].forEach(z => {
      const cuffGeo = new THREE.CylinderGeometry(0.10, 0.094, 0.045, 18);
      const cuff = new THREE.Mesh(cuffGeo, this.matShorts);
      cuff.position.set(0, -0.09, z);
      group.add(cuff);
    });

    // UFC Center Belt Emblem (Curved metallic crest)
    const emblemGeo = new THREE.BoxGeometry(0.02, 0.038, 0.06);
    const emblemMat = new THREE.MeshStandardMaterial({ color: 0xd20a0a, roughness: 0.35, metalness: 0.3 });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0.158, 0.08, 0);
    group.add(emblem);

    return group;
  }

  // 2. ABDOMEN & 6-PACK CORE (Tapered rounded waist & sculpted abs)
  buildAbdomenMesh() {
    const group = new THREE.Group();

    // Core tapered waist barrel
    const coreGeo = new THREE.CylinderGeometry(0.158, 0.145, 0.16, 24);
    coreGeo.scale(0.88, 1.0, 1.14);
    const core = new THREE.Mesh(coreGeo, this.matSkin);
    core.position.set(0, 0, 0);
    core.castShadow = true;
    group.add(core);

    // Bottom Spherical Core Plug (Nests seamlessly into pelvis waistband)
    const botPlugGeo = new THREE.SphereGeometry(0.138, 18, 14);
    botPlugGeo.scale(0.88, 0.5, 1.12);
    const botPlug = new THREE.Mesh(botPlugGeo, this.matSkin);
    botPlug.position.set(0, -0.075, 0);
    group.add(botPlug);

    // Top Spherical Core Plug (Nests seamlessly into ribcage cavity)
    const topPlugGeo = new THREE.SphereGeometry(0.148, 18, 14);
    topPlugGeo.scale(0.88, 0.5, 1.12);
    const topPlug = new THREE.Mesh(topPlugGeo, this.matSkin);
    topPlug.position.set(0, 0.075, 0);
    group.add(topPlug);

    // Anatomical 6-Pack: 6 individual rounded muscle cushions (3 rows x 2 columns)
    const abRowYs = [0.045, 0.0, -0.045];
    const abColZs = [-0.045, 0.045];
    const abPadGeo = new THREE.SphereGeometry(0.036, 12, 10);
    abPadGeo.scale(0.45, 0.85, 1.05);

    abRowYs.forEach(y => {
      abColZs.forEach(z => {
        const abPad = new THREE.Mesh(abPadGeo, this.matMuscle);
        abPad.position.set(0.126, y, z);
        abPad.castShadow = true;
        group.add(abPad);
      });
    });

    // Left & Right Oblique Muscle Contours (Smooth curved lateral flanks)
    const oblGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.12, 12);
    oblGeo.scale(0.8, 1.0, 0.4);
    [-0.14, 0.14].forEach(z => {
      const obl = new THREE.Mesh(oblGeo, this.matMuscle);
      obl.position.set(0.03, 0, z);
      obl.rotation.x = z > 0 ? 0.1 : -0.1;
      group.add(obl);
    });

    return group;
  }

  // 3. CHEST & BROAD SHOULDERS (Broad rounded barrel ribcage & sculpted pectorals)
  buildChestMesh() {
    const group = new THREE.Group();

    // Broad rounded athletic barrel chest
    const chestGeo = new THREE.CylinderGeometry(0.188, 0.162, 0.22, 24);
    chestGeo.scale(0.90, 1.0, 1.25);
    const chest = new THREE.Mesh(chestGeo, this.matSkin);
    chest.position.set(0, 0, 0);
    chest.castShadow = true;
    group.add(chest);

    // Bottom Ribcage Bevel Socket (Seamlessly encloses top of abdomen core)
    const ribSocketGeo = new THREE.CylinderGeometry(0.165, 0.155, 0.05, 20);
    ribSocketGeo.scale(0.90, 1.0, 1.20);
    const ribSocket = new THREE.Mesh(ribSocketGeo, this.matSkin);
    ribSocket.position.set(0, -0.10, 0);
    group.add(ribSocket);

    // Twin Sculpted Pectoral Muscles (Anatomical rounded slabs)
    const pecGeo = new THREE.SphereGeometry(0.105, 16, 14);
    pecGeo.scale(0.55, 0.85, 1.15);
    [-0.09, 0.09].forEach(z => {
      const pec = new THREE.Mesh(pecGeo, this.matMuscle);
      pec.position.set(0.13, 0.02, z);
      pec.castShadow = true;
      group.add(pec);
    });

    // Lateral Latissimus Dorsi Back Contours (V-Taper flair)
    const latGeo = new THREE.CylinderGeometry(0.045, 0.075, 0.18, 12);
    latGeo.scale(0.7, 1.0, 0.5);
    [-0.18, 0.18].forEach(z => {
      const lat = new THREE.Mesh(latGeo, this.matMuscle);
      lat.position.set(-0.06, -0.02, z);
      group.add(lat);
    });

    // Broad Deltoid Shoulder Caps (Smooth spherical ball sockets)
    [-0.21, 0.21].forEach(z => {
      const deltGeo = new THREE.SphereGeometry(0.108, 18, 18);
      deltGeo.scale(0.95, 1.12, 1.05);
      const delt = new THREE.Mesh(deltGeo, this.matSkin);
      delt.position.set(0, 0.06, z);
      delt.castShadow = true;
      group.add(delt);
    });

    // Clavicle Collar Socket for Neck Base
    const collarGeo = new THREE.CylinderGeometry(0.082, 0.092, 0.035, 18);
    const collar = new THREE.Mesh(collarGeo, this.matSkin);
    collar.position.set(0.02, 0.11, 0);
    group.add(collar);

    return group;
  }

  // 4. NECK (Anatomical Cervical Column)
  buildNeckMesh() {
    const group = new THREE.Group();

    const neckGeo = new THREE.CylinderGeometry(0.075, 0.088, 0.12, 18);
    const neck = new THREE.Mesh(neckGeo, this.matSkin);
    neck.castShadow = true;
    group.add(neck);

    // Subtle SCM muscle ridge on front sides
    const scmGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.11, 8);
    [-0.035, 0.035].forEach(z => {
      const scm = new THREE.Mesh(scmGeo, this.matMuscle);
      scm.position.set(0.055, 0, z);
      scm.rotation.z = -0.15;
      group.add(scm);
    });

    return group;
  }

  // 5. HEAD & FACIAL SCULPT (Rounded realistic anatomical skull, chiseled jaw & features)
  buildHeadMesh(facingDir = 1) {
    const group = new THREE.Group();

    // Cranium: Smooth Anatomical Cranial Dome
    const craniumGeo = new THREE.SphereGeometry(0.118, 22, 18);
    craniumGeo.scale(0.92, 1.12, 1.02);
    const cranium = new THREE.Mesh(craniumGeo, this.matSkin);
    cranium.position.set(0, 0.03, 0);
    cranium.castShadow = true;
    group.add(cranium);

    // Chiseled Tapered Jaw & Chin
    const jawGeo = new THREE.CylinderGeometry(0.095, 0.072, 0.10, 18);
    jawGeo.scale(1.0, 1.0, 0.88);
    const jaw = new THREE.Mesh(jawGeo, this.matSkin);
    jaw.position.set(0.03 * facingDir, -0.065, 0);
    jaw.castShadow = true;
    group.add(jaw);

    // Chin Button Rounding
    const chinGeo = new THREE.SphereGeometry(0.036, 12, 12);
    chinGeo.scale(1.0, 0.85, 0.9);
    const chin = new THREE.Mesh(chinGeo, this.matSkin);
    chin.position.set(0.095 * facingDir, -0.095, 0);
    chin.castShadow = true;
    group.add(chin);

    // Sculpted Nose (Tapered rounded bridge & tip)
    const noseGeo = new THREE.ConeGeometry(0.032, 0.06, 12);
    noseGeo.scale(0.8, 1.0, 0.7);
    const nose = new THREE.Mesh(noseGeo, this.matSkin);
    nose.position.set(0.125 * facingDir, 0.015, 0);
    nose.rotation.z = -Math.PI / 2 * facingDir;
    group.add(nose);

    // Sculpted Brow Ridge
    const browGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12);
    browGeo.scale(1.2, 0.7, 1.0);
    const brow = new THREE.Mesh(browGeo, this.matMuscle);
    brow.position.set(0.108 * facingDir, 0.055, 0);
    brow.rotation.x = Math.PI / 2;
    group.add(brow);

    // Mouthguard inside parted lips
    const mouthGeo = new THREE.BoxGeometry(0.018, 0.018, 0.065);
    const mouth = new THREE.Mesh(mouthGeo, this.matMouthguard);
    mouth.position.set(0.115 * facingDir, -0.045, 0);
    group.add(mouth);

    // Anatomical Ears (Curved oval lobes)
    [-0.115, 0.115].forEach(z => {
      const earGeo = new THREE.SphereGeometry(0.032, 10, 8);
      earGeo.scale(0.35, 1.25, 0.75);
      const ear = new THREE.Mesh(earGeo, this.matSkin);
      ear.position.set(-0.01 * facingDir, 0.01, z);
      group.add(ear);
    });

    // Athletic Fade Buzzcut Hair (Smooth curved cap matching cranial contour)
    const hairGeo = new THREE.SphereGeometry(0.122, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    hairGeo.scale(0.92, 1.12, 1.02);
    const hair = new THREE.Mesh(hairGeo, this.matHair);
    hair.position.set(0, 0.035, 0);
    hair.castShadow = true;
    group.add(hair);

    return group;
  }

  // 6. UPPER ARM (Extended Reach 0.35m - Biceps & Triceps)
  // Aligned along Y: Top is shoulder (0, +0.175, 0), Bottom is elbow (0, -0.175, 0)
  buildUpperArmMesh() {
    const group = new THREE.Group();

    // Upper arm smooth muscular cylinder
    const armGeo = new THREE.CylinderGeometry(0.076, 0.064, 0.35, 18);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.castShadow = true;
    group.add(arm);

    // Bicep / Tricep muscle belly bulge
    const bicepGeo = new THREE.SphereGeometry(0.078, 14, 12);
    bicepGeo.scale(1.18, 1.35, 1.0);
    const bicep = new THREE.Mesh(bicepGeo, this.matSkin);
    bicep.position.set(0.01, 0.02, 0);
    group.add(bicep);

    // Shoulder sphere joint cap at top (Nests inside chest deltoid socket with zero gap)
    const shoulderGeo = new THREE.SphereGeometry(0.092, 16, 16);
    const shoulder = new THREE.Mesh(shoulderGeo, this.matSkin);
    shoulder.position.set(0, 0.175, 0);
    group.add(shoulder);

    // Elbow sphere joint at bottom
    const elbowGeo = new THREE.SphereGeometry(0.068, 14, 14);
    const elbow = new THREE.Mesh(elbowGeo, this.matSkin);
    elbow.position.set(0, -0.175, 0);
    elbow.castShadow = true;
    group.add(elbow);

    return group;
  }

  // 7. FOREARM (Extended Reach 0.31m - Tapered muscular forearm & wrist socket)
  // Aligned along Y: Top is elbow socket (0, +0.155, 0), Bottom is wrist (0, -0.155, 0)
  buildForearmMesh() {
    const group = new THREE.Group();

    // Elbow socket joint cap at top (Nests seamlessly into upper arm elbow sphere)
    const elbowSocketGeo = new THREE.SphereGeometry(0.070, 14, 14);
    const elbowSocket = new THREE.Mesh(elbowSocketGeo, this.matSkin);
    elbowSocket.position.set(0, 0.155, 0);
    group.add(elbowSocket);

    // Forearm tapered muscle cylinder
    const armGeo = new THREE.CylinderGeometry(0.068, 0.052, 0.31, 18);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.castShadow = true;
    group.add(arm);

    // Brachioradialis upper forearm contour
    const brachioGeo = new THREE.SphereGeometry(0.068, 12, 12);
    brachioGeo.scale(1.15, 1.4, 0.95);
    const brachio = new THREE.Mesh(brachioGeo, this.matSkin);
    brachio.position.set(0.015, 0.055, 0);
    group.add(brachio);

    // Wrist Joint Sphere at bottom
    const wristGeo = new THREE.SphereGeometry(0.056, 14, 14);
    const wrist = new THREE.Mesh(wristGeo, this.matSkin);
    wrist.position.set(0, -0.155, 0);
    wrist.castShadow = true;
    group.add(wrist);

    return group;
  }

  // 8. 4OZ UFC COMBAT GLOVE & FIST (Rounded padded combat glove)
  // Aligned along Y: Top is knuckles (0, +0.06, 0), Bottom is wrist socket (0, -0.06, 0)
  buildGloveMesh() {
    const group = new THREE.Group();

    // Corner Wrist Tape Wrap (Nests over forearm wrist sphere)
    const tapeGeo = new THREE.CylinderGeometry(0.065, 0.063, 0.06, 18);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.position.set(0, -0.045, 0);
    tape.castShadow = true;
    group.add(tape);

    // 4oz UFC Combat Leather Padded Knuckle Dome (Rounded fist)
    const gloveGeo = new THREE.SphereGeometry(0.068, 16, 14);
    gloveGeo.scale(1.10, 0.88, 1.15);
    const glove = new THREE.Mesh(gloveGeo, this.matGloveLeather);
    glove.position.set(0, 0.03, 0);
    glove.castShadow = true;
    group.add(glove);

    // Thumb padding on inner edge
    const thumbGeo = new THREE.SphereGeometry(0.032, 10, 10);
    thumbGeo.scale(0.8, 1.3, 0.8);
    const thumb = new THREE.Mesh(thumbGeo, this.matGloveLeather);
    thumb.position.set(0.04, 0.015, -0.05);
    group.add(thumb);

    // Finger loop / Open fingers knuckle trim
    const fingersGeo = new THREE.CylinderGeometry(0.045, 0.042, 0.03, 14);
    fingersGeo.scale(1.0, 1.0, 1.25);
    const fingers = new THREE.Mesh(fingersGeo, this.matSkin);
    fingers.position.set(0, 0.082, 0);
    group.add(fingers);

    return group;
  }

  // 9. THIGH & FIGHT SHORTS SLEEVE (Rounded muscular quadriceps)
  // Aligned along Y: Top is hip (0, +0.21, 0), Bottom is knee (0, -0.21, 0), total length 0.42m
  buildThighMesh() {
    const group = new THREE.Group();

    // Shorts sleeve cuff on upper thigh
    const cuffGeo = new THREE.CylinderGeometry(0.112, 0.098, 0.22, 18);
    const cuff = new THREE.Mesh(cuffGeo, this.matShorts);
    cuff.position.set(0, 0.10, 0);
    cuff.castShadow = true;
    group.add(cuff);

    // Quadriceps lower thigh (Anatomical rounded taper)
    const quadGeo = new THREE.CylinderGeometry(0.098, 0.080, 0.22, 18);
    const quad = new THREE.Mesh(quadGeo, this.matSkin);
    quad.position.set(0, -0.10, 0);
    quad.castShadow = true;
    group.add(quad);

    // Quad Vastus Medialis teardrop contour
    const teardropGeo = new THREE.SphereGeometry(0.045, 12, 10);
    teardropGeo.scale(0.9, 1.2, 0.8);
    const teardrop = new THREE.Mesh(teardropGeo, this.matSkin);
    teardrop.position.set(0.05, -0.11, 0);
    group.add(teardrop);

    // Knee Sphere Joint at bottom
    const kneeGeo = new THREE.SphereGeometry(0.078, 14, 14);
    const knee = new THREE.Mesh(kneeGeo, this.matSkin);
    knee.position.set(0, -0.21, 0);
    knee.castShadow = true;
    group.add(knee);

    return group;
  }

  // 10. SHIN & CALF (Anatomical muscular calf contour)
  // Aligned along Y: Top is knee socket (0, +0.20, 0), Bottom is ankle (0, -0.20, 0), total length 0.40m
  buildShinMesh() {
    const group = new THREE.Group();

    // Muscular Calf / Shin tapered cylinder
    const calfGeo = new THREE.CylinderGeometry(0.080, 0.058, 0.40, 18);
    const calf = new THREE.Mesh(calfGeo, this.matSkin);
    calf.position.set(0, 0, 0);
    calf.castShadow = true;
    group.add(calf);

    // Gastrocnemius posterior calf bulge
    const calfBulgeGeo = new THREE.SphereGeometry(0.082, 14, 12);
    calfBulgeGeo.scale(0.85, 1.35, 0.9);
    const calfBulge = new THREE.Mesh(calfBulgeGeo, this.matSkin);
    calfBulge.position.set(-0.02, 0.065, 0);
    group.add(calfBulge);

    // Ankle Sphere Joint at bottom
    const ankleGeo = new THREE.SphereGeometry(0.062, 14, 14);
    const ankle = new THREE.Mesh(ankleGeo, this.matSkin);
    ankle.position.set(0, -0.20, 0);
    ankle.castShadow = true;
    group.add(ankle);

    return group;
  }

  // 11. COMBAT FOOT & GRIPPER SOLE (Rounded athletic foot & contoured sole)
  // Foot extends forward along +X, sole sits on canvas
  buildFootMesh() {
    const group = new THREE.Group();

    // Corner Ankle Wrap / Compression Tape at ankle base
    const tapeGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.position.set(-0.02, 0.03, 0);
    tape.castShadow = true;
    group.add(tape);

    // Rounded Athletic Combat Foot - extends forward along +X with rounded toe box
    const footGeo = new THREE.CylinderGeometry(0.055, 0.048, 0.18, 16);
    footGeo.scale(1.0, 0.55, 1.05);
    const foot = new THREE.Mesh(footGeo, this.matSkin);
    foot.rotation.z = Math.PI / 2;
    foot.position.set(0.04, 0, 0);
    foot.castShadow = true;
    group.add(foot);

    // Rounded Toe Cap
    const toeGeo = new THREE.SphereGeometry(0.048, 12, 10);
    toeGeo.scale(0.6, 0.55, 1.0);
    const toe = new THREE.Mesh(toeGeo, this.matSkin);
    toe.position.set(0.13, 0, 0);
    group.add(toe);

    // Canvas Gripper Sole underneath
    const soleGeo = new THREE.CylinderGeometry(0.058, 0.052, 0.19, 16);
    soleGeo.scale(1.0, 0.15, 1.08);
    const sole = new THREE.Mesh(soleGeo, this.matSole);
    sole.rotation.z = Math.PI / 2;
    sole.position.set(0.04, -0.028, 0);
    group.add(sole);

    return group;
  }
}
