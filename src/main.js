import '../style.css';
import { Game } from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
    // 1. Force Setup UI Elements
    const startBtn = document.getElementById('start-btn');
    const homeScreen = document.getElementById('home-screen');
    const gameUI = document.getElementById('game-ui');

    // 2. Customization Logic
    const styleBtns = document.querySelectorAll('.style-btn');
    styleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            styleBtns.forEach(b => {
                b.style.border = 'none';
                b.classList.remove('active');
            });
            // Add active to clicked
            e.target.style.border = '2px solid white';
            e.target.classList.add('active');

            const colorHex = e.target.getAttribute('data-color');
            console.log("Color Selected:", colorHex);

            // Update Car if it exists
            if (window.game) {
                // Parse hex string to integer
                const colorInt = parseInt(colorHex.replace('#', '0x'), 16);

                // Store preference for later init
                window.game.selectedColor = colorInt;

                // Apply immediately if already running
                if (window.game.car) {
                    window.game.car.buildSportyVisuals(colorInt);
                }
            }
        });
    });

    // 3. Add Critical Click Listener
    // This runs completely outside the Game class logic to GUARANTEE the screen hides
    startBtn.addEventListener('click', () => {
        console.log("MAIN JS: Nuclear Start Clicked");

        // Hide Home Screen
        if (homeScreen) {
            homeScreen.style.setProperty('display', 'none', 'important');
            homeScreen.classList.add('hidden');
        }

        // Show Game HUD
        if (gameUI) {
            gameUI.style.display = 'flex';
            gameUI.classList.remove('hidden');
        }

        // Trigger Game Start
        if (window.game) {
            window.game.startGame();
        } else {
            window.game = new Game();
            window.game.startGame();
        }
    });

    // 3. Initialize Game in background (so assets load)
    if (!window.game) {
        window.game = new Game();
    }
});
