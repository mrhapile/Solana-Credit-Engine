import { BorrowActions } from "@/components/borrow-actions";
import { HomeBorowHead } from "@/components/borrow-head";
import CardContainer from "@/components/card-container";

type PageProps = {
  searchParams: Promise<{
    vaultId?: string;
    positionId?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { vaultId, positionId } = await searchParams;

  const parsedVaultId = vaultId ? Number(vaultId) : 1;
  const parsedPositionId = positionId ? Number(positionId) : 330;

  if (Number.isNaN(parsedVaultId) || Number.isNaN(parsedPositionId)) {
    // This handles the edge case where params exist but are not numbers
    // But defaults (1, 330) are used if params are missing entirely.
    throw new Error("Invalid URL parameters");
  }

  return (
    <section className="mx-auto flex w-full max-w-full flex-1 flex-col gap-4 pt-12.5 md:py-10 lg:gap-8 xl:max-w-7xl">
      <div className="flex flex-col gap-4 px-2 pt-2 sm:gap-6 sm:px-4 sm:pt-4">
        <HomeBorowHead />
        <CardContainer
          vaultId={parsedVaultId}
          positionId={parsedPositionId}
        />
        <BorrowActions />
      </div>
    </section>
  );
}
