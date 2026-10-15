import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PLAYER } from "../config.js";

const MODEL_FACING = Math.PI;
const MOVE_THRESHOLD = 0.6;
const FADE = 0.2;
const VISUAL_SCALE = 2;

const CLIPS = {
    idle: "Idle-loop",
    forward: "JogFront-loop",
    back: "JogBack-loop",
    left: "JogLeft-loop",
    right: "JogRight-loop",
};

export class PlayerModel {
    constructor(player){
        this.player = player;
        this.disposed = false;
        this.mixer = null;
        this.actions = {};
        this.current = null;
        this.hand = null;

        this.root = new THREE.Group();
        this.root.position.y = -PLAYER.height * 0.5;
        this.root.rotation.y = MODEL_FACING;
        player.mesh.add(this.root);

        new GLTFLoader().load(
            "/assets/Character.glb",
            (gltf) => {
                if (this.disposed){
                    return;
                }
                const model = gltf.scene;

                const strip = [];
                model.traverse((o)=>{
                    if (o.isLight || o.isCamera){
                        strip.push(o);
                    }
                    if(o.isMesh){
                        o.castShadow = true;
                        o.frustumCulled = false;
                        if (o.name === "Gun"){
                            o.visible = false;
                        }
                    }
                });
                strip.forEach((o) => o.removeFromParent());

                const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
                model.scale.setScalar(PLAYER.height/size.y * VISUAL_SCALE);
                model.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(model);
                model.position.y -= box.min.y;

                this.root.add(model);
                player.mesh.material.visible = false;
                this.mixer = new THREE.AnimationMixer(model);
                for (const clip of gltf.animations){
                    this.actions[clip.name] = this.mixer.clipAction(clip);
                }
                this._play(CLIPS.idle);
                this.hand = model.getObjectByName("Hand1_R");
            },
            undefined,
            (error) => console.error("Failed to load Character:", error),
        );
    }

    _play(name){
        const next = this.actions[name];
        if (!next || next === this.current){
            return;
        }
        next.reset().fadeIn(FADE).play();
        this.current?.fadeOut(FADE);
        this.current = next;
    }

    getHandPosition(out){
        if (!this.hand){
            return null;
        }

        this.hand.getWorldPosition(out);
        return this.player.mesh.worldToLocal(out);
    }

    update(dt){
        if (!this.mixer){
            return;
        }
        const v = this.player.velocity;
        const sin = Math.sin(this.player.yaw);
        const cos = Math.cos(this.player.yaw);

        const fwd = -v.x * sin - v.z * cos;
        const side = v.x * cos - v.z * sin;

        let name = CLIPS.idle;
        if(fwd * fwd + side * side > MOVE_THRESHOLD * MOVE_THRESHOLD){
            if (Math.abs(fwd) >= Math.abs(side)){
                name = fwd > 0 ? CLIPS.forward : CLIPS.back;
            }else{
                name = side > 0 ? CLIPS.right : CLIPS.left;
            }
        }
        this._play(name);
        this.mixer.update(dt);
    }
    dispose(){
        this.disposed = true;
        this.mixer?.stopAllAction();
        this.root.traverse((o)=>{
            if(o.isMesh){
                o.geometry.dispose();
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach((m)=>m.dispose());
                o.skeleton?.dispose();
            }
        });
        this.root.removeFromParent();
    }
}