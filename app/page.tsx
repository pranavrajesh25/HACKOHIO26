import { Suspense } from "react";
import TestDrive from "./components/app";
export default function Home() {
  return <Suspense fallback={<div className="loading-state">Loading your next small beginning…</div>}><TestDrive /></Suspense>;
}
