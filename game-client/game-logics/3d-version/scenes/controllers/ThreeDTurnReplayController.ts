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
  /** 撃墜演出を開始済みのユニットID。 */
  private readonly defeatedUnitIds = new Set<string>();
  /** Snipe の弾道にかける高さ差補正係数。0.0 に近いほど自然、1.0 に近いほど強く下向き補正。 */
  private readonly snipeAimPitchWeight = 0.55;
  /** Snipe モーション時の下向き姿勢補正角度(rad)。 */
  private readonly snipePosePitchCorrection = -0.18;
  /** Snipe の発射位置を手元からどれだけ前方(狙い先方向)へずらすか。 */
  private readonly snipeMuzzleForwardOffset = 40;

  constructor(private readonly deps: ThreeDTurnReplayControllerDeps) { }

  /**
   * 受信したターンを先頭ステップから順次再生する。
   *
   * @param turn サーバーから受信したターン情報。
   */
  public executeTurn(turn: Turn): void {
    this.defeatedUnitIds.clear();
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
    const attackingUnitIdsInStep = new Set(step.getCombats().map((combat) => combat.getAttackingUnitId()));

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
            this.playCombatAnimationAfterAction(action, combat, unitObject, attackingUnitIdsInStep);
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
        this.playCombatAnimationAfterAction(action, combat, unitObject, attackingUnitIdsInStep);
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
  }, combat: Combat | undefined, unitObject: ThreeDUnitObject, attackingUnitIdsInStep: Set<string>): void {
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

    const defenderUnitObject = combat
      ? this.deps.unitObjectById.get(combat.getDefendingUnitId())
      : undefined;
    const shouldPrioritizeAttackMotion = combat
      ? attackingUnitIdsInStep.has(combat.getDefendingUnitId())
      : false;
    const shieldGuard = combat
      ? this.resolveShieldGuardSpec(combat)
      : null;

    // 回避は着弾後ではなく、攻撃演出の途中で入り始めた方が自然に見える。
    // 3x3x3 キューブ分割(80ms)と初弾射出の後、着弾より前のタイミングで開始する。
    if (combat && defenderUnitObject && combat.getIsAvoidedCombat() && !shouldPrioritizeAttackMotion && !this.isUnitBailedOut(combat.getDefendingUnitId())) {
      this.deps.scene3d.time.delayedCall(110, () => {
        if (this.isUnitBailedOut(combat.getDefendingUnitId())) {
          return;
        }

        void this.playCombatMotion(defenderUnitObject, combat.getDefendingUnitId(), "Avoid", false);
      });
    }

    // 防御成功時はコンバット再生待ちせず、攻撃演出と同時にシールドを表示する。
    if (combat && defenderUnitObject && shieldGuard) {
      this.playShieldGuardEffectIfNeeded(combat, defenderUnitObject, shouldPrioritizeAttackMotion);
    }

    // SHIELD防御が成立したときの「キューブ弾の着弾先」はここで上書きする。
    // 見た目位置を調整したい場合は、resolveShieldBarrierPosition 側を編集する。
    const projectileTargetOverride = combat && shieldGuard
      ? this.resolveShieldBarrierPosition(
        combat.getDefendingUnitId(),
        new THREE.Vector3(defenderWorldPosition.x, defenderWorldPosition.y, defenderWorldPosition.z),
        shieldGuard.azimuth,
      )
      : undefined;

    if (animationSpec.projectilePattern !== "none") {
      this.fireTrionCubeProjectiles(unitObject, combat, animationSpec, projectileTargetOverride);
    }
    void this.playCombatMotion(unitObject, action.getUnitId(), animationSpec.motionType, animationSpec.isMirrored);
  }

  /**
   * 射撃系モーションかどうかを返す。
   * シューターの Shoot とスナイパーの Snipe を両方 projectile として扱う。
   */
  private isProjectileMotionType(motionType: string | null): boolean {
    return motionType === "Shoot" || motionType === "Snipe";
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
    const isMainProjectileMotion = this.isProjectileMotionType(mainMotionType);
    const isSubProjectileMotion = this.isProjectileMotionType(subMotionType);

    // 将来の複合攻撃モーション差し替えを見据え、
    // main/sub/both を明示的に分岐して返す。
    if (isMainAttack && isSubAttack) {
      // 両攻撃時に片方だけ projectile 系のモーションがある場合は、
      // モーションは非 projectile 側、射出演出は projectile 側の手のみを使う。
      if (isMainProjectileMotion !== isSubProjectileMotion) {
        if (isMainProjectileMotion) {
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
        projectilePattern: isMainProjectileMotion || isSubProjectileMotion ? "both" : "none",
        isStraightProjectile: this.isStraightProjectileTrigger(mainTriggerId),
      };
    }

    if (isMainAttack) {
      return {
        motionType: mainMotionType,
        isMirrored: false,
        attackPattern: "main",
        projectilePattern: isMainProjectileMotion ? "main" : "none",
        isStraightProjectile: this.isStraightProjectileTrigger(mainTriggerId),
      };
    }

    if (isSubAttack) {
      return {
        motionType: subMotionType,
        isMirrored: true,
        attackPattern: "sub",
        projectilePattern: isSubProjectileMotion ? "sub" : "none",
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
      motionType: string | null;
      isMirrored: boolean;
      attackPattern: "main" | "sub" | "both" | "none";
      projectilePattern: "main" | "sub" | "both" | "none";
      isStraightProjectile: boolean;
    },
    projectileTargetOverride?: THREE.Vector3,
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
    const projectileDestination = projectileTargetOverride
      ? projectileTargetOverride.clone()
      : this.resolveProjectilePassThroughPosition(
        new THREE.Vector3(unitObject.position.x, unitObject.position.y, unitObject.position.z),
        new THREE.Vector3(defenderWorldPosition.x, defenderWorldPosition.y, defenderWorldPosition.z),
      );
    // 通常時は胸付近へ着弾させるため +14 する。
    // SHIELD防御時は projectileTargetOverride がシールド面座標を指すため、
    // 追加オフセットを 0 にして「盾そのものに当たる」見た目を優先する。
    const targetHeightOffset = projectileTargetOverride ? 0 : 14;

    if (animationSpec.motionType === "Snipe") {
      const hand = projectileHands[0];
      const startPosition = unitObject.getHandWorldPosition(hand, animationSpec.isMirrored);
      const sniperDestination = projectileDestination.clone();
      sniperDestination.y += targetHeightOffset;
      this.launchSniperProjectile(
        startPosition,
        sniperDestination,
        animationSpec.isStraightProjectile,
      );
      return;
    }

    // 両手攻撃(both)時は左右から時間差で射出し、視認性を高める。
    projectileHands.forEach((hand, index) => {
      this.deps.scene3d.time.delayedCall(index * 70, () => {
        this.launchTrionCube(
          unitObject,
          hand,
          animationSpec.isMirrored,
          projectileDestination,
          animationSpec.isStraightProjectile,
          targetHeightOffset,
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
   * Snipe の弾道を、相手が下にいる場合に自然に下向き補正する。
   * 画面上の見た目はsnipeAimPitchWeight係数で調整しやすくする。
   */
  private resolveSniperAimDirection(startPosition: THREE.Vector3, targetPosition: THREE.Vector3): THREE.Vector3 {
    // まずは「本来の狙い方向」そのものを求める。
    // ここでは縦方向の差も含めたベクトルが出るが、狙撃銃は武器自体が水平寄りなので、
    // そのまま使うと「地面にいる敵に対して水平に飛びすぎる」問題が起きる。
    const rawDirection = targetPosition.clone().sub(startPosition);
    const rawDistance = rawDirection.length();
    if (rawDistance <= 1e-6) {
      return rawDirection.clone().normalize();
    }

    // 水平面上の向きを抽出して、左右の角度はそのまま維持する。
    const horizontalDirection = new THREE.Vector3(rawDirection.x, 0, rawDirection.z);
    const horizontalDistance = horizontalDirection.length();
    if (horizontalDistance <= 1e-6) {
      return rawDirection.clone().normalize();
    }

    // 敵が自分より低い位置にいる場合だけ、縦方向を下へ寄せる。
    // これがないと、狙撃銃の「水平な銃口」から見て、弾がやや上目に飛ぶ/横に飛ぶように見える。
    const targetIsLowerThanShooter = startPosition.y > targetPosition.y;
    if (!targetIsLowerThanShooter) {
      return rawDirection.clone().normalize();
    }

    // 高さ差から「どれだけ下向きにするか」を角度として計算する。
    // atan2(高さ差, 水平距離) で、下にいるほど大きくなる角度が出る。
    // ここで係数をかけることで、最終的な見た目を調整しやすくする。
    const heightDifference = startPosition.y - targetPosition.y;
    const downwardPitchRadians = Math.atan2(heightDifference, horizontalDistance) * this.snipeAimPitchWeight;

    // 進行方向の横方向は維持し、縦方向だけ軽く下向きに補正する。
    // これで弾道は自然に落ち、銃口と弾の向きのズレを減らせる。
    const yawDirection = horizontalDirection.clone().divideScalar(horizontalDistance);

    return new THREE.Vector3(
      yawDirection.x,
      -Math.sin(downwardPitchRadians),
      yawDirection.z,
    ).normalize();
  }

  /**
   * スナイパー用の単発弾を、長距離・直線軌道で飛ばす。
   */
  private launchSniperProjectile(
    startPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
    isStraightProjectile: boolean,
  ): void {
    const color = 0xffd76a;
    const bulletRadius = 0.7;
    const bulletGeometry = new THREE.SphereGeometry(bulletRadius, 14, 10);
    const bulletMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.8,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    });
    // 手元の座標そのままだと発射位置が体に埋まって見えるため、狙い先方向(水平のみ)へ少し前へ出す。
    const horizontalAimDirection = new THREE.Vector3(targetPosition.x - startPosition.x, 0, targetPosition.z - startPosition.z);
    if (horizontalAimDirection.lengthSq() > 1e-6) {
      horizontalAimDirection.normalize();
    }
    const muzzleOrigin = startPosition.clone().add(horizontalAimDirection.multiplyScalar(this.snipeMuzzleForwardOffset));

    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(muzzleOrigin);
    bullet.renderOrder = 11;
    this.deps.scene3d.third.add.existing(bullet);
    this.activeTrionCubes.push(bullet);

    this.spawnPulseFlash(muzzleOrigin, color, 0.65, 1.25, 90);

    // 着弾点は本来の targetPosition のまま変えない(ここをずらすと狙った敵より奥に着弾してしまう)。
    // 銃口の見た目角度は resolveSniperAimDirection の浅めの向きを「軌道の制御点」だけに使い、
    // 曲線の終点は常に本来の着弾位置に固定する。
    const shallowAimDirection = this.resolveSniperAimDirection(muzzleOrigin, targetPosition);
    const distanceToTarget = targetPosition.clone().sub(muzzleOrigin).length();
    const travelMs = isStraightProjectile ? 260 : 420;
    // ここから先は「見た目上の弾道」を作る処理。
    // 直線射撃と違って、狙撃弾は途中でやや弧を描く感じを出したいので、
    // 序盤は銃口の見た目角度に寄せつつ、最終的には必ず本来の着弾点へ到達させる。
    const trajectoryCurve = isStraightProjectile
      ? null
      : new THREE.QuadraticBezierCurve3(
        muzzleOrigin.clone(),
        // 制御点は「浅い角度の向き」を使って序盤の飛び方だけ演出し、終点は targetPosition で固定する。
        muzzleOrigin.clone().add(shallowAimDirection.multiplyScalar(distanceToTarget * 0.5)),
        targetPosition.clone(),
      );

    // 軌道線自体は描画確認用の補助線で、実際の弾の移動は次の tween で処理する。
    // つまりこれは「見た目のガイド」ではなく、弾の軌道計算の元になる線を作っている。
    const trajectoryPoints = trajectoryCurve
      ? trajectoryCurve.getPoints(18)
      : [muzzleOrigin.clone(), targetPosition.clone()];
    const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
    const trajectoryMaterial = new THREE.LineBasicMaterial({
      color,
      linewidth: 10,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    trajectoryLine.renderOrder = 9;
    this.deps.scene3d.third.add.existing(trajectoryLine);

    this.deps.scene3d.tweens.addCounter({
      from: 0,
      to: 1,
      duration: travelMs,
      ease: "Linear",
      onUpdate: (tween) => {
        // tween の進行率 progress を使って、弾の位置を曲線上で更新する。
        // これで弾が時間とともに軌道沿いに動いているように見える。
        const progress = tween.getValue() ?? 0;
        const bulletPosition = trajectoryCurve
          ? trajectoryCurve.getPoint(progress)
          : muzzleOrigin.clone().lerp(targetPosition, progress);

        bullet.position.copy(bulletPosition);
        // 進行に合わせて弾の見た目を少し伸ばすことで、飛行中の速度感を出す。
        bullet.scale.set(1, 1, 1.4 + Math.sin(progress * Math.PI) * 0.4);

        // 進行方向に弾の向きも合わせる。これで単なる球ではなく、飛んでいる方向に向く見た目になる。
        const lookDirection = bulletPosition.clone().sub(muzzleOrigin).normalize();
        if (lookDirection.lengthSq() > 0) {
          bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookDirection);
        }
      },
      onComplete: () => {
        // 着弾時に軽いフラッシュを出して、着地/着弾の一瞬を強調する。
        this.spawnPulseFlash(targetPosition, color, 0.8, 1.6, 100);
        this.disposeTrionCubeMesh(bullet, bulletGeometry, bulletMaterial);
        this.disposeTrajectoryLine(trajectoryLine, trajectoryGeometry, trajectoryMaterial);
      },
    });
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
    // 弾の最終到達点に加算する高さ。通常は胸付近狙い、
    // SHIELD防御時は 0 を渡してシールド面へ正確に当てる。
    targetHeightOffset: number = 14,
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

      // 通常は上半身付近へ着弾させるため高さを持ち上げる。
      // SHIELD防御時は呼び出し側で 0 を渡し、シールド面そのものを狙う。
      const endPosition = new THREE.Vector3(
        targetPosition.x,
        targetPosition.y + targetHeightOffset,
        targetPosition.z,
      );
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
    const trajectoryLineWidth = 8;
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
    return triggerId === "ASTEROID" || triggerId === "IBIS";
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

    // Snipe は銃口そのものが水平に見えてしまうため、
    // 実弾の下向き補正だけでなく、キャラの姿勢も少しだけ前傾きさせて
    // 「狙っている感」を出す。視線と銃口の合成感を整えると、下にいる敵を撃つ時の違和感が減る。
    if (motionType === "Snipe") {
      unitObject.rotation.x = this.snipePosePitchCorrection;
    }

    unitObject.playAnimation(motionType, 80, { loop: false });
    this.deps.scene3d.time.delayedCall(combatAnimationDurationMs, () => {
      unitObject.setHorizontalMirror(false);
      unitObject.rotation.x = 0;
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
      const defendingUnitId = combat.getDefendingUnitId();
      const defendingUnitObject = this.deps.unitObjectById.get(defendingUnitId);
      if (!defendingUnitObject) continue;

      if (!combat.getIsDefeatedCombat()) {
        continue;
      }

      this.playDefeatSequence(defendingUnitId, defendingUnitObject);
    }
  }

  /**
   * 撃墜時の Defeat モーションを最後まで再生し、完了後に退場させる。
   */
  private playDefeatSequence(defendingUnitId: string, defendingUnitObject: ThreeDUnitObject): void {
    if (this.defeatedUnitIds.has(defendingUnitId)) {
      return;
    }
    this.defeatedUnitIds.add(defendingUnitId);

    // 撃墜済みフラグは先に立て、以後の行動を止める。
    const friendUnit = this.deps.friendUnitsById.get(defendingUnitId);
    if (friendUnit) {
      friendUnit.isBailout = true;
    }
    const enemyCharacterState = this.deps.enemyCharacterStatesById.get(defendingUnitId);
    if (enemyCharacterState) {
      enemyCharacterState.getEnemyUnit().isBailout = true;
    }

    void this.playDefeatMotionAndFinalize(defendingUnitId, defendingUnitObject);
  }

  /**
   * Defeat モーション再生完了後に、扇形を消してベイルアウト演出を出し、ユニット本体を非表示化する。
   */
  private async playDefeatMotionAndFinalize(defendingUnitId: string, defendingUnitObject: ThreeDUnitObject): Promise<void> {
    const loadedMotions = this.loadedCombatMotionsByUnit.get(defendingUnitId) ?? new Set<string>();
    if (!this.loadedCombatMotionsByUnit.has(defendingUnitId)) {
      this.loadedCombatMotionsByUnit.set(defendingUnitId, loadedMotions);
    }

    if (!loadedMotions.has("Defeat")) {
      await defendingUnitObject.addAnimation("Defeat", "/character/3d/motions/Defeat.glb");
      loadedMotions.add("Defeat");
    }

    defendingUnitObject.setHorizontalMirror(false);
    defendingUnitObject.playAnimation("Defeat", 80, { loop: false });

    // モーション長が取得できないケースでは安全側で長めに待つ。
    const defeatDurationMs = Math.max(900, defendingUnitObject.getAnimationDurationMs("Defeat") ?? 0);
    this.deps.scene3d.time.delayedCall(defeatDurationMs, () => {
      this.clearReplayTriggerFansForUnit(defendingUnitId);
      this.spawnBailoutOrbEffect(defendingUnitObject.position.clone());

      const enemyCharacterState = this.deps.enemyCharacterStatesById.get(defendingUnitId);
      if (enemyCharacterState) {
        enemyCharacterState.setBailout(true);
      } else {
        defendingUnitObject.updateVisibility(false);
      }
    });
  }

  /**
   * ベイルアウト時に、球体が上空へ抜ける演出を表示する。
   */
  private spawnBailoutOrbEffect(startPosition: THREE.Vector3): void {
    const orbColor = 0x9fdcff;
    // ベイルアウト球体の大きさ(半径)。見た目サイズはここで調整する。
    const bailoutOrbRadius = 4;
    const orbGeometry = new THREE.SphereGeometry(bailoutOrbRadius, 18, 14);
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: orbColor,
      emissive: orbColor,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.position.copy(startPosition);
    orb.position.y += 12;
    orb.renderOrder = 16;
    this.deps.scene3d.third.add.existing(orb);
    this.activeTrionCubes.push(orb);

    // ベイルアウト球体が上昇する弾道の高さ。到達高度は endPoint 側で調整する。
    const bailoutArcMidHeight = 280;
    const bailoutArcEndHeight = 800;
    const midPoint = orb.position.clone().add(new THREE.Vector3(0, bailoutArcMidHeight, 0));
    const endPoint = orb.position.clone().add(new THREE.Vector3(0, bailoutArcEndHeight, 0));
    const trailCurve = new THREE.QuadraticBezierCurve3(orb.position.clone(), midPoint, endPoint);

    const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailCurve.getPoints(28));
    const trailMaterial = new THREE.LineBasicMaterial({
      color: orbColor,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.renderOrder = 15;
    this.deps.scene3d.third.add.existing(trail);

    const bailoutDurationMs = 2000;
    this.deps.scene3d.tweens.addCounter({
      from: 0,
      to: 1,
      duration: bailoutDurationMs,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        const point = trailCurve.getPoint(progress);
        orb.position.copy(point);
        orbMaterial.opacity = 0.95 * (1 - progress * 0.7);
        trailMaterial.opacity = 0.5 * (1 - progress);
      },
      onComplete: () => {
        this.disposeTrionCubeMesh(orb, orbGeometry, orbMaterial);
        this.disposeTrajectoryLine(trail, trailGeometry, trailMaterial);
      },
    });
  }

  /**
   * 指定ユニットに紐づくリプレイ用トリガー扇形を破棄する。
   */
  private clearReplayTriggerFansForUnit(unitId: string): void {
    const mainFan = this.mainReplayTriggerFans.get(unitId);
    if (mainFan) {
      mainFan.dispose();
      this.mainReplayTriggerFans.delete(unitId);
    }

    const subFan = this.subReplayTriggerFans.get(unitId);
    if (subFan) {
      subFan.dispose();
      this.subReplayTriggerFans.delete(unitId);
    }
  }

  /**
   * SHIELD による防御成功時、六角柱バリアと必要なら Shield モーションを再生する。
   *
   * 同ステップで攻撃中のユニットは攻撃モーション優先とし、バリア表示のみ行う。
   */
  private playShieldGuardEffectIfNeeded(
    combat: Combat,
    defendingUnitObject: ThreeDUnitObject,
    shouldSkipShieldMotion: boolean,
  ): void {
    const shieldGuard = this.resolveShieldGuardSpec(combat);
    if (!shieldGuard) {
      return;
    }

    this.spawnHexShieldBarrier(combat.getDefendingUnitId(), defendingUnitObject, shieldGuard.azimuth);

    if (shouldSkipShieldMotion || this.isUnitBailedOut(combat.getDefendingUnitId())) {
      return;
    }

    void this.playCombatMotion(defendingUnitObject, combat.getDefendingUnitId(), "Shield", shieldGuard.isMirrored);
  }

  /**
   * 防御成功した SHIELD の使用側を解決する。
   * main を優先し、なければ sub を採用する。
   */
  private resolveShieldGuardSpec(combat: Combat): { azimuth: number; isMirrored: boolean; } | null {
    const mainGuardWithShield = combat.getIsDefenderMainTriggerGuard()
      && combat.getDefenderMainTriggerId() === "SHIELD";
    if (mainGuardWithShield) {
      return {
        azimuth: combat.getDefenderMainTriggerAzimuth(),
        isMirrored: false,
      };
    }

    const subGuardWithShield = combat.getIsDefenderSubTriggerGuard()
      && combat.getDefenderSubTriggerId() === "SHIELD";
    if (subGuardWithShield) {
      return {
        azimuth: combat.getDefenderSubTriggerAzimuth(),
        isMirrored: true,
      };
    }

    return null;
  }

  /**
   * 防御方向に、薄い六角柱のシールド本体を短時間表示する。
   */
  private spawnHexShieldBarrier(defenderUnitId: string, unitObject: ThreeDUnitObject, azimuth: number): void {
    const visibleAzimuth = this.resolveReplayTriggerAzimuth(
      azimuth,
      this.deps.enemyCharacterStatesById.has(defenderUnitId),
    );
    const azimuthRad = THREE.MathUtils.degToRad(visibleAzimuth);
    const barrierPosition = this.resolveShieldBarrierPosition(
      defenderUnitId,
      new THREE.Vector3(unitObject.position.x, unitObject.position.y, unitObject.position.z),
      azimuth,
    );

    // 薄い六角柱シールド本体のサイズ指定。
    // 1,2引数: 半径(見た目の大きさ) / 3引数: 厚み。どちらも従来値から2倍。
    const barrierGeometry = new THREE.CylinderGeometry(10.4, 10.4, 1.3, 6);
    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x66ddff,
      emissive: 0x44bbff,
      emissiveIntensity: 2.6,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const barrierMesh = new THREE.Mesh(barrierGeometry, barrierMaterial);
    barrierMesh.position.copy(barrierPosition);
    barrierMesh.rotation.y = azimuthRad;
    // 六角形の頂点を上下に向けるため、面内で90度回転する。
    barrierMesh.rotation.z = Math.PI / 2;
    barrierMesh.renderOrder = 14;
    this.deps.scene3d.third.add.existing(barrierMesh);
    this.activeTrionCubes.push(barrierMesh);

    const shieldDurationMs = 600;
    // フェードアウトは行わず、一定時間しっかり表示してから消す。
    this.deps.scene3d.time.delayedCall(shieldDurationMs, () => {
      this.disposeTrionCubeMesh(barrierMesh, barrierGeometry, barrierMaterial);
    });
  }

  /**
   * 防御方向に合わせたシールド本体の表示座標を返す。
   */
  private resolveShieldBarrierPosition(
    defenderUnitId: string,
    defenderWorldPosition: THREE.Vector3,
    azimuth: number,
  ): THREE.Vector3 {
    const isEnemyUnit = this.deps.enemyCharacterStatesById.has(defenderUnitId);
    const visibleAzimuth = this.resolveReplayTriggerAzimuth(azimuth, isEnemyUnit);

    // 扇形表示(ThreeDTriggerFanObject)と同じ方位角補正式に合わせる。
    // これでシールド本体も、トリガーが向いている方向へ一致して出る。
    const correctedDirectionRad = THREE.MathUtils.degToRad(90 - visibleAzimuth);
    const forward = new THREE.Vector3(
      Math.cos(correctedDirectionRad),
      0,
      -Math.sin(correctedDirectionRad),
    );

    // 盾はトリガー方位角の「前方」に出す。
    // この forward 距離(現在20)が、防御成功時にキューブ弾が当たる位置の基準になる。
    const barrierPosition = defenderWorldPosition.clone().add(forward.multiplyScalar(20));
    barrierPosition.y += 14;

    return barrierPosition;
  }

  /**
   * SHIELDで止めない弾は、防御側ユニットを少し通り越した先まで飛ばす。
   *
   * 回避時は「避けたあと背後へ抜ける」見た目になり、
   * 非回避時も即消えせず、貫通するような勢いを残せる。
   */
  private resolveProjectilePassThroughPosition(
    attackerWorldPosition: THREE.Vector3,
    defenderWorldPosition: THREE.Vector3,
  ): THREE.Vector3 {
    const travelDirection = defenderWorldPosition.clone().sub(attackerWorldPosition);
    if (travelDirection.lengthSq() <= 1e-8) {
      return defenderWorldPosition.clone();
    }

    travelDirection.normalize();

    const passThroughDistance = 48;
    return defenderWorldPosition.clone().add(travelDirection.multiplyScalar(passThroughDistance));
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