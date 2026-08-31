import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, sessionExpired } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location, expired: sessionExpired }} />;
  }

  return <Outlet />;
}
