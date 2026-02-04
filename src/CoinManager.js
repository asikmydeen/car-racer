import * as THREE from 'three';

export class CoinManager {
    constructor(scene) {
        this.scene = scene;
        this.coins = [];

        // Shared Geometry/Material for performance
        this.coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12);
        this.coinGeo.rotateZ(Math.PI / 2); // Make it face up like a wheel? No, usually spinning upright.
        // Cylinder default is Y-up. Rotate X 90?
        // Let's just rotate the mesh in update.

        this.coinMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffaa00,
            emissiveIntensity: 0.5,
            metalness: 1.0,
            roughness: 0.3
        });
    }

    spawnCoin(x, z) {
        const mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
        mesh.position.set(x, 1, z);
        mesh.castShadow = true;

        this.scene.add(mesh);

        this.coins.push({
            mesh: mesh,
            active: true
        });
    }

    update(dt, playerBodies) {
        // playerBodies is array of [carBody, playerControllerBody] (whichever is active or both)

        const collectDistSq = 2.0 * 2.0;
        const spinSpeed = 3;

        this.coins.forEach(coin => {
            if (!coin.active) return;

            // Spin
            coin.mesh.rotation.y += spinSpeed * dt;

            // Collision Check
            for (const body of playerBodies) {
                if (!body) continue;

                const dx = body.position.x - coin.mesh.position.x;
                const dz = body.position.z - coin.mesh.position.z;

                if (dx * dx + dz * dz < collectDistSq) {
                    this.collectCoin(coin);
                    return; // Collected
                }
            }
        });
    }

    collectCoin(coin) {
        coin.active = false;
        coin.mesh.visible = false;
        // Could remove from scene or pool it.
        // For simple game, just hide.

        // Notify Game? Or return value?
        // Better to have Game check event or callback. 
        // We'll dispatch a custom event on window? Or just return count.

        window.dispatchEvent(new CustomEvent('coinCollected', { detail: { amount: 1 } }));
    }
}
