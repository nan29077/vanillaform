import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  saveHomeStats, saveHomeStories, saveHomeBenefits,
  type HomeStat, type HomeStory, type HomeBenefits,
} from "@/lib/siteContent";

export const dynamic = "force-dynamic";

// POST: 메인페이지 콘텐츠 저장 (최고관리자 전용)
// body.section: "stats" | "stories" | "benefits"
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const section = body.section as string;

  try {
    if (section === "stats") {
      const rawStats = Array.isArray(body.stats) ? body.stats : [];
      const stats: HomeStat[] = rawStats
        .map((s: any) => ({ value: String(s?.value ?? "").trim(), label: String(s?.label ?? "").trim() }))
        .filter((s: HomeStat) => s.value || s.label);
      await saveHomeStats(stats);

    } else if (section === "stories") {
      const rawStories = Array.isArray(body.stories) ? body.stories : [];
      const stories: HomeStory[] = rawStories
        .map((s: any) => ({
          name: String(s?.name ?? "").trim(),
          quote: String(s?.quote ?? "").trim(),
          metric: String(s?.metric ?? "").trim(),
          avatar: String(s?.avatar ?? "").trim() || "/avatars/라이브셀러_2.png",
        }))
        .filter((s: HomeStory) => s.name || s.quote);
      await saveHomeStories(stories);

    } else if (section === "benefits") {
      const rawStats = Array.isArray(body.benefitStats) ? body.benefitStats : [];
      const rawItems = Array.isArray(body.benefitItems) ? body.benefitItems : [];
      const benefits: HomeBenefits = {
        stats: rawStats.map((s: any) => ({
          value: String(s?.value ?? "").trim(),
          label: String(s?.label ?? "").trim(),
          sub: String(s?.sub ?? "").trim(),
        })).filter((s: any) => s.value || s.label),
        items: rawItems.map((s: any) => ({
          iconType: String(s?.iconType ?? "heart").trim(),
          title: String(s?.title ?? "").trim(),
          desc: String(s?.desc ?? "").trim(),
        })).filter((s: any) => s.title || s.desc),
      };
      await saveHomeBenefits(benefits);

    } else {
      // 호환성: 기존 방식 (stats + stories 동시)
      const rawStats = Array.isArray(body.stats) ? body.stats : [];
      const rawStories = Array.isArray(body.stories) ? body.stories : [];
      const stats: HomeStat[] = rawStats
        .map((s: any) => ({ value: String(s?.value ?? "").trim(), label: String(s?.label ?? "").trim() }))
        .filter((s: HomeStat) => s.value || s.label);
      const stories: HomeStory[] = rawStories
        .map((s: any) => ({
          name: String(s?.name ?? "").trim(),
          quote: String(s?.quote ?? "").trim(),
          metric: String(s?.metric ?? "").trim(),
          avatar: String(s?.avatar ?? "").trim() || "/avatars/라이브셀러_2.png",
        }))
        .filter((s: HomeStory) => s.name || s.quote);
      await saveHomeStats(stats);
      await saveHomeStories(stories);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Home content save error:", e);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
