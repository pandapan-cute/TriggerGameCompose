import { forwardRef, type ReactNode, type SyntheticEvent } from "react";

interface NormalFullDialogProps {
  children: ReactNode;
  className?: string;
  onCancel?: (event: SyntheticEvent<HTMLDialogElement, Event>) => void;
}

/**
 * 全画面表示のモーダルダイアログコンポーネント
 * - `dialog`要素を使用して実装
 * - 背景は半透明の黒で、中央にコンテンツを配置
 * - `onCancel`プロパティでキャンセルイベントをハンドリング可能
 */
const NormalFullDialog = forwardRef<HTMLDialogElement, NormalFullDialogProps>(
  ({ children, className, onCancel }, ref) => {
    return (
      <dialog
        ref={ref}
        className={`fixed inset-0 m-0 h-dvh w-dvw max-h-none max-w-none overflow-hidden border-none bg-transparent p-0 backdrop:bg-black/50 ${className ?? ""}`}
        onCancel={(event) => {
          event.preventDefault();
          onCancel?.(event);
        }}
      >
        {children}
      </dialog>
    );
  }
);

NormalFullDialog.displayName = "NormalFullDialog";

export default NormalFullDialog;