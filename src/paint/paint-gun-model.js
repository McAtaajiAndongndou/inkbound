import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MUZZLE_OFFSET = new THREE.Vector3(0,0,-0.5);
const RECOIL_DISTANCE_FIRST = 0.12;
const RECOIL_DISTANCE_THIRD = 0.35;
const RECOIL_TILT = 0.35;
const RECOIL_RECOVERY = 8;
const FLASH_TIME = 0.05;



export class PaintGunModel {
    constructor(camera, player){
        this.camera = camera;
        this.player = player;

        this.firstPersonGun = null;
        this.thirdPersonGun = null;
        this.disposed = false;

        this.recoil = 0;
        this.flashTimer = 0;
        this.firstPersonBase = null;
        this.thirdPersonBase = null;
        this.firstFlash = null;
        this.thirdFlash = null;

        this._flashGeometry = new THREE.SphereGeometry(0.3,8,8);
        this._flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd88,
            transparent: true,
            opacity: 0.9,
        });

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

                this.firstPersonBase = this.firstPersonGun.position.clone();
                this.thirdPersonBase = this.thirdPersonGun.position.clone();

                this.firstFlash = this._makeFlash();
                this.firstPersonGun.add(this.firstFlash);

                this.thirdFlash = this._makeFlash();
                this.thirdPersonGun.add(this.thirdFlash);
            },
            undefined,
            (error) => {
                console.error("Failed to load Pistol gun:", error);
            }
        );
    }

    update(firstPerson,dt) {
        this.recoil = Math.max(0, this.recoil - dt * RECOIL_RECOVERY);
        this.flashTimer = Math.max(0,this.flashTimer-dt);

        const kick = this.recoil * this.recoil;
        const flashOn = this.flashTimer > 0;


        if (this.firstPersonGun){
            this.firstPersonGun.visible = firstPerson;
            this.firstPersonGun.position.copy(this.firstPersonBase);
            this.firstPersonGun.position.z += kick * RECOIL_DISTANCE_FIRST;
            this.firstPersonGun.rotation.x = kick * RECOIL_TILT;
            this.firstFlash.visible  = firstPerson && flashOn;
        }

        if (this.thirdPersonGun){
            this.thirdPersonGun.visible = !firstPerson;
            
            this.thirdPersonGun.position.copy(this.thirdPersonBase);
            this.thirdPersonGun.position.z += kick * RECOIL_DISTANCE_THIRD;
            this.thirdPersonGun.rotation.x = kick * RECOIL_TILT;
            this.thirdFlash.visible = !firstPerson && flashOn;

        }
    }

    getMuzzleWorldPosition(out, firstPerson){
        const gun = firstPerson ? this.firstPersonGun : this.thirdPersonGun;
        return gun ? gun.getWorldPosition(out) : null;
    }

    _makeFlash(){
        const flash = new THREE.Mesh(this._flashGeometry, this._flashMaterial);
        flash.position.copy(MUZZLE_OFFSET);
        flash.visible = false;
        return flash;
    }

    kick(){
        this.recoil = 1;
        this.flashTimer = FLASH_TIME;
    }

    dispose() {
        this.disposed = true;

        if (this.firstPersonGun){
            this.firstPersonGun.removeFromParent();
        }

        if (this.thirdPersonGun) {
            this.thirdPersonGun.removeFromParent();
        }

        this._flashGeometry.dispose();
        this._flashMaterial.dispose();
    }
}