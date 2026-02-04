import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PlayerController {
    constructor(scene, physicsWorld, camera, inputManager) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.camera = camera;
        this.inputManager = inputManager;

        this.body = null;
        this.pitchObject = new THREE.Object3D(); // For looking up/down
        this.yawObject = new THREE.Object3D(); // For looking left/right

        this.yawObject.add(this.pitchObject);
        // Note: Camera will be attached to pitchObject when active

        this.isActive = false;

        // Physics constants
        this.moveSpeed = 8;
        this.jumpForce = 8;
        this.height = 1.8;
        this.radius = 0.4;

        // Input state
        this.enabled = false;

        this.initPhysics();
        this.initMouseLook();
    }

    initPhysics() {
        const shape = new CANNON.Sphere(this.radius); // Use sphere for smooth walking
        this.body = new CANNON.Body({
            mass: 70, // Kg
            fixedRotation: true, // Prevent tipping over
            position: new CANNON.Vec3(0, 10, 0),
            material: new CANNON.Material('player')
        });

        this.body.addShape(shape, new CANNON.Vec3(0, this.radius, 0)); // Bottom of sphere at 0 local
        // Damping
        this.body.linearDamping = 0.9;

        // We will add/remove body from world when toggling
    }

    initMouseLook() {
        // Document-level listener for pointer lock
        document.addEventListener('mousemove', (event) => {
            if (!this.enabled) return;

            const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

            this.yawObject.rotation.y -= movementX * 0.002;
            this.pitchObject.rotation.x -= movementY * 0.002;

            // Clamp pitch
            this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        });

        // Click to capture
        document.body.addEventListener('click', () => {
            if (this.isActive) {
                document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.enabled = (document.pointerLockElement === document.body);
        });
    }

    resetPosition(x, y, z) {
        this.body.position.set(x, y, z);
        this.body.velocity.set(0, 0, 0);
    }

    setActive(active) {
        this.isActive = active;

        if (active) {
            this.physicsWorld.addBody(this.body);
            // Attach camera
            this.pitchObject.add(this.camera);
            this.camera.position.set(0, 0, 0);
            this.camera.rotation.set(0, 0, 0);

            this.scene.add(this.yawObject);

            // Initial pointer lock request might need user gesture, 
            // but we can try if coming from a keypress
            document.body.requestPointerLock();
        } else {
            this.physicsWorld.removeBody(this.body);
            // Detach camera (Game will reclaim it)
            this.pitchObject.remove(this.camera);
            this.scene.remove(this.yawObject);

            document.exitPointerLock();
            this.enabled = false;
        }
    }

    update(dt) {
        if (!this.isActive) return;

        // Sync positions
        // Body pivot is at bottom of feet? No, sphere is offset.
        // Body position is center of mass.
        // Visual (Camera) should be at Body + EyeHeight.

        this.yawObject.position.copy(this.body.position);
        this.yawObject.position.y += this.height - 0.2; // Eye level

        // Input
        if (this.enabled) {
            const inputVector = new CANNON.Vec3(0, 0, 0);
            const moveSpeed = this.moveSpeed;

            if (this.inputManager.keys.forward) inputVector.z -= 1;
            if (this.inputManager.keys.backward) inputVector.z += 1;
            if (this.inputManager.keys.left) inputVector.x -= 1;
            if (this.inputManager.keys.right) inputVector.x += 1;

            if (inputVector.length() > 0) {
                inputVector.normalize();
                inputVector.scale(moveSpeed, inputVector); // Scaled direction
            }

            // Transform inputVector by Yaw
            // We want to move in the direction we are facing (Y axis rotation)
            const rotation = new THREE.Quaternion();
            rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yawObject.rotation.y);

            const direction = new THREE.Vector3(inputVector.x, 0, inputVector.z);
            direction.applyQuaternion(rotation);

            // Apply velocity directly (arcade style)
            this.body.velocity.x = direction.x;
            this.body.velocity.z = direction.z;
        }

        // Jump (Space is Brake in car, but maybe Jump here?)
        // Let's reuse Brake key for Jump if needed, currently not mapped separate.
        // InputManager maps Space to 'brake'.
        if (this.enabled && this.inputManager.keys.brake) {
            // Check ground? Simplified:
            // if (Math.abs(this.body.velocity.y) < 0.1) this.body.velocity.y = 5;
        }
    }

    getPosition() {
        return this.body.position;
    }
}
