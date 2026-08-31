import { prisma } from "@/lib/prisma";
import SupportContent, { type DbContent } from "./SupportContent";

// 관리자가 편집/추가한 푸터 콘텐츠를 항상 최신으로 반영
export const dynamic = "force-dynamic";

export default async function SupportPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params?.slug || "";

  let dbContent: DbContent | null = null;
  // terms·privacy는 코드 기본값(각 사업자 정보)을 항상 사용
  if (slug !== "terms" && slug !== "privacy") {
    try {
      const item = await prisma.footerContent.findUnique({ where: { slug } });
      if (item) {
        dbContent = { slug: item.slug, title: item.title, content: item.content };
      }
    } catch {
      // DB 조회 실패 시 하드코딩 기본값으로 폴백
      dbContent = null;
    }
  }

  return <SupportContent slug={slug} dbContent={dbContent} />;
}
