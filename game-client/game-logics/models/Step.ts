import { Action } from "./Action";

/** 
 * ステップクラス
 * すべてのユニットのActionの集合 が Step
 * (個々のユニットの一回の行動 -> Action)
 */
export class Step implements Step {

  private stepId: string;
  private actions: Action[];

  constructor() {
    this.stepId = crypto.randomUUID();
    this.actions = [];
  }

  static fromJSON(rawStep: unknown): Step {
    const step = Object.setPrototypeOf(rawStep as object, Step.prototype) as Step;
    const actions = (rawStep as { actions?: unknown[]; }).actions;

    if (Array.isArray(actions)) {
      actions.forEach((action) => {
        Action.fromJSON(action);
      });
    }

    return step;
  }

  addAction(action: Action) {
    this.actions.push(action);
  }

  // ゲッター
  getActions(): Action[] {
    return this.actions;
  }
}
