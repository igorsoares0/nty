import { ColorPicker, Popover, TextField, Text, InlineStack } from "@shopify/polaris";
import { useState } from "react";
import { hexToHsb, hsbToHex, formatHexColor } from "../utils/color-utils";

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
}

export function ColorPickerField({ 
  label, 
  value, 
  onChange, 
  placeholder = "#000000",
  name 
}: ColorPickerFieldProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div>
      <Text variant="bodyMd" as="label">
        {label}
      </Text>
      <div style={{ marginTop: "8px" }}>
        <InlineStack gap="300" align="start">
          <Popover
            active={showColorPicker}
            activator={
              <div
                onClick={() => setShowColorPicker(!showColorPicker)}
                style={{
                  width: "32px",
                  height: "32px",
                  backgroundColor: value,
                  border: "1px solid #c9cccf",
                  borderRadius: "4px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              />
            }
            onClose={() => setShowColorPicker(false)}
          >
            <div style={{ padding: "16px", width: "200px" }}>
              <ColorPicker
                color={hexToHsb(value)}
                onChange={(color) => {
                  const hex = hsbToHex(color);
                  onChange(hex);
                }}
                allowAlpha={false}
              />
            </div>
          </Popover>
          <div style={{ flex: 1 }}>
            <TextField
              label=""
              value={value}
              onChange={(newValue) => onChange(formatHexColor(newValue))}
              placeholder={placeholder}
              autoComplete="off"
            />
          </div>
        </InlineStack>
        {name && <input type="hidden" name={name} value={value} />}
      </div>
    </div>
  );
}