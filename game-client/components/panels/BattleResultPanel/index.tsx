import { UnitType } from "@/types/UnitType";
import Image from "next/image";
import styles from "./index.module.css";
import { GameResult } from "@/types/GameTypes";
import { FriendUnit } from "@/types/FriendUnit";
import { EnemyUnit } from "@/types/EnemyUnit";
import LonghexOutline from "@/components/outlines/LonghexOutline";
import { ResultNavButton } from "@/components/buttons/result-nav";

/**
 * BattleResultPanel に渡す入力データ。
 */
interface BattleResultPanelProps {
	result: GameResult;
	friendUnits: FriendUnit[];
	enemyUnits: EnemyUnit[];
	turn: number;
	message?: string | null;
}

/**
 * 結果種別ごとの中央表示テキスト。
 */
const resultTextMap: Record<GameResult, string> = {
	Win: "YOU WIN",
	Lose: "YOU LOSE",
	Draw: "DRAW",
	InProgress: "IN PROGRESS",
};

/**
 * 結果種別ごとの強調色クラス。
 */
const resultColorMap: Record<GameResult, string> = {
	Win: "bg-gradient-to-l from-amber-300 via-yellow-400 to-orange-400",
	Lose: "bg-gradient-to-l from-cyan-200 via-sky-400 to-blue-500",
	Draw: "bg-gradient-to-l from-gray-400 via-gray-500 to-gray-600",
	InProgress: "",
};

/**
 * 結果種別ごとのバーカラー強調色クラス。
 */
const resultBarColorMap: Record<GameResult, { left: string; right: string; }> = {
	Win: { left: "bg-orange-400", right: "bg-amber-300" },
	Lose: { left: "bg-blue-500", right: "bg-cyan-200" },
	Draw: { left: "bg-gray-500", right: "bg-gray-400" },
	InProgress: { left: "", right: "" },
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
		<div className={`flex flex-col items-center gap-2 border-2 rounded-lg py-1 lg:py-3 w-20 lg:w-28 ${isPlayer ? "border-blue-400" : "border-red-400"}`}>
			<div
				className={`relative h-16 w-16 lg:h-20 lg:w-20 ${unitLiveBgColorMap[unit.isBailout ? "bailout" : "alive"]}`}
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
						<span className="absolute lg:left-2 top-6 lg:top-10 h-1 w-16 rotate-45 bg-slate-500" />
						<span className="absolute lg:left-2 top-6 lg:top-10 h-1 w-16 -rotate-45 bg-slate-500" />
					</>
				)}
			</div>
			<span className={`text-sm lg:text-[20px] leading-none font-michroma ${unitLiveColorMap[unit.isBailout ? "bailout" : "alive"]}`}>
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
		<div className="flex flex-wrap items-start justify-center gap-4 lg:gap-6">
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
	message,
}: BattleResultPanelProps) => {

	return (
		<div className="h-full w-full">
			<section className="relative z-40 flex h-full w-full flex-col items-center justify-center overflow-hidden">
				<LonghexOutline>
					{/* 左側の対戦結果・ユニット結果表示 */}
					<div className="w-full w-[70%] my-4 lg:my-8">
						{/* 上段: 敵ユニット */}
						<TeamRow units={enemyUnits} isPlayer={false} />

						{/* 中段: YOU/ENEMYラベル + 結果テキスト + ターン情報 */}
						<div className="flex flex-row justify-center items-center gap-4 my-2 lg:my-4">
							{/* 左側: YOUラベル */}
							<span className={`h-[3px] w-10 lg:w-20 ${resultBarColorMap[result].left} ${styles.leftBarYou}`} />

							<h2
								className={`inline-block bg-clip-text text-3xl text-transparent lg:text-5xl ${resultColorMap[result]} font-michroma italic -skew-x-8 tracking-wider`}
							>
								{resultTextMap[result]}
							</h2>
							{/* 右側: ENEMYラベル */}
							<span className={`h-[3px] w-10 lg:w-20 ${resultBarColorMap[result].right} ${styles.rightBarEnemy}`} />
						</div>

						{/* 下段: 味方ユニット */}
						<TeamRow units={friendUnits} isPlayer={true} />
					</div>
					{/* 右側のターン・経過時間表示 */}
					<div className={`${styles.crossCaptionArea} flex-col justify-center w-[30%] text-slate-100 my-8 mr-8 flex`}>
						<div className={styles.crossCaptionStart}></div>
						<p className="lg:text-2xl leading-none font-michroma">Turn {turn}</p>
						{message && <p className="text-sm lg:text-xl mt-4">{message}</p>}
						<div className={styles.crossCaptionEnd}></div>
					</div>
				</LonghexOutline>
				{/* 画面下の遷移導線 */}
				<div className="lg:mt-8 flex flex-wrap items-center justify-center gap-24 text-[20px] lg:text-[36px] leading-none lg:justify-between">
					<ResultNavButton href="/" variant="back">
						&lt; BACK TO TOP &gt;
					</ResultNavButton>
					<ResultNavButton href="/lobby" variant="next">
						&lt; NEXT BATTLE &gt;
					</ResultNavButton>
				</div>
			</section >
		</div >
	);
};

export default BattleResultPanel;
