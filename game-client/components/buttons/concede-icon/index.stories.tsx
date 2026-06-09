import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ConcedeIcon from "./index";
import { WebSocketProvider } from "@/contexts/WebSocketContext";

const meta: Meta<typeof ConcedeIcon> = {
	title: "Buttons/ConcedeIcon",
	component: ConcedeIcon,
	decorators: [
		(Story) => (
			<WebSocketProvider>
				<Story />
			</WebSocketProvider>
		),
	],
	args: {
	},
};

export default meta;

type Story = StoryObj<typeof ConcedeIcon>;

export const Normal: Story = {

};