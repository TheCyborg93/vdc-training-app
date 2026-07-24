import type { ReactNode } from "react";
import styles from "./uebungen.module.css";

export default function ExercisesLayout({ children }: { children: ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
