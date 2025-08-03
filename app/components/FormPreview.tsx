interface FormPreviewProps {
  formBgColor: string;
  formTextColor: string;
  formButtonColor: string;
  buttonBorderRadius: number;
  textSize: number;
  phoneNumberEnabled: boolean;
  formTitle: string;
  formDescription: string;
  formButtonText: string;
}

export function FormPreview({ 
  formBgColor,
  formTextColor,
  formButtonColor,
  buttonBorderRadius,
  textSize,
  phoneNumberEnabled,
  formTitle,
  formDescription,
  formButtonText
}: FormPreviewProps) {
  return (
    <div style={{ 
      position: "relative",
      border: "1px solid #e1e1e1",
      borderRadius: "8px",
      overflow: "hidden",
      backgroundColor: "#f9f9f9",
      padding: "10px",
    }}>
      <div
        style={{
          backgroundColor: formBgColor,
          padding: "24px",
          borderRadius: "8px",
          maxWidth: "400px",
          margin: "0 auto",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <h3 style={{ 
          color: formTextColor, 
          fontSize: `${textSize}px`,
          marginBottom: "8px",
          fontWeight: "600",
          margin: "0 0 8px 0"
        }}>
          {formTitle}
        </h3>
        <p style={{ 
          color: formTextColor, 
          fontSize: `${textSize - 2}px`,
          marginBottom: "16px",
          margin: "0 0 16px 0"
        }}>
          {formDescription}
        </p>
        
        <div style={{ marginBottom: "12px" }}>
          <input
            type="email"
            placeholder="Enter your email"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: `${textSize - 2}px`,
            }}
          />
        </div>
        
        {phoneNumberEnabled && (
          <div style={{ marginBottom: "12px" }}>
            <input
              type="tel"
              placeholder="Phone number (optional)"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: `${textSize - 2}px`,
              }}
            />
          </div>
        )}
        
        <button
          style={{
            backgroundColor: formButtonColor,
            color: "#ffffff",
            borderRadius: `${buttonBorderRadius}px`,
            fontSize: `${textSize}px`,
            padding: "10px 20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "500",
            width: "100%",
          }}
        >
          {formButtonText}
        </button>
      </div>
    </div>
  );
}