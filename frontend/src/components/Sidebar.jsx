import React from "react";
import { useAuth } from "./AuthContext";

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  const tabs = [
    { id: "policy", label: "Policy Summary" },
    { id: "fraud", label: "Fraud Detection" },
    { id: "doc", label: "Document Classification" }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-circle">AI</div>
        <div>
          <h2>ClaimAxis</h2>
          <p className="tenant-name">{user?.tenant?.name || "Tenant"}</p>
        </div>
      </div>

      <div className="sidebar-menu">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-item ${
              activeTab === tab.id ? "active" : ""
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="avatar-circle">
            {user?.full_name?.[0]?.toUpperCase() ||
              user?.email?.[0]?.toUpperCase() ||
              "U"}
          </div>
          <div>
            <p className="user-name">{user?.full_name || user?.email}</p>
            <p className="user-email">{user?.email}</p>
          </div>
        </div>
        <button className="secondary-btn full-width" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
