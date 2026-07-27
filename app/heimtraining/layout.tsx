import HomeActivityPanel from "@/components/home-training/HomeActivityPanel";
import HomeHistoryPanel from "@/components/home-training/HomeHistoryPanel";
import HomeMilestonesPanel from "@/components/home-training/HomeMilestonesPanel";
import "../vdc-phase5-home-activity.css";
import "../vdc-phase5-home-history.css";
import "../vdc-phase5-home-milestones.css";

export default function HomeTrainingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <HomeActivityPanel />
      <HomeHistoryPanel />
      <HomeMilestonesPanel />
    </>
  );
}
