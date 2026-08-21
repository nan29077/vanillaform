import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import { getShopAwareLoginPath } from "@/lib/shopLoginRedirect";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    productId?: string;
    variantId?: string;
    sellerId?: string;
    campaignId?: string;
    quantity?: string;
  };
}) {
  const session = await auth();
  if (!session) redirect(getShopAwareLoginPath());

  const { type, productId, variantId, sellerId, campaignId, quantity } = searchParams;
  if (!productId || !sellerId) redirect("/");

  const qty = Math.max(1, parseInt(quantity || "1", 10) || 1);

  // ── 셀러 일반상품(DirectProduct) 결제 ──
  // 카탈로그 Product 가 아닌 별도 모델이라 조회 경로가 다르다.
  // 옵션(variant)·공동구매 캠페인은 일반상품에 존재하지 않으므로 무시한다.
  if (type === "direct") {
    const [direct, directSeller] = await Promise.all([
      prisma.directProduct.findUnique({
        where: { id: productId },
        select: { id: true, name: true, images: true, price: true, shippingFee: true, stock: true, isActive: true, sellerId: true },
      }),
      prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { id: true, shopName: true } }),
    ]);
    // 상품이 없거나 비활성/품절이거나, 다른 셀러의 상품을 이 셀러 이름으로 사려는 경우 차단
    if (!direct || !direct.isActive || !directSeller || direct.sellerId !== directSeller.id) redirect("/");
    if (direct.stock < qty) redirect(`/shop`);

    const images = parseJsonArray(direct.images);
    const directShippingFee = Number(direct.shippingFee || 0);

    return (
      <CheckoutClient
        item={{
          itemType: "DIRECT",
          productId: direct.id,
          name: direct.name,
          thumbnail: images[0] || null,
          sellerId: directSeller.id,
          sellerName: directSeller.shopName,
          variantId: null,
          variantName: null,
          campaignId: null,
          campaignTitle: null,
          price: Number(direct.price),
          quantity: qty,
          isCampaign: false,
          shippingFee: directShippingFee,
          // DirectProduct 에는 무료배송 기준금액 개념이 없다 — 배송비 0원이면 무료배송.
          freeShipping: directShippingFee === 0,
          freeShippingThreshold: null,
        }}
      />
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
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
  if (!product) redirect("/");

  let variantInfo: { id: string; name: string; price: number } | null = null;
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, name: true, price: true },
    });
    if (variant) {
      variantInfo = {
        id: variant.id,
        name: variant.name,
        price: Number(variant.price),
      };
    }
  }

  let campaignInfo: {
    id: string;
    title: string;
    campaignPrice: number;
  } | null = null;
  if (campaignId) {
    const campaign = await prisma.groupBuyCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true, campaignPrice: true },
    });
    if (campaign) {
      campaignInfo = {
        id: campaign.id,
        title: campaign.title,
        campaignPrice: Number(campaign.campaignPrice),
      };
    }
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { id: true, shopName: true },
  });
  if (!seller) redirect("/");

  const price =
    campaignInfo?.campaignPrice ??
    variantInfo?.price ??
    Number(product.basePrice);

  const item = {
    itemType: "PRODUCT" as const,
    productId: product.id,
    name: product.name,
    thumbnail: product.thumbnail,
    sellerId: seller.id,
    sellerName: seller.shopName,
    variantId: variantInfo?.id || null,
    variantName: variantInfo?.name || null,
    campaignId: campaignInfo?.id || null,
    campaignTitle: campaignInfo?.title || null,
    price,
    quantity: qty,
    isCampaign: !!campaignInfo,
    // 배송 설정 (상품 기준)
    shippingFee: Number(product.shippingFee || 0),
    freeShipping: product.freeShipping,
    freeShippingThreshold:
      product.freeShippingThreshold != null
        ? Number(product.freeShippingThreshold)
        : null,
  };

  return <CheckoutClient item={item} />;
}
