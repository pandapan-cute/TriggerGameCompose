import { Action } from "./Action";
import { Step } from "./Step";

/** 
 * ターンクラス
 * すべてのStepの集合がTurn
 * (すべてのユニットのActionの集合 -> Step) -> Turn
 * (個々のユニットの一回の行動 -> Action)
 */
export class Turn {
  private gameId: string;
  private turnId: string;
  private turnStartDatetime: string;
  private turnStatus: string;
  private turnNumber: number;
  private steps: Step[];

  constructor() {
    this.turnNumber = 1;
    this.steps = [];
    this.gameId = "";
    this.turnId = "";
    this.turnStartDatetime = "";
    this.turnStatus = "";
  }

  static fromJSON(rawTurn: unknown): Turn {
    const turn = Object.setPrototypeOf(rawTurn as object, Turn.prototype) as Turn;
    const steps = (rawTurn as { steps?: unknown[]; }).steps;

    if (Array.isArray(steps)) {
      steps.forEach((step) => {
        Step.fromJSON(step);
      });
    }

    return turn;
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

  getTurnNumber(): number {
    return this.turnNumber;
  }
}