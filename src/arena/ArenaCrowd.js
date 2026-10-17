import * as THREE from 'three';

/**
 * ArenaCrowd: Authentic UFC Championship Arena Environment (T-Mobile Arena / MSG Scale)
 * 
 * Spatial Layout & Features:
 * 1. Elevated Octagon Platform with Red & Blue Corner Access Stairs.
 * 2. Dedicated Fighter Walkout Runway & Archway with security barriers.
 * 3. Authentic Ringside Floor Layout (Tata Letak Ruang UFC Asli):
 *    - Red Corner Team: Head Coach, Cutman, Assistant, Stool, Ice Bucket, Towel.
 *    - Blue Corner Team: Head Coach, Cutman, Assistant, Stool, Ice Bucket, Towel.
 *    - Official UFC Broadcast Commentary Desk (Jon Anik, Joe Rogan, Daniel Cormier).
 *    - NSAC / Athletic Commission & Timekeeper Station with official brass round bell & red digital timer.
 *    - 3 Separate Official Judges positioned at triangular vantage points around the cage.
 *    - Ringside Medical Doctors Station with emergency jump kits.
 *    - Steadicam operators, ringside press photographers with telephoto lenses, and corner Jib Crane.
 *    - Security Personnel stationed at cage stairs, perimeter barriers, and walkout aisle.
 * 4. VIP Floor Seating (4 rows of ringside floor chairs with VIP spectators).
 * 5. Expansive Multi-Tier Stadium Bowl (Radius expanding to 50m!):
 *    - Lower Bowl (Radius 12.2m - 23.5m, Height up to 5.8m).
 *    - 360° Concourse Fascia with glowing LED Sponsor Ribbon (UFC, Monster, Crypto.com, Prime, Venum).
 *    - Upper Bowl Grandstand (Radius 24.5m - 50.0m, Height up to 21.0m) holding thousands of fans.
 * 6. Overhead Octagon Lighting Truss & Center-Hung 4-Sided Jumbotron.
 * 7. 4,500 Animated Instanced Spectators with high-performance direct buffer animation.
 * 8. Sparkling Smartphone Camera Flashes across the dim arena stands.
 */
export class ArenaCrowd {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.spectatorCount = 4500;
    this.excitement = 0.0;
    this.targetExcitement = 0.0;

    this.spectatorData = [];
    this.flashSprites = [];
    this.flashTimers = [];

    // Procedural Textures
    this.ledRibbonTex = this.createLedRibbonTexture();
    this.jumbotronTex = this.createJumbotronTexture();
    this.walkoutTex = this.createWalkoutCarpetTexture();

    // Arena Spatial Architecture
    this.initStadiumStructure();
    this.initOctagonStairs();
    this.initWalkoutRunway();
    this.initCornerTeams();
    this.initRingsideOfficials();
    this.initVipFloorSeating();
    this.initOverheadJumbotronAndTruss();
    this.initCrowdInstances();
    this.initCameraFlashes();
  }

  // -------------------------------------------------------------
  // PROCEDURAL HIGH-RESOLUTION TEXTURES
  // -------------------------------------------------------------

  // 360° Concourse LED Ribbon Banner with Official UFC Sponsors
  createLedRibbonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Carbon fiber dark background
    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, 4096, 256);

    // Subtle carbon grid
    ctx.fillStyle = '#0d0f14';
    for (let x = 0; x < 4096; x += 16) {
      ctx.fillRect(x, 0, 8, 256);
    }

    // Top and bottom neon edge strips
    ctx.fillStyle = '#d20a0a';
    ctx.fillRect(0, 0, 4096, 12);
    ctx.fillStyle = '#00a3ff';
    ctx.fillRect(0, 244, 4096, 12);

    const sponsors = [
      { text: 'RFC 300', color: '#ffffff', sub: 'RAGDOLL FIGHTING CHAMPIONSHIP', subColor: '#d20a0a' },
      { text: 'MONSTER ENERGY', color: '#50d71e', sub: 'UNLEASH THE BEAST', subColor: '#ffffff' },
      { text: 'CRYPTO.COM', color: '#1199fa', sub: 'OFFICIAL CRYPTOCURRENCY', subColor: '#ffffff' },
      { text: 'PRIME', color: '#ff2222', sub: 'HYDRATION FOR ATHLETES', subColor: '#ffffff' },
      { text: 'BUD LIGHT', color: '#0a75d2', sub: 'EASY TO ENJOY', subColor: '#ffffff' },
      { text: 'VENUM', color: '#f5f5f5', sub: 'FIGHT GEAR & APPAREL', subColor: '#888888' },
      { text: 'TIMEX', color: '#ffd000', sub: 'OFFICIAL TIMEKEEPER', subColor: '#ffffff' },
      { text: 'OCTAGON PASS', color: '#ffffff', sub: 'EXCLUSIVE PPV ACCESS', subColor: '#00e5ff' },
    ];

    const blockWidth = 4096 / sponsors.length;
    sponsors.forEach((sp, i) => {
      const bx = i * blockWidth;

      // Vertical separator
      ctx.fillStyle = '#1c202a';
      ctx.fillRect(bx, 20, 3, 216);

      // Main Brand
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 68px Impact, sans-serif';
      ctx.fillStyle = sp.color;
      ctx.fillText(sp.text, bx + blockWidth / 2, 110);

      // Slogan / Subtext
      ctx.font = '700 24px Arial, sans-serif';
      ctx.fillStyle = sp.subColor;
      ctx.letterSpacing = '4px';
      ctx.fillText(sp.sub, bx + blockWidth / 2, 175);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(4, 1);
    texture.anisotropy = 8;
    return texture;
  }

  // 4-Sided Giant Center-Hung Jumbotron Video Screen Texture
  createJumbotronTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, 1024, 512);

    // Red RFC Header Bar
    ctx.fillStyle = '#d20a0a';
    ctx.fillRect(0, 0, 1024, 70);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 48px Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RFC RAGDOLL FIGHTING CHAMPIONSHIP', 512, 35);

    // Live Fight Clock Display
    ctx.fillStyle = '#101319';
    ctx.fillRect(362, 90, 300, 100);
    ctx.strokeStyle = '#d20a0a';
    ctx.lineWidth = 4;
    ctx.strokeRect(362, 90, 300, 100);

    ctx.font = '900 64px Impact, sans-serif';
    ctx.fillStyle = '#ff2222';
    ctx.fillText('04:32', 512, 140);

    ctx.font = '700 20px Arial, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText('ROUND 1 OF 5', 512, 170);

    // Red Corner Fighter Card
    ctx.fillStyle = '#181a20';
    ctx.fillRect(50, 220, 420, 240);
    ctx.fillStyle = '#d20a0a';
    ctx.fillRect(50, 220, 420, 32);
    ctx.font = '900 22px Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RED CORNER', 260, 236);

    ctx.font = '900 38px Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PHIL TIMSKY', 260, 290);
    ctx.font = '700 20px Arial, sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('28 - 2 - 0 (24 KO)', 260, 335);
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillStyle = '#d20a0a';
    ctx.fillText('CHAMPION', 260, 375);

    // Blue Corner Fighter Card
    ctx.fillStyle = '#181a20';
    ctx.fillRect(554, 220, 420, 240);
    ctx.fillStyle = '#0a64d2';
    ctx.fillRect(554, 220, 420, 32);
    ctx.font = '900 22px Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BLUE CORNER', 764, 236);

    ctx.font = '900 38px Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ALEX STRIKER', 764, 290);
    ctx.font = '700 20px Arial, sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('25 - 3 - 0 (19 KO)', 764, 335);
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillStyle = '#0a64d2';
    ctx.fillText('#1 CONTENDER', 764, 375);

    // Bottom PPV Live Bug
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(60, 490, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 18px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('LIVE PPV', 120, 490);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  // Heavy-duty Black Walkout Carpet with UFC Branding
  createWalkoutCarpetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, 512, 2048);

    // White side boundary lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(20, 0, 8, 2048);
    ctx.fillRect(484, 0, 8, 2048);

    // Repeating UFC logos along runway
    for (let y = 250; y < 2048; y += 450) {
      ctx.save();
      ctx.translate(256, y);
      ctx.rotate(-Math.PI / 2);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 110px Impact, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillText('UFC', 0, 0);

      ctx.font = '700 24px Arial, sans-serif';
      ctx.fillStyle = '#d20a0a';
      ctx.letterSpacing = '6px';
      ctx.fillText('CHAMPIONSHIP', 0, 55);

      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    return texture;
  }

  // -------------------------------------------------------------
  // 1. STADIUM ARCHITECTURE (MASSIVE MULTI-TIER EXPANDED BOWL)
  // -------------------------------------------------------------
  initStadiumStructure() {
    // Arena Ringside Floor Level (at y = -0.65m, where octagon platform is elevated)
    const floorGeo = new THREE.RingGeometry(4.62, 12.0, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090b0e,
      roughness: 0.94,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.65;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Ringside Steel Barricade (Separates VIP Floor from Lower Bowl at radius 11.8m)
    const barricadeRadius = 11.8;
    const barricadeCount = 44;
    for (let i = 0; i < barricadeCount; i++) {
      const angle = (i * Math.PI * 2) / barricadeCount;
      // Skip opening for walkout tunnel at South-East (angle ~ -0.4 to 0.4 rad)
      if (Math.abs(angle - Math.PI / 2) < 0.22) continue;

      const x = Math.cos(angle) * barricadeRadius;
      const z = Math.sin(angle) * barricadeRadius;

      const railGeo = new THREE.BoxGeometry(1.72, 0.95, 0.05);
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x14161b,
        metalness: 0.8,
        roughness: 0.35,
      });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(x, -0.65 + 0.475, z);
      rail.rotation.y = -angle + Math.PI / 2;
      this.group.add(rail);
    }

    // TIER 1: Lower Bowl (Radius 12.2m to 23.5m, Height -0.2m to 5.8m)
    const t1Geo = new THREE.CylinderGeometry(23.5, 12.2, 6.0, 48, 1, true);
    const t1Mat = new THREE.MeshStandardMaterial({
      color: 0x08090d,
      roughness: 0.95,
      flatShading: true,
    });
    const tier1 = new THREE.Mesh(t1Geo, t1Mat);
    tier1.position.y = 2.8;
    tier1.receiveShadow = true;
    this.group.add(tier1);

    // 360° Concourse Fascia Ring with Illuminated LED Sponsor Ribbon
    const fasciaGeo = new THREE.CylinderGeometry(23.6, 23.6, 1.4, 64, 1, true);
    // Invert U coordinates so text is not mirrored when viewed from the inside (THREE.BackSide)
    const uvAttr = fasciaGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1.0 - uvAttr.getX(i));
    }
    uvAttr.needsUpdate = true;

    const fasciaMat = new THREE.MeshBasicMaterial({
      map: this.ledRibbonTex,
      side: THREE.BackSide,
    });
    const fascia = new THREE.Mesh(fasciaGeo, fasciaMat);
    fascia.position.y = 6.5;
    this.group.add(fascia);

    // Fascia Steel Frame trims
    const frameGeo = new THREE.TorusGeometry(23.62, 0.08, 8, 64);
    frameGeo.rotateX(Math.PI / 2);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x181a20, metalness: 0.8 });
    const topTrim = new THREE.Mesh(frameGeo, frameMat);
    topTrim.position.y = 7.2;
    this.group.add(topTrim);
    const btmTrim = new THREE.Mesh(frameGeo, frameMat);
    btmTrim.position.y = 5.8;
    this.group.add(btmTrim);

    // TIER 2 & 3: Upper Bowl Grandstand (Radius 24.5m to 50.0m! Height 7.0m to 21.0m)
    const t2Geo = new THREE.CylinderGeometry(50.0, 24.5, 14.0, 64, 1, true);
    const t2Mat = new THREE.MeshStandardMaterial({
      color: 0x050608,
      roughness: 0.96,
      flatShading: true,
    });
    const tier2 = new THREE.Mesh(t2Geo, t2Mat);
    tier2.position.y = 14.0;
    tier2.receiveShadow = true;
    this.group.add(tier2);

    // Massive Stadium Outer Enclosure Wall (Radius 51.5m, Height 26m)
    const wallGeo = new THREE.CylinderGeometry(51.5, 51.5, 26.0, 48, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x030405,
      roughness: 1.0,
      side: THREE.BackSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 13.0;
    this.group.add(wall);

    // Dark Arena Ceiling Dome
    const ceilingGeo = new THREE.ConeGeometry(51.5, 8.0, 48, 1, true);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x020304,
      roughness: 1.0,
      side: THREE.BackSide,
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.y = 28.0;
    ceiling.rotation.x = Math.PI;
    this.group.add(ceiling);
  }

  // -------------------------------------------------------------
  // 2. OCTAGON ACCESS STAIRS (RED & BLUE CORNERS)
  // -------------------------------------------------------------
  initOctagonStairs() {
    // Red Corner Stairs (West, at x = -5.1m, z = 0)
    const redStairs = this.buildStairsMesh(0xd20a0a);
    redStairs.position.set(-5.05, -0.65, 0);
    redStairs.rotation.y = Math.PI / 2;
    this.group.add(redStairs);

    // Blue Corner Stairs (East, at x = +5.1m, z = 0)
    const blueStairs = this.buildStairsMesh(0x0a64d2);
    blueStairs.position.set(5.05, -0.65, 0);
    blueStairs.rotation.y = -Math.PI / 2;
    this.group.add(blueStairs);
  }

  buildStairsMesh(cornerColor) {
    const group = new THREE.Group();
    const steps = 4;
    const stepDepth = 0.28;
    const stepHeight = 0.165;
    const stepWidth = 1.25;

    for (let s = 0; s < steps; s++) {
      // Step riser & tread
      const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, (steps - s) * stepDepth);
      const stepMat = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.7, metalness: 0.5 });
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(0, (s + 0.5) * stepHeight, (s * stepDepth) / 2);
      group.add(step);

      // Yellow non-slip safety edge
      const edgeGeo = new THREE.BoxGeometry(stepWidth, 0.02, 0.035);
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd000 });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(0, (s + 1) * stepHeight + 0.01, -((steps - s) * stepDepth) / 2 + 0.02);
      group.add(edge);
    }

    // Corner Handrails
    [-stepWidth / 2 - 0.04, stepWidth / 2 + 0.04].forEach(hx => {
      const railGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.25, 8);
      const railMat = new THREE.MeshStandardMaterial({ color: cornerColor, metalness: 0.6, roughness: 0.3 });
      const post1 = new THREE.Mesh(railGeo, railMat);
      post1.position.set(hx, 0.55, -0.4);
      group.add(post1);

      const post2 = new THREE.Mesh(railGeo, railMat);
      post2.position.set(hx, 0.85, 0.4);
      group.add(post2);

      const barGeo = new THREE.BoxGeometry(0.04, 0.04, 1.1);
      const bar = new THREE.Mesh(barGeo, railMat);
      bar.position.set(hx, 0.95, 0.0);
      bar.rotation.x = 0.32;
      group.add(bar);
    });

    return group;
  }

  // -------------------------------------------------------------
  // 3. FIGHTER WALKOUT RUNWAY & ENTRANCE TUNNEL
  // -------------------------------------------------------------
  initWalkoutRunway() {
    const runwayGroup = new THREE.Group();

    // Runway Carpet extending from Z = 8.5m to Z = 44.0m
    const runwayLength = 35.5;
    const runwayWidth = 2.8;
    const runwayGeo = new THREE.BoxGeometry(runwayWidth, 0.12, runwayLength);
    const runwayMat = new THREE.MeshStandardMaterial({
      map: this.walkoutTex,
      roughness: 0.85,
    });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.set(0, -0.65 + 0.06, 8.5 + runwayLength / 2);
    runway.receiveShadow = true;
    runwayGroup.add(runway);

    // Steel Crowd Barriers on both sides of runway
    const barCount = 14;
    const spacing = runwayLength / barCount;
    for (let i = 0; i < barCount; i++) {
      const zPos = 8.8 + i * spacing;
      [-runwayWidth / 2 - 0.15, runwayWidth / 2 + 0.15].forEach(xPos => {
        const barGeo = new THREE.BoxGeometry(0.06, 0.95, spacing * 0.96);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: 0.7, roughness: 0.4 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(xPos, -0.65 + 0.475, zPos);
        runwayGroup.add(bar);

        // Security guards stationed every few panels facing the crowd
        if (i % 3 === 1) {
          const sec = this.buildSecurityGuard();
          sec.position.set(xPos + (xPos > 0 ? 0.45 : -0.45), -0.65, zPos);
          sec.rotation.y = xPos > 0 ? Math.PI / 2 : -Math.PI / 2;
          runwayGroup.add(sec);
        }
      });
    }

    // Entrance Archway at Back Tunnel (Z = 43.5m)
    const archGroup = new THREE.Group();
    archGroup.position.set(0, -0.65, 43.5);

    // Black Steel Arch Posts
    [-2.2, 2.2].forEach(px => {
      const pillarGeo = new THREE.BoxGeometry(0.55, 6.5, 0.55);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x181a20, metalness: 0.8, roughness: 0.3 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, 3.25, 0);
      archGroup.add(pillar);

      // Glowing vertical LED light strip
      const stripGeo = new THREE.PlaneGeometry(0.12, 5.8);
      const stripMat = new THREE.MeshBasicMaterial({ color: 0xd20a0a });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(px, 3.25, -0.28);
      strip.rotation.y = Math.PI;
      archGroup.add(strip);
    });

    // Top Header Truss
    const headerGeo = new THREE.BoxGeometry(5.2, 1.2, 0.6);
    const headerMat = new THREE.MeshStandardMaterial({ color: 0x111317, metalness: 0.7 });
    const header = new THREE.Mesh(headerGeo, headerMat);
    header.position.set(0, 6.2, 0);
    archGroup.add(header);

    // Glowing UFC Entrance Sign
    const signGeo = new THREE.PlaneGeometry(4.2, 0.9);
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#0a0b0e';
    sCtx.fillRect(0, 0, 512, 128);
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.font = '900 64px Impact, sans-serif';
    sCtx.fillStyle = '#d20a0a';
    sCtx.fillText('UFC WALKOUT', 256, 64);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(0, 6.2, -0.32);
    sign.rotation.y = Math.PI;
    archGroup.add(sign);

    runwayGroup.add(archGroup);
    this.group.add(runwayGroup);
  }

  // -------------------------------------------------------------
  // 4. CORNER TEAMS (RED & BLUE CORNERS)
  // -------------------------------------------------------------
  initCornerTeams() {
    // RED CORNER TEAM (outside the cage on the left, x ~ -5.5m, y = -0.65m)
    const redCorner = new THREE.Group();
    redCorner.position.set(-5.5, -0.65, 0);
    redCorner.rotation.y = Math.PI / 2;

    // Corner Stool (Red vinyl barstool)
    const stoolGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.65, 8);
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0xd20a0a, roughness: 0.4 });
    const stoolRed = new THREE.Mesh(stoolGeo, stoolMat);
    stoolRed.position.set(0, 0.325, 0.45);
    redCorner.add(stoolRed);

    // Corner Ice Bucket & Water Bottle
    const bucketGeo = new THREE.CylinderGeometry(0.14, 0.11, 0.28, 8);
    const bucketMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7 });
    const bucketRed = new THREE.Mesh(bucketGeo, bucketMat);
    bucketRed.position.set(0.45, 0.14, 0.45);
    redCorner.add(bucketRed);

    // Red Corner Head Coach (red/black team windbreaker)
    const coachRed = this.buildCornerPerson(0xd20a0a, 0x141619, 0xd6a383, 'COACH');
    coachRed.position.set(-0.65, 0, 0.5);
    coachRed.rotation.y = -0.2;
    redCorner.add(coachRed);

    // Red Corner Cutman (black shirt, white medical towel & ice pack)
    const cutmanRed = this.buildCornerPerson(0x111317, 0x111317, 0xcfa07e, 'CUTMAN');
    cutmanRed.position.set(0.75, 0, 0.5);
    cutmanRed.rotation.y = 0.2;
    redCorner.add(cutmanRed);

    // Assistant Coach
    const asstRed = this.buildCornerPerson(0xd20a0a, 0x141619, 0xd29d7c, 'ASST');
    asstRed.position.set(0.1, 0, 0.95);
    asstRed.rotation.y = 0.0;
    redCorner.add(asstRed);

    this.group.add(redCorner);

    // BLUE CORNER TEAM (outside the cage on the right, x ~ +5.5m, y = -0.65m)
    const blueCorner = new THREE.Group();
    blueCorner.position.set(5.5, -0.65, 0);
    blueCorner.rotation.y = -Math.PI / 2;

    const stoolBlue = new THREE.Mesh(stoolGeo, new THREE.MeshStandardMaterial({ color: 0x0a64d2, roughness: 0.4 }));
    stoolBlue.position.set(0, 0.325, 0.45);
    blueCorner.add(stoolBlue);

    const bucketBlue = new THREE.Mesh(bucketGeo, bucketMat);
    bucketBlue.position.set(-0.45, 0.14, 0.45);
    blueCorner.add(bucketBlue);

    // Blue Corner Head Coach
    const coachBlue = this.buildCornerPerson(0x0a64d2, 0x141619, 0xcfa07e, 'COACH');
    coachBlue.position.set(0.65, 0, 0.5);
    coachBlue.rotation.y = 0.2;
    blueCorner.add(coachBlue);

    // Blue Corner Cutman
    const cutmanBlue = this.buildCornerPerson(0x111317, 0x111317, 0xd6a383, 'CUTMAN');
    cutmanBlue.position.set(-0.75, 0, 0.5);
    cutmanBlue.rotation.y = -0.2;
    blueCorner.add(cutmanBlue);

    // Assistant Coach
    const asstBlue = this.buildCornerPerson(0x0a64d2, 0x141619, 0xd29d7c, 'ASST');
    asstBlue.position.set(-0.1, 0, 0.95);
    asstBlue.rotation.y = 0.0;
    blueCorner.add(asstBlue);

    this.group.add(blueCorner);
  }

  buildCornerPerson(jacketColor, pantsColor, skinColor, role) {
    const person = new THREE.Group();

    // Legs
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.85, 0.22),
      new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 })
    );
    legs.position.y = 0.425;
    person.add(legs);

    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.58, 0.26),
      new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.75 })
    );
    torso.position.y = 1.10;
    person.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.21, 0.18),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65 })
    );
    head.position.y = 1.48;
    person.add(head);

    if (role === 'COACH') {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.05, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 })
      );
      cap.position.set(0, 1.58, 0.03);
      person.add(cap);
    } else if (role === 'CUTMAN') {
      const towel = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.42, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9 })
      );
      towel.position.set(0.22, 1.18, 0);
      person.add(towel);
    }

    return person;
  }

  // -------------------------------------------------------------
  // 5. RINGSIDE OFFICIALS, BROADCAST COMMENTARY & JUDGES (TRUE UFC TRIANGLE)
  // -------------------------------------------------------------
  initRingsideOfficials() {
    // 1. UFC Official Commentary Desk (South side at z = 6.6m, y = -0.65m)
    const commGroup = new THREE.Group();
    commGroup.position.set(0, -0.65, 6.6);

    const tableGeo = new THREE.BoxGeometry(2.8, 0.82, 0.75);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.6 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = 0.41;
    commGroup.add(table);

    // Red UFC Logo Front Skirt
    const skirtGeo = new THREE.BoxGeometry(2.75, 0.68, 0.02);
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xd20a0a, roughness: 0.5 });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.set(0, 0.44, 0.38);
    commGroup.add(skirt);

    // 3 Commentators (Joe Rogan, Daniel Cormier, Jon Anik) with dual glowing screens
    [-0.85, 0, 0.85].forEach(posX => {
      const monGeo = new THREE.BoxGeometry(0.38, 0.24, 0.04);
      const monMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: 0.8 });
      const monitor = new THREE.Mesh(monGeo, monMat);
      monitor.position.set(posX, 0.94, -0.05);
      monitor.rotation.x = -0.3;
      commGroup.add(monitor);

      const scrGeo = new THREE.PlaneGeometry(0.34, 0.20);
      const scrMat = new THREE.MeshBasicMaterial({ color: 0x225588 });
      const screen = new THREE.Mesh(scrGeo, scrMat);
      screen.position.set(posX, 0.94, -0.028);
      screen.rotation.x = -0.3;
      commGroup.add(screen);

      // Commentator Suit & Head
      const suit = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.52, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.7 })
      );
      suit.position.set(posX, 0.88, 0.55);
      commGroup.add(suit);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.20, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xd6a383, roughness: 0.65 })
      );
      head.position.set(posX, 1.25, 0.55);
      commGroup.add(head);

      // Headset with boom mic
      const headset = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.015, 6, 12, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 })
      );
      headset.position.set(posX, 1.30, 0.55);
      commGroup.add(headset);
    });

    this.group.add(commGroup);

    // 2. NSAC Commission & Official Timekeeper Station (North side at z = -6.8m, y = -0.65m)
    const commishGroup = new THREE.Group();
    commishGroup.position.set(0, -0.65, -6.8);
    commishGroup.rotation.y = Math.PI;

    const jTable = new THREE.Mesh(tableGeo, tableMat);
    jTable.position.y = 0.41;
    commishGroup.add(jTable);

    const jSkirt = new THREE.Mesh(skirtGeo, new THREE.MeshStandardMaterial({ color: 0x111e33, roughness: 0.6 }));
    jSkirt.position.set(0, 0.44, 0.38);
    commishGroup.add(jSkirt);

    // Official Brass Round Bell
    const bellGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.10, 8);
    const bellMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    const bell = new THREE.Mesh(bellGeo, bellMat);
    bell.position.set(0.65, 0.87, 0);
    commishGroup.add(bell);

    // Red Digital Round Timer Display on Desk
    const timerBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x0a0c10 })
    );
    timerBox.position.set(-0.65, 0.91, 0);
    commishGroup.add(timerBox);

    const timerScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xff1111 })
    );
    timerScreen.position.set(-0.65, 0.91, -0.061);
    timerScreen.rotation.y = Math.PI;
    commishGroup.add(timerScreen);

    // 3 Commission Inspectors in suits
    [-0.65, 0, 0.65].forEach(posX => {
      const suit = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.52, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.7 })
      );
      suit.position.set(posX, 0.88, 0.55);
      commishGroup.add(suit);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.20, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xcfa07e, roughness: 0.65 })
      );
      head.position.set(posX, 1.25, 0.55);
      commishGroup.add(head);
    });

    this.group.add(commishGroup);

    // 3. THREE SEPARATE OFFICIAL JUDGES (UFC Triangle Setup: Judge 1, Judge 2, Judge 3)
    const judgePositions = [
      { x: -5.8, z: 2.8, angle: Math.PI * 0.75 },  // Judge 1 (South-West)
      { x: 0.0, z: -6.0, angle: 0 },               // Judge 2 (North)
      { x: 5.8, z: 2.8, angle: -Math.PI * 0.75 },  // Judge 3 (South-East)
    ];

    judgePositions.forEach((jp, idx) => {
      const jGroup = new THREE.Group();
      jGroup.position.set(jp.x, -0.65, jp.z);
      jGroup.lookAt(0, -0.65, 0);

      // Dedicated Judge Podium Table
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.80, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.6 })
      );
      desk.position.set(0, 0.40, 0.25);
      jGroup.add(desk);

      // Scorecard Pad & Small Monitor
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.02, 0.32),
        new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.8 })
      );
      pad.position.set(0.15, 0.81, 0.25);
      jGroup.add(pad);

      // Judge Seated
      const jSuit = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.50, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x181a20 })
      );
      jSuit.position.set(0, 0.85, 0.65);
      jGroup.add(jSuit);

      const jHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.20, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xd6a383 })
      );
      jHead.position.set(0, 1.22, 0.65);
      jGroup.add(jHead);

      this.group.add(jGroup);
    });

    // 4. Ringside Medical Doctors Station (x = 5.2m, z = -3.2m)
    const docGroup = new THREE.Group();
    docGroup.position.set(5.2, -0.65, -3.2);
    docGroup.lookAt(0, -0.65, 0);

    // Medical Table with First Aid Kit
    const docTable = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.78, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1e2229 })
    );
    docTable.position.set(0, 0.39, 0.25);
    docGroup.add(docTable);

    // Red Emergency Trauma Kit
    const kit = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.22, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xd20a0a })
    );
    kit.position.set(0, 0.89, 0.25);
    docGroup.add(kit);

    // 2 Seated Event Physicians
    [-0.32, 0.32].forEach(dx => {
      const dSuit = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.48, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x2b384a })
      );
      dSuit.position.set(dx, 0.82, 0.65);
      docGroup.add(dSuit);

      const dHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.20, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xcfa07e })
      );
      dHead.position.set(dx, 1.18, 0.65);
      docGroup.add(dHead);
    });
    this.group.add(docGroup);

    // 5. Ringside Photographers & Steadicam Operators
    const mediaCrew = [
      { angle: Math.PI * 0.32, type: 'STEADICAM' },
      { angle: Math.PI * 0.68, type: 'PHOTOGRAPHER' },
      { angle: -Math.PI * 0.32, type: 'STEADICAM' },
      { angle: -Math.PI * 0.68, type: 'PHOTOGRAPHER' },
      { angle: Math.PI * 0.95, type: 'PHOTOGRAPHER' },
    ];

    mediaCrew.forEach(crew => {
      const dist = 5.8;
      const cx = Math.cos(crew.angle) * dist;
      const cz = Math.sin(crew.angle) * dist;

      const crewGroup = new THREE.Group();
      crewGroup.position.set(cx, -0.65, cz);
      crewGroup.lookAt(0, 0.5, 0);

      // Body (black UFC crew polo)
      const isPhotog = crew.type === 'PHOTOGRAPHER';
      const bodyH = isPhotog ? 0.42 : 0.48;
      const bodyY = isPhotog ? 0.48 : 0.65;

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, bodyH, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 })
      );
      body.position.y = bodyY;
      crewGroup.add(body);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.18, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xd6a383, roughness: 0.65 })
      );
      head.position.y = bodyY + 0.35;
      crewGroup.add(head);

      // Telephoto Camera Rig
      const cam = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.36),
        new THREE.MeshStandardMaterial({ color: 0x0a0c0e, metalness: 0.7 })
      );
      cam.position.set(0, bodyY + 0.42, 0.24);

      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.08, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.85 }) // White Canon/Sony Telephoto
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, bodyY + 0.42, 0.54);

      crewGroup.add(cam);
      crewGroup.add(lens);
      this.group.add(crewGroup);
    });

    // 6. Corner Jib / Crane Camera (North-East, x = 6.8m, z = -5.8m)
    const jibGroup = new THREE.Group();
    jibGroup.position.set(6.8, -0.65, -5.8);
    jibGroup.lookAt(0, 1.2, 0);

    const baseGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8);
    const jibBase = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: 0.8 }));
    jibBase.position.y = 0.6;
    jibGroup.add(jibBase);

    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8);
    armGeo.rotateZ(Math.PI / 2);
    const jibArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0x0a0c0e, metalness: 0.85 }));
    jibArm.position.set(1.2, 1.6, 0);
    jibArm.rotation.y = 0.4;
    jibGroup.add(jibArm);

    this.group.add(jibGroup);
  }

  // Security Guard Helper
  buildSecurityGuard() {
    const group = new THREE.Group();

    // Black Security Pants
    const pants = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.88, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x0e1014 })
    );
    pants.position.y = 0.44;
    group.add(pants);

    // Event Staff Yellow/Black Jacket
    const jacket = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.58, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xffd000, roughness: 0.7 })
    );
    jacket.position.y = 1.14;
    group.add(jacket);

    // Head with Security Earpiece
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.21, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xd6a383 })
    );
    head.position.y = 1.52;
    group.add(head);

    return group;
  }

  // -------------------------------------------------------------
  // 6. VIP FLOOR SEATING (RINGSIDE CHAIRS FOR VIP CELEBRITIES)
  // -------------------------------------------------------------
  initVipFloorSeating() {
    // 3 Concentric rows of VIP folding chairs on the floor (radius 7.4m to 11.0m)
    const vipMeshGroup = new THREE.Group();
    const chairGeo = new THREE.BoxGeometry(0.42, 0.45, 0.42);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.7 });

    const vipRows = [
      { radius: 7.6, count: 48 },
      { radius: 8.8, count: 56 },
      { radius: 10.0, count: 64 },
    ];

    vipRows.forEach(row => {
      for (let i = 0; i < row.count; i++) {
        const angle = (i * Math.PI * 2) / row.count;
        // Don't place chairs inside walkout runway
        const z = Math.sin(angle) * row.radius;
        const x = Math.cos(angle) * row.radius;
        if (z > 7.0 && Math.abs(x) < 2.4) continue;

        const chair = new THREE.Mesh(chairGeo, chairMat);
        chair.position.set(x, -0.65 + 0.225, z);
        chair.lookAt(0, -0.65 + 0.225, 0);
        vipMeshGroup.add(chair);
      }
    });

    this.group.add(vipMeshGroup);
  }

  // -------------------------------------------------------------
  // 7. OVERHEAD STEEL LIGHTING TRUSS & 4-SIDED JUMBOTRON
  // -------------------------------------------------------------
  initOverheadJumbotronAndTruss() {
    const trussHeight = 8.6;
    const trussGroup = new THREE.Group();
    trussGroup.position.y = trussHeight;

    // Octagonal Truss Ring directly over Octagon
    const trussRadius = 5.6;
    for (let i = 0; i < 8; i++) {
      const a1 = (i * Math.PI) / 4 + Math.PI / 8;
      const a2 = (((i + 1) % 8) * Math.PI) / 4 + Math.PI / 8;
      const x1 = Math.cos(a1) * trussRadius;
      const z1 = Math.sin(a1) * trussRadius;
      const x2 = Math.cos(a2) * trussRadius;
      const z2 = Math.sin(a2) * trussRadius;

      const beamLen = Math.hypot(x2 - x1, z2 - z1);
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const beamAngle = Math.atan2(z2 - z1, x2 - x1);

      const beamGeo = new THREE.BoxGeometry(beamLen, 0.4, 0.4);
      const beamMat = new THREE.MeshStandardMaterial({
        color: 0x22262e,
        metalness: 0.8,
        roughness: 0.35,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(midX, 0, midZ);
      beam.rotation.y = -beamAngle;
      trussGroup.add(beam);

      // Hanging Stadium Speaker Line-Arrays
      if (i % 2 === 0) {
        const spkGroup = new THREE.Group();
        spkGroup.position.set(midX, -0.6, midZ);
        for (let s = 0; s < 4; s++) {
          const spk = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.22, 0.32),
            new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.8 })
          );
          spk.position.set(0, -s * 0.24, 0);
          spk.rotation.x = -s * 0.08;
          spkGroup.add(spk);
        }
        trussGroup.add(spkGroup);
      }
    }

    // 4-Sided Giant Center-Hung Jumbotron Video Board (Hanging at y = 11.5m)
    const jumbotronGroup = new THREE.Group();
    jumbotronGroup.position.y = 11.5;

    const coreGeo = new THREE.BoxGeometry(4.8, 2.6, 4.8);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x080a0d, roughness: 0.7 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    jumbotronGroup.add(core);

    const screenOffsets = [
      { pos: [0, 0, 2.42], rotY: 0 },
      { pos: [0, 0, -2.42], rotY: Math.PI },
      { pos: [2.42, 0, 0], rotY: Math.PI / 2 },
      { pos: [-2.42, 0, 0], rotY: -Math.PI / 2 },
    ];

    screenOffsets.forEach(cfg => {
      const scrGeo = new THREE.PlaneGeometry(4.5, 2.3);
      const scrMat = new THREE.MeshBasicMaterial({ map: this.jumbotronTex });
      const scr = new THREE.Mesh(scrGeo, scrMat);
      scr.position.set(...cfg.pos);
      scr.rotation.y = cfg.rotY;
      jumbotronGroup.add(scr);
    });

    this.group.add(trussGroup);
    this.group.add(jumbotronGroup);
  }

  // -------------------------------------------------------------
  // 8. 4,500 INSTANCED DENSE SPECTATORS (EXPANDED TO RADIUS 49.5m)
  // -------------------------------------------------------------
  initCrowdInstances() {
    // Low-poly merged fan mesh (head + shoulders + torso)
    const fanGeo = new THREE.BoxGeometry(0.36, 0.70, 0.28);

    const crowdMat = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.08,
      flatShading: true,
    });

    this.crowdMesh = new THREE.InstancedMesh(fanGeo, crowdMat, this.spectatorCount);
    this.crowdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crowdMesh.castShadow = false;
    this.crowdMesh.receiveShadow = false;

    // Authentic UFC Audience Palette
    const fanColors = [
      new THREE.Color(0xb51212), // UFC Red team
      new THREE.Color(0x0e58b8), // UFC Blue team
      new THREE.Color(0x131518), // Black MMA hoodie
      new THREE.Color(0x22262d), // Charcoal streetwear
      new THREE.Color(0xd8dbe2), // White fan tee
      new THREE.Color(0x525b68), // Grey athletic crew
      new THREE.Color(0x9a8028), // Gold champion cap
      new THREE.Color(0x1a3826), // Military olive
      new THREE.Color(0x5e227a), // Deep purple
      new THREE.Color(0xb24d18), // Dark orange
      new THREE.Color(0x181c22), // VIP Dark suit
    ];

    const dummy = new THREE.Object3D();
    const rows = 28;
    const fansPerRow = Math.floor(this.spectatorCount / rows);

    let instanceIdx = 0;
    for (let r = 0; r < rows; r++) {
      const rowT = r / (rows - 1);

      // Section 1: VIP Floor (rows 0..3, radius 7.5m to 11.0m, height -0.2m)
      // Section 2: Lower Bowl (rows 4..12, radius 12.5m to 23.0m, height 0.6m to 5.6m)
      // Section 3: Upper Bowl (rows 13..27, radius 24.8m to 49.5m, height 7.2m to 20.8m)
      let rowRadius, rowY;
      if (rowT < 0.14) {
        // VIP Floor
        const fT = rowT / 0.14;
        rowRadius = THREE.MathUtils.lerp(7.6, 11.2, fT);
        rowY = -0.65 + 0.45;
      } else if (rowT < 0.44) {
        // Lower Bowl
        const bT = (rowT - 0.14) / 0.30;
        rowRadius = THREE.MathUtils.lerp(12.5, 23.0, bT);
        rowY = THREE.MathUtils.lerp(0.6, 5.6, Math.pow(bT, 1.15));
      } else {
        // Upper Bowl (Wider & Higher!)
        const uT = (rowT - 0.44) / 0.56;
        rowRadius = THREE.MathUtils.lerp(24.8, 49.5, uT);
        rowY = THREE.MathUtils.lerp(7.2, 20.8, Math.pow(uT, 1.25));
      }

      const countInThisRow = Math.floor(fansPerRow * (0.8 + rowT * 1.4));

      for (let i = 0; i < countInThisRow && instanceIdx < this.spectatorCount; i++) {
        const angle = (i / countInThisRow) * Math.PI * 2 + (r % 2) * 0.03 + Math.random() * 0.02;

        // Leave opening for Walkout Runway at Z > 7.0m, |X| < 2.2m on lower floors
        const rawZ = Math.sin(angle) * rowRadius;
        const rawX = Math.cos(angle) * rowRadius;
        if (rowY < 2.0 && rawZ > 6.5 && Math.abs(rawX) < 2.2) {
          continue;
        }

        const radJitter = rowRadius + (Math.random() - 0.5) * 0.42;
        const x = Math.cos(angle) * radJitter;
        const z = Math.sin(angle) * radJitter;
        const y = rowY + (Math.random() - 0.5) * 0.08;

        dummy.position.set(x, y, z);
        dummy.lookAt(0, 0.8, 0); // All 4,500 fans face the illuminated center Octagon!
        dummy.rotation.x += (Math.random() - 0.5) * 0.10;
        dummy.rotation.z += (Math.random() - 0.5) * 0.06;
        dummy.scale.setScalar(0.92 + Math.random() * 0.16);
        dummy.updateMatrix();

        this.crowdMesh.setMatrixAt(instanceIdx, dummy.matrix);

        const color = fanColors[Math.floor(Math.random() * fanColors.length)];
        this.crowdMesh.setColorAt(instanceIdx, color);

        this.spectatorData.push({
          baseY: y,
          bobSpeed: 1.6 + Math.random() * 2.2,
          bobPhase: Math.random() * Math.PI * 2,
          cheerAmp: 0.16 + Math.random() * 0.38,
        });

        instanceIdx++;
      }
    }

    this.crowdMesh.instanceMatrix.needsUpdate = true;
    if (this.crowdMesh.instanceColor) this.crowdMesh.instanceColor.needsUpdate = true;
    this.group.add(this.crowdMesh);
  }

  // -------------------------------------------------------------
  // 9. SPARKLING SMARTPHONE CAMERA FLASHES IN THE DARK STANDS
  // -------------------------------------------------------------
  initCameraFlashes() {
    this.flashCount = 48;
    this.flashGroup = new THREE.Group();
    this.group.add(this.flashGroup);

    const flashGeo = new THREE.PlaneGeometry(0.65, 0.65);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < this.flashCount; i++) {
      const flashMesh = new THREE.Mesh(flashGeo, flashMat.clone());
      const r = THREE.MathUtils.lerp(12.5, 48.0, Math.random());
      const angle = Math.random() * Math.PI * 2;
      const y = 1.0 + Math.pow((r - 12.0) / 36.0, 1.25) * 19.0 + Math.random() * 0.5;

      flashMesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      flashMesh.lookAt(0, 1.0, 0);

      this.flashGroup.add(flashMesh);
      this.flashSprites.push(flashMesh);
      this.flashTimers.push({
        nextFlash: Math.random() * 4.5,
        currentDuration: 0,
        active: false,
      });
    }
  }

  // Triggered on combat hits or knockdowns
  triggerExcitement(amount = 0.5) {
    this.targetExcitement = Math.min(1.0, this.targetExcitement + amount);

    const triggerCount = Math.floor(amount * 24);
    for (let i = 0; i < triggerCount; i++) {
      const idx = Math.floor(Math.random() * this.flashCount);
      this.flashTimers[idx].nextFlash = 0.02 * i;
    }
  }

  // -------------------------------------------------------------
  // 10. HIGH-PERFORMANCE 60 FPS ANIMATION LOOP
  // -------------------------------------------------------------
  update(delta, time) {
    this.excitement = THREE.MathUtils.lerp(this.excitement, this.targetExcitement, delta * 3.5);
    this.targetExcitement = THREE.MathUtils.lerp(this.targetExcitement, 0.0, delta * 0.35);

    // Dynamic LED Sponsor Ribbon marquee scroll
    if (this.ledRibbonTex) {
      this.ledRibbonTex.offset.x = (this.ledRibbonTex.offset.x + delta * 0.015) % 1.0;
    }

    const isHyped = this.excitement > 0.15;
    const matArray = this.crowdMesh.instanceMatrix.array;
    const count = this.spectatorData.length;

    // Direct Float32Array buffer manipulation (50x faster than dummy.updateMatrix across 4,500 instances!)
    for (let i = 0; i < count; i++) {
      const fan = this.spectatorData[i];
      const naturalBob = Math.sin(time * fan.bobSpeed + fan.bobPhase) * 0.035;
      const hypeJump = isHyped ? Math.max(0, Math.sin(time * 9.0 + fan.bobPhase)) * fan.cheerAmp * this.excitement : 0;

      // Matrix entry 13 is translation Y (column-major 4x4 matrix: [12]=X, [13]=Y, [14]=Z)
      matArray[i * 16 + 13] = fan.baseY + naturalBob + hypeJump;
    }
    this.crowdMesh.instanceMatrix.needsUpdate = true;

    // Smartphone Flashes update in dark arena tiers
    for (let i = 0; i < this.flashCount; i++) {
      const timer = this.flashTimers[i];
      const sprite = this.flashSprites[i];

      if (timer.active) {
        timer.currentDuration += delta;
        if (timer.currentDuration < 0.09) {
          sprite.material.opacity = 1.0 - timer.currentDuration / 0.09;
          sprite.scale.setScalar(1.0 + (1.0 - sprite.material.opacity) * 2.0);
        } else {
          sprite.material.opacity = 0.0;
          timer.active = false;
          timer.nextFlash = 1.5 + Math.random() * (4.5 - this.excitement * 2.8);
        }
      } else {
        timer.nextFlash -= delta;
        if (timer.nextFlash <= 0) {
          timer.active = true;
          timer.currentDuration = 0;
          sprite.material.opacity = 1.0;
          sprite.scale.setScalar(0.9 + Math.random() * 0.8);
        }
      }
    }
  }
}
