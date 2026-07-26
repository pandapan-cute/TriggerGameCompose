import { Suspense } from "react";
import LobbyView from "@/components/views/LobbyView";

type LobbySearchParams = Promise<{ dimension?: string | string[]; }>;

const normalizeDimension = (value?: string | string[]): "2D" | "3D" => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "2D" ? "2D" : "3D";
};

/**
 * マッチング待機中ページコンポーネント
 */
export default async function LobbyPage({
  searchParams,
}: {
  searchParams: LobbySearchParams;
}) {
  const params = await searchParams;
  const dimension = normalizeDimension(params.dimension);

  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900" />}>
      <LobbyView dimension={dimension} type="PvP" />
    </Suspense>
  );
}