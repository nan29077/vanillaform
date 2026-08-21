import VanillaLoader from "@/components/shared/VanillaLoader";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <VanillaLoader size={96} />
    </div>
  );
}

