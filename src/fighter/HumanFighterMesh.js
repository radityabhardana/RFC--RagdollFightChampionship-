import * as THREE from 'three';

// Procedural Anatomical Human Musculoskeletal Sculpt for UFC Fighters
// Creates realistic V-taper physique, pectorals, 6-pack abs, deltoids, biceps,
// jawline, ears, mouthguard, authentic 4oz MMA gloves, and UFC fight shorts.

export class HumanFighterMesh {
  constructor(config = {}) {
    this.skinColor = config.skinColor || 0xd99b7d;
    this.shortsColor = config.shortsColor || 0xd4af37;
    this.corner = config.corner || 'RED';
    this.cornerColor = this.corner === 'RED' ? 0xd20a0a : 0x0a5cd2;
    this.isPlayer = config.isPlayer || false;

    this.initMaterials();
  }

  initMaterials() {
    // Realistic human skin with sweat sheen under arena floodlights
    this.matSkin = new THREE.MeshStandardMaterial({
      color: this.skinColor,
      roughness: 0.42, // Glistening sweat
      metalness: 0.04,
    });

    // Pectoral / Abdominal muscle shade (subtle shadow contour)
    const shadowColor = new THREE.Color(this.skinColor).multiplyScalar(0.92);
    this.matMuscleShadow = new THREE.MeshStandardMaterial({
      color: shadowColor,
      roughness: 0.45,
      metalness: 0.04,
    });

    // UFC Fight Shorts Fabric
    this.matShorts = new THREE.MeshStandardMaterial({
      color: this.shortsColor,
      roughness: 0.65,
      metalness: 0.15,
    });

    // Shorts Elastic Waistband
    this.matWaistband = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.7,
      metalness: 0.2,
    });

    // 4oz MMA Gloves (Matte black leather)
    this.matGloveLeather = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.35,
      metalness: 0.25,
    });

    // Corner Tape (Red/Blue tape around wrists & ankles)
    this.matTape = new THREE.MeshStandardMaterial({
      color: this.cornerColor,
      roughness: 0.5,
      metalness: 0.1,
    });

    // Hair material
    this.matHair = new THREE.MeshStandardMaterial({
      color: this.isPlayer ? 0x221812 : 0x181512,
      roughness: 0.9,
    });

    // Mouthguard (white/red)
    this.matMouthguard = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.3,
    });
  }

  // 1. ANATOMICAL HEAD & NECK
  buildHeadMesh(facingDir) {
    const group = new THREE.Group();

    // Cranium / Skull
    const craniumGeo = new THREE.SphereGeometry(0.165, 20, 20);
    craniumGeo.scale(0.92, 1.05, 0.98);
    const cranium = new THREE.Mesh(craniumGeo, this.matSkin);
    cranium.castShadow = true;
    group.add(cranium);

    // Chiseled Jawline & Chin
    const jawGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.14, 12);
    jawGeo.scale(0.85, 1.0, 1.15);
    const jaw = new THREE.Mesh(jawGeo, this.matSkin);
    jaw.position.set(0.04 * facingDir, -0.07, 0);
    jaw.rotation.z = -facingDir * 0.15;
    jaw.castShadow = true;
    group.add(jaw);

    // Chin bone protrusion
    const chinGeo = new THREE.SphereGeometry(0.045, 10, 10);
    const chin = new THREE.Mesh(chinGeo, this.matSkin);
    chin.position.set(0.14 * facingDir, -0.12, 0);
    group.add(chin);

    // Brow Ridge & Nose
    const browGeo = new THREE.BoxGeometry(0.06, 0.03, 0.13);
    const brow = new THREE.Mesh(browGeo, this.matSkin);
    brow.position.set(0.14 * facingDir, 0.03, 0);
    group.add(brow);

    const noseGeo = new THREE.ConeGeometry(0.032, 0.07, 6);
    const nose = new THREE.Mesh(noseGeo, this.matSkin);
    nose.position.set(0.17 * facingDir, -0.01, 0);
    nose.rotation.z = -facingDir * Math.PI / 2.8;
    group.add(nose);

    // Mouthguard inside lips
    const mouthGeo = new THREE.BoxGeometry(0.04, 0.018, 0.07);
    const mouth = new THREE.Mesh(mouthGeo, this.matMouthguard);
    mouth.position.set(0.135 * facingDir, -0.07, 0);
    group.add(mouth);

    // Ears
    [-0.15, 0.15].forEach(z => {
      const earGeo = new THREE.SphereGeometry(0.035, 8, 8);
      earGeo.scale(0.5, 1.1, 0.6);
      const ear = new THREE.Mesh(earGeo, this.matSkin);
      ear.position.set(-0.02 * facingDir, 0, z);
      group.add(ear);
    });

    // Athletic Fade Buzzcut Hair
    const hairGeo = new THREE.SphereGeometry(0.172, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2.1);
    hairGeo.scale(0.93, 1.05, 0.99);
    const hair = new THREE.Mesh(hairGeo, this.matHair);
    hair.position.set(-0.01 * facingDir, 0.02, 0);
    group.add(hair);

    return group;
  }

  // 2. SCULPTED TORSO & V-TAPER CHEST
  buildTorsoMesh() {
    const group = new THREE.Group();

    // Core ribcage cylinder base
    const ribGeo = new THREE.CylinderGeometry(0.27, 0.23, 0.45, 18);
    ribGeo.scale(0.85, 1.0, 1.25); // Broad across shoulders, athletic depth
    const ribMesh = new THREE.Mesh(ribGeo, this.matSkin);
    ribMesh.castShadow = true;
    group.add(ribMesh);

    // Twin Pectoral Muscles (Left & Right Pec slabs)
    const pecGeo = new THREE.BoxGeometry(0.11, 0.14, 0.15);
    [-0.09, 0.09].forEach(z => {
      const pec = new THREE.Mesh(pecGeo, this.matSkin);
      pec.position.set(0.13, 0.11, z);
      pec.rotation.y = (z > 0 ? 0.15 : -0.15);
      pec.castShadow = true;
      group.add(pec);
    });

    // 6-Pack Abdominal Muscles (Sculpted core contour)
    const abGeo = new THREE.BoxGeometry(0.05, 0.055, 0.08);
    const abRows = [
      { y: 0.01, zOff: 0.05 },
      { y: -0.07, zOff: 0.048 },
      { y: -0.14, zOff: 0.045 },
    ];
    abRows.forEach(row => {
      [-row.zOff, row.zOff].forEach(z => {
        const ab = new THREE.Mesh(abGeo, this.matMuscleShadow);
        ab.position.set(0.12, row.y, z);
        ab.castShadow = true;
        group.add(ab);
      });
    });

    // Latissimus Dorsi (V-Taper back wings)
    [-0.20, 0.20].forEach(z => {
      const latGeo = new THREE.ConeGeometry(0.14, 0.32, 8);
      latGeo.scale(0.5, 1.0, 0.7);
      const lat = new THREE.Mesh(latGeo, this.matSkin);
      lat.position.set(-0.06, 0.06, z);
      lat.rotation.z = Math.PI;
      group.add(lat);
    });

    // Deltoid Shoulder Caps
    [-0.30, 0.30].forEach(z => {
      const deltGeo = new THREE.SphereGeometry(0.11, 14, 14);
      deltGeo.scale(0.9, 1.1, 0.9);
      const delt = new THREE.Mesh(deltGeo, this.matSkin);
      delt.position.set(0, 0.18, z);
      delt.castShadow = true;
      group.add(delt);
    });

    return group;
  }

  // 3. PELVIS & UFC FIGHT SHORTS
  buildPelvisMesh() {
    const group = new THREE.Group();

    // Hips base
    const hipGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.35, 16);
    hipGeo.scale(0.85, 1.0, 1.15);
    const hips = new THREE.Mesh(hipGeo, this.matShorts);
    hips.castShadow = true;
    group.add(hips);

    // Elastic UFC Waistband
    const bandGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.07, 18);
    bandGeo.scale(0.86, 1.0, 1.16);
    const band = new THREE.Mesh(bandGeo, this.matWaistband);
    band.position.set(0, 0.15, 0);
    group.add(band);

    // UFC Logo Emblem on waistband
    const logoGeo = new THREE.BoxGeometry(0.04, 0.045, 0.06);
    const logoMat = new THREE.MeshStandardMaterial({ color: 0xd20a0a, roughness: 0.4 });
    const logo = new THREE.Mesh(logoGeo, logoMat);
    logo.position.set(0.21, 0.15, 0);
    group.add(logo);

    return group;
  }

  // 4. UPPER ARM (Biceps & Triceps)
  buildUpperArmMesh() {
    const group = new THREE.Group();

    // Main upper arm cylinder
    const armGeo = new THREE.CylinderGeometry(0.082, 0.072, 0.32, 14);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.castShadow = true;
    group.add(arm);

    // Biceps bulge
    const bicepGeo = new THREE.SphereGeometry(0.065, 10, 10);
    bicepGeo.scale(0.8, 1.4, 0.9);
    const bicep = new THREE.Mesh(bicepGeo, this.matSkin);
    bicep.position.set(0.04, 0.02, 0);
    group.add(bicep);

    return group;
  }

  // 5. FOREARM & OFFICIAL 4OZ UFC GLOVE
  buildGloveMesh(facingDir) {
    const group = new THREE.Group();

    // 4oz UFC Glove Knuckle Padding (Curved leather block)
    const gloveGeo = new THREE.BoxGeometry(0.16, 0.13, 0.14);
    const glove = new THREE.Mesh(gloveGeo, this.matGloveLeather);
    glove.castShadow = true;
    group.add(glove);

    // Finger dividers / Open finger loops
    const fingersGeo = new THREE.BoxGeometry(0.05, 0.06, 0.12);
    const fingers = new THREE.Mesh(fingersGeo, this.matSkin);
    fingers.position.set(0.08 * facingDir, -0.02, 0);
    group.add(fingers);

    // Thumb protector pad
    const thumbGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const thumb = new THREE.Mesh(thumbGeo, this.matGloveLeather);
    thumb.position.set(0.02 * facingDir, 0.02, 0.07);
    group.add(thumb);

    // Red/Blue Corner Wrist Tape
    const tapeGeo = new THREE.CylinderGeometry(0.082, 0.082, 0.06, 14);
    const tape = new THREE.Mesh(tapeGeo, this.matTape);
    tape.rotation.z = Math.PI / 2;
    tape.position.set(-0.09 * facingDir, 0, 0);
    group.add(tape);

    return group;
  }

  // 6. THIGH & FIGHT SHORTS LEG
  buildThighMesh() {
    const group = new THREE.Group();

    // Shorts leg sleeve
    const sleeveGeo = new THREE.CylinderGeometry(0.122, 0.108, 0.24, 14);
    const sleeve = new THREE.Mesh(sleeveGeo, this.matShorts);
    sleeve.position.set(0, 0.09, 0);
    sleeve.castShadow = true;
    group.add(sleeve);

    // Lower thigh quadriceps (Vastus Medialis muscle above knee)
    const quadGeo = new THREE.CylinderGeometry(0.102, 0.082, 0.22, 14);
    const quad = new THREE.Mesh(quadGeo, this.matSkin);
    quad.position.set(0, -0.11, 0);
    quad.castShadow = true;
    group.add(quad);

    return group;
  }

  // 7. SHIN, MUSCULAR CALF & FOOT
  buildShinMesh() {
    const group = new THREE.Group();

    // Muscular calf diamond shape
    const calfGeo = new THREE.CylinderGeometry(0.088, 0.065, 0.42, 14);
    calfGeo.scale(0.9, 1.0, 1.15); // Diamond calf profile
    const calf = new THREE.Mesh(calfGeo, this.matSkin);
    calf.castShadow = true;
    group.add(calf);

    // Patella / Kneecap
    const kneeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const knee = new THREE.Mesh(kneeGeo, this.matSkin);
    knee.position.set(0.06, 0.17, 0);
    group.add(knee);

    // Ankle Wrap / Compression band
    const wrapGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.07, 12);
    const wrap = new THREE.Mesh(wrapGeo, this.matTape);
    wrap.position.set(0, -0.16, 0);
    group.add(wrap);

    // Foot & Toes
    const footGeo = new THREE.BoxGeometry(0.18, 0.06, 0.09);
    const foot = new THREE.Mesh(footGeo, this.matSkin);
    foot.position.set(0.05, -0.21, 0);
    foot.castShadow = true;
    group.add(foot);

    return group;
  }
}
