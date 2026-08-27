/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import TechHub from './pages/TechHub';
import Schedule from './pages/Schedule';
import Productivity from './pages/Productivity';
import History from './pages/History';
import Settings from './pages/Settings';
import HelpCenter from './pages/HelpCenter';
import TeamComms from './pages/TeamComms';
import AuditLog from './pages/AuditLog';
import TicketSamples from './pages/TicketSamples';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="relative w-full h-full overflow-hidden">
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<TechHub />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="productivity" element={<Productivity />} />
                <Route path="history" element={<History />} />
                <Route path="settings" element={<Settings />} />
                <Route path="support" element={<HelpCenter />} />
                <Route path="teamComms" element={<TeamComms />} />
                <Route path="auditLog" element={<AuditLog />} />
                <Route path='ticketSamples' element={<TicketSamples />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
