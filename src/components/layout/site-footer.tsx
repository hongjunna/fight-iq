export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Fight IQ · 격투 팬을 위한 지식 퀴즈</p>
        <p>단체·선수 이름은 사실 서술에만 쓰며, 어떤 단체와도 제휴 관계가 없습니다.</p>
      </div>
    </footer>
  );
}
