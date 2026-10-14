import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class PaintGunModel {
    constructor(camera, player){
        this.camera = camera;
        this.player = player;

        this.firstPersonGun = null;
        this.thirdPersonGun = null;
        this.disposed = false;

        const loader = new GLTFLoader();

        loader.load(
            "/assets/Pistol.glb",
            (gltf) => {
                if (this.disposed) {
                    return;
                }
                
                const model = gltf.scene;

                this.firstPersonGun = model.clone(true);
                this.firstPersonGun.scale.setScalar(0.3);
                this.firstPersonGun.position.set(0.3,-0.25,-0.6);
                this.firstPersonGun.visible = true;
                this.camera.add(this.firstPersonGun);

                this.thirdPersonGun = model.clone(true);
                this.thirdPersonGun.scale.setScalar(0.3);
                this.thirdPersonGun.position.set(0.6,0.2,-0.4);
                this.thirdPersonGun.visible  = false;
                this.player.mesh.add(this.thirdPersonGun);

                this.firstPersonGun.traverse((object) => {
                    if (object.isMesh){
                        object.castShadow = true;
                    }
                });

                this.thirdPersonGun.traverse((object) => {
                    if (object.isMesh){
                        object.castShadow = true;
                    }
                });
            },
            undefined,
            (error) => {
                console.error("Failed to load Pistol gun:", error);
            }
        );
    }

    update(firstPerson) {
        if (this.firstPersonGun){
            this.firstPersonGun.visible = firstPerson;
        }

        if (this.thirdPersonGun){
            this.thirdPersonGun.visible = !firstPerson;
        }
    }

    dispose() {
        this.disposed = true;

        if (this.firstPersonGun){
            this.firstPersonGun.removeFromParent();
        }

        if (this.thirdPersonGun) {
            this.thirdPersonGun.removeFromParent();
        }
    }
}