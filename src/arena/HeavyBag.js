import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { sounds } from '../audio/SoundManager.js';

/**
 * Professional UFC Heavy Boxing Bag & Industrial Steel Training Station
 * 
 * Features:
 * - Positioned at the exact center of the Octagon (0, 1.25, 0).
 * - Full heavy-duty industrial cantilever steel gallows stand (Tiang Baja UFC) at z = -1.25m.
 * - Heavy triangular steel base frame with counterweight plates and rubber floor pads.
 * - 85 kg (187 lbs) ultra-dense combat leather bag with authentic high-inertia pendulum physics.
 * - Kinetic impact absorption: eliminates twitchy/light balloon flailing; absorbs strikes with realistic heavyweight sway.
 * - Heavy suspension system: 360° ball-bearing swivel, compression spring, and 4 angled steel link chains.
 * - Static collision body for the stand column so fighters cannot pass through the pole.
 */
export class HeavyBag {
  constructor(scene, world, position = { x: 0, y: 1.25, z: 0 }) {
    this.scene = scene;
    this.world = world;
    this.position = new THREE.Vector3(position.x, position.y, position.z);

    // Stand geometry configuration
    this.standZ = -1.25;
    this.standHeight = 2.75;
    this.anchorY = 2.65; // Overhead swivel hook height directly above the bag

    this.initPhysics();
    this.initVisualMesh();
  }

  getPosition() {
    return this.bagBody ? this.bagBody.position : this.position;
  }

  getTorsoPosition() {
    return this.getPosition();
  }

  initPhysics() {
    // Ultra-dense combat leather & compressed fabric/sand filler (very low restitution = 0.04)
    const bagMat = new CANNON.Material({ friction: 0.8, restitution: 0.04 });
    const steelMat = new CANNON.Material({ friction: 0.5, restitution: 0.1 });

    // 1. Static Stand Post & Base Collision Body (Mass: 0)
    this.standBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(this.position.x, 1.35, this.standZ),
      material: steelMat,
    });
    // Vertical column box (0.16m x 2.7m x 0.16m)
    this.standBody.addShape(new CANNON.Box(new CANNON.Vec3(0.09, 1.35, 0.09)));
    // Base footprint box (1.4m wide x 0.1m high x 0.7m deep)
    this.standBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.70, 0.06, 0.40)),
      new CANNON.Vec3(0, -1.30, 0)
    );
    this.standBody.collisionFilterGroup = 1;
    this.standBody.collisionFilterMask = -1;
    this.world.addBody(this.standBody);

    // 2. Static Overhead Swivel Anchor Mount at (0, 2.65, 0)
    this.anchorBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(this.position.x, this.anchorY, this.position.z),
    });
    this.world.addBody(this.anchorBody);

    // 3. Heavy-Duty Professional Boxing Bag (85.0 kg = ~187 lbs, true commercial heavyweight gym bag)
    this.bagBody = new CANNON.Body({
      mass: 85.0,
      position: new CANNON.Vec3(this.position.x, this.position.y, this.position.z),
      material: bagMat,
      linearDamping: 0.16,   // Smooth natural pendulum drag through air
      angularDamping: 0.88,  // Strong rotational resistance prevents erratic twirling
    });

    // Cylinder: height = 1.20m, radius = 0.23m (thick, dense target)
    const bagShape = new CANNON.Cylinder(0.23, 0.23, 1.20, 16);
    this.bagBody.addShape(bagShape);
    this.bagBody.collisionFilterGroup = 1;
    this.bagBody.collisionFilterMask = -1;
    this.bagBody.isHeavyBag = true;
    this.world.addBody(this.bagBody);

    // 4. Flexible 4-Chain Suspension Constraint (Top ring at local y = 0.60m to Anchor at y = 2.65m)
    this.chainConstraint = new CANNON.PointToPointConstraint(
      this.bagBody,
      new CANNON.Vec3(0, 0.60, 0), // Top swivel bracket on bag
      this.anchorBody,
      new CANNON.Vec3(0, 0, 0)     // Overhead swivel hook
    );
    this.world.addConstraint(this.chainConstraint);

    // Strike audio trigger with impact velocity evaluation
    this.lastImpactTime = 0;
    this.bagBody.addEventListener('collide', (e) => {
      const now = performance.now();
      if (now - this.lastImpactTime > 130) {
        const relVel = e.contact ? Math.abs(e.contact.getImpactVelocityAlongNormal()) : 2.5;
        if (relVel > 0.6) {
          this.lastImpactTime = now;
          if (relVel > 3.2) {
            sounds.playHeavyImpact(true);
          } else {
            sounds.playPunch(0.95);
          }
        }
      }
    });
  }

  initVisualMesh() {
    this.group = new THREE.Group();

    // Steel material tokens
    const steelDarkMat = new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.38,
      metalness: 0.85,
    });
    const steelAccentMat = new THREE.MeshStandardMaterial({
      color: 0xd20a0a, // UFC Red accent
      roughness: 0.40,
      metalness: 0.40,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd0d5dd,
      roughness: 0.15,
      metalness: 0.95,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x0a0b0d,
      roughness: 0.90,
      metalness: 0.05,
    });

    // =========================================================================
    // A. HEAVY INDUSTRIAL STEEL GALLOWS STAND (TIANG PENYANGGA SAMSAK)
    // =========================================================================
    const standGroup = new THREE.Group();

    // 1. Base Longitudinal Spine Tube on Canvas (z from -0.80 to -1.80)
    const baseSpineGeo = new THREE.BoxGeometry(0.14, 0.07, 1.25);
    const baseSpine = new THREE.Mesh(baseSpineGeo, steelDarkMat);
    baseSpine.position.set(this.position.x, 0.035, this.standZ - 0.15);
    baseSpine.castShadow = true;
    baseSpine.receiveShadow = true;
    standGroup.add(baseSpine);

    // 2. Wide Transverse Outrigger Legs (Front & Rear cross beams)
    const frontLegGeo = new THREE.BoxGeometry(1.40, 0.07, 0.14);
    const frontLeg = new THREE.Mesh(frontLegGeo, steelDarkMat);
    frontLeg.position.set(this.position.x, 0.035, this.standZ + 0.40);
    frontLeg.castShadow = true;
    frontLeg.receiveShadow = true;
    standGroup.add(frontLeg);

    const rearLegGeo = new THREE.BoxGeometry(1.65, 0.07, 0.14);
    const rearLeg = new THREE.Mesh(rearLegGeo, steelDarkMat);
    rearLeg.position.set(this.position.x, 0.035, this.standZ - 0.70);
    rearLeg.castShadow = true;
    rearLeg.receiveShadow = true;
    standGroup.add(rearLeg);

    // Rubber floor feet under outriggers
    [-0.65, 0.65].forEach(x => {
      const footGeo = new THREE.BoxGeometry(0.16, 0.02, 0.16);
      const footFront = new THREE.Mesh(footGeo, rubberMat);
      footFront.position.set(this.position.x + x, 0.01, this.standZ + 0.40);
      standGroup.add(footFront);
    });
    [-0.78, 0.78].forEach(x => {
      const footGeo = new THREE.BoxGeometry(0.16, 0.02, 0.16);
      const footRear = new THREE.Mesh(footGeo, rubberMat);
      footRear.position.set(this.position.x + x, 0.01, this.standZ - 0.70);
      standGroup.add(footRear);
    });

    // 3. Olympic Cast-Iron Counterweight Plates Stacked on Rear Frame (Stability Ballast)
    [-0.45, 0.45].forEach(x => {
      [0.08, 0.14].forEach(y => {
        const plateGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.05, 24);
        const plate = new THREE.Mesh(plateGeo, steelDarkMat);
        plate.position.set(this.position.x + x, y, this.standZ - 0.70);
        plate.castShadow = true;
        standGroup.add(plate);

        // Center hub ring
        const hubGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.055, 16);
        const hub = new THREE.Mesh(hubGeo, chromeMat);
        hub.position.set(this.position.x + x, y, this.standZ - 0.70);
        standGroup.add(hub);
      });
    });

    // 4. Main Vertical Heavy Steel Pillar (Tiang Utama, height = 2.72m)
    const pillarGeo = new THREE.BoxGeometry(0.15, this.standHeight, 0.15);
    const pillar = new THREE.Mesh(pillarGeo, steelDarkMat);
    pillar.position.set(this.position.x, this.standHeight * 0.5, this.standZ);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    standGroup.add(pillar);

    // Base Gusset Plates (Triangular steel brackets welded at pillar base)
    [-0.09, 0.09].forEach(x => {
      const gussetGeo = new THREE.BoxGeometry(0.02, 0.35, 0.35);
      const gusset = new THREE.Mesh(gussetGeo, steelAccentMat);
      gusset.position.set(this.position.x + x, 0.20, this.standZ);
      gusset.rotation.x = Math.PI / 4;
      standGroup.add(gusset);
    });

    // UFC Brand Badge Plaque on Pillar Face
    const badgeGeo = new THREE.BoxGeometry(0.16, 0.45, 0.02);
    const badge = new THREE.Mesh(badgeGeo, steelAccentMat);
    badge.position.set(this.position.x, 1.65, this.standZ + 0.08);
    standGroup.add(badge);

    const badgeLabelGeo = new THREE.BoxGeometry(0.12, 0.12, 0.025);
    const badgeLabelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const badgeLabel = new THREE.Mesh(badgeLabelGeo, badgeLabelMat);
    badgeLabel.position.set(this.position.x, 1.65, this.standZ + 0.085);
    standGroup.add(badgeLabel);

    // 5. Overhead Cantilever Arm (Lengan Penyangga Horizontal Menjulur ke Titik Pusat Samsak)
    const boomLength = Math.abs(this.standZ) + 0.10; // ~1.35m forward
    const boomGeo = new THREE.BoxGeometry(0.14, 0.14, boomLength);
    const boom = new THREE.Mesh(boomGeo, steelDarkMat);
    boom.position.set(this.position.x, this.standHeight - 0.07, this.standZ * 0.5 + 0.05);
    boom.castShadow = true;
    boom.receiveShadow = true;
    standGroup.add(boom);

    // 6. Heavy 45° Diagonal Reinforcing Truss Brace
    const trussLen = 0.95;
    const trussGeo = new THREE.BoxGeometry(0.08, 0.08, trussLen);
    const truss = new THREE.Mesh(trussGeo, steelDarkMat);
    truss.position.set(this.position.x, this.standHeight - 0.42, this.standZ + 0.42);
    truss.rotation.x = -Math.PI / 4;
    truss.castShadow = true;
    standGroup.add(truss);

    // 7. Overhead Swivel Carabiner & Shock Absorber Coil Spring
    const hookBaseGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16);
    const hookBase = new THREE.Mesh(hookBaseGeo, chromeMat);
    hookBase.position.set(this.position.x, this.standHeight - 0.15, this.position.z);
    standGroup.add(hookBase);

    // Heavy Spring (Peredam Kejut Guncangan Samsak)
    const springGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12);
    const spring = new THREE.Mesh(springGeo, chromeMat);
    spring.position.set(this.position.x, this.anchorY + 0.06, this.position.z);
    standGroup.add(spring);

    // 360-Degree Swivel Ring Carabiner
    const swivelRingGeo = new THREE.TorusGeometry(0.045, 0.014, 12, 24);
    const swivelRing = new THREE.Mesh(swivelRingGeo, chromeMat);
    swivelRing.position.set(this.position.x, this.anchorY, this.position.z);
    swivelRing.rotation.y = Math.PI / 2;
    standGroup.add(swivelRing);

    this.group.add(standGroup);

    // =========================================================================
    // B. PROFESSIONAL UFC 85KG HEAVY LEATHER BAG (SAMSAK GANTUNG)
    // =========================================================================
    const bagGroup = new THREE.Group();

    // 1. Heavy Combat Bag Cylinder (1.20m tall x 0.46m diameter)
    const bagGeo = new THREE.CylinderGeometry(0.23, 0.23, 1.20, 28);
    const bagMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.50,
      metalness: 0.12,
    });
    this.bagMesh = new THREE.Mesh(bagGeo, bagMat);
    this.bagMesh.castShadow = true;
    this.bagMesh.receiveShadow = true;
    bagGroup.add(this.bagMesh);

    // 2. UFC Official Red Strike Target Zone (Liver / Midsection Bullseye)
    const targetBandGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.30, 28);
    const targetBandMat = new THREE.MeshStandardMaterial({
      color: 0xd20a0a,
      roughness: 0.44,
      metalness: 0.10,
    });
    const targetBand = new THREE.Mesh(targetBandGeo, targetBandMat);
    targetBand.position.set(0, 0.04, 0);
    this.bagMesh.add(targetBand);

    // Target Precision Crosshairs (Front & Rear strike markers)
    const markerGeo = new THREE.BoxGeometry(0.04, 0.12, 0.015);
    const markerCrossGeo = new THREE.BoxGeometry(0.12, 0.04, 0.015);
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    [-1, 1].forEach(side => {
      const vMark = new THREE.Mesh(markerGeo, markerMat);
      const hMark = new THREE.Mesh(markerCrossGeo, markerMat);
      vMark.position.set(0, 0.04, side * 0.236);
      hMark.position.set(0, 0.04, side * 0.236);
      this.bagMesh.add(vMark);
      this.bagMesh.add(hMark);
    });

    // 3. Top and Bottom Heavy Double-Stitched Reinforcement Caps
    [-0.59, 0.59].forEach(y => {
      const capGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 28);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.85 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0, y, 0);
      this.bagMesh.add(cap);
    });

    // 4. 4 Heavy Steel D-Rings on Bag Top Rim
    const dRingGeo = new THREE.TorusGeometry(0.024, 0.007, 8, 16);
    this.chainAttachmentPoints = [];
    const chainAngles = [
      Math.PI / 4,
      (3 * Math.PI) / 4,
      (5 * Math.PI) / 4,
      (7 * Math.PI) / 4,
    ];

    chainAngles.forEach(angle => {
      const dRing = new THREE.Mesh(dRingGeo, chromeMat);
      const rx = Math.cos(angle) * 0.19;
      const rz = Math.sin(angle) * 0.19;
      dRing.position.set(rx, 0.60, rz);
      dRing.rotation.x = Math.PI / 2;
      dRing.rotation.y = angle;
      this.bagMesh.add(dRing);
    });

    this.group.add(bagGroup);

    // =========================================================================
    // C. 4 HIGH-TENSILE STEEL LINK SUSPENSION CHAINS
    // =========================================================================
    this.chainLines = [];
    const chainMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.95,
      roughness: 0.18,
    });

    chainAngles.forEach(angle => {
      const chainGeo = new THREE.CylinderGeometry(0.011, 0.011, 1.0, 8);
      const chainMesh = new THREE.Mesh(chainGeo, chainMat);
      chainMesh.castShadow = true;
      this.group.add(chainMesh);
      this.chainLines.push({ mesh: chainMesh, angle });
    });

    this.scene.add(this.group);
  }

  update(delta = 0.016) {
    if (!this.bagMesh || !this.bagBody) return;

    // 1. Realistic Heavyweight Velocity Regulation
    // Prevent unphysical explosive launches when struck by infinite-mass kinematic bodies
    const v = this.bagBody.velocity;
    const horizSpeed = Math.hypot(v.x, v.z);
    const maxHorizSpeed = 2.4; // Max speed for a true 85kg heavy bag
    if (horizSpeed > maxHorizSpeed) {
      const sc = maxHorizSpeed / horizSpeed;
      v.x *= sc;
      v.z *= sc;
    }

    // Limit unnatural upward lift from uppercuts / teeps
    if (v.y > 0.40) v.y = 0.40;
    if (v.y < -3.0) v.y = -3.0;

    // Angular velocity clamp (prevents bag spinning like a helicopter propeller)
    const angSpeed = this.bagBody.angularVelocity.length();
    if (angSpeed > 3.0) {
      this.bagBody.angularVelocity.scale(3.0 / angSpeed, this.bagBody.angularVelocity);
    }

    // 2. Gravitational Pendulum Righting Torque
    // In real life, the bag's center of mass hangs 0.60m below the chain mount.
    // Gravity creates a natural righting moment that restores upright posture.
    const bagQuat = new THREE.Quaternion().copy(this.bagBody.quaternion);
    const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(bagQuat);
    const tiltAngle = Math.acos(THREE.MathUtils.clamp(upVec.y, -1, 1));
    if (tiltAngle > 0.04) {
      const tiltAxis = new THREE.Vector3().crossVectors(upVec, new THREE.Vector3(0, 1, 0)).normalize();
      const restoreTorque = tiltAngle * 35.0; // Restoring spring
      this.bagBody.angularVelocity.x += tiltAxis.x * restoreTorque * delta;
      this.bagBody.angularVelocity.z += tiltAxis.z * restoreTorque * delta;
    }

    // 3. Sync visual mesh with Cannon physics body
    this.bagMesh.position.copy(this.bagBody.position);
    this.bagMesh.quaternion.copy(this.bagBody.quaternion);

    // 4. Update the 4 angled steel link chains from the overhead swivel to the D-rings
    const anchorPos = new THREE.Vector3(this.position.x, this.anchorY, this.position.z);
    const topCenter = new THREE.Vector3(0, 0.60, 0).applyQuaternion(this.bagMesh.quaternion).add(this.bagMesh.position);

    this.chainLines.forEach(({ mesh, angle }) => {
      const strapOffset = new THREE.Vector3(
        Math.cos(angle) * 0.19,
        0,
        Math.sin(angle) * 0.19
      ).applyQuaternion(this.bagMesh.quaternion);

      const bagAttachment = topCenter.clone().add(strapOffset);
      const chainVector = new THREE.Vector3().subVectors(anchorPos, bagAttachment);
      const len = chainVector.length();

      mesh.position.copy(bagAttachment).addScaledVector(chainVector, 0.5);
      mesh.scale.set(1, len, 1);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), chainVector.normalize());
    });
  }
}
