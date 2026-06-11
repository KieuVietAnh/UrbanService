// src/guards/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base-300">
        <span className="loading loading-ring loading-lg text-primary"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but keep current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
