import { prisma } from "@/lib/prisma";
import AddressesClient from "./AddressesClient";
import { requireBuyerSession } from "@/lib/buyerGuard";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const session = await requireBuyerSession();

  const addresses = await prisma.address.findMany({
    where: { userId: session.user!.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const serialized = addresses.map((a) => ({
    id: a.id,
    name: a.name,
    phone: a.phone,
    zipCode: a.zipCode,
    address1: a.address1,
    address2: a.address2,
    isDefault: a.isDefault,
  }));

  return <AddressesClient initialAddresses={serialized} />;
}
