import { CharacterImageState } from "../entities/CharacterImageState";

/**
 * ゲームの状態を管理するクラス
 */
export class GameState {
  /** 現在のゲーム状態 */
  private gameState: "TriggerSetting" | "Default" | null;
  /** 選択中のキャラクター */
  private selectedCharacter: CharacterImageState | null;

  constructor() {
    this.gameState = null;
    this.selectedCharacter = null;
  }

  public getGameState(): "TriggerSetting" | "Default" | null {
    return this.gameState;
  }

  public getSelectedCharacter(): CharacterImageState | null {
    return this.selectedCharacter;
  }


  public setGameState(newState: "TriggerSetting" | "Default" | null): void {
    this.gameState = newState;
  }

  public setSelectedCharacter(character: CharacterImageState | null): void {
    this.selectedCharacter = character;
  }
}