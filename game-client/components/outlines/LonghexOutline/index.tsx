import Image from "next/image";

/**
 * 白の長方形の外枠
 * 左上と右下が斜めにカットされている
 */
const LonghexOutline = ({ children }: { children?: React.ReactNode; }) => {
  return (
    <div className="relative w-full max-w-5xl p-1" style={{
      clipPath:
        "polygon(5% 0, 100% 0, 100% 90%, 95% 100%, 0 100%, 0 10%)",
    }}>
      {/* 外枠 */}
      <div
        className="relative flex flex-row bg-gradient-to-b from-[#2c3942] to-[#222f39] px-3 py-3 ms:px-6 ms:py-5 gap-4"
        style={{
          clipPath:
            "polygon(5% 0, 100% 0, 100% 90%, 95% 100%, 0 100%, 0 10%)",
        }}
      >
        {/* 左下の六角形アイコン */}
        <div className="pointer-events-none absolute bottom-4 left-4 h-1/2 aspect-square">
          <Image
            src="/icons/hexagon.svg"
            alt="left-down-hexagon"
            fill
            className="object-contain -scale-x-100 -scale-y-100 mix-blend-soft-light opacity-50"
          />
        </div>

        {/* 右上の六角形アイコン */}
        <div className="pointer-events-none absolute top-4 right-4 h-1/2 aspect-square">
          <Image
            src="/icons/hexagon.svg"
            alt="right-up-hexagon"
            fill
            className="object-contain mix-blend-soft-light opacity-30"
          />
        </div>

        {/* 内部コンテンツ */}
        {children}
      </div>
    </div>
  );
};
export default LonghexOutline;
