import HomeActivityPanel from "@/components/home-training/HomeActivityPanel";
import HomeHistoryPanel from "@/components/home-training/HomeHistoryPanel";
import "../vdc-phase5-home-activity.css";
import "../vdc-phase5-home-history.css";

export default function HomeTrainingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <HomeActivityPanel />
      <HomeHistoryPanel />
    </>
  );
}
