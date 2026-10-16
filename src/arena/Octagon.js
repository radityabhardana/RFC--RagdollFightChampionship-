import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Octagon {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.radius = 4.57; // Official UFC 30ft Regulation Cage (9.144m diameter, 4.57m radius)
    this.fenceHeight = 1.80; // Official UFC Fence Height (5ft 11in, level with fighter's forehead)
    this.sides = 8;
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    this.initFloor();
    this.initPostsAndFence();
    this.initPhysics();
    this.initStadiumLighting();
  }

  // Generate procedural high-res UFC style canvas texture
  createCanvasTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    // Canvas base texture (textured dark carbon grey mat)
    ctx.fillStyle = '#181a1e';
    ctx.fillRect(0, 0, 2048, 2048);

    // Subtle mat fabric grain
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < 40000; i++) {
      const rx = Math.random() * 2048;
      const ry = Math.random() * 2048;
      ctx.fillRect(rx, ry, 2, 2);
    }

    const cx = 1024;
    const cy = 1024;

    // Draw Octagon inner boundary line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      const x = cx + Math.cos(angle) * 880;
      const y = cy + Math.sin(angle) * 880;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Center UFC Octagon emblem
    ctx.strokeStyle = '#d20a0a';
    ctx.lineWidth = 18;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      const x = cx + Math.cos(angle) * 360;
      const y = cy + Math.sin(angle) * 360;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // UFC Center Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 130px Impact, sans-serif';
    ctx.fillStyle = '#f0f0f0';
    ctx.fillText('UFC', cx, cy - 25);

    ctx.font = '800 36px Arial, sans-serif';
    ctx.fillStyle = '#d20a0a';
    ctx.letterSpacing = '8px';
    ctx.fillText('RAGDOLL CHAMPIONSHIP', cx, cy + 55);

    // Red Corner & Blue Corner indicator strips
    // Red Corner (Top)
    ctx.fillStyle = 'rgba(220, 20, 20, 0.85)';
    ctx.fillRect(cx - 320, cy - 860, 640, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px Impact, sans-serif';
    ctx.fillText('RED CORNER', cx, cy - 840);

    // Blue Corner (Bottom)
    ctx.fillStyle = 'rgba(20, 100, 240, 0.85)';
    ctx.fillRect(cx - 320, cy + 820, 640, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px Impact, sans-serif';
    ctx.fillText('BLUE CORNER', cx, cy + 840);

    // Sponsor Octagons on Canvas
    const sponsors = ['VITALITY', 'CRYPTO', 'ENERGY', 'STRIKER'];
    sponsors.forEach((sponsor, idx) => {
      const angle = (idx * Math.PI) / 2 + Math.PI / 4;
      const sx = cx + Math.cos(angle) * 620;
      const sy = cy + Math.sin(angle) * 620;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle + Math.PI / 2);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(-140, -45, 280, 90);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 4;
      ctx.strokeRect(-140, -45, 280, 90);

      ctx.font = '900 32px Impact, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillText(sponsor, 0, 0);

      ctx.restore();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  }

  // Create chain-link fence texture with alpha channel
  createFenceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(160, 165, 175, 0.65)';
    ctx.lineWidth = 3.5;

    // Diamond wire grid
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(64, 0);
    ctx.lineTo(128, 64);
    ctx.lineTo(64, 128);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(128, 64);
    ctx.lineTo(64, 128);
    ctx.lineTo(0, 64);
    ctx.closePath();
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 10);
    return texture;
  }

  initFloor() {
    // 8-sided polygon shape for canvas
    const shape = new THREE.Shape();
    for (let i = 0; i < this.sides; i++) {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      const x = Math.cos(angle) * this.radius;
      const y = Math.sin(angle) * this.radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const floorGeo = new THREE.ShapeGeometry(shape);
    // Project UVs to map square canvas texture onto Octagon
    const pos = floorGeo.attributes.position;
    const uvs = [];
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) / (this.radius * 2)) + 0.5;
      const v = (pos.getY(i) / (this.radius * 2)) + 0.5;
      uvs.push(u, v);
    }
    floorGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createCanvasTexture(),
      roughness: 0.85,
      metalness: 0.1,
    });

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0.01; // Elevate canvas mat cleanly above ground plane
    floorMesh.receiveShadow = true;
    this.meshGroup.add(floorMesh);

    // Outer elevated Octagon platform skirt (openEnded = true removes top cap to prevent Z-fighting)
    const skirtGeo = new THREE.CylinderGeometry(this.radius + 0.6, this.radius + 1.2, 0.6, 8, 1, true);
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c0e,
      roughness: 0.9,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.position.y = -0.3;
    skirtMesh.rotation.y = Math.PI / 8;
    this.meshGroup.add(skirtMesh);

    // Floor edge bumper rim
    const rimGeo = new THREE.TorusGeometry(this.radius + 0.05, 0.08, 8, 8);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.03;
    this.meshGroup.add(rimMesh);
  }

  initPostsAndFence() {
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, this.fenceHeight + 0.2, 16);
    const fenceTexture = this.createFenceTexture();

    // Solid alphaTest rendering prevents transparency sorting flicker
    const fenceMat = new THREE.MeshStandardMaterial({
      map: fenceTexture,
      alphaTest: 0.35,
      transparent: true,
      roughness: 0.4,
      metalness: 0.8,
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    const bumperMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.6,
      metalness: 0.2
    });

    const redCornerMat = new THREE.MeshStandardMaterial({
      color: 0xd20a0a,
      roughness: 0.5,
      metalness: 0.1
    });

    const blueCornerMat = new THREE.MeshStandardMaterial({
      color: 0x0a5cd2,
      roughness: 0.5,
      metalness: 0.1
    });

    for (let i = 0; i < this.sides; i++) {
      const angle1 = (i * Math.PI) / 4 + Math.PI / 8;
      const angle2 = (((i + 1) % this.sides) * Math.PI) / 4 + Math.PI / 8;

      const x1 = Math.cos(angle1) * this.radius;
      const z1 = Math.sin(angle1) * this.radius;
      const x2 = Math.cos(angle2) * this.radius;
      const z2 = Math.sin(angle2) * this.radius;

      // Corner Post
      let currentPostMat = bumperMat;
      if (i === 6) currentPostMat = redCornerMat; // Red corner
      if (i === 2) currentPostMat = blueCornerMat; // Blue corner

      const postMesh = new THREE.Mesh(postGeo, currentPostMat);
      postMesh.position.set(x1, this.fenceHeight / 2, z1);
      postMesh.castShadow = true;
      this.meshGroup.add(postMesh);

      // Corner Post Foam Pad (Thicker cylindrical cushion)
      const padGeo = new THREE.CylinderGeometry(0.2, 0.2, this.fenceHeight * 0.9, 12);
      const padMesh = new THREE.Mesh(padGeo, currentPostMat);
      padMesh.position.set(x1 * 0.96, this.fenceHeight / 2, z1 * 0.96);
      this.meshGroup.add(padMesh);

      // Fence Panel between corner i and corner i+1
      const panelWidth = Math.hypot(x2 - x1, z2 - z1);
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const fenceAngle = Math.atan2(z2 - z1, x2 - x1);

      const fenceGeo = new THREE.PlaneGeometry(panelWidth, this.fenceHeight);
      const fenceMesh = new THREE.Mesh(fenceGeo, fenceMat);
      fenceMesh.position.set(midX, this.fenceHeight / 2, midZ);
      fenceMesh.rotation.y = -fenceAngle;
      this.meshGroup.add(fenceMesh);

      // Top Foam Rail
      const topRailGeo = new THREE.BoxGeometry(panelWidth, 0.12, 0.16);
      const topRailMesh = new THREE.Mesh(topRailGeo, bumperMat);
      topRailMesh.position.set(midX, this.fenceHeight, midZ);
      topRailMesh.rotation.y = -fenceAngle;
      this.meshGroup.add(topRailMesh);

      // Bottom Rail
      const botRailGeo = new THREE.BoxGeometry(panelWidth, 0.08, 0.14);
      const botRailMesh = new THREE.Mesh(botRailGeo, bumperMat);
      botRailMesh.position.set(midX, 0.04, midZ);
      botRailMesh.rotation.y = -fenceAngle;
      this.meshGroup.add(botRailMesh);
    }
  }

  initPhysics() {
    // Canvas floor physics
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: new CANNON.Material({ friction: 0.8, restitution: 0.1 })
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.collisionFilterGroup = 1;
    groundBody.collisionFilterMask = -1;
    this.world.addBody(groundBody);

    // 8 Fence Wall Physics Colliders
    for (let i = 0; i < this.sides; i++) {
      const angle1 = (i * Math.PI) / 4 + Math.PI / 8;
      const angle2 = (((i + 1) % this.sides) * Math.PI) / 4 + Math.PI / 8;

      const x1 = Math.cos(angle1) * this.radius;
      const z1 = Math.sin(angle1) * this.radius;
      const x2 = Math.cos(angle2) * this.radius;
      const z2 = Math.sin(angle2) * this.radius;

      const panelWidth = Math.hypot(x2 - x1, z2 - z1);
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const fenceAngle = Math.atan2(z2 - z1, x2 - x1);
      const midDist = Math.hypot(midX, midZ);

      // Heavy 1.0m thick barrier preventing any physics penetration or tunneling
      const wallShape = new CANNON.Box(new CANNON.Vec3(panelWidth / 2 + 0.25, this.fenceHeight / 2 + 0.3, 0.5));
      const wallBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: new CANNON.Material({ friction: 0.5, restitution: 0.15 })
      });
      wallBody.addShape(wallShape);

      // Offset outward so the inner collision face aligns exactly with the fence wire mesh
      const outX = midX / midDist;
      const outZ = midZ / midDist;
      wallBody.position.set(midX + outX * 0.45, this.fenceHeight / 2, midZ + outZ * 0.45);
      wallBody.quaternion.setFromEuler(0, -fenceAngle, 0);
      wallBody.collisionFilterGroup = 1;
      wallBody.collisionFilterMask = -1;
      this.world.addBody(wallBody);
    }
  }

  initStadiumLighting() {
    // 1. Ambient & Hemisphere Light (ensures all angles are clearly visible)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3a4556, 1.8);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);

    // 2. Center arena overhead directional key light with crisp shadow mapping
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(2, 14, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 28;
    keyLight.shadow.camera.left = -6.0;
    keyLight.shadow.camera.right = 6.0;
    keyLight.shadow.camera.top = 6.0;
    keyLight.shadow.camera.bottom = -6.0;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.normalBias = 0.05; // Eliminates shadow acne and flicker on flat canvas
    this.scene.add(keyLight);

    // 3. Side & Rim lighting for dramatic fighter muscle definition
    const fillLight = new THREE.DirectionalLight(0xffeedd, 1.6);
    fillLight.position.set(-6, 8, -4);
    this.scene.add(fillLight);

    const frontLight = new THREE.DirectionalLight(0xddeeff, 1.4);
    frontLight.position.set(0, 7, 8);
    this.scene.add(frontLight);
  }
}
