import HomeActivityPanel from "@/components/home-training/HomeActivityPanel";
import "../vdc-phase5-home-activity.css";

export default function HomeTrainingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <HomeActivityPanel />
    </>
  );
}
