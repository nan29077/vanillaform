import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import ContentEditForm from "./ContentEditForm";

export const dynamic = "force-dynamic";

export default async function ContentEditPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
  });
  if (!seller) redirect("/");

  const post = await prisma.contentPost.findUnique({
    where: { id: resolvedParams.id },
    include: {
      shoppingTags: {
        include: {
          product: { select: { id: true, name: true, thumbnail: true, basePrice: true } },
        },
      },
    },
  });

  if (!post || post.sellerId !== seller.id) {
    notFound();
  }

  const serialized = {
    id: post.id,
    title: post.title,
    content: post.content || "",
    images: parseJsonArray(post.images),
    category: post.category || "",
    hashtags: parseJsonArray(post.hashtags),
    isPublished: post.isPublished,
    shoppingTags: post.shoppingTags.map((t) => ({
      id: t.id,
      productId: t.productId,
      productName: t.product.name,
      productThumbnail: t.product.thumbnail,
      imageIndex: t.imageIndex,
      posX: t.posX,
      posY: t.posY,
      label: t.label || t.product.name,
    })),
  };

  return <ContentEditForm post={serialized} />;
}
