import { ThreeDCharacterPlacementService } from "@/game-logics/3d-version/services/ThreeDCharacterPlacementService";
import { ThreeDPlayerCharacterState } from "@/game-logics/3d-version/entities/ThreeDPlayerCharacterState";
import { ThreeDEnemyCharacterState } from "@/game-logics/3d-version/entities/ThreeDEnemyCharacterState";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { FriendUnit } from "@/types/FriendUnit";
import { HexUtils } from "@/game-logics/hexUtils";
import { GameResult } from "@/types/GameTypes";
import { Combat } from "@/game-logics/models/Combat";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { MAX_TURN } from "@/game-logics/config/game-config";
import { MAX_UNIT_EXEC_SECONDS } from "@/game-logics/config/game-config";
import { CHARACTER_STATUS } from "@/game-logics/config/status";
import { TRIGGER_STATUS } from "@/game-logics/config/status";
import { GridConfig } from "@/game-logics/types";
import { ThreeDTriggerFanObject } from "@/game-logics/3d-version/graphics/ThreeDTriggerFanObject";
import { Scene3D } from "@enable3d/phaser-extension";
import * as THREE from "three";

/**
 * ThreeDTurnReplayController が参照する依存関係。
 *
 * 補足:
 * 3D版のターン再生を Scene から分離し、2D版 TurnReplayController と同じ役割分担に寄せる。
 */
export interface ThreeDTurnReplayControllerDeps {
  scene3d: Scene3D;
  hexUtils: HexUtils;
  gridConfig: GridConfig;
  placementService: ThreeDCharacterPlacementService;
  /** 指定グリッド座標でのユニット配置高さを返す。 */
  resolveUnitHeightAtGrid: (col: number, row: number) => number;
  unitObjectById: Map<string, ThreeDUnitObject>;
  enemyCharacterStatesById: Map<string, ThreeDEnemyCharacterState>;
  playerCharacterStates: Map<ThreeDUnitObject, ThreeDPlayerCharacterState>;
  friendUnitsById: Map<string, FriendUnit>;
  clearSelection: () => void;
  onReplayCompleted: (turnNumber: number) => void;
  setActionMode?: (isActionMode: boolean) => void;
  setActionAnimationInProgress?: (isInProgress: boolean) => void;
  clearPlannedSteps?: () => void;
  restoreActionPointsRemainSecondsText?: () => void;
  updateFieldViewVisibility: () => boolean[][] | undefined;
  completeGame?: (result: GameResult) => void;
}

/**
 * 受信した Turn の 3D 再生を扱う。
 *
 * 2D版と同じく、ステップ単位でアクションとコンバットを順に再生し、
 * 完了後にゲーム終了判定または行動フェーズ復帰を行う。
 */
export class ThreeDTurnReplayController {
  /** リプレイ中に表示するメイントリガー扇形。 */
  private readonly mainReplayTriggerFans = new Map<string, ThreeDTriggerFanObject>();
  /** リプレイ中に表示するサブトリガー扇形。 */
  private readonly subReplayTriggerFans = new Map<string, ThreeDTriggerFanObject>();
  /** ユニットごとに読み込み済みの戦闘モーション名を保持する。 */
  private readonly loadedCombatMotionsByUnit = new Map<string, Set<string>>();
  /** 射出中のトリオンキューブ。 */
  private readonly activeTrionCubes: THREE.Mesh[] = [];

  constructor(private readonly deps: ThreeDTurnReplayControllerDeps) { }

  /**
   * 受信したターンを先頭ステップから順次再生する。
   *
   * @param turn サーバーから受信したターン情報。
   */
  public executeTurn(turn: Turn): void {
    this.clearAllReplayTriggerFans();
    this.deps.clearSelection();
    this.deps.setActionMode?.(true);
    this.deps.setActionAnimationInProgress?.(true);

    this.deps.scene3d.time.delayedCall(2000, () => {
      this.executeStep(turn, 0);
    });
  }

  /**
   * 指定インデックスのステップを再生し、次ステップへ連鎖させる。
   *
   * @param turn 再生対象のターン。
   * @param stepIndex 再生するステップのインデックス。
   */
  private executeStep(turn: Turn, stepIndex: number): void {
    const steps = turn.getSteps();
    const step = steps[stepIndex];
    if (!step) return;

    this.replayActions(step);
    this.deps.scene3d.time.delayedCall(500, () => {
      this.replayCombats(step);
    });

    // 3D版でもステップ再生後に視界情報を更新する。
    this.deps.updateFieldViewVisibility();

    const nextStepIndex = stepIndex + 1;
    this.deps.scene3d.time.delayedCall(1000, () => {
      if (nextStepIndex < steps.length) {
        this.executeStep(turn, nextStepIndex);
        return;
      }

      const gameResult = this.checkGameIsCompleted(turn.getTurnNumber());
      if (gameResult !== "InProgress") {
        this.clearAllReplayTriggerFans();
        this.deps.completeGame?.(gameResult);
        return;
      }

      this.completeUnitActionPhase(turn.getTurnNumber());
    });
  }

  /**
   * 1ステップ内のアクション群を 3D ユニットに反映する。
   *
   * @param step 再生対象のステップ。
   */
  private replayActions(step: Step): void {
    for (const action of step.getActions()) {
      if (this.isUnitBailedOut(action.getUnitId())) {
        continue;
      }

      const unitObject = this.deps.unitObjectById.get(action.getUnitId());
      if (!unitObject) continue;
      const combat = step.getCombats().find((currentCombat) => currentCombat.getAttackingUnitId() === action.getUnitId());

      const playerState = this.deps.playerCharacterStates.get(unitObject);
      const currentGridPosition = this.getCurrentGridPosition(action.getUnitId());
      const targetGridPosition = this.resolveGridPosition(action.getUnitId(), action.getPosition());
      const worldPosition = this.deps.placementService.fromGridOn3D(
        this.deps.hexUtils,
        targetGridPosition.col,
        targetGridPosition.row,
        this.deps.resolveUnitHeightAtGrid(targetGridPosition.col, targetGridPosition.row),
      );

      const isMoving =
        currentGridPosition.col !== targetGridPosition.col ||
        currentGridPosition.row !== targetGridPosition.row;

      if (isMoving) {
        // 3D版では移動アニメーションを先行し、完了時に状態を確定する。
        unitObject.faceToward(worldPosition);
        // 移動開始時点の位置でトリガー扇形を表示し、移動中は中心座標を追従させる。
        this.updateReplayTriggerFansForAction(
          action,
          { x: unitObject.position.x, y: unitObject.position.y, z: unitObject.position.z },
          unitObject.position.y + 0.02,
        );

        unitObject.moveTo(
          worldPosition,
          500,
          () => {
            if (this.isUnitBailedOut(action.getUnitId())) {
              return;
            }

            const enemyCharacterState = this.deps.enemyCharacterStatesById.get(action.getUnitId());
            if (enemyCharacterState) {
              enemyCharacterState.syncReplayState({
                unitTypeId: action.getUnitTypeId(),
                displayGridPosition: targetGridPosition,
                worldPosition,
                currentActionPoints: action.getCurrentActionPoints(),
                usingMainTriggerId: action.getUsingMainTriggerId(),
                usingSubTriggerId: action.getUsingSubTriggerId(),
              });
            } else {
              unitObject.syncVisualState({
                unitTypeId: action.getUnitTypeId(),
                visible: true,
                position: worldPosition,
                usingMainTriggerId: action.getUsingMainTriggerId(),
                usingSubTriggerId: action.getUsingSubTriggerId(),
              });
            }

            if (playerState) {
              playerState.syncReplayState({
                displayGridPosition: targetGridPosition,
                currentActionPoints: action.getCurrentActionPoints(),
                usingMainTriggerId: action.getUsingMainTriggerId(),
                usingSubTriggerId: action.getUsingSubTriggerId(),
              });
            }

            this.updateReplayTriggerFansForAction(action, worldPosition, unitObject.position.y + 0.02);
            this.playCombatAnimationAfterAction(action, combat, unitObject);
          },
          (currentPosition) => {
            this.updateReplayTriggerFansForAction(action, currentPosition, currentPosition.y + 0.02);
          },
        );
      } else {
        // 移動しないアクションは Idle のまま、座標と表示だけを更新する。
        unitObject.playAnimation("Idle", 120);
        if (playerState) {
          playerState.syncReplayState({
            displayGridPosition: targetGridPosition,
            currentActionPoints: action.getCurrentActionPoints(),
            usingMainTriggerId: action.getUsingMainTriggerId(),
            usingSubTriggerId: action.getUsingSubTriggerId(),
          });
        }

        const enemyCharacterState = this.deps.enemyCharacterStatesById.get(action.getUnitId());
        if (enemyCharacterState) {
          enemyCharacterState.syncReplayState({
            unitTypeId: action.getUnitTypeId(),
            displayGridPosition: targetGridPosition,
            worldPosition,
            currentActionPoints: action.getCurrentActionPoints(),
            usingMainTriggerId: action.getUsingMainTriggerId(),
            usingSubTriggerId: action.getUsingSubTriggerId(),
          });
        } else {
          unitObject.syncVisualState({
            unitTypeId: action.getUnitTypeId(),
            visible: true,
            position: worldPosition,
            usingMainTriggerId: action.getUsingMainTriggerId(),
            usingSubTriggerId: action.getUsingSubTriggerId(),
          });
        }
        this.updateReplayTriggerFansForAction(action, worldPosition, unitObject.position.y + 0.02);
        this.playCombatAnimationAfterAction(action, combat, unitObject);
      }
    }
  }

  /**
   * 対象ユニットが撃墜済みかを判定する。
   */
  private isUnitBailedOut(unitId: string): boolean {
    const friendUnit = this.deps.friendUnitsById.get(unitId);
    if (friendUnit) {
      return friendUnit.isBailout;
    }

    const enemyState = this.deps.enemyCharacterStatesById.get(unitId);
    return enemyState?.getEnemyUnit().isBailout ?? false;
  }

  /**
   * アクション反映後にコンバットがある場合、敵方向へ向いて戦闘モーションを再生する。
   */
  private playCombatAnimationAfterAction(action: {
    getUnitId: () => string;
    getUsingMainTriggerId: () => string;
    getUsingSubTriggerId: () => string;
    getPosition: () => { col: number; row: number; };
  }, combat: Combat | undefined, unitObject: ThreeDUnitObject): void {
    const animationSpec = this.resolveCombatAnimationSpec(action, combat);
    if (!animationSpec.motionType) {
      return;
    }

    const defenderGridPosition = combat
      ? this.resolveGridPosition(combat.getDefendingUnitId(), combat.getDefenderPosition())
      : action.getPosition();
    const defenderWorldPosition = this.deps.placementService.fromGridOn3D(
      this.deps.hexUtils,
      defenderGridPosition.col,
      defenderGridPosition.row,
      this.deps.resolveUnitHeightAtGrid(defenderGridPosition.col, defenderGridPosition.row),
    );

    unitObject.faceToward(defenderWorldPosition);
    if (animationSpec.projectilePattern !== "none") {
      this.fireTrionCubeProjectiles(unitObject, combat, animationSpec);
    }
    void this.playCombatMotion(unitObject, action.getUnitId(), animationSpec.motionType, animationSpec.isMirrored);
  }

  /**
   * 戦闘時に再生するモーションと左右反転の有無を解決する。
   */
  private resolveCombatAnimationSpec(action: {
    getUsingMainTriggerId: () => string;
    getUsingSubTriggerId: () => string;
  }, combat: Combat | undefined): {
    motionType: string | null;
    isMirrored: boolean;
    attackPattern: "main" | "sub" | "both" | "none";
    projectilePattern: "main" | "sub" | "both" | "none";
    isStraightProjectile: boolean;
  } {
    if (!combat) {
      return {
        motionType: null,
        isMirrored: false,
        attackPattern: "none",
        projectilePattern: "none",
        isStraightProjectile: false,
      };
    }

    const isMainAttack = combat.getIsAttackerMainTriggerAttack();
    const isSubAttack = combat.getIsAttackerSubTriggerAttack();
    const mainTriggerId = action.getUsingMainTriggerId();
    const subTriggerId = action.getUsingSubTriggerId();
    const mainMotionType = this.resolveTriggerMotionType(mainTriggerId);
    const subMotionType = this.resolveTriggerMotionType(subTriggerId);
    const isMainShoot = mainMotionType === "Shoot";
    const isSubShoot = subMotionType === "Shoot";

    // 将来の複合攻撃モーション差し替えを見据え、
    // main/sub/both を明示的に分岐して返す。
    if (isMainAttack && isSubAttack) {
      // 両攻撃時に片方だけ Shoot の場合は、
      // モーションは非 Shoot 側、射出演出は Shoot 側の手のみを使う。
      if (isMainShoot !== isSubShoot) {
        if (isMainShoot) {
          return {
            motionType: subMotionType,
            isMirrored: true,
            attackPattern: "both",
            projectilePattern: "main",
            isStraightProjectile: this.isStraightProjectileTrigger(mainTriggerId),
          };
        }

        return {
          motionType: mainMotionType,
          isMirrored: false,
          attackPattern: "both",
          projectilePattern: "sub",
          isStraightProjectile: this.isStraightProjectileTrigger(subTriggerId),
        };
      }

      return {
        motionType: mainMotionType,
        isMirrored: false,
        attackPattern: "both",
        projectilePattern: isMainShoot || isSubShoot ? "both" : "none",
        isStraightProjectile: this.isStraightProjectileTrigger(mainTriggerId),
      };
    }

    if (isMainAttack) {
      return {
        motionType: mainMotionType,
        isMirrored: false,
        attackPattern: "main",
        projectilePattern: isMainShoot ? "main" : "none",
        isStraightProjectile: this.isStraightProjectileTrigger(mainTriggerId),
      };
    }

    if (isSubAttack) {
      return {
        motionType: subMotionType,
        isMirrored: true,
        attackPattern: "sub",
        projectilePattern: isSubShoot ? "sub" : "none",
        isStraightProjectile: this.isStraightProjectileTrigger(subTriggerId),
      };
    }

    return {
      motionType: null,
      isMirrored: false,
      attackPattern: "none",
      projectilePattern: "none",
      isStraightProjectile: false,
    };
  }

  /**
   * Shoot モーション時に、トリオンキューブを手元から射出する。
   */
  private fireTrionCubeProjectiles(
    unitObject: ThreeDUnitObject,
    combat: Combat | undefined,
    animationSpec: {
      isMirrored: boolean;
      attackPattern: "main" | "sub" | "both" | "none";
      projectilePattern: "main" | "sub" | "both" | "none";
      isStraightProjectile: boolean;
    },
  ): void {
    if (!combat) {
      return;
    }

    const projectileHands = this.resolveProjectileHands(animationSpec.projectilePattern);
    if (projectileHands.length === 0) {
      return;
    }

    const defenderGridPosition = this.resolveGridPosition(combat.getDefendingUnitId(), combat.getDefenderPosition());
    const defenderWorldPosition = this.deps.placementService.fromGridOn3D(
      this.deps.hexUtils,
      defenderGridPosition.col,
      defenderGridPosition.row,
      this.deps.resolveUnitHeightAtGrid(defenderGridPosition.col, defenderGridPosition.row),
    );

    // 両手攻撃(both)時は左右から時間差で射出し、視認性を高める。
    projectileHands.forEach((hand, index) => {
      this.deps.scene3d.time.delayedCall(index * 70, () => {
        this.launchTrionCube(
          unitObject,
          hand,
          animationSpec.isMirrored,
          defenderWorldPosition,
          animationSpec.isStraightProjectile,
        );
      });
    });
  }

  /**
   * 射出すべき手を返す。
   */
  private resolveProjectileHands(attackPattern: "main" | "sub" | "both" | "none"): Array<"main" | "sub"> {
    switch (attackPattern) {
      case "main":
        return ["main"];
      case "sub":
        return ["sub"];
      case "both":
        return ["main", "sub"];
      default:
        return [];
    }
  }

  /**
   * 手元からトリオンキューブを飛ばす。
   */
  private launchTrionCube(
    unitObject: ThreeDUnitObject,
    hand: "main" | "sub",
    isMirrored: boolean,
    targetPosition: { x: number; y: number; z: number; },
    isStraightProjectile: boolean,
  ): void {
    const startPosition = unitObject.getHandWorldPosition(hand, isMirrored);
    const emitterColor = 0x59f5ff;

    // まず手元に「大きな塊」を短時間だけ表示する。
    const largeCubeSize = 6;
    const largeGeometry = new THREE.BoxGeometry(largeCubeSize, largeCubeSize, largeCubeSize);
    const largeMaterial = new THREE.MeshStandardMaterial({
      color: emitterColor,
      emissive: emitterColor,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const largeCube = new THREE.Mesh(largeGeometry, largeMaterial);
    largeCube.position.copy(startPosition);
    largeCube.renderOrder = 10;
    this.deps.scene3d.third.add.existing(largeCube);
    this.activeTrionCubes.push(largeCube);

    // 塊を消して 3x3x3 の小キューブに分割する。
    this.deps.scene3d.time.delayedCall(80, () => {
      this.disposeTrionCubeMesh(largeCube, largeGeometry, largeMaterial);

      // 小キューブ1個あたりのサイズ。
      const fragmentSize = 2;
      const fragmentGap = 0.5;
      const fragments: Array<{ mesh: THREE.Mesh; geometry: THREE.BoxGeometry; material: THREE.MeshStandardMaterial; }>
        = [];

      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const geometry = new THREE.BoxGeometry(fragmentSize, fragmentSize, fragmentSize);
            const material = new THREE.MeshStandardMaterial({
              color: emitterColor,
              emissive: emitterColor,
              emissiveIntensity: 1.7,
              transparent: true,
              opacity: 0.9,
              depthWrite: false,
            });
            const fragment = new THREE.Mesh(geometry, material);

            const offset = new THREE.Vector3(
              x * (fragmentSize + fragmentGap),
              y * (fragmentSize + fragmentGap),
              z * (fragmentSize + fragmentGap),
            );
            fragment.position.copy(startPosition).add(offset);
            fragment.renderOrder = 10;
            this.deps.scene3d.third.add.existing(fragment);
            this.activeTrionCubes.push(fragment);
            fragments.push({ mesh: fragment, geometry, material });
          }
        }
      }

      const endPosition = new THREE.Vector3(targetPosition.x, targetPosition.y + 25, targetPosition.z);
      const travelMs = 220;

      // 小キューブ本体は固定し、そこから弾だけを射出する。
      fragments.forEach(({ mesh }, index) => {
        const emitterPosition = mesh.position.clone();
        const arcHeight = 12 + ((Math.floor(index / 3) % 3) - 1) * 4;
        const bulletTarget = this.resolveBulletImpactPoint(endPosition, index);

        this.deps.scene3d.time.delayedCall(index * 12, () => {
          this.launchTrionBulletFromEmitter(
            emitterPosition,
            bulletTarget,
            arcHeight,
            travelMs,
            emitterColor,
            isStraightProjectile,
          );
        });
      });

      // 発射演出の完了後に発射元キューブをまとめて消す。
      const totalDelayMs = (fragments.length - 1) * 12 + travelMs + 120;
      this.deps.scene3d.time.delayedCall(totalDelayMs, () => {
        fragments.forEach(({ mesh, geometry, material }) => {
          this.disposeTrionCubeMesh(mesh, geometry, material);
        });
      });
    });
  }

  /**
   * 固定された小キューブ発射口から、弾道付きの弾を1発射出する。
   */
  private launchTrionBulletFromEmitter(
    emitterPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
    arcHeight: number,
    travelMs: number,
    color: number,
    isStraightProjectile: boolean,
  ): void {
    // 射出される弾の半径。
    const bulletRadius = 0.4;
    const bulletGeometry = new THREE.SphereGeometry(bulletRadius, 14, 10);
    const bulletMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(emitterPosition);
    bullet.renderOrder = 11;
    this.deps.scene3d.third.add.existing(bullet);
    this.activeTrionCubes.push(bullet);

    this.spawnPulseFlash(emitterPosition, color, 0.45, 0.9, 90);

    const projectileCurve = isStraightProjectile
      ? null
      : (() => {
        const control = emitterPosition.clone().lerp(targetPosition, 0.5);
        control.y += arcHeight;
        return new THREE.QuadraticBezierCurve3(
          emitterPosition.clone(),
          control,
          targetPosition.clone(),
        );
      })();

    // 弾道線は射出中だけ表示する。
    const trajectoryPoints = projectileCurve
      ? projectileCurve.getPoints(24)
      : [emitterPosition.clone(), targetPosition.clone()];
    const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
    // 軌道線の太さ。
    const trajectoryLineWidth = 3;
    const trajectoryMaterial = new THREE.LineBasicMaterial({
      color,
      linewidth: trajectoryLineWidth,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    trajectoryLine.renderOrder = 9;
    this.deps.scene3d.third.add.existing(trajectoryLine);

    this.deps.scene3d.tweens.addCounter({
      from: 0,
      to: 1,
      duration: travelMs,
      ease: "Cubic.easeInOut",
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        const direction = projectileCurve
          ? projectileCurve.getTangent(progress).normalize()
          : targetPosition.clone().sub(emitterPosition).normalize();
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

        const stretch = 1.15 + Math.sin(progress * Math.PI) * 0.85;
        bullet.scale.set(0.75, 0.75, stretch);

        if (isStraightProjectile) {
          bullet.position.lerpVectors(emitterPosition, targetPosition, progress);
        } else {
          const point = projectileCurve?.getPoint(progress);
          if (!point) {
            return;
          }
          bullet.position.copy(point);
        }
      },
      onComplete: () => {
        this.spawnPulseFlash(targetPosition, color, 0.7, 1.35, 110);
        this.disposeTrionCubeMesh(bullet, bulletGeometry, bulletMaterial);
        this.disposeTrajectoryLine(trajectoryLine, trajectoryGeometry, trajectoryMaterial);
      },
    });
  }

  /**
   * 発射口や着弾点に短いフラッシュを出して、攻撃の勢いを強める。
   */
  private spawnPulseFlash(
    position: THREE.Vector3,
    color: number,
    startScale: number,
    endScale: number,
    durationMs: number,
  ): void {
    const flashGeometry = new THREE.SphereGeometry(0.4, 12, 8);
    const flashMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 3.2,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    flash.scale.setScalar(startScale);
    flash.renderOrder = 12;
    this.deps.scene3d.third.add.existing(flash);
    this.activeTrionCubes.push(flash);

    this.deps.scene3d.tweens.addCounter({
      from: 0,
      to: 1,
      duration: durationMs,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        const scale = startScale + (endScale - startScale) * progress;
        flash.scale.setScalar(scale);
        flashMaterial.opacity = 0.8 * (1 - progress);
      },
      onComplete: () => {
        this.disposeTrionCubeMesh(flash, flashGeometry, flashMaterial);
      },
    });
  }

  /**
   * 各弾の着弾点を少し散らして、1点集中の違和感を抑える。
   */
  private resolveBulletImpactPoint(baseTarget: THREE.Vector3, index: number): THREE.Vector3 {
    const xBand = (index % 3) - 1;
    const yBand = (Math.floor(index / 3) % 3) - 1;
    const zBand = (Math.floor(index / 9) % 3) - 1;

    const spreadX = xBand * 2.1 + zBand * 2;
    const spreadZ = zBand * 2.1 + yBand * 2;
    const spreadY = yBand * 2;

    return baseTarget.clone().add(new THREE.Vector3(spreadX, spreadY, spreadZ));
  }

  /**
   * 直線弾道にするトリガーかどうかを返す。
   */
  private isStraightProjectileTrigger(triggerId: string): boolean {
    return triggerId === "ASTEROID";
  }

  /**
   * トリオンキューブの描画リソースを破棄する。
   */
  private disposeTrionCubeMesh(
    cube: THREE.Mesh,
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial,
  ): void {
    cube.removeFromParent();
    geometry.dispose();
    material.dispose();

    const index = this.activeTrionCubes.indexOf(cube);
    if (index >= 0) {
      this.activeTrionCubes.splice(index, 1);
    }
  }

  /**
   * 弾道線リソースを破棄する。
   */
  private disposeTrajectoryLine(
    line: THREE.Line,
    geometry: THREE.BufferGeometry,
    material: THREE.LineBasicMaterial,
  ): void {
    line.removeFromParent();
    geometry.dispose();
    material.dispose();
  }

  /**
   * トリガーIDからモーション名を解決する。
   */
  private resolveTriggerMotionType(triggerId: string): string | null {
    const triggerKey = triggerId as keyof typeof TRIGGER_STATUS;
    const triggerStatus = TRIGGER_STATUS[triggerKey];

    return triggerStatus?.motionType ?? null;
  }

  /**
   * 戦闘モーションを必要に応じて読み込み、短時間再生後に Idle へ戻す。
   */
  private async playCombatMotion(unitObject: ThreeDUnitObject, unitId: string, motionType: string, isMirrored: boolean): Promise<void> {
    const loadedMotions = this.loadedCombatMotionsByUnit.get(unitId) ?? new Set<string>();
    if (!this.loadedCombatMotionsByUnit.has(unitId)) {
      this.loadedCombatMotionsByUnit.set(unitId, loadedMotions);
    }

    if (!loadedMotions.has(motionType)) {
      await unitObject.addAnimation(motionType, `/character/3d/motions/${motionType}.glb`);
      loadedMotions.add(motionType);
    }

    const combatAnimationDurationMs = 420;
    unitObject.setHorizontalMirror(isMirrored);
    unitObject.playAnimation(motionType, 80, { loop: false });
    this.deps.scene3d.time.delayedCall(combatAnimationDurationMs, () => {
      unitObject.setHorizontalMirror(false);
      unitObject.playAnimation("Idle", 80);
    });
  }

  /**
   * 1ステップ内のコンバット群を 3D ユニットへ反映する。
   *
   * @param step 再生対象のステップ。
   */
  private replayCombats(step: { getCombats: () => Combat[]; }): void {
    for (const combat of step.getCombats()) {
      const defendingUnitObject = this.deps.unitObjectById.get(combat.getDefendingUnitId());
      if (!defendingUnitObject) continue;

      if (!combat.getIsDefeatedCombat()) {
        continue;
      }

      // 3D版は 2D の撃破演出を簡略化し、撃破時は非表示化のみ行う。
      const enemyCharacterState = this.deps.enemyCharacterStatesById.get(combat.getDefendingUnitId());
      if (enemyCharacterState) {
        enemyCharacterState.setBailout(true);
      } else {
        defendingUnitObject.updateVisibility(false);
      }

      const friendUnit = this.deps.friendUnitsById.get(combat.getDefendingUnitId());
      if (friendUnit) {
        friendUnit.isBailout = true;
      }
    }
  }

  /**
   * 再生完了時のフェーズ復帰処理を実行する。
   *
   * @param turnNumber 完了したターン番号。
   */
  private completeUnitActionPhase(turnNumber: number): void {
    // 再生中の Running を止め、次の行動設定モードでは全ユニットを待機状態に戻す。
    this.setAllUnitsIdle();
    // 行動設定フェーズへ戻る前に、リプレイ用トリガー扇形を消す。
    this.clearAllReplayTriggerFans();

    // 前ターンの選択を持ち越すと、次ターンの初回クリックが「同じユニット再クリック」扱いになる。
    this.deps.clearSelection();
    this.resetPlayerActionResources();

    this.deps.setActionMode?.(false);
    this.deps.setActionAnimationInProgress?.(false);

    this.deps.clearPlannedSteps?.();
    this.deps.restoreActionPointsRemainSecondsText?.();
    this.deps.onReplayCompleted(turnNumber);
  }

  /**
   * 3D版のゲーム終了判定を行う。
   *
   * @param currentTurn 現在のターン番号。
   */
  private checkGameIsCompleted(currentTurn: number): GameResult {
    const playerAlive = Array.from(this.deps.friendUnitsById.values()).filter((unit) => !unit.isBailout);
    const enemyAlive = Array.from(this.deps.enemyCharacterStatesById.values()).filter((state) => !state.getEnemyUnit().isBailout);

    console.log(`checkGameIsCompleted: playerAlive=${playerAlive.length}, enemyAlive=${enemyAlive.length}, currentTurn=${currentTurn}`);

    const isPlayerDefeated = playerAlive.length === 0;
    const isEnemyDefeated = enemyAlive.length === 0;

    if (isPlayerDefeated && isEnemyDefeated) {
      return "Draw";
    }
    if (isPlayerDefeated) {
      return "Lose";
    }
    if (isEnemyDefeated) {
      return "Win";
    }
    if (currentTurn >= MAX_TURN) {
      return "Draw";
    }

    return "InProgress";
  }

  /**
   * 3D版での敵味方判定に応じて、サーバー座標を盤面座標へ変換する。
   *
   * 敵ユニットは表示用に反転配置しているため、受信した座標を反転して扱う。
   */
  private resolveGridPosition(unitId: string, position: { col: number; row: number; }): { col: number; row: number; } {
    if (this.deps.friendUnitsById.has(unitId)) {
      return position;
    }

    return this.deps.hexUtils.invertPosition(position);
  }

  /**
   * 現在の表示座標を、ユニット種別に応じて盤面座標で返す。
   *
   * 敵ユニットは表示用に反転配置しているため、保存済みの raw 座標を反転して比較する。
   */
  private getCurrentGridPosition(unitId: string): { col: number; row: number; } {
    if (this.deps.friendUnitsById.has(unitId)) {
      return this.deps.friendUnitsById.get(unitId)?.position ?? { col: 0, row: 0 };
    }

    const enemyCharacterState = this.deps.enemyCharacterStatesById.get(unitId);
    if (!enemyCharacterState) {
      return { col: 0, row: 0 };
    }

    return enemyCharacterState.getDisplayGridPosition() ?? this.deps.hexUtils.invertPosition(enemyCharacterState.getEnemyUnit().position);
  }

  /**
   * 行動モード終了時に、全ユニットのアニメーションを Idle へ戻す。
   *
   * 3D では Running のクロスフェードが残りやすいため、次の行動設定開始前に明示的に待機状態へ戻す。
   */
  private setAllUnitsIdle(): void {
    for (const unitObject of this.deps.unitObjectById.values()) {
      if (!unitObject.visible) {
        continue;
      }

      unitObject.playAnimation("Idle", 150);
    }
  }

  /**
   * 次ターンの行動設定開始に向けて、3D味方ユニットの行動リソースを初期化する。
   */
  private resetPlayerActionResources(): void {
    for (const state of this.deps.playerCharacterStates.values()) {
      const friendUnit = state.getFriendUnit();

      if (friendUnit.isBailout) {
        state.setActionPoints(0);
        state.setRemainSeconds(0);
        state.resetCurrentStep();
        continue;
      }

      const status = CHARACTER_STATUS[friendUnit.unitTypeId as keyof typeof CHARACTER_STATUS];
      const maxActionPoints = status?.activeCount ?? friendUnit.currentActionPoints;

      state.setActionPoints(maxActionPoints);
      state.setRemainSeconds(MAX_UNIT_EXEC_SECONDS);
      state.resetCurrentStep();
    }
  }

  /**
   * 1アクション分のトリガー方位を、3Dリプレイ用の扇形へ反映する。
   */
  private updateReplayTriggerFansForAction(
    action: { getUnitId: () => string; getUsingMainTriggerId: () => string; getUsingSubTriggerId: () => string; getMainTriggerAzimuth: () => number; getSubTriggerAzimuth: () => number; },
    center: { x: number; y: number; z: number; },
    y: number,
  ): void {
    const unitId = action.getUnitId();
    const isEnemyUnit = this.deps.enemyCharacterStatesById.has(unitId);
    const mainTriggerKey = action.getUsingMainTriggerId() as keyof typeof TRIGGER_STATUS;
    const subTriggerKey = action.getUsingSubTriggerId() as keyof typeof TRIGGER_STATUS;
    const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];
    const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];
    const mainAzimuth = this.resolveReplayTriggerAzimuth(action.getMainTriggerAzimuth(), isEnemyUnit);
    const subAzimuth = this.resolveReplayTriggerAzimuth(action.getSubTriggerAzimuth(), isEnemyUnit);

    if (mainTriggerStatus) {
      this.upsertReplayTriggerFan(
        this.mainReplayTriggerFans,
        unitId,
        {
          x: center.x,
          y,
          z: center.z,
        },
        0xff6b6b,
        mainAzimuth,
        mainTriggerStatus.angle,
        mainTriggerStatus.range,
      );
    }

    if (subTriggerStatus) {
      this.upsertReplayTriggerFan(
        this.subReplayTriggerFans,
        unitId,
        {
          x: center.x,
          y,
          z: center.z,
        },
        0x6b6bff,
        subAzimuth,
        subTriggerStatus.angle,
        subTriggerStatus.range,
      );
    }
  }

  /**
   * 敵ユニットのトリガー向きを、表示用に 180 度反転して返す。
   */
  private resolveReplayTriggerAzimuth(azimuth: number, isEnemyUnit: boolean): number {
    if (!isEnemyUnit) {
      return azimuth;
    }

    return (azimuth + 180) % 360;
  }

  /**
   * リプレイ用トリガー扇形を更新または新規作成する。
   */
  private upsertReplayTriggerFan(
    fanMap: Map<string, ThreeDTriggerFanObject>,
    unitId: string,
    center: { x: number; y: number; z: number; },
    color: number,
    azimuth: number,
    angle: number,
    range: number,
  ): void {
    const existing = fanMap.get(unitId);
    if (existing) {
      existing.updateTriggerAzimuth(azimuth, center, color, angle, range, true);
      return;
    }

    fanMap.set(
      unitId,
      new ThreeDTriggerFanObject(
        this.deps.scene3d,
        center,
        color,
        azimuth,
        angle,
        range,
        this.deps.gridConfig,
        true,
      ),
    );
  }

  /**
   * リプレイ中に表示した全ユニットのトリガー扇形を破棄する。
   */
  private clearAllReplayTriggerFans(): void {
    for (const fan of this.mainReplayTriggerFans.values()) {
      fan.dispose();
    }
    this.mainReplayTriggerFans.clear();

    for (const fan of this.subReplayTriggerFans.values()) {
      fan.dispose();
    }
    this.subReplayTriggerFans.clear();
  }
}