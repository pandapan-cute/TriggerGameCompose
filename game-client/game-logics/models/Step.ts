import { Action } from "./Action";

/** ステップインターフェース */
export interface Step {
  stepId: string;
  actions: Action[];
}

/** 
 * ステップクラス
 * すべてのユニットのActionの集合 が Step
 * (個々のユニットの一回の行動 -> Action)
 */
export class Step implements Step {

}
