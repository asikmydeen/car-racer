import * as THREE from 'three';

export class InteractionManager {
    constructor(scene, uiElement) {
        this.scene = scene;
        this.ui = uiElement; // The interaction-prompt div
        this.interactables = [];
        this.activeInteractable = null;
    }

    addInteractable(position, radius, label, onInteract) {
        // Visual debug (optional)
        // ...

        const item = {
            position: position, // Store reference, do not clone if we want to update it
            radius: radius,
            label: label,
            onInteract: onInteract
        };
        this.interactables.push(item);
        return item;
    }

    update(playerPos, isInteractPressed) {
        let nearest = null;
        let minDist = Infinity;

        // Find nearest interactable
        for (const item of this.interactables) {
            const dist = playerPos.distanceTo(item.position);
            if (dist < item.radius) {
                if (dist < minDist) {
                    minDist = dist;
                    nearest = item;
                }
            }
        }

        this.activeInteractable = nearest;

        // Update UI
        if (nearest) {
            this.ui.style.display = 'block';
            this.ui.innerText = `[E] ${nearest.label}`;

            // Interaction logic
            if (isInteractPressed) {
                // Debounce handled by input manager? No, usually continuous.
                // We need a "just pressed" check from Game.js or here.
                // Assuming Game.js passes true only on frame of press? 
                // actually Game.js passes key state.
                // So checking here might re-trigger.
                // Better: Game.js calls 'triggerInteraction()' explicitly on keydown.
                // For now, let's assume 'isInteractPressed' is the raw key state
                // and we need to handle debounce ourselves or trust caller.
            }
        } else {
            this.ui.style.display = 'none';
        }
    }

    triggerInteraction() {
        if (this.activeInteractable) {
            console.log("Interacting with:", this.activeInteractable.label);
            this.activeInteractable.onInteract();
        }
    }
}
