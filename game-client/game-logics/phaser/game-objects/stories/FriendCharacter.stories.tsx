import PhaserWrapper from '../PhaserWrapper';
import Phaser from 'phaser';
import { RemainSecondsWidget } from '../widgets/RemainSecondsWidget';
import { FriendUnitImage } from '../images/FriendUnitImage';
import { GRID_CONFIG } from '@/game-logics/config/game-config';
import { UnitImageLoader } from '../../scenes/loader/UnitImageLoader';
import { GameAssetsLoader } from '../../scenes/loader/GameAssetsLoader';
import { ActionPointsWidget } from '../widgets/ActionPointsWidget';

/**
 * 味方キャラクターの表示を確認できるstorybook
 * @returns 
 */
export const Default = () => {
  const scene: Phaser.Types.Scenes.SettingsConfig & any = {
    preload() {
      // ユニット画像のプリロード
      new UnitImageLoader(this);
      // ゲーム関連アセットのプリロード
      new GameAssetsLoader(this);
    },
    create() {
      const POSITION = { x: 100, y: 100 };
      /** 味方キャラクターの表示 */
      const friendUnitImage = new FriendUnitImage(this, POSITION.x, POSITION.y, 'MIKUMO_OSAMU', false, GRID_CONFIG);
      friendUnitImage.updateUnitImage('MIKUMO_OSAMU');
      /** 残り時間ウィジェットの表示 */
      const widget = new RemainSecondsWidget(this);
      widget.updateRemainSecondsDisplay(POSITION, 10);

      /** アクションポイントの円形の表示 */
      const actionPointsWidget = new ActionPointsWidget(this, POSITION);
      actionPointsWidget.updateActionPointsDisplay(POSITION, 15, 8);
    },
  };
  return <PhaserWrapper config={{ scene }} />;
};
const meta = { title: 'Phaser/FriendCharacter' };
export default meta;
