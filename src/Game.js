import * as THREE from 'three';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Car } from './Car.js';
import { Track } from './Track.js';
import { InputManager } from './InputManager.js';
import { PedestrianManager } from './PedestrianManager.js';

import { PlayerController } from './PlayerController.js';
import { CoinManager } from './CoinManager.js';
import { InteractionManager } from './InteractionManager.js';

export class Game {
    constructor() {
        this.container = document.body;
        this.clock = new THREE.Clock();
        this.state = 'MENU'; // MENU, PLAYING (Driving), WALKING, ENDED
        this.selectedColor = 0xff0033; // Default Red
        this.wallet = 0;

        // Setup Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue

        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 1500);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(50, 200, 100);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Systems
        this.physicsWorld = new PhysicsWorld();
        this.inputManager = new InputManager();
        this.track = new Track(this.scene, this.physicsWorld);
        this.car = new Car(this.scene, this.physicsWorld, this.inputManager);
        this.playerController = new PlayerController(this.scene, this.physicsWorld, this.camera, this.inputManager);

        this.pedestrianManager = new PedestrianManager(this.scene, this.physicsWorld);
        this.pedestrianManager.spawnPedestrians();

        this.coinManager = new CoinManager(this.scene);
        this.track.setCoinManager(this.coinManager);

        // Interaction
        this.interactionManager = new InteractionManager(this.scene, document.getElementById('interaction-prompt'));
        this.track.setInteractionManager(this.interactionManager); // Pass to Track
        this.trunkInteractable = this.interactionManager.addInteractable(new THREE.Vector3(), 3.0, 'Open Trunk', () => {
            console.log("Trunk Interact");
            if (this.car) this.car.toggleTrunk();
        });

        // UI
        this.ui = {
            home: document.getElementById('home-screen'),
            game: document.getElementById('game-ui'),
            end: document.getElementById('end-screen'),
            timer: document.getElementById('timer'),
            speedometer: document.getElementById('speedometer'),
            coinCounter: document.getElementById('coin-counter'),
            finalTime: document.getElementById('final-time'),
            nitroBar: document.getElementById('nitro-fill')
        };

        this.lastInteractState = false;

        // Economy Event
        window.addEventListener('coinCollected', (e) => {
            this.wallet += e.detail.amount;
            if (this.ui.coinCounter) {
                this.ui.coinCounter.innerText = `Coins: ${this.wallet}`;
            }
        });

        window.addEventListener('buyItem', (e) => {
            const cost = e.detail.cost;
            const item = e.detail.name;

            if (this.wallet >= cost) {
                this.wallet -= cost;
                if (this.ui.coinCounter) {
                    this.ui.coinCounter.innerText = `Coins: ${this.wallet}`;
                }
                console.log(`Purchased ${item}!`);
                // Optional: Show "Purchased!" floating text or notification
            } else {
                console.log("Not enough money!");
                // Optional: Show "Not enough money" warning
            }
        });

        // Input state
        this.lastToggleState = false;

        // Bind Buttons
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.style.pointerEvents = 'auto'; // Force clickable
            startBtn.style.cursor = 'pointer';
            startBtn.addEventListener('click', () => {
                console.log("Button Clicked");
                this.startGame();
            });
        }
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.style.pointerEvents = 'auto';
            restartBtn.addEventListener('click', () => this.startGame());
        }

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Initialize Track immediately
        this.track.generate();
        const start = this.track.startPoint;
        this.car.init(start.x, start.y, start.z);

        this.updateUI();
        this.animate();
    }

    startGame() {
        this.state = 'PLAYING';
        this.clock.start();
        this.clock.elapsedTime = 0;

        // Reset Car
        if (this.car.chassisBody) {
            const start = this.track.startPoint;
            this.car.chassisBody.position.set(start.x, start.y, start.z);
            this.car.chassisBody.velocity.set(0, 0, 0);
            this.car.chassisBody.angularVelocity.set(0, 0, 0);

            // Face -Z (forward in track generation)
            const q = this.car.chassisBody.quaternion;
            // Cannon Quat setFromAxisAngle
            // If car defaults to +Z, we need 180 deg rotation around Y
            // But let's check Car.js... usually RaycastVehicle aligns +Z index 2.
            // Just rotate 180 to face -Z.
            // Using cannon-es Quaternion
            q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
        }

        // Apply Custom Color
        if (this.car) {
            this.car.buildSportyVisuals(this.selectedColor);
        }

        this.updateUI();
    }

    endGame() {
        if (this.state === 'ENDED') return;
        this.state = 'ENDED';
        if (this.ui.finalTime) this.ui.finalTime.innerText = `Time: ${this.clock.getElapsedTime().toFixed(2)}s`;
        this.updateUI();
    }

    updateUI() {
        if (!this.ui.home) return;

        // Force direct style updates to ensure visibility changes
        this.ui.home.style.display = (this.state === 'MENU') ? 'flex' : 'none';

        // Game UI visible in both PLAYING (Driving) and WALKING
        this.ui.game.style.display = (this.state === 'PLAYING' || this.state === 'WALKING') ? 'flex' : 'none';

        this.ui.end.style.display = (this.state === 'ENDED') ? 'flex' : 'none';
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const dt = Math.min(this.clock.getDelta(), 0.1);

        if (this.state === 'PLAYING' || this.state === 'WALKING') {
            this.physicsWorld.update(dt);

            // --- Input Handling for Mode Switch ---
            if (this.inputManager.keys.toggle && !this.lastToggleState) {
                // F Key Pressed
                if (this.state === 'PLAYING') {
                    // Exit Car
                    this.state = 'WALKING';

                    // Get car pos/rot
                    const carPos = this.car.chassisBody.position;
                    // Place player to the left of car?
                    this.playerController.resetPosition(carPos.x + 2, carPos.y + 1, carPos.z);
                    this.playerController.setActive(true);

                    // InputManager handles keys, but Car updates physics based on them.
                    // We need to ensure Car doesn't receive input when walking?
                    // Car.update checks inputManager.keys directly.
                    // Ideally we clear inputs or tell Car not to update controls.
                    // For now, let's rely on us not calling car.update?
                    // But we MUST call car.update for physics (it might be moving).
                    // We should add a 'controllable' flag to Car.

                    // Hack: Car update takes inputManager. We can pass a dummy or flag.

                } else if (this.state === 'WALKING') {
                    // Enter Car
                    // Check distance
                    const playerPos = this.playerController.getPosition();
                    const carPos = this.car.chassisBody.position;
                    const dist = playerPos.distanceTo(carPos);

                    if (dist < 5) {
                        this.state = 'PLAYING';
                        this.playerController.setActive(false);
                    }
                }
            }
            this.lastToggleState = this.inputManager.keys.toggle;


            // --- Updates ---
            if (this.state === 'PLAYING') {
                this.car.update(dt);
            } else {
                // Still update car physics (engine off?)
                // If we don't call update, physics still runs (added to world)
                // but engine force logic won't run. That's fine (Neutral).
                // Actually we should sync visuals.
                this.car.syncVisualsOnly(); // Need to implement this or just call update with no input
            }

            if (this.state === 'WALKING') {
                this.playerController.update(dt);
            }

            // Pedestrians culling target
            let targetPos;
            if (this.state === 'PLAYING') {
                targetPos = this.car.chassisBody ? this.car.chassisBody.position : new THREE.Vector3();
            } else {
                targetPos = this.playerController.getPosition();
            }
            this.pedestrianManager.update(dt, targetPos);

            // Coins
            this.coinManager.update(dt, [this.car.chassisBody, this.playerController.body]);

            // Interaction
            if (this.state === 'WALKING') {
                // Update Trunk Position
                if (this.car.chassisBody) {
                    const carPos = this.car.chassisBody.position;
                    const carQuat = this.car.chassisBody.quaternion;
                    // Trunk is at back. +Z is back? (based on offset)
                    // In init: chassisLength=2. But car faces -Z (rotated 180).
                    // So back is +Z local? 
                    // Local Forward is -Z. Local Back is +Z.
                    // Global rotation applied.
                    const backOffset = new THREE.Vector3(0, 0, 2.5); // Slightly behind
                    backOffset.applyQuaternion(carQuat);
                    this.trunkInteractable.position.copy(carPos).add(backOffset);
                }

                this.interactionManager.update(this.playerController.getPosition());

                if (this.inputManager.keys.interact && !this.lastInteractState) {
                    this.interactionManager.triggerInteraction();
                }
            } else {
                this.interactionManager.update(new THREE.Vector3(99999, 99999, 99999)); // Hide UI
            }
            this.lastInteractState = this.inputManager.keys.interact;


            // --- UI ---
            if (this.ui.timer) this.ui.timer.innerText = this.clock.getElapsedTime().toFixed(1);
            if (this.ui.speedometer) {
                const speed = (this.state === 'PLAYING') ? this.car.getSpeed() : 0;
                this.ui.speedometer.innerText = Math.floor(speed) + ' KM/H';
            }

            // --- Camera ---
            if (this.state === 'PLAYING' && this.car.chassisBody) {
                // Chase Camera
                const pos = this.car.chassisBody.position;
                const quat = this.car.chassisBody.quaternion;
                const threeQuat = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);

                const offset = new THREE.Vector3(0, 5, -8);
                offset.applyQuaternion(threeQuat);
                const target = new THREE.Vector3().copy(pos).add(offset);

                this.camera.position.lerp(target, 0.1);
                this.camera.lookAt(pos.x, pos.y + 1, pos.z);
            }
            // If WALKING, PlayerController handles Camera.

            // Win check (Only in car for now?)
            if (this.state === 'PLAYING' && targetPos.distanceTo(this.track.endPoint) < 30) this.endGame();
        }
        else if (this.state === 'MENU') {
            // Idle spin
            const t = Date.now() * 0.0005;
            this.camera.position.set(30 * Math.sin(t), 20, 30 * Math.cos(t));
            this.camera.lookAt(0, 0, 0);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
