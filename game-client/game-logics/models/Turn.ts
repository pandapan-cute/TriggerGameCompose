import { Action } from "./Action";
import { Step } from "./Step";

/** 
 * ターンクラス
 * すべてのStepの集合がTurn
 * (すべてのユニットのActionの集合 -> Step) -> Turn
 * (個々のユニットの一回の行動 -> Action)
 */
export class Turn {
  private steps: Step[];

  constructor() {
    this.steps = [];
  }

  /** ステップを追加する */
  addActionWithIndex(index: number, action: Action) {
    if (index < this.steps.length) {
      this.steps[index].addAction(action);
    } else {
      const newStep = new Step();

      while (this.steps.length < index) {
        this.steps.push(new Step());
      }
      newStep.addAction(action);
      this.steps.push(newStep);
    }
  }

  clearSteps() {
    this.steps = [];
  }

  getStepLength(): number {
    return this.steps.length;
  }

  // ゲッター
  getSteps(): Step[] {
    return this.steps;
  }
}