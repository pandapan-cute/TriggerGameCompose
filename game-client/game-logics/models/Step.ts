import { Action } from "./Action";
import { Combat } from "./Combat";

/** 
 * ステップクラス
 * すべてのユニットのActionの集合 が Step
 * (個々のユニットの一回の行動 -> Action)
 */
export class Step {

  private stepId: string;
  private actions?: Action[];
  private combats: Combat[];
  private visibilityCells: boolean[][];

  constructor() {
    this.stepId = crypto.randomUUID();
    this.actions = [];
    this.combats = [];
    this.visibilityCells = [];
  }

  static fromJSON(rawStep: unknown): Step {
    const step = Object.setPrototypeOf(rawStep as object, Step.prototype) as Step;
    const actions = (rawStep as { actions?: unknown[]; }).actions;
    const combats = (rawStep as { combats?: unknown[]; }).combats;
    const visibilityCells = (rawStep as { visibilityCells?: boolean[][]; }).visibilityCells;

    if (Array.isArray(actions)) {
      step.actions = actions.map((action) => Action.fromJSON(action));
    } else {
      step.actions = [];
    }

    if (Array.isArray(combats)) {
      step.combats = combats.map((combat) => Combat.fromJSON(combat));
    } else {
      step.combats = [];
    }

    if (Array.isArray(visibilityCells)) {
      step.visibilityCells = visibilityCells;
    } else {
      step.visibilityCells = [];
    }

    return step;
  }

  addAction(action: Action) {
    this.actions?.push(action);
  }

  // ゲッター
  getActions(): Action[] {
    return this.actions ?? [];
  }

  getCombats(): Combat[] {
    return this.combats;
  }

  getVisibilityCells(): boolean[][] {
    return this.visibilityCells;
  }
}
