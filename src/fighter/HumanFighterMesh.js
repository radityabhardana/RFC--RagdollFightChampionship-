import * as THREE from 'three';

/**
 * UFC-Style Faceted Low-Poly Humanoid Fighter Mesh
 * 
 * Supports authentic real-life UFC fighter customization:
 * - Distinctive hairstyles (Conor slick undercut, Khabib chinstrap buzz, Oliveira bleached blonde, Jiri samurai topknot, etc.)
 * - 3D procedural beards (Dagestani chinstrap, full ginger beard, neat goatee, mustache)
 * - Real-life tattoo signatures (Conor gorilla & tiger, Topuria crown/cross, Poatan indigenous tribal sleeves, Jon Jones Phil 4:13, etc.)
 * - Authentic UFC Fight Trunks (custom national/champion colors, compression shorts, waistband, gold badge)
 * - Official UFC 4oz Fingerless Combat Gloves and ankle wraps
 */
export class HumanFighterMesh {
  constructor(config = {}) {
    this.isPlayer = config.isPlayer !== false;
    this.corner = config.corner || (this.isPlayer ? 'RED' : 'BLUE');
    this.cornerColor = this.corner === 'RED' ? 0xd20a0a : 0x1a66d2;

    // Real UFC fighter customization fields
    this.skinColor = config.skinColor || (this.isPlayer ? 0xd6a383 : 0xcfa07e);
    this.trunksColor = config.trunksColor || config.pantsColor || (this.isPlayer ? 0x181a1f : 0x121417);
    this.trunksTrimColor = config.trunksTrimColor || this.cornerColor;
    this.gloveColor = 0x141518; // Official UFC Black 4oz Gloves
    this.hairColor = config.hairColor || (this.isPlayer ? 0x221a15 : 0x1b1512);
    this.hairStyle = config.hairStyle || 'SLICK_FADE';
    this.beardStyle = config.beardStyle || 'CLEAN_SHAVEN';
    this.beardColor = config.beardColor || this.hairColor;
    this.tattooType = config.tattooType || 'NONE';

    this.initMaterials();
  }

  initMaterials() {
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

    // Trunks Elastic Waistband
    this.matTrunksWaist = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0x0d0e10,
      roughness: 0.60,
    });

    // Trunks Trim / Accent Stripe
    this.matTrunksTrim = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.trunksTrimColor,
      roughness: 0.50,
      metalness: 0.12,
    });

    // Corner Color Stripe (Red / Blue corner)
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

    // Corner Wrist & Ankle Wraps
    this.matCornerTape = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.cornerColor,
      roughness: 0.55,
      metalness: 0.08,
    });

    // Hair Material
    this.matHair = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.hairColor,
      roughness: 0.88,
    });

    // Beard Material
    this.matBeard = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: this.beardColor,
      roughness: 0.90,
    });

    // Tattoo Ink Materials
    this.matTattooDark = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0x162228,
      roughness: 0.85,
    });

    this.matTattooGold = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0xd4af37,
      metalness: 0.65,
      roughness: 0.35,
    });

    this.matTattooGreen = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0x00843d,
      roughness: 0.70,
    });

    this.matTattooOrange = new THREE.MeshStandardMaterial({
      ...matOpts,
      color: 0xdf6e16,
      roughness: 0.70,
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

  // 1. PELVIS & UFC FIGHT TRUNKS
  buildPelvisMesh() {
    const group = new THREE.Group();

    // Main fight trunks base
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

    // Lateral athletic fight stripes on thighs (Custom Trunks Trim Color)
    [-0.168, 0.168].forEach(z => {
      const stripeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.014);
      const stripe = new THREE.Mesh(stripeGeo, this.matTrunksTrim);
      stripe.position.set(0, -0.01, z);
      group.add(stripe);
    });

    return group;
  }

  // 2. ABDOMEN & SIX-PACK (With optional tiger tattoo for Conor)
  buildAbdomenMesh() {
    const group = new THREE.Group();

    // Muscular tapered mid-torso (pure skin)
    const abdomenGeo = new THREE.CylinderGeometry(0.155, 0.145, 0.14, 6, 1);
    abdomenGeo.scale(0.86, 1.0, 1.15);
    const abdomen = new THREE.Mesh(abdomenGeo, this.matSkin);
    abdomen.position.set(0, 0, 0);
    abdomen.castShadow = true;
    group.add(abdomen);

    // Six-pack abdominal pads
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

    // Real Tattoo: Conor McGregor Stomach Tiger & Script Tattoo
    if (this.tattooType === 'MCGREGOR_GORILLA_TIGER') {
      // Tiger head center belly
      const tigerGeo = new THREE.BoxGeometry(0.015, 0.058, 0.075);
      const tiger = new THREE.Mesh(tigerGeo, this.matTattooDark);
      tiger.position.set(0.134, -0.015, 0);
      group.add(tiger);

      // Tiger orange eyes/accent
      [-0.018, 0.018].forEach(z => {
        const eyeGeo = new THREE.BoxGeometry(0.016, 0.012, 0.014);
        const eye = new THREE.Mesh(eyeGeo, this.matTattooOrange);
        eye.position.set(0.136, -0.01, z);
        group.add(eye);
      });

      // "MCGREGOR" and "NOTORIOUS" text banner ribbons above and below tiger
      const bannerTopGeo = new THREE.BoxGeometry(0.014, 0.018, 0.095);
      const bannerTop = new THREE.Mesh(bannerTopGeo, this.matTattooDark);
      bannerTop.position.set(0.132, 0.035, 0);
      group.add(bannerTop);

      const bannerBotGeo = new THREE.BoxGeometry(0.014, 0.018, 0.095);
      const bannerBot = new THREE.Mesh(bannerBotGeo, this.matTattooDark);
      bannerBot.position.set(0.132, -0.055, 0);
      group.add(bannerBot);
    }

    return group;
  }

  // 3. CHEST & SHOULDERS (With real UFC chest tattoos)
  buildChestMesh() {
    const group = new THREE.Group();

    // Broad muscular ribcage
    const chestGeo = new THREE.CylinderGeometry(0.185, 0.165, 0.20, 6, 1);
    chestGeo.scale(0.88, 1.0, 1.25);
    const chest = new THREE.Mesh(chestGeo, this.matSkin);
    chest.position.set(0, 0.01, 0);
    chest.castShadow = true;
    group.add(chest);

    // Pectoralis Major muscle shelves
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

    // --- REAL-LIFE CHEST TATTOOS ---
    if (this.tattooType === 'MCGREGOR_GORILLA_TIGER') {
      // Iconic Silverback Gorilla with Crown eating a heart
      const gorillaGeo = new THREE.BoxGeometry(0.018, 0.115, 0.135);
      const gorilla = new THREE.Mesh(gorillaGeo, this.matTattooDark);
      gorilla.position.set(0.132, 0.035, 0);
      group.add(gorilla);

      // Gold Crown atop Gorilla
      const crownGeo = new THREE.BoxGeometry(0.020, 0.032, 0.065);
      const crown = new THREE.Mesh(crownGeo, this.matTattooGold);
      crown.position.set(0.134, 0.095, 0);
      group.add(crown);

      // Heart eaten by gorilla (ruby/red accent)
      const heartGeo = new THREE.BoxGeometry(0.020, 0.025, 0.025);
      const heart = new THREE.Mesh(heartGeo, this.matCornerStripe);
      heart.position.set(0.136, 0.025, 0);
      group.add(heart);

    } else if (this.tattooType === 'TOPURIA_CROWN_CROSS') {
      // Ilia Topuria Large Crown & Cross Centerpiece
      const crossVertGeo = new THREE.BoxGeometry(0.016, 0.12, 0.022);
      const crossVert = new THREE.Mesh(crossVertGeo, this.matTattooDark);
      crossVert.position.set(0.132, 0.03, 0);
      group.add(crossVert);

      const crossHorizGeo = new THREE.BoxGeometry(0.016, 0.022, 0.075);
      const crossHoriz = new THREE.Mesh(crossHorizGeo, this.matTattooDark);
      crossHoriz.position.set(0.132, 0.055, 0);
      group.add(crossHoriz);

      const crownGeo = new THREE.BoxGeometry(0.018, 0.035, 0.058);
      const crown = new THREE.Mesh(crownGeo, this.matTattooGold);
      crown.position.set(0.134, 0.092, 0);
      group.add(crown);

    } else if (this.tattooType === 'JONES_PHILIPPIANS_413') {
      // Jon Jones Scripture "Philippians 4:13" on right pectoral
      const scriptGeo = new THREE.BoxGeometry(0.016, 0.028, 0.095);
      const script = new THREE.Mesh(scriptGeo, this.matTattooDark);
      script.position.set(0.133, 0.045, 0.075);
      script.rotation.y = -0.15;
      group.add(script);

    } else if (this.tattooType === 'ADESANYA_BROKEN_NATIVE') {
      // Israel Adesanya "Broken Native" arch + African continent outline
      const archGeo = new THREE.BoxGeometry(0.016, 0.024, 0.135);
      const arch = new THREE.Mesh(archGeo, this.matTattooDark);
      arch.position.set(0.132, 0.075, 0);
      group.add(arch);

      const africaGeo = new THREE.BoxGeometry(0.016, 0.065, 0.055);
      const africa = new THREE.Mesh(africaGeo, this.matTattooDark);
      africa.position.set(0.132, 0.025, 0);
      group.add(africa);

    } else if (this.tattooType === 'POATAN_INDIGENOUS_TRIBAL') {
      // Alex Pereira Indigenous Pataxó tribal chest & collar markings
      const tribalGeo = new THREE.BoxGeometry(0.016, 0.075, 0.115);
      const tribal = new THREE.Mesh(tribalGeo, this.matTattooDark);
      tribal.position.set(0.131, 0.035, -0.06);
      group.add(tribal);

    } else if (this.tattooType === 'OLIVEIRA_LIONS') {
      // Charles Oliveira Dual Lions on pecs
      [-0.08, 0.08].forEach(z => {
        const lionGeo = new THREE.BoxGeometry(0.016, 0.065, 0.065);
        const lion = new THREE.Mesh(lionGeo, this.matTattooDark);
        lion.position.set(0.132, 0.03, z);
        group.add(lion);
      });
    }

    return group;
  }

  // 4. NECK
  buildNeckMesh() {
    const group = new THREE.Group();
    const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.11, 6);
    const neck = new THREE.Mesh(neckGeo, this.matSkin);
    neck.castShadow = true;
    group.add(neck);
    return group;
  }

  // 5. HEAD, HAIR & BEARDS (Customized per real UFC fighter)
  buildHeadMesh(facingDir = 1) {
    const group = new THREE.Group();

    // 1. Faceted Cranium / Head Block
    const headGeo = new THREE.BoxGeometry(0.20, 0.21, 0.19, 2, 2, 2);
    const head = new THREE.Mesh(headGeo, this.matSkin);
    head.position.set(0, 0.02, 0);
    head.castShadow = true;
    group.add(head);

    // 2. Angled Jawline & Chin Cut
    const chinGeo = new THREE.BoxGeometry(0.08, 0.065, 0.13);
    const chin = new THREE.Mesh(chinGeo, this.matSkin);
    chin.position.set(0.075 * facingDir, -0.075, 0);
    chin.castShadow = true;
    group.add(chin);

    // 3. 3D Procedural Hair Styles
    this.buildHair(group, facingDir);

    // 4. 3D Procedural Beards
    this.buildBeard(group, facingDir);

    // 5. Low-Poly 3D Nose Bridge
    const noseGeo = new THREE.BoxGeometry(0.032, 0.042, 0.028);
    const nose = new THREE.Mesh(noseGeo, this.matSkin);
    nose.position.set(0.112 * facingDir, 0.005, 0);
    group.add(nose);

    // 6. Minimalist Eyes & Brows
    [-0.048, 0.048].forEach(z => {
      const eyeGeo = new THREE.BoxGeometry(0.015, 0.018, 0.024);
      const eye = new THREE.Mesh(eyeGeo, this.matEyes);
      eye.position.set(0.103 * facingDir, 0.032, z);
      group.add(eye);

      const browGeo = new THREE.BoxGeometry(0.02, 0.012, 0.036);
      const brow = new THREE.Mesh(browGeo, this.matHair);
      brow.position.set(0.106 * facingDir, 0.052, z);
      group.add(brow);
    });

    // 7. Low-poly Ears
    [-0.105, 0.105].forEach(z => {
      const earGeo = new THREE.BoxGeometry(0.035, 0.048, 0.02);
      const ear = new THREE.Mesh(earGeo, this.matSkin);
      ear.position.set(-0.015 * facingDir, 0.01, z);
      group.add(ear);
    });

    return group;
  }

  // 3D Procedural Hair Builder
  buildHair(group, facingDir) {
    if (this.hairStyle === 'SHAVED') {
      // Very faint scalp shade (clean shaved head)
      const stubbleGeo = new THREE.BoxGeometry(0.204, 0.035, 0.194);
      const stubble = new THREE.Mesh(stubbleGeo, this.matHair);
      stubble.position.set(0, 0.112, 0);
      group.add(stubble);
      return;
    }

    if (this.hairStyle === 'SAMURAI_TOPKNOT') {
      // Jiri Prochazka Samurai hairstyle: Close cropped base with high topknot
      const hairBase = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.05, 0.20), this.matHair);
      hairBase.position.set(0, 0.11, 0);
      group.add(hairBase);

      // Upright Samurai Topknot Ponytail bundle
      const knotGeo = new THREE.CylinderGeometry(0.024, 0.032, 0.14, 5);
      const knot = new THREE.Mesh(knotGeo, this.matHair);
      knot.position.set(-0.02 * facingDir, 0.20, 0);
      knot.rotation.x = 0.15;
      group.add(knot);

      // Red/Gold Bushido tie cord
      const tieGeo = new THREE.CylinderGeometry(0.030, 0.030, 0.022, 6);
      const tie = new THREE.Mesh(tieGeo, this.matCornerTape);
      tie.position.set(-0.02 * facingDir, 0.145, 0);
      group.add(tie);
      return;
    }

    if (this.hairStyle === 'SLICK_UNDERCUT') {
      // Conor McGregor high fade undercut with voluminous swept-back top
      const topGeo = new THREE.BoxGeometry(0.23, 0.085, 0.185);
      const top = new THREE.Mesh(topGeo, this.matHair);
      top.position.set(0.01 * facingDir, 0.125, 0);
      group.add(top);

      const backGeo = new THREE.BoxGeometry(0.08, 0.17, 0.19);
      const back = new THREE.Mesh(backGeo, this.matHair);
      back.position.set(-0.075 * facingDir, 0.03, 0);
      group.add(back);

      const frontTuftGeo = new THREE.BoxGeometry(0.07, 0.05, 0.15);
      const frontTuft = new THREE.Mesh(frontTuftGeo, this.matHair);
      frontTuft.position.set(0.09 * facingDir, 0.11, 0);
      group.add(frontTuft);
      return;
    }

    if (this.hairStyle === 'BLEACHED_BLONDE') {
      // Charles Oliveira bleached crop
      const topGeo = new THREE.BoxGeometry(0.215, 0.075, 0.205);
      const top = new THREE.Mesh(topGeo, this.matHair);
      top.position.set(0, 0.118, 0);
      group.add(top);

      const fringeGeo = new THREE.BoxGeometry(0.055, 0.045, 0.175);
      const fringe = new THREE.Mesh(fringeGeo, this.matHair);
      fringe.position.set(0.088 * facingDir, 0.098, 0);
      group.add(fringe);
      return;
    }

    // Default Buzz / Fade (Topuria, Khabib, Islam, Holloway, Pereira, etc.)
    const hairTopGeo = new THREE.BoxGeometry(0.212, 0.065, 0.202);
    const hairTop = new THREE.Mesh(hairTopGeo, this.matHair);
    hairTop.position.set(0, 0.115, 0);
    hairTop.castShadow = true;
    group.add(hairTop);

    const hairBackGeo = new THREE.BoxGeometry(0.085, 0.15, 0.202);
    const hairBack = new THREE.Mesh(hairBackGeo, this.matHair);
    hairBack.position.set(-0.068 * facingDir, 0.03, 0);
    hairBack.castShadow = true;
    group.add(hairBack);

    const hairFrontGeo = new THREE.BoxGeometry(0.055, 0.04, 0.165);
    const hairFront = new THREE.Mesh(hairFrontGeo, this.matHair);
    hairFront.position.set(0.082 * facingDir, 0.095, 0);
    group.add(hairFront);
  }

  // 3D Procedural Beard Builder
  buildBeard(group, facingDir) {
    if (this.beardStyle === 'CLEAN_SHAVEN') return;

    if (this.beardStyle === 'DAGESTANI_CHINSTRAP') {
      // Khabib & Islam signature Dagestani chinstrap beard:
      // Heavy beard lining the entire jaw and under-chin, with clean-shaven upper lip (no mustache)
      const chinBeardGeo = new THREE.BoxGeometry(0.095, 0.075, 0.145);
      const chinBeard = new THREE.Mesh(chinBeardGeo, this.matBeard);
      chinBeard.position.set(0.068 * facingDir, -0.082, 0);
      group.add(chinBeard);

      // Jaw wraps extending back to ears
      [-0.088, 0.088].forEach(z => {
        const jawWrapGeo = new THREE.BoxGeometry(0.12, 0.065, 0.042);
        const jawWrap = new THREE.Mesh(jawWrapGeo, this.matBeard);
        jawWrap.position.set(0.005 * facingDir, -0.065, z);
        group.add(jawWrap);
      });
      return;
    }

    if (this.beardStyle === 'FULL_GINGER_BEARD' || this.beardStyle === 'RUGGED_TRIMMED') {
      // Conor McGregor full groomed beard & mustache
      const chinBeardGeo = new THREE.BoxGeometry(0.095, 0.085, 0.14);
      const chinBeard = new THREE.Mesh(chinBeardGeo, this.matBeard);
      chinBeard.position.set(0.078 * facingDir, -0.08, 0);
      group.add(chinBeard);

      // Full Mustache
      const stacheGeo = new THREE.BoxGeometry(0.035, 0.024, 0.085);
      const stache = new THREE.Mesh(stacheGeo, this.matBeard);
      stache.position.set(0.108 * facingDir, -0.025, 0);
      group.add(stache);

      // Jaw cheek whiskers
      [-0.088, 0.088].forEach(z => {
        const whiskerGeo = new THREE.BoxGeometry(0.11, 0.068, 0.038);
        const whisker = new THREE.Mesh(whiskerGeo, this.matBeard);
        whisker.position.set(0.012 * facingDir, -0.055, z);
        group.add(whisker);
      });
      return;
    }

    if (this.beardStyle === 'TRIMMED_BOX' || this.beardStyle === 'TRIMMED_GOATEE' || this.beardStyle === 'LEAN_GOATEE') {
      // Topuria, Jon Jones, Adesanya neat goatee & trimmed mustache
      const goateeGeo = new THREE.BoxGeometry(0.055, 0.065, 0.085);
      const goatee = new THREE.Mesh(goateeGeo, this.matBeard);
      goatee.position.set(0.092 * facingDir, -0.072, 0);
      group.add(goatee);

      const stacheGeo = new THREE.BoxGeometry(0.030, 0.018, 0.075);
      const stache = new THREE.Mesh(stacheGeo, this.matBeard);
      stache.position.set(0.108 * facingDir, -0.024, 0);
      group.add(stache);
      return;
    }

    if (this.beardStyle === 'MUSTACHE_STUBBLE') {
      // Max Holloway mustache + chin tab
      const stacheGeo = new THREE.BoxGeometry(0.030, 0.020, 0.080);
      const stache = new THREE.Mesh(stacheGeo, this.matBeard);
      stache.position.set(0.108 * facingDir, -0.024, 0);
      group.add(stache);

      const chinTabGeo = new THREE.BoxGeometry(0.028, 0.025, 0.040);
      const chinTab = new THREE.Mesh(chinTabGeo, this.matBeard);
      chinTab.position.set(0.098 * facingDir, -0.065, 0);
      group.add(chinTab);
      return;
    }

    if (this.beardStyle === 'SAMURAI_TUFT') {
      // Jiri Prochazka pointed chin tuft
      const tuftGeo = new THREE.ConeGeometry(0.032, 0.10, 4);
      const tuft = new THREE.Mesh(tuftGeo, this.matBeard);
      tuft.position.set(0.085 * facingDir, -0.12, 0);
      tuft.rotation.z = -0.25 * facingDir;
      group.add(tuft);
    }
  }

  // 6. UPPER ARM (Shirtless muscular bicep with optional sleeve tattoos)
  buildUpperArmMesh(side = 'left') {
    const group = new THREE.Group();

    // Muscular deltoid junction
    const shoulderGeo = new THREE.BoxGeometry(0.115, 0.11, 0.115);
    const shoulder = new THREE.Mesh(shoulderGeo, this.matSkin);
    shoulder.position.set(0, 0.12, 0);
    shoulder.castShadow = true;
    group.add(shoulder);

    // Bicep / tricep muscular arm prism
    const bicepGeo = new THREE.BoxGeometry(0.105, 0.25, 0.105);
    const bicep = new THREE.Mesh(bicepGeo, this.matSkin);
    bicep.position.set(0, -0.05, 0);
    bicep.castShadow = true;
    group.add(bicep);

    // Tattoo Sleeves on Upper Arm
    const hasSleeve = (
      (this.tattooType === 'POATAN_INDIGENOUS_TRIBAL' && side === 'left') ||
      (this.tattooType === 'POIRIER_JAPANESE_SLEEVES') ||
      (this.tattooType === 'HOLLOWAY_WINGS_POLYNESIAN' && side === 'left') ||
      (this.tattooType === 'OLIVEIRA_LIONS')
    );

    if (hasSleeve) {
      const tattooSleeveGeo = new THREE.BoxGeometry(0.108, 0.24, 0.108);
      const tattooSleeve = new THREE.Mesh(tattooSleeveGeo, this.matTattooDark);
      tattooSleeve.position.set(0, -0.05, 0);
      group.add(tattooSleeve);
    }

    return group;
  }

  // 7. FOREARM (With optional tattoo sleeve)
  buildForearmMesh(side = 'left') {
    const group = new THREE.Group();

    // Faceted 6-sided athletic forearm
    const armGeo = new THREE.CylinderGeometry(0.048, 0.058, 0.31, 6);
    const arm = new THREE.Mesh(armGeo, this.matSkin);
    arm.position.set(0, 0, 0);
    arm.castShadow = true;
    group.add(arm);

    // Forearm tattoo sleeves
    const hasForearmSleeve = (
      (this.tattooType === 'POATAN_INDIGENOUS_TRIBAL' && side === 'left') ||
      (this.tattooType === 'POIRIER_JAPANESE_SLEEVES') ||
      (this.tattooType === 'HOLLOWAY_WINGS_POLYNESIAN' && side === 'left')
    );

    if (hasForearmSleeve) {
      const forearmTatGeo = new THREE.CylinderGeometry(0.0495, 0.0595, 0.26, 6);
      const forearmTat = new THREE.Mesh(forearmTatGeo, this.matTattooDark);
      forearmTat.position.set(0, 0.02, 0);
      group.add(forearmTat);
    }

    // Official Corner Wrist Tape Wrap
    const tapeGeo = new THREE.CylinderGeometry(0.050, 0.052, 0.055, 6);
    const tape = new THREE.Mesh(tapeGeo, this.matCornerTape);
    tape.position.set(0, -0.13, 0);
    group.add(tape);

    return group;
  }

  // 8. OFFICIAL UFC 4OZ GLOVE
  buildGloveMesh(side = 'left') {
    const group = new THREE.Group();

    // Dense leather striking knuckle pad
    const padGeo = new THREE.BoxGeometry(0.088, 0.095, 0.082);
    const pad = new THREE.Mesh(padGeo, this.matGlove);
    pad.position.set(0, -0.015, 0);
    pad.castShadow = true;
    group.add(pad);

    // Segmented finger pads
    const fingerGeo = new THREE.BoxGeometry(0.022, 0.038, 0.078);
    const finger = new THREE.Mesh(fingerGeo, this.matGlove);
    finger.position.set(0.044, -0.038, 0);
    group.add(finger);

    // Thumb guard
    const thumbZ = side === 'left' ? 0.045 : -0.045;
    const thumbGeo = new THREE.BoxGeometry(0.032, 0.045, 0.026);
    const thumb = new THREE.Mesh(thumbGeo, this.matGlove);
    thumb.position.set(0.015, -0.01, thumbZ);
    group.add(thumb);

    // Wrist closure strap with UFC Octagon emblem
    const strapGeo = new THREE.BoxGeometry(0.092, 0.028, 0.086);
    const strap = new THREE.Mesh(strapGeo, this.matCornerTape);
    strap.position.set(0, 0.035, 0);
    group.add(strap);

    return group;
  }

  // 9. THIGH
  buildThighMesh() {
    const group = new THREE.Group();
    const thighGeo = new THREE.BoxGeometry(0.145, 0.40, 0.145);
    const thigh = new THREE.Mesh(thighGeo, this.matSkin);
    thigh.position.set(0, 0, 0);
    thigh.castShadow = true;
    group.add(thigh);

    // Compression fight trunks hem sleeve
    const trunksHemGeo = new THREE.BoxGeometry(0.152, 0.14, 0.152);
    const trunksHem = new THREE.Mesh(trunksHemGeo, this.matTrunks);
    trunksHem.position.set(0, 0.13, 0);
    trunksHem.castShadow = true;
    group.add(trunksHem);

    return group;
  }

  // 10. SHIN & CALF
  buildShinMesh() {
    const group = new THREE.Group();
    const shinGeo = new THREE.BoxGeometry(0.125, 0.38, 0.125);
    const shin = new THREE.Mesh(shinGeo, this.matSkin);
    shin.position.set(0, 0, 0);
    shin.castShadow = true;
    group.add(shin);

    // Official UFC Ankle Support Sleeve (Corner identifier)
    const ankleGeo = new THREE.BoxGeometry(0.130, 0.09, 0.130);
    const ankle = new THREE.Mesh(ankleGeo, this.matCornerTape);
    ankle.position.set(0, -0.14, 0);
    group.add(ankle);

    return group;
  }

  // 11. BAREFOOT COMBAT FOOT
  buildFootMesh() {
    const group = new THREE.Group();

    // Instep & heel
    const heelGeo = new THREE.BoxGeometry(0.17, 0.055, 0.095);
    const heel = new THREE.Mesh(heelGeo, this.matSkin);
    heel.position.set(0.02, 0, 0);
    heel.castShadow = true;
    group.add(heel);

    // Toe box
    const toeGeo = new THREE.BoxGeometry(0.065, 0.038, 0.090);
    const toe = new THREE.Mesh(toeGeo, this.matSkin);
    toe.position.set(0.115, -0.008, 0);
    group.add(toe);

    // Ankle wrap bridge
    const wrapGeo = new THREE.BoxGeometry(0.095, 0.062, 0.100);
    const wrap = new THREE.Mesh(wrapGeo, this.matCornerTape);
    wrap.position.set(-0.02, 0.02, 0);
    group.add(wrap);

    return group;
  }
}
