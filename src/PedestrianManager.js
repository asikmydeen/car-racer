import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PedestrianManager {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.pedestrians = [];
        this.walkSpeed = 2;
    }

    spawnPedestrians() {
        // Spawn 30 random people scattered across the city
        // Grid is approx 10x10 blocks, so ~0.3 people per block ( Sparse )
        for (let i = 0; i < 30; i++) {
            this.createPedestrian();
        }

        // Spawn 10 people near the start point (0,0) so the player sees them immediately
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 10 + Math.random() * 40; // 10 to 50 units away
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.createPedestrian(x, z);
        }
    }

    createPedestrian(spawnX, spawnZ) {
        const group = new THREE.Group();

        // Body (Steve)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.8, 0.3);
        const bodyMat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0; // Local
        group.add(bodyMesh);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.6;
        group.add(head);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(0.15, -0.6, 0);
        group.add(legL);
        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(-0.15, -0.6, 0);
        group.add(legR);

        // Start Pos
        let x, z;
        if (spawnX !== undefined && spawnZ !== undefined) {
            x = spawnX;
            z = spawnZ;
        } else {
            const blockSize = 200;
            x = (Math.random() - 0.5) * 10 * blockSize;
            z = (Math.random() - 0.5) * 10 * blockSize;
        }

        group.position.set(x, 1, z);
        this.scene.add(group);

        // PHYSICS BODY
        const shape = new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.3));
        const body = new CANNON.Body({ mass: 50 }); // Heavy enough to get hit
        body.addShape(shape);
        body.position.set(x, 1, z);
        body.fixedRotation = true; // Stay upright initially
        body.updateMassProperties();
        this.physicsWorld.addBody(body);

        // State
        const p = {
            mesh: group,
            body: body,
            vx: (Math.random() - 0.5) * this.walkSpeed,
            vz: (Math.random() - 0.5) * this.walkSpeed,
            legL: legL,
            legR: legR,
            animTime: Math.random() * 10,
            isRagdoll: false,
            timer: 0
        };

        this.pedestrians.push(p);
    }

    update(dt, playerPos) {
        const cullDistSq = 150 * 150; // Active radius
        const playerX = playerPos.x;
        const playerZ = playerPos.z;

        this.pedestrians.forEach(p => {
            // Distance Check
            const dx = p.body.position.x - playerX;
            const dz = p.body.position.z - playerZ;
            const distSq = dx * dx + dz * dz;

            if (distSq > cullDistSq) {
                // Far: CULL
                if (p.mesh.visible) {
                    p.mesh.visible = false;
                    // Aggressive Optimization: Remove from physics world entirely
                    this.physicsWorld.removeBody(p.body);
                }
                return; // Skip Update
            }

            // Near: ACTIVE
            if (!p.mesh.visible) {
                p.mesh.visible = true;
                // re-add to physics world
                this.physicsWorld.addBody(p.body);
                p.body.wakeUp();
            }

            if (p.isRagdoll) {
                // Sync Mesh to Ragdoll Body
                p.mesh.position.copy(p.body.position);
                p.mesh.quaternion.copy(p.body.quaternion);
                return;
            }

            // --- Walking Logic ---
            // Move Body
            p.body.position.x += p.vx * dt;
            p.body.position.z += p.vz * dt;

            // Sync Mesh
            p.mesh.position.copy(p.body.position);
            // Height adjust (bobbing)
            p.mesh.position.y -= 0.1;

            // Rotation (Face direction)
            p.mesh.lookAt(p.mesh.position.x + p.vx, p.mesh.position.y, p.mesh.position.z + p.vz);

            // Hit Detection (If velocity spikes, trigger ragdoll)
            const speed = p.body.velocity.length();
            if (speed > 5) {
                // HIT!
                p.isRagdoll = true;
                p.body.fixedRotation = false; // Allow tumble
                p.body.updateMassProperties();
                // Add spin
                p.body.angularVelocity.set(
                    Math.random() * 10,
                    Math.random() * 10,
                    Math.random() * 10
                );
                // Launch up
                p.body.velocity.y += 10;
            }

            // Walk Anim
            p.animTime += dt * 5;
            p.legL.rotation.x = Math.sin(p.animTime) * 0.5;
            p.legR.rotation.x = Math.sin(p.animTime + Math.PI) * 0.5;

            // Bounds Check (Wander back)
            if (Math.random() < 0.01) {
                p.vx = -p.vx;
                p.vz = -p.vz;
            }
        });
    }
}
