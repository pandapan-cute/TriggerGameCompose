import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import LoadingDialog from ".";

const meta: Meta<typeof LoadingDialog> = {
  title: "Dialogs/LoadingDialog",
  component: LoadingDialog,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    message: "Loading...",
    isOpen: true,
  },
};

export default meta;

type Story = StoryObj<typeof LoadingDialog>;

export const Normal: Story = {
  render: (args) => {
    return (
      <div className="min-h-screen bg-[#04070d]">
        <LoadingDialog {...args} />
      </div>
    );
  },
};
