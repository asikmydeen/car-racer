import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Car {
    constructor(scene, physicsWorld, inputManager) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.inputManager = inputManager;

        this.vehicle = null;
        this.chassisBody = null;
        this.wheelMeshes = [];
        this.chassisMesh = null;
    }

    init(x, y, z) {
        // === CHASSIS PHYSICS ===
        // Chassis is 2x0.5x4 meters (width x height x length)
        const chassisWidth = 1;  // half-width
        const chassisHeight = 0.25; // half-height
        const chassisLength = 2; // half-length

        const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisWidth, chassisHeight, chassisLength));
        this.chassisBody = new CANNON.Body({
            mass: 500,
            allowSleep: false
        });
        // Shape centered at body origin (no offset)
        // To lower Center of Mass, we move the shape UP relative to the body center.
        // So the Body Center (pivot) is effectively lower.
        // SHIFT FORWARD: -Z is Forward. We add slight negative Z offset to put weight on front wheels.
        const comOffset = new CANNON.Vec3(0, 0.2, -0.5); // Weight Forward (-0.5)
        this.chassisBody.addShape(chassisShape, comOffset);
        this.chassisBody.position.set(x, y + 1, z); // Start higher to drop safely

        // Face -Z (180 deg rotation)
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
        this.chassisBody.quaternion.copy(q);

        // Lock Rotation Axes (The "Nuclear Option")
        this.chassisBody.angularFactor = new CANNON.Vec3(0, 1, 0);

        this.chassisBody.angularDamping = 0.9;
        this.chassisBody.linearDamping = 0.1;

        // COLLISION GROUPS to prevent raycast self-hit
        // 1: Ground/Scene, 2: Car, 4: Triggers
        this.chassisBody.collisionFilterGroup = 2;
        this.chassisBody.collisionFilterMask = 1 | 4;

        this.physicsWorld.addBody(this.chassisBody);

        // === VISUAL CAR MODEL ===
        this.chassisMesh = new THREE.Group();
        this.buildSportyVisuals(0xff0033); // Default Red
        this.scene.add(this.chassisMesh);

        // === RAYCAST VEHICLE ===
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        });

        // Wheel setup
        const wheelRadius = 0.4; // 0.35 -> 0.4
        const wheelWidth = 0.3;
        const wheelTrack = 1.3;  // WIDER STANCE (Was 0.85)
        const wheelBase = 1.6;    // Z distance from center

        // Wheel options
        const options = {
            radius: wheelRadius,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 200,  // Stiffness increased for high speed downforce
            suspensionRestLength: 2.5, // Extended range to prevent bottoming out
            frictionSlip: 6,           // Increased Grip (was 3) for better turning
            dampingRelaxation: 2.5,
            dampingCompression: 10.0, // High damping to absorb fast impacts
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            maxSuspensionTravel: 1.0, // Allow more travel if needed
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
        };

        // Wheel connection point Y should be at bottom of chassis
        // Chassis half-height is 0.25, so bottom is at -0.25
        // BUG FIX: Move Raycast Origin UP to prevent tunneling underground at high speed
        // Moving to Y=1.5 (Approx 1.75m above bottom).
        const wheelY = 1.5;

        // Add 4 wheels
        const positions = [
            { x: wheelTrack, z: wheelBase },   // Front Left
            { x: -wheelTrack, z: wheelBase },  // Front Right
            { x: wheelTrack, z: -wheelBase },  // Rear Left
            { x: -wheelTrack, z: -wheelBase }, // Rear Right
        ];

        for (const pos of positions) {
            const wheelInfo = Object.assign({}, options);
            wheelInfo.chassisConnectionPointLocal = new CANNON.Vec3(pos.x, wheelY, pos.z);
            this.vehicle.addWheel(wheelInfo);
        }

        this.vehicle.addToWorld(this.physicsWorld.world);

        // === WHEEL VISUALS ===
        const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

        const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelWidth + 0.02, 12);
        rimGeo.rotateZ(Math.PI / 2);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3 });

        for (let i = 0; i < 4; i++) {
            const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
            wheelMesh.castShadow = true;
            const rimMesh = new THREE.Mesh(rimGeo, rimMat);
            wheelMesh.add(rimMesh);
            this.scene.add(wheelMesh);
            this.wheelMeshes.push(wheelMesh);
        }
    }

    setColor(hex) {
        // Find the main body mesh and update color
        this.chassisMesh.traverse((child) => {
            if (child.isMesh && child.name === 'bodyPanel') {
                child.material.color.setHex(hex);
            }
        });
    }

    buildSportyVisuals(color) {
        // Clear existing
        while (this.chassisMesh.children.length > 0) {
            this.chassisMesh.remove(this.chassisMesh.children[0]);
        }

        // --- Materials ---
        const paintColor = color || 0xff0000; // Use argument or default Red
        const paintMat = new THREE.MeshPhysicalMaterial({
            color: paintColor,
            metalness: 0.7,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });

        const blackMat = new THREE.MeshStandardMaterial({
            color: 0x111111, roughness: 0.5, metalness: 0.5
        }); // Carbon trim

        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            metalness: 0.9,
            roughness: 0.0,
            transparent: true,
            opacity: 0.9
        });

        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Neon cyan

        // --- 1. Main Body (Wedge) ---
        // A tapered box for the main chassis
        const chassisBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 4.4), paintMat);
        chassisBase.position.set(0, 0.4, 0); // Reverted position
        chassisBase.castShadow = true;
        chassisBase.name = 'bodyPanel';
        this.chassisMesh.add(chassisBase);

        // --- 2. Cockpit (Cabin) ---
        // Angular, low profile
        // Box, tapered.
        const cabinGeo = new THREE.BoxGeometry(1.4, 0.5, 2.0);
        const cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(0, 0.8, -0.2);
        // Slant the cabin?
        // Simple scale trick:
        cabin.scale.set(0.85, 1, 1);
        this.chassisMesh.add(cabin);

        // --- 3. Fenders (Muscular Arches) ---
        // 4 separate meshes
        const fenderGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 32);
        fenderGeo.rotateZ(Math.PI / 2); // Cylinder along X axis

        const offsets = [
            { x: 0.7, z: 1.4, s: 1 },  // Front L
            { x: -0.7, z: 1.4, s: 1 }, // Front R
            { x: 0.8, z: -1.4, s: 1.2 }, // Rear L (Wider)
            { x: -0.8, z: -1.4, s: 1.2 } // Rear R (Wider)
        ];

        offsets.forEach(off => {
            const f = new THREE.Mesh(fenderGeo, paintMat);
            f.position.set(off.x, 0.35, off.z); // Reverted position
            // Actually scale(x,y,z) on a Z-rotated cyl:
            // X-scale stretches LENGTH of cyl (width of car)
            // Y-scale stretches Height
            // Z-scale stretches Depth (Length of car)
            f.scale.set(1, 0.6, 1.4); // Reverted scale
            f.name = 'bodyPanel';
            this.chassisMesh.add(f);
        });

        // --- 4. Nose & Hood (Sloped) ---
        const noseGeo = new THREE.BoxGeometry(1.5, 0.1, 1.0);
        const nose = new THREE.Mesh(noseGeo, paintMat);
        nose.position.set(0, 0.4, 2.3);
        nose.rotation.x = 0.2; // Slope down
        nose.name = 'bodyPanel';
        this.chassisMesh.add(nose);

        // --- 5. Side Intakes ---
        const intakeGeo = new THREE.BoxGeometry(0.4, 0.4, 1.5);
        const intL = new THREE.Mesh(intakeGeo, blackMat);
        intL.position.set(0.9, 0.4, 0);
        this.chassisMesh.add(intL);

        const intR = new THREE.Mesh(intakeGeo, blackMat);
        intR.position.set(-0.9, 0.4, 0);
        this.chassisMesh.add(intR);

        // --- 6. Rear Wing (Spoiler) & Trunk ---
        this.trunkLid = new THREE.Group();
        this.trunkLid.position.set(0, 0.65, -1.5); // Pivot point
        this.chassisMesh.add(this.trunkLid);

        // Lid Panel
        const lidGeo = new THREE.BoxGeometry(1.5, 0.1, 1.0);
        const lid = new THREE.Mesh(lidGeo, paintMat);
        lid.position.set(0, 0, -0.5); // Offset from pivot
        this.trunkLid.add(lid);

        // Wing attached to Lid
        const wingBoard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.6), blackMat);
        wingBoard.position.set(0, 0.5, -0.6); // relative to lid pivot

        const strutGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
        const sL = new THREE.Mesh(strutGeo, blackMat);
        sL.position.set(0.5, 0.2, -0.5);
        const sR = new THREE.Mesh(strutGeo, blackMat);
        sR.position.set(-0.5, 0.2, -0.5);

        this.trunkLid.add(wingBoard);
        this.trunkLid.add(sL);
        this.trunkLid.add(sR);

        // --- 7. Lights ---
        // Headlights (Aggressive Slits)
        const hlGeo = new THREE.BoxGeometry(0.3, 0.05, 0.1);
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const hlL = new THREE.Mesh(hlGeo, hlMat);
        hlL.position.set(0.5, 0.45, 2.3);
        hlL.rotation.y = -0.3; // Angle back
        this.chassisMesh.add(hlL);

        const hlR = new THREE.Mesh(hlGeo, hlMat);
        hlR.position.set(-0.5, 0.45, 2.3);
        hlR.rotation.y = 0.3;
        this.chassisMesh.add(hlR);

        // Tail Lights (Neon Bar)
        const tailGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, 0.5, -2.25);
        this.chassisMesh.add(tail);

        // --- 8. Exhausts ---
        const exGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.4);
        exGeo.rotateX(Math.PI / 2);
        const exMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });

        const ex1 = new THREE.Mesh(exGeo, exMat);
        ex1.position.set(0.2, 0.2, -2.3);
        this.chassisMesh.add(ex1);

        const ex2 = new THREE.Mesh(exGeo, exMat);
        ex2.position.set(-0.2, 0.2, -2.3);
        this.chassisMesh.add(ex2);
    }

    update(dt) {
        if (!this.vehicle || !this.chassisBody) return;

        // Speed Limiter
        // Prevent physics instability by clamping max speed
        const v = this.chassisBody.velocity;
        const speed = v.length();
        let maxSpeed = 100; // Approx 360 km/h for Forward

        // Check if reversing (localVel > 5.0 from update loop, but we need to re-calc or assume)
        // Let's re-calculate localVel here for safety or use the 'v' directly.
        // Actually, just calculating it here is cleaner.
        const carForward = new CANNON.Vec3(0, 0, 1);
        this.chassisBody.quaternion.vmult(carForward, carForward);
        const localVelCheck = carForward.dot(v);

        if (localVelCheck > 1.0) { // Moving Backward
            maxSpeed = 30; // Cap Reverse at ~100 km/h
        }

        if (speed > maxSpeed) {
            v.normalize();
            v.scale(maxSpeed, v);
            this.chassisBody.velocity.copy(v);
        }

        // Dynamic Downforce (Aerodynamics)
        // Increases with speed to keep car planted
        const downforce = 100 + (speed * 100); // Base 100 + Speed factor
        this.chassisBody.applyForce(new CANNON.Vec3(0, -downforce, 0), this.chassisBody.position);

        // Anti-Roll / Stabilizer Bar
        // If the car tilts, push it back upright.
        const up = new CANNON.Vec3(0, 1, 0);
        const carUp = new CANNON.Vec3(0, 1, 0);
        this.chassisBody.quaternion.vmult(carUp, carUp);

        // Calculate tilt
        // Cross product of carUp and WorldUp gives axis of rotation to fix it
        const correctionAxis = new CANNON.Vec3();
        carUp.cross(up, correctionAxis);

        // Apply torque proportional to tilt
        // Only if tilt is significant but not 180 (upside down)
        // .scale(200) is the strength of the stabilizer
        correctionAxis.scale(500, correctionAxis);
        this.chassisBody.torque.x += correctionAxis.x;
        this.chassisBody.torque.z += correctionAxis.z;
        // Don't effect Y (yaw)

        // Respawn if fell
        if (this.chassisBody.position.y < -5) {
            this.chassisBody.position.set(0, 2, -10);
            this.chassisBody.velocity.set(0, 0, 0);
            this.chassisBody.angularVelocity.set(0, 0, 0);
            // Reset rotation to face -Z (180 deg around Y)
            const q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            this.chassisBody.quaternion.copy(q);
        }

        // === CONTROLS ===
        const maxSteer = 0.7; // Increased to 0.7 (approx 40 deg) for arcade response
        const maxForce = 6000; // Increased Power (was 3000)
        const brakeForce = 150; // Stronger Brakes

        // Get local forward velocity
        // We need to know if we are moving forward or backward relative to the car's facing
        const forwardNormal = new CANNON.Vec3(0, 0, 1); // Z is forward? No, Z+ is Backward in our model (180 deg rot)

        // Use current velocity
        const velocity = this.chassisBody.velocity;

        // Re-calculate projection (safe to reuse vector if needed, but here we just re-calc)
        // carForward is already defined above? No, it's block scoped if I didn't scope it!
        // Wait, line 304 'const carForward' is in update() scope.
        // So line 365 'const carForward' throws error.
        // FIX: Just reuse it or reset it.
        const carForwardControl = new CANNON.Vec3(0, 0, 1); // Rename to avoid collision
        this.chassisBody.quaternion.vmult(carForwardControl, carForwardControl);
        const localVel = carForwardControl.dot(velocity);
        // Wait, car faces -Z. So Forward is -Z. 
        // If carForward (Z+) dot v is positive, we are moving BACKWARD. 
        // If negative, we are moving FORWARD.

        const isMovingForward = localVel < -5.0; // Moving Forward > 5 m/s (~18 km/h)
        const isMovingBackward = localVel > 5.0; // Moving Backward > 5 m/s (~18 km/h)

        let engineForce = 0;
        let actualBrake = 0;

        // W / Up
        if (this.inputManager.keys.forward) {
            engineForce = -maxForce;
        }
        // S / Down
        else if (this.inputManager.keys.backward) {
            if (isMovingForward) {
                // Smart Brake
                actualBrake = brakeForce;
            } else {
                // Reverse
                // Reduce power in reverse to prevent "Wheelie" / Flipping
                engineForce = maxForce * 0.5; // Positive Z is Backward
            }
        }

        if (this.inputManager.keys.nitro) {
            engineForce -= maxForce * 5; // Nitro adds kick
        }

        let steering = 0;

        // Analog Input (Steering Wheel)
        if (this.inputManager.steeringValue) {
            steering = -this.inputManager.steeringValue * maxSteer;
        }
        // Keyboard (Digital) fallback/override
        else {
            if (this.inputManager.keys.left) steering = maxSteer;
            if (this.inputManager.keys.right) steering = -maxSteer;
        }

        // Limit Steering while Reversing to prevent "Death Spin" / Sinking
        if (isMovingBackward) {
            steering *= 0.5; // Reduce steering angle by 50% in reverse
        }

        // Front wheel steering (indices 0, 1)
        this.vehicle.setSteeringValue(steering, 0);
        this.vehicle.setSteeringValue(steering, 1);

        // RWD (Rear-Wheel Drive) - Max Control
        // Front wheels (0, 1): 0 Force (Steering Only)
        // Rear wheels (2, 3): 100% Force (Propulsion)
        this.vehicle.applyEngineForce(0, 0);
        this.vehicle.applyEngineForce(0, 1);
        this.vehicle.applyEngineForce(engineForce, 2);
        this.vehicle.applyEngineForce(engineForce, 3);

        // Explicit Handbrake override
        if (this.inputManager.keys.brake) { // Spacebar
            actualBrake = brakeForce * 2;
        }

        // Apply Brakes
        for (let i = 0; i < 4; i++) {
            this.vehicle.setBrake(actualBrake, i);
        }

        // === SYNC VISUALS ===
        this.chassisMesh.position.copy(this.chassisBody.position);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }
    }

    syncVisualsOnly() {
        if (!this.vehicle || !this.chassisBody) return;

        // Apply friction braking naturally? 
        // Or just let it roll.
        // It will roll based on physics world step.

        // === SYNC VISUALS ===
        this.chassisMesh.position.copy(this.chassisBody.position);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }
    }

    getSpeed() {
        return this.chassisBody ? this.chassisBody.velocity.length() * 3.6 : 0;
    }

    toggleTrunk() {
        if (!this.trunkLid) return;

        this.isTrunkOpen = !this.isTrunkOpen;

        if (this.isTrunkOpen) {
            this.trunkLid.rotation.x = -1.2; // Open 70 degrees
        } else {
            this.trunkLid.rotation.x = 0;
        }
    }
}
