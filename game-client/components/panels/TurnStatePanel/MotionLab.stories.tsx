import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TurnStateMotionLabPanel from "./MotionLab";
import './index.module.css';

const meta: Meta<typeof TurnStateMotionLabPanel> = {
	title: "Panels/TurnStateMotionLabPanel",
	component: TurnStateMotionLabPanel,
	parameters: {
		layout: "fullscreen",
	},
	args: {
	},
};

export default meta;

type Story = StoryObj<typeof TurnStateMotionLabPanel>;

const remainingDateTime = new Date(Date.now() + 60000);

export const Normal: Story = {
	args: {
		endtime: remainingDateTime, // 1 minute from now
		turn: 3,
		maxTurn: 6,
	}
};