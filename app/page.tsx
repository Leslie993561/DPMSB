import { PortalDpResumo } from "@/components/modules/home/PortalDpResumo";
import { PortalSstResumo } from "@/components/modules/home/PortalSstResumo";
import { PortalDhoResumo } from "@/components/modules/home/PortalDhoResumo";

export default function Home() {
  return (
    <div className="flex flex-col gap-3">
      <PortalDpResumo />
      <PortalSstResumo />
      <PortalDhoResumo />
    </div>
  );
}
