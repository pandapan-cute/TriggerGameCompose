import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import BattleResultPanel from "./index";
import { UnitType } from "@/types/UnitType";
import './index.module.css';

const friendUnits = [
	{ unitId: "p1", unitTypeId: UnitType.MIKUMO_OSAMU, position: { col: 0, row: 0 }, usingMainTriggerId: "t1", usingSubTriggerId: "t2", havingMainTriggerIds: ["t1"], havingSubTriggerIds: ["t2"], mainTriggerHp: 100, subTriggerHp: 100, sightRange: 8, isBailout: false },
	{ unitId: "p2", unitTypeId: UnitType.KUGA_YUMA, position: { col: 1, row: 0 }, usingMainTriggerId: "t3", usingSubTriggerId: "t4", havingMainTriggerIds: ["t3"], havingSubTriggerIds: ["t4"], mainTriggerHp: 100, subTriggerHp: 100, sightRange: 8, isBailout: true },
	{ unitId: "p3", unitTypeId: UnitType.AMATORI_CHIKA, position: { col: 2, row: 0 }, usingMainTriggerId: "t5", usingSubTriggerId: "t6", havingMainTriggerIds: ["t5"], havingSubTriggerIds: ["t6"], mainTriggerHp: 100, subTriggerHp: 100, sightRange: 8, isBailout: true },
	{ unitId: "p4", unitTypeId: UnitType.HYUSE_KURONIN, position: { col: 3, row: 0 }, usingMainTriggerId: "t7", usingSubTriggerId: "t8", havingMainTriggerIds: ["t7"], havingSubTriggerIds: ["t8"], mainTriggerHp: 100, subTriggerHp: 100, sightRange: 8, isBailout: false },

];

const enemyUnits = [
	{ unitId: "e1", unitTypeId: UnitType.MIKUMO_OSAMU, position: { col: 0, row: 1 }, usingMainTriggerId: "t9", usingSubTriggerId: "t10", isBailout: false },
	{ unitId: "e2", unitTypeId: UnitType.KUGA_YUMA, position: { col: 1, row: 1 }, usingMainTriggerId: "t11", usingSubTriggerId: "t12", isBailout: true },
	{ unitId: "e3", unitTypeId: UnitType.AMATORI_CHIKA, position: { col: 2, row: 1 }, usingMainTriggerId: "t13", usingSubTriggerId: "t14", isBailout: true },
	{ unitId: "e4", unitTypeId: UnitType.HYUSE_KURONIN, position: { col: 3, row: 1 }, usingMainTriggerId: "t15", usingSubTriggerId: "t16", isBailout: false },
];

const meta: Meta<typeof BattleResultPanel> = {
	title: "Panels/BattleResultPanel",
	component: BattleResultPanel,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		turn: 6,
		friendUnits,
		enemyUnits,
	},
};

export default meta;

type Story = StoryObj<typeof BattleResultPanel>;

export const YouWin: Story = {
	args: {
		result: "win",
		friendUnits,
		enemyUnits,
	},
};

export const YouLose: Story = {
	args: {
		result: "lose",
		friendUnits,
		enemyUnits,
	},
};

export const Draw: Story = {
	args: {
		result: "draw",
		friendUnits,
		enemyUnits,
	},
};