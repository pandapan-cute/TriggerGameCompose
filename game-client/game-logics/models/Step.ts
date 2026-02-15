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

  addAction(action: Action) {
    this.actions.push(action);
  }

  // ゲッター
  getActions(): Action[] {
    return this.actions;
  }
}
