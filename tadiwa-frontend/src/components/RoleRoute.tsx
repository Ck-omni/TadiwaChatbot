import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../lib/api';

// Blocks direct navigation to a route the current user's role can't use —
// the sidebar already hides these links, but a typed-in URL or a stale
// bookmark should redirect home rather than render the page and let the
// backend's own 403 surface as a confusing in-page error.
export default function RoleRoute({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
