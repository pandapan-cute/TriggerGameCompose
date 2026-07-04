import { Scene3D, ExtendedObject3D } from "@enable3d/phaser-extension";
import { GridCellsScene } from "../../phaser/scenes/GridCellsScene";
import { ThreeDFieldViewState } from "../entities/ThreeDFieldViewState";

export class ThreeDGridCellsScene extends GridCellsScene {

  private threeDFieldViewState!: ThreeDFieldViewState;

  public init() {
    // 💡 4. ここで3DモードをONにする！
    // これにより、このシーンだけ裏で Three.js や物理エンジンが起動します
    this.accessThirdDimension();
  }

  /** フィールドビューの状態管理を初期化する（3D版） */
  protected initializeFieldViewState() {
    this.threeDFieldViewState = new ThreeDFieldViewState(
      this.hexUtils,
      this,
      this.gridConfig,
      this.fieldSteps,
      this.visibility,
    );
  }

  async create(): Promise<void> {
    // もとの2Dクラスのcreate（通信初期化など）をそのまま再利用して実行！
    super.create();

    await this.third.warpSpeed();
    this.third.camera.position.set(20, 20, 40);

    const robot = new ExtendedObject3D();
    const animations = ['Jumping', 'LookingAround', 'Running', 'BodyJabCross', 'HipHopDancing'];
    const pos = { x: 0, y: 5, z: 0 };

    await this.third.load.fbx('/character/3d/Idle.fbx').then(object => {
      robot.add(object);

      this.third.animationMixers.add(robot.anims.mixer);

      robot.anims.add('Idle', object.animations[0]);
      robot.anims.play('Idle');

      // attach a cube to the left hand
      robot.traverse(child => {
        if (child.name === 'mixamorigLeftHandIndex1') {
          child.add(this.third.add.box({ width: 20, height: 20, depth: 20 }));
        }
      });

      robot.traverse(child => {
        if (child.isMesh) child.castShadow = child.receiveShadow = true;
      });

      robot.scale.set(0.05, 0.05, 0.05);
      robot.position.set(pos.x, pos.y, pos.z);


      this.third.add.existing(robot);

      // load more animations
      animations.forEach(key => {
        if (key === 'Idle') return;
        this.third.load.fbx(`/character/3d/${key}.fbx`).then(object => {
          robot.anims.add(key, object.animations[0]);
        });
      });

      this.time.addEvent({
        delay: 2500,
        loop: true,
        callback: () => {
          const anim = Phaser.Math.RND.pick(animations);
          console.log(`Set animation ${anim}`);
          robot.anims.play(anim, 350);
        }
      });
    });
  }

}