import LiveAttendanceDock from "@/components/trainer/LiveAttendanceDock";
import "../../vdc-phase6-live.css";
import "../../vdc-phase6-board-management.css";
import "../../vdc-phase6-attendance.css";

export default function TrainerLiveLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <LiveAttendanceDock />
    </>
  );
}
