"use client";

import { useState } from "react";
import { Home, Receipt, Menu, Hand } from "lucide-react";

interface SidebarProps {
  userEmail: string;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  onExpandChange?: (isExpanded: boolean) => void;
}

export default function Sidebar({
  userEmail,
  currentPage,
  onNavigate,
  onLogout,
  onExpandChange,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleToggleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    onExpandChange?.(newExpandedState);
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "transactions", label: "Transactions & Vouchers", icon: Receipt },
  ];

  // Get user initials for avatar
  const getInitials = (email: string) => {
    const name = email.split("@")[0];
    return name.substring(0, 1).toUpperCase();
  };

  return (
    <>
      <div
        style={{
          width: isExpanded ? "280px" : "80px",
          height: "100vh",
          background: "#1f1f1f",
          position: "fixed",
          left: 0,
          top: 0,
          display: "flex",
          flexDirection: "column",
          transition: "width 0.3s ease",
          zIndex: 1000,
        }}
      >
        {/* Logo Section */}
        <div
          style={{
            padding: isExpanded ? "24px 20px" : "24px 16px",
            borderBottom: "1px solid #2d2d2d",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {isExpanded && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flex: 1,
                minWidth: 0,
              }}
            >
              {/* Flip Logo */}
              <img
                src="https://framerusercontent.com/images/ZycDnV7cvhrZMV3Smrx4wZtWk.png"
                alt="Flip Logo"
                style={{
                  width: "40px",
                  height: "40px",
                  flexShrink: 0,
                  objectFit: "contain",
                }}
              />
              <span
                style={{
                  color: "white",
                  fontSize: "18px",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                }}
              >
                Flip Jajan
              </span>
            </div>
          )}

          {/* Collapse/Expand Button */}
          <button
            onClick={handleToggleExpand}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: "#2d2d2d",
              border: "none",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#3d3d3d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#2d2d2d";
            }}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Menu Items */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isExpanded ? "16px 20px" : "16px 12px",
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: "100%",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: currentPage === item.id ? "#fd6442" : "transparent",
                border: "none",
                borderRadius: "16px",
                marginBottom: "8px",
                cursor: "pointer",
                transition: "background 0.2s ease",
                color: "white",
                fontSize: "15px",
                fontWeight: "500",
                justifyContent: isExpanded ? "flex-start" : "center",
              }}
              onMouseEnter={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.background = "#2d2d2d";
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <item.icon size={22} style={{ flexShrink: 0 }} />
              {isExpanded && (
                <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
              )}
            </button>
          ))}
        </div>

        {/* Profile Section */}
        <div
          style={{
            borderTop: "1px solid #2d2d2d",
            padding: isExpanded ? "20px" : "20px 12px",
          }}
        >
          <div
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
              padding: "12px",
              borderRadius: "12px",
              transition: "background 0.2s ease",
              justifyContent: isExpanded ? "flex-start" : "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#2d2d2d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "14px",
                flexShrink: 0,
              }}
            >
              {getInitials(userEmail)}
            </div>
            {isExpanded && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: "#9ca3af",
                    fontSize: "11px",
                    marginBottom: "2px",
                  }}
                >
                  Super admin
                </div>
                <div
                  style={{
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "600",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {userEmail.split("@")[0]}
                </div>
              </div>
            )}
            {isExpanded && (
              <div
                style={{ color: "#9ca3af", fontSize: "18px", flexShrink: 0 }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          onClick={() => setShowLogoutConfirm(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "16px",
                }}
              >
                <Hand size={48} strokeWidth={1.5} />
              </div>
              <h3
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#1f2937",
                  marginBottom: "8px",
                }}
              >
                Logout Confirmation
              </h3>
              <p style={{ color: "#6b7280", fontSize: "14px" }}>
                Are you sure you want to logout?
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  background: "white",
                  color: "#374151",
                  border: "2px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                style={{
                  flex: 1,
                  padding: "12px 24px",
                  background:
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(239, 68, 68, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
