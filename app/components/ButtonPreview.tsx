interface ButtonPreviewProps {
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  textSize: number;
  textContent: string;
}

export function ButtonPreview({ 
  backgroundColor, 
  textColor, 
  borderRadius, 
  textSize, 
  textContent 
}: ButtonPreviewProps) {
  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <button
        style={{
          backgroundColor,
          color: textColor,
          borderRadius: `${borderRadius}px`,
          fontSize: `${textSize}px`,
          padding: "12px 24px",
          border: "none",
          cursor: "pointer",
          fontWeight: "500",
        }}
      >
        {textContent}
      </button>
    </div>
  );
}