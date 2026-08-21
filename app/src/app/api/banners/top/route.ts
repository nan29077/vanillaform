import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Get active top banner
export async function GET() {
  try {
    const banner = await prisma.banner.findFirst({
      where: { isActive: true, position: "top" },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(banner);
  } catch (error) {
    return NextResponse.json(null);
  }
}
