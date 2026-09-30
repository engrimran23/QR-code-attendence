const variants = {
  primary: {
    background: "linear-gradient(135deg, #1a6fc4 0%, #1F4E79 100%)",
    color: "#fff",
    boxShadow: "0 3px 10px rgba(31,78,121,0.45)",
    border: "none",
  },
  green: {
    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    color: "#fff",
    boxShadow: "0 3px 10px rgba(34,197,94,0.45)",
    border: "none",
  },
  orange: {
    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    color: "#fff",
    boxShadow: "0 3px 10px rgba(249,115,22,0.45)",
    border: "none",
  },
  red: {
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "#fff",
    boxShadow: "0 3px 10px rgba(239,68,68,0.45)",
    border: "none",
  },
  ghost: {
    background: "#F3F4F6",
    color: "#374151",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: "1px solid #E5E7EB",
  },
  download: {
    background: "linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)",
    color: "#fff",
    boxShadow: "0 3px 12px rgba(6,182,212,0.5)",
    border: "none",
  },
  print: {
    background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
    color: "#fff",
    boxShadow: "0 3px 12px rgba(168,85,247,0.5)",
    border: "none",
  },
};

export default function Btn({ children, onClick, variant = "primary", size = "md", disabled, type = "button", style: extra }) {
  const v = variants[variant] || variants.primary;
  const pad = size === "sm" ? "6px 14px" : size === "lg" ? "12px 28px" : "8px 18px";
  const fs  = size === "sm" ? 12 : size === "lg" ? 15 : 13;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...v,
        borderRadius: 8,
        padding: pad,
        fontSize: fs,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        letterSpacing: "0.02em",
        transition: "transform 0.1s, box-shadow 0.1s",
        ...extra,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
    >{children}</button>
  );
}
