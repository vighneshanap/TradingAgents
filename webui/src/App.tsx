import { Route, Routes, Navigate } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import HomePage from "@/pages/Home";
import NewRunPage from "@/pages/NewRun";
import RunsListPage from "@/pages/RunsList";
import RunViewerPage from "@/pages/RunViewer";
import MemoryListPage from "@/pages/MemoryList";
import MemoryTickerPage from "@/pages/MemoryTicker";
import SettingsPage from "@/pages/Settings";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/runs/new" element={<NewRunPage />} />
        <Route path="/runs" element={<RunsListPage />} />
        <Route path="/runs/:id/*" element={<RunViewerPage />} />
        <Route path="/memory" element={<MemoryListPage />} />
        <Route path="/memory/:ticker" element={<MemoryTickerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
