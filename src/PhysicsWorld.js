import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -10, 0); // Slightly stronger gravity
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.solver.iterations = 20; // High precision for high speed

        // Ground material (high friction for tires)
        this.groundMaterial = new CANNON.Material('ground');
        this.wheelMaterial = new CANNON.Material('wheel');

        // Wheel-ground contact: high friction, low bounce
        const wheelGroundContact = new CANNON.ContactMaterial(
            this.wheelMaterial,
            this.groundMaterial,
            {
                friction: 0.8, // High grip
                restitution: 0.0, // No bounce
            }
        );
        this.world.addContactMaterial(wheelGroundContact);

        // Default material for other objects
        this.defaultMaterial = new CANNON.Material('default');
        const defaultContact = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.groundMaterial,
            {
                friction: 0.5,
                restitution: 0.1,
            }
        );
        this.world.addContactMaterial(defaultContact);

        // Set default world material
        this.world.defaultContactMaterial.friction = 0.5;
        this.world.defaultContactMaterial.restitution = 0.1;
    }

    update(dt) {
        // Fixed timestep for stability
        // Substeps increased to 20 to prevent tunneling at 300km/h
        this.world.step(1 / 60, dt, 20);
    }

    addBody(body) {
        this.world.addBody(body);
    }

    removeBody(body) {
        this.world.removeBody(body);
    }
}
