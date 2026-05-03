import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import LonghexOutline from "./index";

const meta: Meta<typeof LonghexOutline> = {
  title: "Outlines/LonghexOutline",
  component: LonghexOutline,
  parameters: {
    layout: "fullscreen",
  },
  args: {
  },
};

export default meta;

type Story = StoryObj<typeof LonghexOutline>;

export const Normal: Story = {
  args: {
    children: <p>Normal</p>,
  },
};