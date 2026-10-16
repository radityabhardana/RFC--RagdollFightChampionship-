import * as THREE from 'three';

/**
 * Clean Stylized Humanoid Fighter Mesh (17-Segment Smooth Capsule Architecture)
 * 
 * Features:
 * - 17 Fully Articulated Anatomical Segments without ANY lumpy protruding spheres:
 *   1. Pelvis (UFC fight shorts & waistband)
 *   2. Abdomen (Smooth tapered athletic core)
 *   3. Chest (Athletic V-taper ribcage & smooth deltoid shoulders)
 *   4. Neck (Clean cervical column)
 *   5. Head (Sleek stylized athletic fighter head, focused eyes, buzzcut, mouthguard)
 *   6-7. Left & Right Upper Arms (Smooth athletic capsules, 0.35m reach)
 *   8-9. Left & Right Forearms (Smooth athletic capsules, 0.31m reach)
 *   10-11. Left & Right 4oz UFC Combat Gloves (Curved padded leather & corner tape)
 *   12-13. Left & Right Thighs (Shorts sleeves & smooth quadriceps, 0.42m)
 *   14-15. Left & Right Shins (Smooth muscular shins, 0.40m)
 *   16-17. Left & Right Combat Feet (Smooth rounded feet, ankle tape & grip soles)
 * 
 * Aesthetics:
 * - Clean, sleek, rounded human silhouette (like premium stylized action figures / Gang Beasts / Toribash).
 * - Zero lumpy bumps ("cacaran"/chickenpox boils completely eliminated).
 * - Continuous smooth capsule surfaces matching physics collision hulls 1-to-1.
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
    // Stylized warm smooth skin with soft specular reflection
    this.matSkin = new THREE.MeshStandardMaterial({
      color: this.skinColor,
      roughness: 0.50,
      metalness: 0.04,
    });

    // UFC Fight Shorts Fabric
    this.matShorts = new THREE.MeshStandardMaterial({
      color: this.shortsColor,
      roughness: 0.60,
      metalness: 0.12,
    });

    // Shorts Elastic Waistband (Dark matte charcoal)
    this.matWaistband = new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.65,
      metalness: 0.20,
    });

    // Official 4oz MMA Gloves (Matte black combat leather)
    this.matGloveLeather = new THREE.MeshStandardMaterial({
      color: 0x18191d,
      roughness: 0.35,
      metalness: 0.25,
    });

    // Corner Wrist & Ankle Tape (Red / Blue corner tape)
    this.matTape = new THREE.MeshStandardMaterial({
      color: this.cornerColor,
      roughness: 0.45,
      metalness: 0.10,
    });

    // Athletic Hair
    this.matHair = new THREE.MeshStandardMaterial({
      color: this.isPlayer ? 0x241a14 : 0x161412,
      roughness: 0.85,
    });

    // Fighter Eyes (Focused dark gaze)
    this.matEyes = new THREE.MeshStandardMaterial({
      color: 0x111215,
      roughness: 0.20,
    });

    // Mouthguard (White)
    this.matMouthguard = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.30,
    });

    // Foot Soles (High-grip canvas rubber)
    this.matSole = new THREE.MeshStandardMaterial({
      color: 0x1f2126,
      roughness: 0.85,
    });
  }

  // 1. PELVIS & UFC FIGHT SHORTS (Smooth rounded trunk & waistband)
  buildPelvisMesh() {
    const group = new THREE.Group();

    // Smooth rounded shorts trunk
    const trunkGeo = new THREE.CapsuleGeometry(0.145, 0.08, 12, 28);
    trunkGeo.scale(0.88, 1.0, 1.18);
    const trunk = new THREE.Mesh(trunkGeo, this.matShorts);
    trunk.position.set(0, 0, 0);
    trunk.castShadow = true;
    group.add(trunk);

    // Elastic UFC Waistband
    const bandGeo = new THREE.CylinderGeometry(0.158, 0.156, 0.045, 28);
    bandGeo.scale(0.88, 1.0, 1.18);
    const band = new THREE.Mesh(bandGeo, this.matWaistband);
    band.position.set(0, 0.07, 0);
    band.castShadow = true;
    group.add(band);

    // Small red UFC belt patch on front
    const emblemGeo = new THREE.BoxGeometry(0.015, 0.03, 0.045);
    const emblemMat = new THREE.MeshStandardMaterial({ color: 0xd20a0a, roughness: 0.35, metalness: 0.30 });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0.142, 0.07, 0);
    group.add(emblem);

    return group;
  }

  // 2. ABDOMEN (Smooth tapered athletic core)
  buildAbdomenMesh() {
    const group = new THREE.Group();

    // Smooth athletic waist capsule - seamlessly connects pelvis to ribcage
    const coreGeo = new THREE.CapsuleGeometry(0.13, 0.07, 12, 28);
    coreGeo.scale(0.85, 1.0, 1.12);
    const core = new THREE.Mesh(coreGeo, this.matSkin);
    core.position.set(0, 0, 0);
    core.castShadow = true;
    group.add(core);

    return group;
  }

  // 3. CHEST & BROAD SHOULDERS (Athletic V-taper ribcage & smooth shoulder caps)
  buildChestMesh() {
    const group = new THREE.Group();

    // Broad athletic torso capsule
    const chestGeo = new THREE.CapsuleGeometry(0.155, 0.08, 12, 28);
    chestGeo.scale(0.84, 1.0, 1.25);
    const chest = new THREE.Mesh(chestGeo, this.matSkin);
    chest.position.set(0, 0.01, 0);
    chest.castShadow = true;
    group.add(chest);

    // Smooth deltoid shoulder sockets (nest smoothly into upper arm tops)
    [-0.21, 0.21].forEach(z => {
      const deltGeo = new THREE.SphereGeometry(0.085, 18, 18);
      const delt = new THREE.Mesh(deltGeo, this.matSkin);
      delt.position.set(0, 0.06, z);
      delt.castShadow = true;
      group.add(delt);
    });

    // Clean collar socket at neck base
    const collarGeo = new THREE.CylinderGeometry(0.075, 0.082, 0.03, 20);
    const collar = new THREE.Mesh(collarGeo, this.matSkin);
    collar.position.set(0.01, 0.10, 0);
    group.add(collar);

    return group;
  }

  // 4. NECK (Clean cervical column)
  buildNeckMesh() {
    const group = new THREE.Group();

    const neckGeo = new THREE.CylinderGeometry(0.072, 0.082, 0.11, 24);
    const neck = new THREE.Mesh(neckGeo, this.matSkin);
    neck.castShadow = true;
    group.add(neck);

    return group;
  }

  // 5. HEAD & FACIAL SCULPT (Sleek stylized athletic fighter head)
  buildHeadMesh(facingDir = 1) {
    const group = new THREE.Group();

    // Smooth athletic cranium dome
    const craniumGeo = new THREE.SphereGeometry(0.125, 24, 20);
    craniumGeo.scale(0.92, 1.08, 0.95);
    const cranium = new THREE.Mesh(craniumGeo, this.matSkin);
    cranium.position.set(0, 0.02, 0);
    cranium.castShadow = true;
    group.add(cranium);

    // Chiseled athletic jawline
    const jawGeo = new THREE.CylinderGeometry(0.095, 0.072, 0.09, 20);
    jawGeo.scale(0.95, 1.0, 0.88);
    const jaw = new THREE.Mesh(jawGeo, this.matSkin);
    jaw.position.set(0.02 * facingDir, -0.06, 0);
    jaw.castShadow = true;
    group.add(jaw);

    // Smooth rounded chin
    const chinGeo = new THREE.SphereGeometry(0.038, 14, 14);
    const chin = new THREE.Mesh(chinGeo, this.matSkin);
    chin.position.set(0.07 * facingDir, -0.09, 0);
    chin.castShadow = true;
    group.add(chin);

    // Sleek buzzcut hair that closely wraps the head
    const hairGeo = new THREE.SphereGeometry(0.128, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
    hairGeo.scale(0.92, 1.08, 0.95);
    const hair = new THREE.Mesh(hairGeo, this.matHair);
    hair.position.set(0, 0.025, 0);
    hair.castShadow = true;
    group.add(hair);

    // Focused fighter eyes
    const eyeGeo = new THREE.SphereGeometry(0.014, 10, 10);
    eyeGeo.scale(0.4, 0.7, 1.0);
    [-0.045, 0.045].forEach(z => {
      const eye = new THREE.Mesh(eyeGeo, this.matEyes);
      eye.position.set(0.095 * facingDir, 0.025, z);
      group.add(eye);
    });

    // Subtle athletic nose bridge (no protruding cone!)
    const noseGeo = new THREE.BoxGeometry(0.025, 0.035, 0.022);
    const nose = new THREE.Mesh(noseGeo, this.matSkin);
    nose.position.set(0.108 * facingDir, 0.005, 0);
    group.add(nose);

    // Clean mouthguard strip
    const mouthGeo = new THREE.BoxGeometry(0.012, 0.016, 0.055);
    const mouth = new THREE.Mesh(mouthGeo, this.matMouthguard);
    mouth.position.set(0.095 * facingDir, -0.042, 0);
    group.add(mouth);

    // Flush, natural ears
    [-0.118, 0.118].forEach(z => {
      const earGeo = new THREE.SphereGeometry(0.025, 12, 10);
      earGeo.scale(0.3, 1.0, 0.7);
      const ear = new THREE.Mesh(earGeo, this.matSkin);
      ear.position.set(-0.01 * facingDir, 0.01, z);
      group.add(ear);
    });

    return group;
  }

  // 6. UPPER ARM (Extended 0.35m - Single Smooth Athletic Capsule)
  // Aligned along Y: Top is shoulder (0, +0.175, 0), Bottom is elbow (0, -0.175, 0)
  buildUpperArmMesh() {
    const group = new THREE.Group();

    // Radius 0.065, cylinder length 0.22 -> Total height = 0.22 + 2*0.065 = 0.35m
    const armGeo = new THREE.CapsuleGeometry(0.065, 0.22, 14, 24);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.position.set(0, 0, 0);
    arm.castShadow = true;
    group.add(arm);

    return group;
  }

  // 7. FOREARM (Extended 0.31m - Single Smooth Athletic Capsule)
  // Aligned along Y: Top is elbow socket (0, +0.155, 0), Bottom is wrist (0, -0.155, 0)
  buildForearmMesh() {
    const group = new THREE.Group();

    // Radius 0.055, cylinder length 0.20 -> Total height = 0.20 + 2*0.055 = 0.31m
    const armGeo = new THREE.CapsuleGeometry(0.055, 0.20, 14, 24);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.position.set(0, 0, 0);
    arm.castShadow = true;
    group.add(arm);

    return group;
  }

  // 8. 4OZ UFC COMBAT GLOVE & FIST (Smooth curved padded glove & corner tape)
  buildGloveMesh() {
    const group = new THREE.Group();

    // Corner Wrist Tape Wrap (Red / Blue corner tape)
    const tapeGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.05, 24);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.position.set(0, -0.045, 0);
    tape.castShadow = true;
    group.add(tape);

    // Smooth padded 4oz MMA combat glove
    const gloveGeo = new THREE.CapsuleGeometry(0.058, 0.05, 14, 24);
    const glove = new THREE.Mesh(gloveGeo, this.matGloveLeather);
    glove.position.set(0, 0.02, 0);
    glove.castShadow = true;
    group.add(glove);

    return group;
  }

  // 9. THIGH & FIGHT SHORTS SLEEVE (Smooth Capsule with Shorts Cuff)
  // Aligned along Y: Top is hip (0, +0.21, 0), Bottom is knee (0, -0.21, 0), total length 0.42m
  buildThighMesh() {
    const group = new THREE.Group();

    // Radius 0.075, cylinder length 0.27 -> Total height = 0.27 + 2*0.075 = 0.42m
    const thighGeo = new THREE.CapsuleGeometry(0.075, 0.27, 14, 24);
    const thigh = new THREE.Mesh(thighGeo, this.matSkin);
    thigh.position.set(0, 0, 0);
    thigh.castShadow = true;
    group.add(thigh);

    // Shorts sleeve cuff on upper thigh
    const cuffGeo = new THREE.CylinderGeometry(0.088, 0.082, 0.20, 24);
    const cuff = new THREE.Mesh(cuffGeo, this.matShorts);
    cuff.position.set(0, 0.10, 0);
    cuff.castShadow = true;
    group.add(cuff);

    return group;
  }

  // 10. SHIN (Smooth Muscular Shin Capsule)
  // Aligned along Y: Top is knee socket (0, +0.20, 0), Bottom is ankle (0, -0.20, 0), total length 0.40m
  buildShinMesh() {
    const group = new THREE.Group();

    // Radius 0.065, cylinder length 0.27 -> Total height = 0.27 + 2*0.065 = 0.40m
    const shinGeo = new THREE.CapsuleGeometry(0.065, 0.27, 14, 24);
    const shin = new THREE.Mesh(shinGeo, this.matSkin);
    shin.position.set(0, 0, 0);
    shin.castShadow = true;
    group.add(shin);

    return group;
  }

  // 11. COMBAT FOOT & GRIPPER SOLE (Smooth rounded athletic foot & sole)
  // Foot extends forward along +X, sole sits on canvas
  buildFootMesh() {
    const group = new THREE.Group();

    // Corner Ankle Wrap / Compression Tape at ankle base
    const tapeGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.05, 24);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.position.set(-0.02, 0.03, 0);
    tape.castShadow = true;
    group.add(tape);

    // Smooth Rounded Athletic Combat Foot - Capsule oriented horizontally along +X
    const footGeo = new THREE.CapsuleGeometry(0.048, 0.12, 12, 20);
    const foot = new THREE.Mesh(footGeo, this.matSkin);
    foot.rotation.z = Math.PI / 2;
    foot.position.set(0.04, 0, 0);
    foot.castShadow = true;
    group.add(foot);

    // Flat Canvas Gripper Sole underneath
    const soleGeo = new THREE.BoxGeometry(0.18, 0.018, 0.085);
    const sole = new THREE.Mesh(soleGeo, this.matSole);
    sole.position.set(0.04, -0.046, 0);
    group.add(sole);

    return group;
  }
}
