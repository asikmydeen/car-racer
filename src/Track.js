import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Track {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.startPoint = new THREE.Vector3(0, 2, 0);
        this.endPoint = new THREE.Vector3(0, 0, 0);
        this.coinManager = null;
    }

    setCoinManager(cm) {
        this.coinManager = cm;
    }

    setInteractionManager(im) {
        this.interactionManager = im;
    }

    generate() {
        // 1. Physics Ground
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            material: this.physicsWorld.groundMaterial,
            collisionFilterGroup: 1, // Explicitly Group 1
            collisionFilterMask: -1 // Collide with everything
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.physicsWorld.addBody(groundBody);

        // 2. Visual Ground
        const cityGroundGeo = new THREE.PlaneGeometry(5000, 5000);
        const cityGroundMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.9,
            metalness: 0.1
        });
        const cityGroundMesh = new THREE.Mesh(cityGroundGeo, cityGroundMat);
        cityGroundMesh.rotation.x = -Math.PI / 2;
        cityGroundMesh.position.y = -0.1;
        cityGroundMesh.receiveShadow = true;
        this.scene.add(cityGroundMesh);

        // 3. Grid Generation
        // Grid properties
        const gridSize = 10; // 10x10 intersections
        const blockSize = 200; // Distance between intersections
        const roadWidth = 20;

        // Calculate offset to center the grid around (0,0)
        const offset = (gridSize - 1) * blockSize / 2;

        this.startPoint.set(0, 2, -10); // Start in middle of segment
        this.endPoint.set(blockSize * 2, 0, 0); // Arbitrary goal

        for (let x = 0; x < gridSize; x++) {
            for (let z = 0; z < gridSize; z++) {
                const px = x * blockSize - offset;
                const pz = z * blockSize - offset;

                // Create Intersection at this node
                this.createIntersection(px, pz, roadWidth);

                // Create Road to the Right (East) if not last column
                if (x < gridSize - 1) {
                    this.createRoadSegment(
                        px + roadWidth / 2, pz,
                        px + blockSize - roadWidth / 2, pz,
                        roadWidth
                    );
                }

                // Create Road to the Bottom (South) if not last row
                if (z < gridSize - 1) {
                    this.createRoadSegment(
                        px, pz + roadWidth / 2,
                        px, pz + blockSize - roadWidth / 2,
                        roadWidth
                    );
                }

                // Fill the block to the bottom-right with content (buildings)
                if (x < gridSize - 1 && z < gridSize - 1) {
                    // Center of the block
                    const blockCx = px + blockSize / 2;
                    const blockCz = pz + blockSize / 2;
                    this.populateBlock(blockCx, blockCz, blockSize - roadWidth, roadWidth);
                }
            }
        }

        // Add Outer Barriers
        this.createOuterBarriers(gridSize, blockSize, roadWidth, offset);
    }

    createIntersection(x, z, width) {
        const geo = new THREE.PlaneGeometry(width, width);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }); // Darker for intersection
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.01, z);
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
    }

    createRoadSegment(x1, z1, x2, z2, width) {
        // Calculate length and center
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.sqrt(dx * dx + dz * dz);
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        const angle = Math.atan2(dz, dx); // Angle in X-Z plane

        const geo = new THREE.PlaneGeometry(length, width);
        const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.set(cx, 0.01, cz);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -angle; // Standard plane is XY, rotated X-90 is XZ. Rotate Z to align.
        this.scene.add(mesh);

        // Add lane markings?
        // Keep simple for now.

        // Chance to spawn coins on road
        if (this.coinManager && Math.random() > 0.5) {
            const numCoins = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numCoins; i++) {
                // Lerp between start and end
                const t = (i + 1) / (numCoins + 1);
                const mx = x1 + (x2 - x1) * t;
                const mz = z1 + (z2 - z1) * t;
                this.coinManager.spawnCoin(mx, mz);
            }
        }
    }

    populateBlock(cx, cz, size, roadWidth) {
        // Decide Block Type (Zoning)
        const rand = Math.random();

        if (rand < 0.1) {
            // 10% Stunt Park (New!)
            // this.addStuntPark(cx, cz, size);
        } else if (rand < 0.5) {
            // 40% Downtown (Skyscrapers)
            const numBuildings = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numBuildings; i++) {
                const margin = 20;
                const safeSize = size - margin * 2;
                const bx = cx - safeSize / 2 + Math.random() * safeSize;
                const bz = cz - safeSize / 2 + Math.random() * safeSize;
                this.addTetrisBuilding(bx, bz);
            }
        } else {
            // 50% Residential / Shops
            const houseSize = 20;
            const gap = 10;
            const startX = cx - size / 2 + houseSize;
            const startZ = cz - size / 2 + houseSize;

            for (let x = startX; x < cx + size / 2 - houseSize; x += houseSize + gap) {
                for (let z = startZ; z < cz + size / 2 - houseSize; z += houseSize + gap) {
                    if (Math.random() > 0.3) {
                        // 20% Chance of Shop
                        if (Math.random() < 0.2) {
                            this.addStore(x, z);
                        } else {
                            this.addTownhouse(x, z);
                        }
                    }
                }
            }
        }

        // Add billboard occasionally
        if (Math.random() > 0.8) {
            const bx = cx - size / 4 + Math.random() * size / 2;
            const bz = cz - size / 4 + Math.random() * size / 2;
            this.addBillboard(bx, bz, Math.random() * Math.PI);
        }
    }

    addTetrisBuilding(x, z) {
        const stackHeight = 3 + Math.floor(Math.random() * 5);
        let currentY = 0;
        let currentWidth = 15 + Math.random() * 15;
        let currentDepth = 15 + Math.random() * 15;

        const hue = Math.random();
        const buildingMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, 0.6, 0.5),
            roughness: 0.1,
            metalness: 0.8,
            emissive: new THREE.Color().setHSL(hue, 0.8, 0.2),
            emissiveIntensity: 0.4
        });

        const root = new THREE.Group();
        root.position.set(x, 0, z);

        for (let i = 0; i < stackHeight; i++) {
            const h = 5 + Math.random() * 5;

            const geo = new THREE.BoxGeometry(currentWidth, h, currentDepth);
            const mesh = new THREE.Mesh(geo, buildingMat);
            mesh.position.y = currentY + h / 2;
            mesh.castShadow = true;
            root.add(mesh);

            // Nuclear Optimization: ONLY add physics for the FIRST floor (Base).
            // Upper floors are visual-only. This prevents "invisible walls" at top 
            // and cuts physics bodies by ~80% per building.
            if (i === 0) {
                const shape = new CANNON.Box(new CANNON.Vec3(currentWidth / 2, h / 2, currentDepth / 2));
                const body = new CANNON.Body({
                    mass: 0,
                    collisionFilterGroup: 1,
                    collisionFilterMask: -1
                });
                body.addShape(shape);
                body.position.set(x, currentY + h / 2, z);
                this.physicsWorld.addBody(body);
            }

            currentY += h;
            currentWidth *= 0.8;
            currentDepth *= 0.8;
        }

        this.scene.add(root);
    }

    addStore(x, z) {
        const root = new THREE.Group();
        root.position.set(x, 0, z);

        const width = 14;
        const depth = 12;
        const height = 10;

        const bodyGeo = new THREE.BoxGeometry(width, height, depth);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = height / 2;
        body.castShadow = true;
        root.add(body);

        // Physics
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const physicsBody = new CANNON.Body({ mass: 0 });
        physicsBody.addShape(shape);
        physicsBody.position.set(x, height / 2, z);
        this.physicsWorld.addBody(physicsBody);

        // Sign
        const shopNames = ["GROCERY", "MARKET", "PIZZA", "BURGER", "GYM", "PHARMACY", "CAFE"];
        const name = shopNames[Math.floor(Math.random() * shopNames.length)];
        this.createSign(body, name, width * 0.9, 3, height / 2 - 2, 0.6);

        // Interaction Trigger
        if (this.interactionManager) {
            const triggerPos = new THREE.Vector3(x, 0, z + depth / 2 + 4); // Front of store
            this.interactionManager.addInteractable(triggerPos, 4.0, `Buy ${name} ($10)`, () => {
                console.log(`Buying from ${name}`);
                window.dispatchEvent(new CustomEvent('buyItem', { detail: { cost: 10, name: name } }));
            });
        }

        this.scene.add(root);
    }

    addTownhouse(x, z) {
        const root = new THREE.Group();
        root.position.set(x, 0, z);

        const width = 12;
        const depth = 12;
        const height = 8;

        const bodyGeo = new THREE.BoxGeometry(width, height, depth);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xddccaa });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = height / 2;
        body.castShadow = true;
        root.add(body);

        // Physics
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const physicsBody = new CANNON.Body({ mass: 0 });
        physicsBody.addShape(shape);
        physicsBody.position.set(x, height / 2, z);
        this.physicsWorld.addBody(physicsBody);

        const roofHeight = 4;
        const roofGeo = new THREE.ConeGeometry(width * 0.8, roofHeight, 4, 1, false, Math.PI / 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x883333 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = height + roofHeight / 2;
        root.add(roof);

        const yardGeo = new THREE.PlaneGeometry(width * 1.5, depth * 2);
        const yardMat = new THREE.MeshStandardMaterial({ color: 0x228822 });
        const yard = new THREE.Mesh(yardGeo, yardMat);
        yard.rotation.x = -Math.PI / 2;
        yard.position.set(0, 0.02, -depth / 2);
        yard.receiveShadow = true;
        root.add(yard);

        this.scene.add(root);
    }

    addStuntPark(cx, cz, size) {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(size - 10, size - 10);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(cx, 0.06, cz);
        this.scene.add(floor);

        // Twirl Ramp Visuals (Tube)
        const pathPoints = [];
        const segments = 20;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = t * Math.PI * 2; // Full circle twist
            const x = Math.cos(angle) * 20;
            const y = i * 4; // Height
            const z = Math.sin(angle) * 20;
            pathPoints.push(new THREE.Vector3(x, y, z));
        }
        const twirlCurve = new THREE.CatmullRomCurve3(pathPoints);

        const tubeGeo = new THREE.TubeGeometry(twirlCurve, 64, 5, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, side: THREE.DoubleSide, wireframe: false });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.position.set(cx, 0, cz);
        this.scene.add(tubeMesh);

        // Physics: Chain of Boxes approximation
        // Iterate through curve to place boxes
        const physicsSteps = 20;
        const pts = twirlCurve.getPoints(physicsSteps);

        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i];
            const p2 = pts[i + 1];

            // Midpoint
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const mz = (p1.z + p2.z) / 2;

            // Vector p1->p2
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dz = p2.z - p1.z;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Orientation
            // Create quaternion looking from p1 to p2
            // Cannon body local Z axis is usually "forward"? Box is aligned how?
            // Box(width, height, depth). Let's say Depth is road length.
            // Width is road width (10). Height is thickness (1).

            const shape = new CANNON.Box(new CANNON.Vec3(5, 0.5, len / 2));
            const body = new CANNON.Body({ mass: 0 });
            body.addShape(shape);
            body.position.set(cx + mx, my, cz + mz);

            // Align rotation to path
            // We want body Z axis to point along (dx, dy, dz)
            const targetDir = new CANNON.Vec3(dx, dy, dz);
            targetDir.normalize();

            // Default Z is (0,0,1). We need rotation from (0,0,1) to targetDir.
            const startDir = new CANNON.Vec3(0, 0, 1);
            const q = new CANNON.Quaternion();
            q.setFromVectors(startDir, targetDir);
            body.quaternion.copy(q);

            this.physicsWorld.addBody(body);
        }

        // Sign
        const sign = createTextTexture("STUNT PARK");
        const board = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 10),
            new THREE.MeshBasicMaterial({ map: sign, transparent: true })
        );
        board.position.set(cx, 20, cz);
        board.lookAt(cx + 100, 20, cz + 100);
        this.scene.add(board);
    }

    addBillboard(x, z, rotationY) {
        const height = 20;
        const width = 30;
        const poleHeight = 15;
        const poleRadius = 1;

        // Pole
        const poleGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const poleMesh = new THREE.Mesh(poleGeo, poleMat);
        poleMesh.position.set(x, poleHeight / 2, z);
        this.scene.add(poleMesh);

        // Billboard body
        const billboardGeo = new THREE.BoxGeometry(width, height, 1);
        const billboardMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const billboardMesh = new THREE.Mesh(billboardGeo, billboardMat);
        billboardMesh.position.set(x, poleHeight + height / 2, z);
        billboardMesh.rotation.y = rotationY;
        this.scene.add(billboardMesh);

        // Physics for billboard (simple box)
        const billboardShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, 0.5));
        const billboardBody = new CANNON.Body({ mass: 0 });
        billboardBody.addShape(billboardShape);
        billboardBody.position.set(x, poleHeight + height / 2, z);
        billboardBody.quaternion.setFromEuler(0, rotationY, 0);
        this.physicsWorld.addBody(billboardBody);

        // Add text texture
        const texture = createTextTexture("AD SPACE");
        const planeGeo = new THREE.PlaneGeometry(width * 0.9, height * 0.8);
        const planeMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        planeMesh.position.set(x, poleHeight + height / 2, z + 0.51); // Slightly in front
        planeMesh.rotation.y = rotationY;
        this.scene.add(planeMesh);
    }

    createSign(parentMesh, text, w, h, yOffset, zProtrusion) {
        const texture = createTextTexture(text);
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0xffffff,
            emissiveIntensity: 0.5
        });
        // Scale UVs to fit? Canvas is 2:1. Box is w:h.

        const geo = new THREE.BoxGeometry(w, h, 0.5);
        const sign = new THREE.Mesh(geo, mat);

        // Attach to parent front face (assuming Z+)
        // Get parent Z bound
        // Simplified: Just use 0 offset Z-wise if parent is box at 0
        // Parent origin is center. Front face is +Depth/2.

        // This helper is called inside addTetris where we don't easily know depth.
        // We'll trust visual check or just offset by a constant if generic.
        // Actually, for Tetris, blocks are random depth.
        // Or stick to the side.

        // Let's attach to Z+.
        // Parent is Mesh.
        if (parentMesh.geometry.parameters) {
            const d = parentMesh.geometry.parameters.depth;
            sign.position.set(0, yOffset || 0, d / 2 + (zProtrusion || 0.25));
        } else {
            sign.position.set(0, yOffset || 0, 5 + (zProtrusion || 0.25));
        }

        parentMesh.add(sign);
    }

    createOuterBarriers(gridSize, blockSize, roadWidth, offset) {
        // Calculate bounds
        const minX = -offset - roadWidth / 2;
        const maxX = (gridSize - 1) * blockSize - offset + roadWidth / 2;
        const minZ = -offset - roadWidth / 2;
        const maxZ = (gridSize - 1) * blockSize - offset + roadWidth / 2;

        const totalWidth = maxX - minX;
        const totalHeight = maxZ - minZ;

        // North (Min Z)
        // Fixed: Removed call to undefined addBarrier

        // North Wall
        this.addBarrierDirect((minX + maxX) / 2, minZ, totalWidth, 0);
        // South Wall
        this.addBarrierDirect((minX + maxX) / 2, maxZ, totalWidth, 0);
        // West Wall
        this.addBarrierDirect(minX, (minZ + maxZ) / 2, 0, totalHeight);
        // East Wall
        this.addBarrierDirect(maxX, (minZ + maxZ) / 2, 0, totalHeight);
    }

    addBarrierDirect(x, z, w, d) {
        // If w > 0, horizontal wall. If d > 0, vertical wall.
        const length = w > 0 ? w : d;
        const isHorizontal = w > 0;

        const height = 5;
        const thickness = 2;

        // Physics
        const shape = new CANNON.Box(new CANNON.Vec3(
            isHorizontal ? length / 2 : thickness / 2,
            height / 2,
            isHorizontal ? thickness / 2 : length / 2
        ));
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(x, height / 2, z);
        this.physicsWorld.addBody(body);

        // Visual
        const geo = new THREE.BoxGeometry(
            isHorizontal ? length : thickness,
            3,
            isHorizontal ? thickness : length
        );
        // Neon boundary
        const mat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(body.position);
        this.scene.add(mesh);
    }


}

// Helper
function createTextTexture(text) {
    const canvas = document.createElement('canvas');
    const width = 512;
    const height = 256;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const hue = Math.floor(Math.random() * 360);
    ctx.fillStyle = `hsl(${hue}, 80%, 30%)`;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 10;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}
