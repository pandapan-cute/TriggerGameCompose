import { useEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import MotionLabDialog, { type MotionLabDialogHandle } from "./MotionLabDialog";

const meta: Meta<typeof MotionLabDialog> = {
  title: "Dialogs/MotionLabDialog",
  component: MotionLabDialog,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    turn: 2,
  },
};

export default meta;

type Story = StoryObj<typeof MotionLabDialog>;

export const Normal: Story = {
  render: (args) => {
    const dialogRef = useRef<MotionLabDialogHandle>(null);

    useEffect(() => {
      dialogRef.current?.show();
    }, []);

    return (
      <div className="min-h-screen bg-white p-8">
        <div className="mb-4">
          <button
            type="button"
            className="rounded border border-slate-500 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            onClick={() => dialogRef.current?.show()}
          >
            Replay animation
          </button>
        </div>

        <MotionLabDialog ref={dialogRef} turn={args.turn} />
      </div>
    );
  },
};