import React, { useState } from "react";
import Sidebar from "./Sidebar";
import PolicySummary from "./PolicySummary";
import FraudDetection from "./FraudDetection";
import DocClassification from "./DocClassification";

const DashboardLayout = () => {
  const [activeTab, setActiveTab] = useState("doc"); // focus on doc by default

  const renderContent = () => {
    switch (activeTab) {
      case "policy":
        return <PolicySummary />;
      case "fraud":
        return <FraudDetection />;
      case "doc":
        return <DocClassification />;
      default:
        return <DocClassification />;
    }
  };

  return (
    <div className="dashboard">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">{renderContent()}</main>
    </div>
  );
};

export default DashboardLayout;
