import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (slug) {
    const item = await prisma.footerContent.findUnique({ where: { slug } });
    return NextResponse.json(item ?? null);
  }

  const items = await prisma.footerContent.findMany({ orderBy: { slug: "asc" } });
  return NextResponse.json(items);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, title, content } = await req.json();
  if (!slug || !title) {
    return NextResponse.json({ error: "slug, title 필수" }, { status: 400 });
  }

  const item = await prisma.footerContent.upsert({
    where: { slug },
    update: { title, content: content ?? "" },
    create: { slug, title, content: content ?? "" },
  });

  return NextResponse.json(item);
}
