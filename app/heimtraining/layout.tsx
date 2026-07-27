import HomeQuickstartPanel from "@/components/home-training/HomeQuickstartPanel";
import HomeGoalsPanel from "@/components/home-training/HomeGoalsPanel";
import HomePlanLibrary from "@/components/home-training/HomePlanLibrary";
import HomeActivityPanel from "@/components/home-training/HomeActivityPanel";
import HomeHistoryPanel from "@/components/home-training/HomeHistoryPanel";
import HomeMilestonesPanel from "@/components/home-training/HomeMilestonesPanel";
import HomeTrendsPanel from "@/components/home-training/HomeTrendsPanel";
import { HomeInsightsProvider } from "@/components/home-training/HomeInsightsProvider";
import "../vdc-phase5-home-quickstart.css";
import "../vdc-phase5-home-goals.css";
import "../vdc-phase5-home-library.css";
import "../vdc-phase5-home-activity.css";
import "../vdc-phase5-home-history.css";
import "../vdc-phase5-home-milestones.css";
import "../vdc-phase5-home-trends.css";

export default function HomeTrainingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <HomeInsightsProvider>
      {children}
      <HomeQuickstartPanel />
      <HomeGoalsPanel />
      <HomePlanLibrary />
      <HomeActivityPanel />
      <HomeHistoryPanel />
      <HomeMilestonesPanel />
      <HomeTrendsPanel />
    </HomeInsightsProvider>
  );
}
