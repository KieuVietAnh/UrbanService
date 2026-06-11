// src/guards/RoleGuard.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const RoleGuard = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base-300">
        <span className="loading loading-ring loading-lg text-primary"></span>
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    // If unauthorized, redirect to standard dashboard fallback
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
