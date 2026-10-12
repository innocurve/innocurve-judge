import Link from "next/link";

export default function HistoryNotFound() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-black">기록을 찾을 수 없습니다</h1>
      <p className="text-sm leading-relaxed text-ink-soft">
        최근 100건 밖으로 밀려나 삭제되었거나 주소가 올바르지 않습니다.
      </p>
      <Link
        href="/history"
        className="self-start text-sm font-bold underline underline-offset-2 hover:text-seal"
      >
        심사 기록 목록 보기
      </Link>
    </div>
  );
}
