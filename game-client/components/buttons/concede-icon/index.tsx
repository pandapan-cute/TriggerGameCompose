import NormalFullDialog from "@/components/dialogs/NormalFullDialog";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useRef } from "react";
import { ResultNavButton } from "../result-nav";
import Image from "next/image";

/**
 * 対戦リタイアアイコンボタン
 * @returns 
 */
export default function ConcedeIcon() {
  /* ダイアログのRef */
  const dialogRef = useRef<HTMLDialogElement>(null);

  /** ダイアログを開く */
  const handleOpenDialog = () => {
    dialogRef.current?.showModal();
  };

  /** ダイアログを閉じる */
  const handleCloseDialog = () => {
    dialogRef.current?.close();
  };

  const { sendMessage } = useWebSocket();

  /** 降参処理 */
  const handleConcede = () => {
    sendMessage({ action: "concedeGame" });
    handleCloseDialog();
  };

  return (
    <>
      <div onClick={handleOpenDialog}>
        <Image
          src="/icons/concede.svg"
          alt="Concede"
          width={24}
          height={24}
          className="text-red-500"
        />
      </div>
      <NormalFullDialog ref={dialogRef}>
        <div className="flex h-full w-full flex-col items-center justify-center">
          <div className="justify-center text-center text-white">
            <h3 className="text-2xl font-bold">Concede and return to the title screen?</h3>
            <p className="mt-2 text-xl">降参してタイトルページに戻ります。<br />
              よろしいですか？</p>
          </div>
          <div className="mt-4 flex gap-16 justify-center">
            <ResultNavButton href="#" onClick={handleCloseDialog} variant="back">
              Cancel
            </ResultNavButton>
            <ResultNavButton href="/" onClick={handleConcede} variant="next">
              Go to Title
            </ResultNavButton>
          </div>
        </div>
      </NormalFullDialog>
    </>
  );
} 