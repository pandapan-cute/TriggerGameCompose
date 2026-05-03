import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TurnStateMotionExecutePanel from "./MotionExecute";
import './index.module.css';

const meta: Meta<typeof TurnStateMotionExecutePanel> = {
	title: "Panels/TurnStateMotionExecutePanel",
	component: TurnStateMotionExecutePanel,
	parameters: {
		layout: "fullscreen",
	},
	args: {
	},
};

export default meta;

type Story = StoryObj<typeof TurnStateMotionExecutePanel>;

const remainingDateTime = new Date(Date.now() + 60000);

export const Normal: Story = {
	args: {
		endtime: remainingDateTime, // 1 minute from now
		turn: 3,
		maxTurn: 6,
	}
};