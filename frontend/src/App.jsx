import React from "react";
import { AuthProvider, useAuth } from "./components/AuthContext";
import AuthPage from "./components/AuthPage";
import DashboardLayout from "./components/DashboardLayout";

const AppContent = () => {
  const { token, loadingUser } = useAuth();

  if (loadingUser) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading your workspace...</p>
      </div>
    );
  }

  if (!token) {
    return <AuthPage />;
  }

  return <DashboardLayout />;
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
