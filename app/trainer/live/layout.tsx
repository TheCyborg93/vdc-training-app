import Link from "next/link";
import LiveAttendanceDock from "@/components/trainer/LiveAttendanceDock";
import LiveGroupingDock from "@/components/trainer/LiveGroupingDock";
import "../../vdc-phase6-live.css";
import "../../vdc-phase6-board-management.css";
import "../../vdc-phase6-attendance.css";
import "../../vdc-phase6-grouping.css";

export default function TrainerLiveLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Link className="phase6-coach-shortcut" href="/trainer/live/coach">Coach View</Link>
      <LiveGroupingDock />
      <LiveAttendanceDock />
    </>
  );
}
