import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageShell narrow className="flex flex-col items-center justify-center text-center">
      <p className="display-title text-8xl text-primary">KO</p>
      <h1 className="display-title mt-4 text-2xl">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-muted-foreground">주소가 바뀌었거나 볼 수 없는 기록입니다.</p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-6" })}>
        홈으로
      </Link>
    </PageShell>
  );
}
