import PhaserWrapper from '../PhaserWrapper';
import Phaser from 'phaser';
import { RemainSecondsWidget } from '../widgets/RemainSecondsWidget';
import { FriendUnitImage } from '../images/FriendUnitImage';
import { GridConfig } from '@/game-logics/types';
import { GRID_CONFIG } from '@/game-logics/config/game-config';
import { UnitImageLoader } from '../../scenes/loader/UnitImageLoader';

/**
 * 味方キャラクターの表示を確認できるstorybook
 * @returns 
 */
export const Default = () => {
  const scene: Phaser.Types.Scenes.SettingsConfig & any = {
    preload() {
      // ユニット画像のプリロード
      new UnitImageLoader(this);
    },
    create() {
      const POSITION = { x: 100, y: 100 };
      /** 味方キャラクターの表示 */
      const friendUnitImage = new FriendUnitImage(this, POSITION.x, POSITION.y, 'MIKUMO_OSAMU', false, GRID_CONFIG);
      friendUnitImage.updateUnitImage('MIKUMO_OSAMU');
      /** 残り時間ウィジェットの表示 */
      const widget = new RemainSecondsWidget(this);
      widget.updateRemainSecondsDisplay(POSITION, 10);
    },
  };
  return <PhaserWrapper config={{ scene }} />;
};
export default { title: 'Phaser/FriendCharacter' };
