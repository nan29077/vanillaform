import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopAwareLoginPath } from "@/lib/shopLoginRedirect";
import CartClient from "@/components/shared/CartClient";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await auth();
  if (!session) redirect(getShopAwareLoginPath());

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user!.id },
    include: {
      variant: {
        include: {
          product: {
            select: {
              name: true,
              thumbnail: true,
              basePrice: true,
              shippingFee: true,
              freeShipping: true,
              freeShippingThreshold: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Load product info separately for items without variants
  const productIds = cartItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      basePrice: true,
      shippingFee: true,
      freeShipping: true,
      freeShippingThreshold: true,
    },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  // Load campaign info for items with campaignId
  const campaignIds = cartItems
    .map((item) => item.campaignId)
    .filter(Boolean) as string[];
  const campaigns =
    campaignIds.length > 0
      ? await prisma.groupBuyCampaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, campaignPrice: true, title: true },
        })
      : [];
  const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c]));

  const items = cartItems.map((item) => {
    const product = item.variant?.product || productMap[item.productId];
    const campaign = item.campaignId ? campaignMap[item.campaignId] : null;
    const campaignPrice = campaign ? Number(campaign.campaignPrice) : null;
    return {
      id: item.id,
      productId: item.productId,
      sellerId: item.sellerId,
      campaignId: item.campaignId,
      name: product?.name || "상품",
      thumbnail: product?.thumbnail || null,
      variantId: item.variantId,
      variantName: item.variant?.name || null,
      price:
        campaignPrice || Number(item.variant?.price || product?.basePrice || 0),
      quantity: item.quantity,
      isCampaign: !!item.campaignId,
      shippingFee: product ? Number(product.shippingFee) : 0,
      freeShipping: product ? product.freeShipping : false,
      freeShippingThreshold:
        product?.freeShippingThreshold != null
          ? Number(product.freeShippingThreshold)
          : null,
    };
  });

  return (
    <div className="animate-fade-in pb-4">
      <CartClient initialItems={items} />
    </div>
  );
}
