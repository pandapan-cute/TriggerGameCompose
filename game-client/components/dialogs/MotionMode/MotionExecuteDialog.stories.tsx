import { useEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import MotionExecuteDialog, { type MotionExecuteDialogHandle } from "./MotionExecuteDialog";

const meta: Meta<typeof MotionExecuteDialog> = {
  title: "Dialogs/MotionExecuteDialog",
  component: MotionExecuteDialog,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    turn: 2,
  },
};

export default meta;

type Story = StoryObj<typeof MotionExecuteDialog>;

export const Normal: Story = {
  render: (args) => {
    const dialogRef = useRef<MotionExecuteDialogHandle>(null);

    useEffect(() => {
      dialogRef.current?.show();
    }, []);

    return (
      <div className="min-h-screen bg-[#0b1014] p-8">
        <div className="mb-4">
          <button
            type="button"
            className="rounded border border-slate-500 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            onClick={() => dialogRef.current?.show()}
          >
            Replay animation
          </button>
        </div>

        <MotionExecuteDialog ref={dialogRef} turn={args.turn} />
      </div>
    );
  },
};