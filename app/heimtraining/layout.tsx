import HomeActivityPanel from "@/components/home-training/HomeActivityPanel";
import HomeHistoryPanel from "@/components/home-training/HomeHistoryPanel";
import HomeMilestonesPanel from "@/components/home-training/HomeMilestonesPanel";
import HomeTrendsPanel from "@/components/home-training/HomeTrendsPanel";
import "../vdc-phase5-home-activity.css";
import "../vdc-phase5-home-history.css";
import "../vdc-phase5-home-milestones.css";
import "../vdc-phase5-home-trends.css";

export default function HomeTrainingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <HomeActivityPanel />
      <HomeHistoryPanel />
      <HomeMilestonesPanel />
      <HomeTrendsPanel />
    </>
  );
}
