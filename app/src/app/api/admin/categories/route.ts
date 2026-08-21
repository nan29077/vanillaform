import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 카테고리 목록
export async function GET() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ categories });
}

// POST: 카테고리 생성
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  const { name, slug, icon, image, description, sortOrder, isActive, parentId } = await req.json();
  if (!name || !slug) {
    return NextResponse.json({ error: "이름과 슬러그는 필수" }, { status: 400 });
  }
  try {
    const cat = await prisma.category.create({
      data: { name, slug, icon: icon || null, image: image || null, description: description || null, sortOrder: sortOrder || 0, isActive: isActive ?? true, parentId: parentId || null },
    });
    return NextResponse.json({ category: cat });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "이미 존재하는 이름 또는 슬러그" }, { status: 409 });
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}

// PATCH: 카테고리 수정
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  const { id, name, slug, icon, image, description, sortOrder, isActive } = await req.json();
  if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (slug !== undefined) data.slug = slug;
  if (icon !== undefined) data.icon = icon;
  if (image !== undefined) data.image = image;
  if (description !== undefined) data.description = description;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  if (isActive !== undefined) data.isActive = isActive;

  try {
    const cat = await prisma.category.update({ where: { id }, data });
    return NextResponse.json({ category: cat });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "이미 존재하는 이름 또는 슬러그" }, { status: 409 });
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

// DELETE: 카테고리 삭제
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ message: "삭제 완료" });
  } catch {
    return NextResponse.json({ error: "삭제 실패 (연결된 상품이 있을 수 있음)" }, { status: 500 });
  }
}
