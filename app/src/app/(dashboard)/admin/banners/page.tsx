import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SiteManager from "@/components/admin/SiteManager";
import { getHomeStats, getHomeStories, getHomeBenefits } from "@/lib/siteContent";
import { getSocialLinks, getFooterSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminSitePage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const [banners, homeStats, homeStories, homeBenefits, socialLinks, footerSettings] = await Promise.all([
    prisma.banner.findMany({ orderBy: [{ position: "asc" }, { sortOrder: "asc" }] }),
    getHomeStats(),
    getHomeStories(),
    getHomeBenefits(),
    getSocialLinks(),
    getFooterSettings(),
  ]);

  const serialized = banners.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
    position: b.position,
    sortOrder: b.sortOrder,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <SiteManager
        initialBanners={serialized}
        initialStats={homeStats}
        initialStories={homeStories}
        initialBenefits={homeBenefits}
        initialSocialLinks={socialLinks}
        initialFooterSettings={footerSettings}
      />
    </div>
  );
}
