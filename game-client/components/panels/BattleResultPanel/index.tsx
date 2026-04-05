import { UnitType } from "@/types/UnitType";
import Image from "next/image";
import styles from "./index.module.css";
import { GameResult } from "@/types/GameTypes";
import { FriendUnit } from "@/types/FriendUnit";
import { EnemyUnit } from "@/types/EnemyUnit";

/**
 * BattleResultPanel に渡す入力データ。
 */
interface BattleResultPanelProps {
	result: GameResult;
	friendUnits: FriendUnit[];
	enemyUnits: EnemyUnit[];
	turn: number;
}

/**
 * 結果種別ごとの中央表示テキスト。
 */
const resultTextMap: Record<GameResult, string> = {
	win: "YOU WIN",
	lose: "YOU LOSE",
	draw: "DRAW",
};

/**
 * 結果種別ごとの強調色クラス。
 */
const resultColorMap: Record<GameResult, string> = {
	win: "bg-gradient-to-l from-amber-300 via-yellow-400 to-orange-400",
	lose: "bg-gradient-to-l from-cyan-200 via-sky-400 to-blue-500",
	draw: "bg-gradient-to-l from-gray-400 via-gray-500 to-gray-600",
};

/**
 * 結果種別ごとのバーカラー強調色クラス。
 */
const resultBarColorMap: Record<GameResult, { left: string; right: string; }> = {
	win: { left: "bg-orange-400", right: "bg-amber-300" },
	lose: { left: "bg-blue-500", right: "bg-cyan-200" },
	draw: { left: "bg-gray-500", right: "bg-gray-400" },
};

/**
 * ユニットの生存状態ごとの強調色クラス。
 */
const unitLiveColorMap: Record<"alive" | "bailout", string> = {
	alive: "text-white",
	bailout: "text-slate-400",
};

/**
 * ユニットの生存状態ごとの背景色クラス。
 */
const unitLiveBgColorMap: Record<"alive" | "bailout", string> = {
	alive: "bg-white",
	bailout: "bg-slate-400",
};

/**
 * ユニット種別IDから公開画像パスへ変換する。
 * 未知のIDは UNKNOWN 画像にフォールバックする。
 *
 * @param unitTypeId ユニット種別ID
 * @returns 公開画像パス
 */
const getCharacterImagePath = (unitTypeId: UnitType): string => {
	return `/character/${unitTypeId}.svg`;
};

/**
 * ユニット1体分の状態カードを表示する。
 *
 * @param unit 表示対象ユニット
 * @param isPlayer プレイヤーかどうか
 */
const StatusCard = ({ unit, isPlayer }: { unit: FriendUnit | EnemyUnit; isPlayer?: boolean; }) => {
	return (
		<div className={`flex flex-col items-center gap-2 border-2 rounded-lg py-3 w-28 ${isPlayer ? "border-blue-400" : "border-red-400"}`}>
			<div
				className={`relative h-20 w-20 ${unitLiveBgColorMap[unit.isBailout ? "bailout" : "alive"]}`}
				style={{ clipPath: "polygon(14% 0, 0 14%, 0 100%, 86% 100%, 100% 86%, 100% 0)" }}
			>
				<Image
					src={getCharacterImagePath(unit.unitTypeId)}
					alt={unit.unitTypeId}
					fill
					className="object-contain p-1"
					sizes="80px"
				/>
				{/* Bailout時はXマークを重ねて状態を強調 */}
				{unit.isBailout && (
					<>
						<span className="absolute left-2 top-10 h-1 w-16 rotate-45 bg-slate-500" />
						<span className="absolute left-2 top-10 h-1 w-16 -rotate-45 bg-slate-500" />
					</>
				)}
			</div>
			<span className={`text-[20px] leading-none font-michroma ${unitLiveColorMap[unit.isBailout ? "bailout" : "alive"]}`}>
				{unit.isBailout ? "Bailout" : "Alive"}
			</span>
		</div>
	);
};

/**
 * 敵・味方それぞれのユニット行を表示する。
 *
 * @param units 表示するユニット配列
 */
const TeamRow = ({ units, isPlayer }: { units: (FriendUnit | EnemyUnit)[]; isPlayer?: boolean; }) => {
	return (
		<div className="flex flex-wrap items-start justify-center gap-4 md:gap-6">
			{units.map((unit) => (
				<StatusCard key={unit.unitId} unit={unit} isPlayer={isPlayer} />
			))}
		</div>
	);
};

/**
 * 対戦結果オーバーレイパネル。
 * 勝敗、ユニット生存状態、ターン・経過時間、次アクション導線を表示する。
 */
const BattleResultPanel = ({
	result,
	friendUnits,
	enemyUnits,
	turn,
}: BattleResultPanelProps) => {

	return (
		<div className="h-full w-full border-4 border-slate-900">
			<section className="relative z-40 flex h-full w-full flex-col items-center justify-center overflow-hidden">
				<div className="relative w-full max-w-5xl p-1 bg-white" style={{
					clipPath:
						"polygon(5% 0, 100% 0, 100% 90%, 95% 100%, 0 100%, 0 10%)",
				}}>
					{/* 外枠 */}
					<div
						className="flex flex-row bg-[#223748]/95 px-5 py-8 md:px-10 md:py-10 gap-4"
						style={{
							clipPath:
								"polygon(5% 0, 100% 0, 100% 90%, 95% 100%, 0 100%, 0 10%)",
						}}
					>
						{/* 左側の対戦結果・ユニット結果表示 */}
						<div className="w-[70%]">
							{/* 上段: 敵ユニット */}
							<TeamRow units={enemyUnits} isPlayer={false} />

							{/* 中段: YOU/ENEMYラベル + 結果テキスト + ターン情報 */}
							<div className="flex flex-row justify-center items-center gap-4 my-8">
								{/* 左側: YOUラベル */}
								<span className={`h-[3px] w-20 ${resultBarColorMap[result].left} ${styles.leftBarYou}`} />

								<h2
									className={`inline-block bg-clip-text text-3xl text-transparent md:text-5xl ${resultColorMap[result]} font-michroma italic -skew-x-8 tracking-wider`}
								>
									{resultTextMap[result]}
								</h2>
								{/* 右側: ENEMYラベル */}
								<span className={`h-[3px] w-20 ${resultBarColorMap[result].right} ${styles.rightBarEnemy}`} />
							</div>

							{/* 下段: 味方ユニット */}
							<TeamRow units={friendUnits} isPlayer={true} />
						</div>
						{/* 右側のターン・経過時間表示 */}
						<div className={`${styles.crossCaptionArea} flex flex-col justify-center w-[30%] text-slate-100`}>
							<div className={styles.crossCaptionStart}></div>
							<p className="text-2xl leading-none font-michroma">Turn {turn}</p>
							<div className={styles.crossCaptionEnd}></div>
						</div>
					</div>
				</div>
				{/* 画面下の遷移導線 */}
				<div className="mt-8 flex flex-wrap items-center justify-center gap-24 text-[36px] leading-none md:justify-between">
					<button
						type="button"
						onClick={() => window.location.href = "/"}
						className="text-slate-100 transition-opacity hover:opacity-80"
					>
						&lt; BACK TO TOP &gt;
					</button>
					<button
						type="button"
						onClick={() => window.location.href = "/lobby"}
						className="text-cyan-400 transition-opacity hover:opacity-80"
					>
						&lt; NEXT BATTLE &gt;
					</button>
				</div>
			</section>
		</div>
	);
};

export default BattleResultPanel;
