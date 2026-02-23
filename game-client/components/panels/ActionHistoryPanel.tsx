import { Action } from "@/game-logics/models/Action";

interface ActionHistoryPanelProps {
  globalActionHistory?: Action[];
}

// 履歴表示コンポーネント
const ActionHistoryPanel = ({
  globalActionHistory,
}: ActionHistoryPanelProps) => {
  return (
    <div className="text-white p-2 text-sm z-50 max-w-sm w-full">
      {globalActionHistory?.map((history, index) => (
        <div
          key={index}
          className="mb-2 p-2 bg-gray-700 bg-opacity-50 rounded text-xs"
        >
          <div className="text-slate-300">
            位置: ({history.getPosition().col}, {history.getPosition().row})
          </div>
          <div className="text-red-300">
            Main: {history.getUsingMainTriggerId()}°
          </div>
          <div className="text-blue-300">
            Sub: {history.getUsingSubTriggerId()}°
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActionHistoryPanel;
