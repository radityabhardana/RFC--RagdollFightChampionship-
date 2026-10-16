import * as THREE from 'three';

/**
 * UFC-Style Faceted Low-Poly Humanoid Fighter Mesh
 * 
 * Authentic MMA / UFC Fighter Aesthetic:
 * - Shirtless / Naked muscular upper body with faceted pectorals, six-pack abs, and deltoid definition.
 * - Official UFC Fight Trunks (compression shorts with thick elastic waistband, UFC badge, and corner accent stripes).
 * - Official UFC 4oz Fingerless Combat Gloves with corner tape (Red/Blue corner).
 * - Barefoot MMA combat feet with official UFC corner ankle support wraps.
 */
export class HumanFighterMesh {
  constructor(config = {}) {
    this.isPlayer = config.isPlayer !== false;
    this.corner = config.corner || (this.isPlayer ? 'RED' : 'BLUE');
    this.cornerColor = this.corner === 'RED' ? 0xd20a0a : 0x1a66d2;

    // Athletic fighter palette: Natural skin tones, UFC dark fight trunks, black 4oz gloves
    this.skinColor = config.skinColor || (this.isPlayer ? 0xd6a383 : 0xcfa07e);
    this.trunksColor = config.pantsColor || (this.isPlayer ? 0x181a1f : 0x121417);
    this.gloveColor = 0x141518; // Official UFC Black 4oz Gloves
    this.hairColor = config.hairColor || (this.isPlayer ? 0x221a15 : 0x1b1512);

    this.initMaterials();
  }

  initMaterials() {
    // 100% Flat-shaded materials for faceted athletic low-poly aesthetic
    const matOpts = {
      flatShading: true,
      roughness: 0.75,
      metalness: 0.06,
    };

    // Athletic Muscular Skin
    this.matSkin = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.skinColor,
      roughness: 0.62,
    });

    // UFC Fight Trunks (Matte technical performance fabric)
    this.matTrunks = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.trunksColor,
      roughness: 0.72,
    });

    // Trunks Elastic Waistband (Dark ribbed compression band)
    this.matTrunksWaist = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0x0d0e10,
      roughness: 0.60,
    });

    // Corner Color Stripe / Side Accent (Red / Blue corner)
    this.matCornerStripe = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.cornerColor,
      roughness: 0.50,
      metalness: 0.12,
    });

    // UFC Waistband Gold/Metallic Octagon Badge
    this.matBadge = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0xd4af37,
      metalness: 0.75,
      roughness: 0.30,
    });

    // Official UFC 4oz Leather Fight Gloves
    this.matGlove = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.gloveColor,
      roughness: 0.58,
      metalness: 0.10,
    });

    // Corner Wrist & Ankle Wraps (Red / Blue corner identifier)
    this.matCornerTape = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.cornerColor,
      roughness: 0.55,
      metalness: 0.08,
    });

    // Hair (Low-poly faceted dark hair block)
    this.matHair = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.hairColor,
      roughness: 0.90,
    });

    // Eyes & Eyebrows
    this.matEyes = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0x141417,
      roughness: 0.30,
    });

    // Foot Soles / Pads
    this.matFootSole = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.skinColor,
      roughness: 0.85,
    });
  }

  // 1. PELVIS & UFC FIGHT TRUNKS (Compression fight shorts, elastic waistband, UFC badge, corner accent stripes)
  buildPelvisMesh() {
    const group = new THREE.Group();

    // Main fight trunks base (faceted athletic shorts cut)
    const hipsGeo = new THREE.BoxGeometry(0.24, 0.16, 0.33, 2, 2, 2);
    const hips = new THREE.Mesh(hipsGeo, this.matTrunks);
    hips.position.set(0, 0, 0);
    hips.castShadow = true;
    group.add(hips);

    // Thick compression elastic waistband
    const waistGeo = new THREE.BoxGeometry(0.246, 0.046, 0.338);
    const waist = new THREE.Mesh(waistGeo, this.matTrunksWaist);
    waist.position.set(0, 0.065, 0);
    waist.castShadow = true;
    group.add(waist);

    // Official UFC Gold Octagon Waistband Badge
    const badgeGeo = new THREE.BoxGeometry(0.016, 0.032, 0.052);
    const badge = new THREE.Mesh(badgeGeo, this.matBadge);
    badge.position.set(0.125, 0.065, 0);
    group.add(badge);

    // Lateral athletic fight stripes on thighs (Red / Blue corner identifier)
    [-0.168, 0.168].forEach(z => {
      const stripeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.014);
      const stripe = new THREE.Mesh(stripeGeo, this.matCornerStripe);
      stripe.position.set(0, -0.01, z);
      group.add(stripe);
    });

    return group;
  }

  // 2. ABDOMEN & SIX-PACK (Shirtless athletic mid-torso with faceted abdominal muscles)
  buildAbdomenMesh() {
    const group = new THREE.Group();

    // Muscular tapered mid-torso (pure skin)
    const abdomenGeo = new THREE.CylinderGeometry(0.155, 0.145, 0.14, 6, 1);
    abdomenGeo.scale(0.86, 1.0, 1.15);
    const abdomen = new THREE.Mesh(abdomenGeo, this.matSkin);
    abdomen.position.set(0, 0, 0);
    abdomen.castShadow = true;
    group.add(abdomen);

    // Six-pack abdominal pads (low-poly muscle definition)
    const absY = [0.035, -0.015, -0.055];
    absY.forEach(y => {
      [-0.045, 0.045].forEach(z => {
        const abGeo = new THREE.BoxGeometry(0.022, 0.030, 0.038);
        const abMesh = new THREE.Mesh(abGeo, this.matSkin);
        abMesh.position.set(0.122, y, z);
        abMesh.castShadow = true;
        group.add(abMesh);
      });
    });

    return group;
  }

  // 3. CHEST & SHOULDERS (Shirtless broad athletic pectorals & muscular deltoids)
  buildChestMesh() {
    const group = new THREE.Group();

    // Broad muscular ribcage (pure skin)
    const chestGeo = new THREE.CylinderGeometry(0.185, 0.165, 0.20, 6, 1);
    chestGeo.scale(0.88, 1.0, 1.25);
    const chest = new THREE.Mesh(chestGeo, this.matSkin);
    chest.position.set(0, 0.01, 0);
    chest.castShadow = true;
    group.add(chest);

    // Pectoralis Major muscle shelves (left & right pecs)
    [-0.082, 0.082].forEach(z => {
      const pecGeo = new THREE.BoxGeometry(0.055, 0.095, 0.125);
      const pec = new THREE.Mesh(pecGeo, this.matSkin);
      pec.position.set(0.108, 0.025, z);
      pec.castShadow = true;
      group.add(pec);
    });

    // Muscular deltoid shoulder caps
    [-0.205, 0.205].forEach(z => {
      const deltGeo = new THREE.BoxGeometry(0.115, 0.115, 0.105);
      const delt = new THREE.Mesh(deltGeo, this.matSkin);
      delt.position.set(0, 0.055, z);
      delt.castShadow = true;
      group.add(delt);
    });

    return group;
  }

  // 4. NECK (Faceted cervical prism)
  buildNeckMesh() {
    const group = new THREE.Group();

    // 6-sided faceted low-poly neck prism
    const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.11, 6);
    const neck = new THREE.Mesh(neckGeo, this.matSkin);
    neck.castShadow = true;
    group.add(neck);

    return group;
  }

  // 5. HEAD & FACE (Faceted GoreBox Phil Timsky Aesthetic)
  buildHeadMesh(facingDir = 1) {
    const group = new THREE.Group();

    // 1. Faceted Cranium / Head Block
    const headGeo = new THREE.BoxGeometry(0.20, 0.21, 0.19, 2, 2, 2);
    const head = new THREE.Mesh(headGeo, this.matSkin);
    head.position.set(0, 0.02, 0);
    head.castShadow = true;
    group.add(head);

    // 2. Angled Jawline & Chin Cut (signature GoreBox blocky chin)
    const chinGeo = new THREE.BoxGeometry(0.08, 0.065, 0.13);
    const chin = new THREE.Mesh(chinGeo, this.matSkin);
    chin.position.set(0.075 * facingDir, -0.075, 0);
    chin.castShadow = true;
    group.add(chin);

    // 3. Faceted Low-Poly Hair Cap (Overhangs on top and back)
    // Top hair block
    const hairTopGeo = new THREE.BoxGeometry(0.215, 0.07, 0.205);
    const hairTop = new THREE.Mesh(hairTopGeo, this.matHair);
    hairTop.position.set(0, 0.115, 0);
    hairTop.castShadow = true;
    group.add(hairTop);

    // Back hair block
    const hairBackGeo = new THREE.BoxGeometry(0.09, 0.16, 0.205);
    const hairBack = new THREE.Mesh(hairBackGeo, this.matHair);
    hairBack.position.set(-0.07 * facingDir, 0.03, 0);
    hairBack.castShadow = true;
    group.add(hairBack);

    // Hair fringe / parted front tuft
    const hairFrontGeo = new THREE.BoxGeometry(0.06, 0.045, 0.17);
    const hairFront = new THREE.Mesh(hairFrontGeo, this.matHair);
    hairFront.position.set(0.085 * facingDir, 0.095, 0);
    group.add(hairFront);

    // 4. Low-Poly 3D Nose Bridge
    const noseGeo = new THREE.BoxGeometry(0.032, 0.042, 0.028);
    const nose = new THREE.Mesh(noseGeo, this.matSkin);
    nose.position.set(0.112 * facingDir, 0.005, 0);
    group.add(nose);

    // 5. GoreBox Minimalist Eyes
    [-0.048, 0.048].forEach(z => {
      // Dark pupil / eye facet
      const eyeGeo = new THREE.BoxGeometry(0.015, 0.018, 0.024);
      const eye = new THREE.Mesh(eyeGeo, this.matEyes);
      eye.position.set(0.103 * facingDir, 0.032, z);
      group.add(eye);

      // Low-poly Eyebrow ridge
      const browGeo = new THREE.BoxGeometry(0.02, 0.012, 0.036);
      const brow = new THREE.Mesh(browGeo, this.matHair);
      brow.position.set(0.106 * facingDir, 0.052, z);
      group.add(brow);
    });

    // 6. Low-poly Ears (faceted side tabs)
    [-0.105, 0.105].forEach(z => {
      const earGeo = new THREE.BoxGeometry(0.035, 0.048, 0.02);
      const ear = new THREE.Mesh(earGeo, this.matSkin);
      ear.position.set(-0.015 * facingDir, 0.01, z);
      group.add(ear);
    });

    return group;
  }

  // 6. UPPER ARM (T-shirt sleeve edge + Faceted muscular bicep)
  // 6. UPPER ARM (Shirtless muscular bicep & deltoid)
  // Aligned along Y: Top is shoulder (0, +0.175, 0), Bottom is elbow (0, -0.175, 0)
  buildUpperArmMesh() {
    const group = new THREE.Group();

    // Muscular deltoid junction
    const shoulderGeo = new THREE.BoxGeometry(0.115, 0.11, 0.115);
    const shoulder = new THREE.Mesh(shoulderGeo, this.matSkin);
    shoulder.position.set(0, 0.12, 0);
    shoulder.castShadow = true;
    group.add(shoulder);

    // Bicep / tricep muscular arm prism (pure skin)
    const bicepGeo = new THREE.BoxGeometry(0.105, 0.25, 0.105);
    const bicep = new THREE.Mesh(bicepGeo, this.matSkin);
    bicep.position.set(0, -0.05, 0);
    bicep.castShadow = true;
    group.add(bicep);

    return group;
  }

  // 7. FOREARM (Faceted muscular forearm prism down to wrist)
  // Aligned along Y: Top is elbow socket (0, +0.155, 0), Bottom is wrist (0, -0.155, 0)
  buildForearmMesh() {
    const group = new THREE.Group();

    // Faceted 6-sided athletic forearm
    const armGeo = new THREE.CylinderGeometry(0.048, 0.058, 0.31, 6);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.position.set(0, 0, 0);
    arm.castShadow = true;
    group.add(arm);

    // UFC wrist wrap cuff base
    const cuffGeo = new THREE.BoxGeometry(0.098, 0.045, 0.098);
    const cuff = new THREE.Mesh(cuffGeo, this.matCornerTape);
    cuff.position.set(0, -0.13, 0);
    cuff.castShadow = true;
    group.add(cuff);

    return group;
  }

  // 8. OFFICIAL UFC 4OZ COMBAT GLOVES (Black leather, corner tape, exposed fingers)
  buildGloveMesh() {
    const group = new THREE.Group();

    // Corner tape ring around wrist (Red / Blue corner)
    const tapeGeo = new THREE.BoxGeometry(0.105, 0.038, 0.105);
    const tape = new THREE.Mesh(tapeGeo, this.matCornerTape);
    tape.position.set(0, -0.055, 0);
    tape.castShadow = true;
    group.add(tape);

    // Main 4oz padded knuckle strike block
    const gloveGeo = new THREE.BoxGeometry(0.100, 0.088, 0.096);
    const glove = new THREE.Mesh(gloveGeo, this.matGlove);
    glove.position.set(0, 0.01, 0);
    glove.castShadow = true;
    group.add(glove);

    // Thumb wrap block
    const thumbGeo = new THREE.BoxGeometry(0.035, 0.045, 0.035);
    const thumb = new THREE.Mesh(thumbGeo, this.matGlove);
    thumb.position.set(0.042, 0.01, 0.042);
    group.add(thumb);

    // Exposed skin fingertips (signature UFC fingerless glove detail!)
    const fingersGeo = new THREE.BoxGeometry(0.088, 0.025, 0.085);
    const fingers = new THREE.Mesh(fingersGeo, this.matSkin);
    fingers.position.set(0, 0.06, 0);
    group.add(fingers);

    return group;
  }

  // 9. THIGH & UFC FIGHT TRUNKS (Upper fight shorts sleeve + exposed muscular lower quad)
  // Aligned along Y: Top is hip (0, +0.21, 0), Bottom is knee (0, -0.21, 0), total length 0.42m
  buildThighMesh() {
    const group = new THREE.Group();

    // Upper fight trunks sleeve
    const trunksLegGeo = new THREE.BoxGeometry(0.144, 0.22, 0.152);
    const trunksLeg = new THREE.Mesh(trunksLegGeo, this.matTrunks);
    trunksLeg.position.set(0, 0.10, 0);
    trunksLeg.castShadow = true;
    group.add(trunksLeg);

    // Side accent stripe on trunks leg
    const stripeGeo = new THREE.BoxGeometry(0.146, 0.20, 0.012);
    const stripe = new THREE.Mesh(stripeGeo, this.matCornerStripe);
    stripe.position.set(0, 0.10, 0.076);
    group.add(stripe);

    // Lower muscular quad / thigh (exposed skin down to knee joint)
    const quadGeo = new THREE.BoxGeometry(0.128, 0.20, 0.136);
    const quad = new THREE.Mesh(quadGeo, this.matSkin);
    quad.position.set(0, -0.11, 0);
    quad.castShadow = true;
    group.add(quad);

    return group;
  }

  // 10. SHIN & BARE LOWER LEG (Muscular calf & shin ridge + UFC ankle support wrap)
  // Aligned along Y: Top is knee socket (0, +0.20, 0), Bottom is ankle (0, -0.20, 0), total length 0.40m
  buildShinMesh() {
    const group = new THREE.Group();

    // Bare athletic shin and calf muscle
    const shinGeo = new THREE.BoxGeometry(0.120, 0.33, 0.125, 1, 2, 1);
    const shin = new THREE.Mesh(shinGeo, this.matSkin);
    shin.position.set(0, 0.035, 0);
    shin.castShadow = true;
    group.add(shin);

    // Official UFC Corner Ankle Support Wrap (elastic compression sleeve around ankle)
    const wrapGeo = new THREE.BoxGeometry(0.126, 0.09, 0.130);
    const wrap = new THREE.Mesh(wrapGeo, this.matCornerTape);
    wrap.position.set(0, -0.155, 0);
    wrap.castShadow = true;
    group.add(wrap);

    return group;
  }

  // 11. BAREFOOT MMA COMBAT FOOT (Ankle sleeve, athletic instep, barefoot toes)
  // Foot extends forward along +X, sole sits on canvas
  buildFootMesh() {
    const group = new THREE.Group();

    // 1. UFC Ankle Wrap heel cup & arch sleeve
    const wrapGeo = new THREE.BoxGeometry(0.105, 0.065, 0.098);
    const wrap = new THREE.Mesh(wrapGeo, this.matCornerTape);
    wrap.position.set(-0.015, 0.01, 0);
    wrap.castShadow = true;
    group.add(wrap);

    // 2. Athletic Barefoot instep & arch
    const instepGeo = new THREE.BoxGeometry(0.115, 0.050, 0.092);
    const instep = new THREE.Mesh(instepGeo, this.matSkin);
    instep.position.set(0.045, -0.015, 0);
    instep.castShadow = true;
    group.add(instep);

    // 3. Low-Poly Toes Block (5 toes strike edge for kicks)
    const toesGeo = new THREE.BoxGeometry(0.075, 0.035, 0.090);
    const toes = new THREE.Mesh(toesGeo, this.matSkin);
    toes.position.set(0.125, -0.026, 0);
    toes.castShadow = true;
    group.add(toes);

    // 4. Foot Sole Pad
    const soleGeo = new THREE.BoxGeometry(0.21, 0.014, 0.095);
    const sole = new THREE.Mesh(soleGeo, this.matFootSole);
    sole.position.set(0.045, -0.048, 0);
    group.add(sole);

    return group;
  }
}
