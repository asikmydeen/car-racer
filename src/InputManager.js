export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false,
            nitro: false,
            toggle: false, // F: Enter/Exit Car
            interact: false // E: Interact/Buy
        };

        this.steeringValue = 0; // -1 to 1

        this.initKeyboard();
        this.initTouch();
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'KeyW': this.keys.forward = true; break;
                case 'KeyS': this.keys.backward = true; break; // S is Brake/Reverse
                case 'KeyA': this.keys.left = true; break;
                case 'KeyD': this.keys.right = true; break;
                case 'Space': this.keys.brake = true; break;
                case 'ShiftLeft': this.keys.nitro = true; break;
                case 'KeyF': this.keys.toggle = true; break;
                case 'KeyE': this.keys.interact = true; break;
                case 'ArrowUp': this.keys.forward = true; break;
                case 'ArrowDown': this.keys.backward = true; break;
                case 'ArrowLeft': this.keys.left = true; break;
                case 'ArrowRight': this.keys.right = true; break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': this.keys.forward = false; break;
                case 'KeyS': this.keys.backward = false; break;
                case 'KeyA': this.keys.left = false; break;
                case 'KeyD': this.keys.right = false; break;
                case 'Space': this.keys.brake = false; break;
                case 'ShiftLeft': this.keys.nitro = false; break;
                case 'KeyF': this.keys.toggle = false; break;
                case 'KeyE': this.keys.interact = false; break;
                case 'ArrowUp': this.keys.forward = false; break;
                case 'ArrowDown': this.keys.backward = false; break;
                case 'ArrowLeft': this.keys.left = false; break;
                case 'ArrowRight': this.keys.right = false; break;
            }
        });
    }

    initTouch() {
        // Wait for DOM
        setTimeout(() => {
            this.setupSteeringWheel();
            this.setupPedals();
        }, 100);
    }

    setupSteeringWheel() {
        const wheel = document.getElementById('steering-wheel');
        const container = document.getElementById('steering-container');
        if (!wheel || !container) return;

        let startX = 0;
        let isDragging = false;
        let currentAngle = 0;

        const handleStart = (e) => {
            if (e.target.closest('#steering-container')) {
                isDragging = true;
                startX = e.touches ? e.touches[0].clientX : e.clientX;
                e.preventDefault();
            }
        };

        const handleMove = (e) => {
            if (!isDragging) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const deltaX = x - startX;

            // Map pixel drag to rotation angle (max 90 degrees)
            // Sensitivity: 150px width.
            currentAngle = Math.max(-90, Math.min(90, deltaX * 1.5));

            // Visual Rotation
            wheel.style.transform = `rotate(${currentAngle}deg)`;

            // Logic Output (-1 to 1)
            this.steeringValue = currentAngle / 90;

            // Optional: Set keys for compatibility if Car.js ignores steeringValue
            // But we will update Car.js
        };

        const handleEnd = () => {
            isDragging = false;
            currentAngle = 0;
            this.steeringValue = 0;
            wheel.style.transform = `rotate(0deg)`;
        };

        container.addEventListener('touchstart', handleStart, { passive: false });
        container.addEventListener('touchmove', handleMove, { passive: false });
        container.addEventListener('touchend', handleEnd);

        // Mouse fallback for testing
        container.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
    }

    setupPedals() {
        const gas = document.getElementById('gas-pedal');
        const brake = document.getElementById('brake-pedal');

        if (gas) {
            const pressGas = (e) => { e.preventDefault(); this.keys.forward = true; };
            const releaseGas = (e) => { e.preventDefault(); this.keys.forward = false; };
            gas.addEventListener('touchstart', pressGas, { passive: false });
            gas.addEventListener('touchend', releaseGas);
            gas.addEventListener('mousedown', pressGas);
            gas.addEventListener('mouseup', releaseGas);
        }

        if (brake) {
            // Brake Pedal usually means BRAKE logic, but in simple arcade 'S' is Reverse/Brake.
            // Let's map it to 'backward' which handles both in Car.js usually
            const pressBrake = (e) => { e.preventDefault(); this.keys.backward = true; }; // S key logic
            const releaseBrake = (e) => { e.preventDefault(); this.keys.backward = false; };
            brake.addEventListener('touchstart', pressBrake, { passive: false });
            brake.addEventListener('touchend', releaseBrake);
            brake.addEventListener('mousedown', pressBrake);
            brake.addEventListener('mouseup', releaseBrake);
        }
    }
}
