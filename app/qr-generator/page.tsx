"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  readLogo,
  renderQr,
  svgToPngBlob,
  type DotStyle,
  type RenderResult,
} from "./qr-render";

const ACCENT = "#00C896";
const ACCENT_BRIGHT = "#00E0A8";

const COLORS = {
  bg: "#060908",
  surface: "#0C1110",
  surface2: "#101615",
  surface3: "#141B19",
  border: "#1D2724",
  borderLight: "#293530",
  text: "#F3F7F5",
  muted: "#82908B",
  dim: "#53605C",
} as const;

type QRType = "URL" | "Text" | "Email" | "Phone" | "WiFi";
type ECCLevel = "L" | "M" | "Q" | "H";
type DownloadFormat = "png" | "svg";

interface HistoryItem {
  id: string;
  createdAt: number;
  type: QRType;
  fields: QRFields;
  fg: string;
  bg: string;
  ecc: ECCLevel;
  size: number;
  dotStyle: DotStyle;
  title: string;
  titleScale: number;
  logo: string | null;
  logoScale: number;
  logoPlate: boolean;
}

const HISTORY_KEY = "qr-studio-history-v1";
const AUTOSAVE_KEY = "qr-studio-autosave-v1";
const MAX_HISTORY = 30;
const MAX_TITLE = 60;

const DOT_STYLES: Array<{ id: DotStyle; label: string }> = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
];

interface QRFields {
  url: string;
  text: string;
  email: string;
  subject: string;
  body: string;
  phone: string;
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "None";
}

interface Preset {
  name: string;
  fg: string;
  bg: string;
}

const QR_TYPES: Array<{
  id: QRType;
  label: string;
  description: string;
  icon: "link" | "text" | "mail" | "phone" | "wifi";
}> = [
  {
    id: "URL",
    label: "Website",
    description: "Website or landing page",
    icon: "link",
  },
  {
    id: "Text",
    label: "Text",
    description: "Plain text content",
    icon: "text",
  },
  {
    id: "Email",
    label: "Email",
    description: "Email with subject",
    icon: "mail",
  },
  {
    id: "Phone",
    label: "Phone",
    description: "Phone number",
    icon: "phone",
  },
  {
    id: "WiFi",
    label: "WiFi",
    description: "Network credentials",
    icon: "wifi",
  },
];

const PRESETS: Preset[] = [
  { name: "Classic", fg: "#000000", bg: "#FFFFFF" },
  { name: "Night", fg: "#FFFFFF", bg: "#101116" },
  { name: "Mint", fg: "#065F46", bg: "#ECFDF5" },
  { name: "Ocean", fg: "#1E3A8A", bg: "#EFF6FF" },
  { name: "Amber", fg: "#78350F", bg: "#FFFBEB" },
  { name: "Rose", fg: "#9F1239", bg: "#FFF1F2" },
  { name: "Violet", fg: "#4C1D95", bg: "#F5F3FF" },
  { name: "Slate", fg: "#0F172A", bg: "#F8FAFC" },
];

const ECC_LEVELS: Record<
  ECCLevel,
  {
    name: string;
    recovery: string;
    description: string;
  }
> = {
  L: {
    name: "Low",
    recovery: "7%",
    description: "Smallest QR",
  },
  M: {
    name: "Medium",
    recovery: "15%",
    description: "Recommended",
  },
  Q: {
    name: "High",
    recovery: "25%",
    description: "More damage resistant",
  },
  H: {
    name: "Maximum",
    recovery: "30%",
    description: "Print & logos",
  },
};

const MAX_TEXT = 1200;

function emptyFields(): QRFields {
  return {
    url: "",
    text: "",
    email: "",
    subject: "",
    body: "",
    phone: "",
    ssid: "",
    password: "",
    security: "WPA",
  };
}

function buildQRData(type: QRType, fields: QRFields): string {
  switch (type) {
    case "URL":
      return fields.url.trim();

    case "Text":
      return fields.text.trim();

    case "Phone": {
      const phone = fields.phone.trim();
      return phone ? `tel:${phone}` : "";
    }

    case "Email": {
      const email = fields.email.trim();

      if (!email) return "";

      const query: string[] = [];

      if (fields.subject.trim()) {
        query.push(`subject=${encodeURIComponent(fields.subject.trim())}`);
      }

      if (fields.body.trim()) {
        query.push(`body=${encodeURIComponent(fields.body.trim())}`);
      }

      return `mailto:${email}${query.length ? `?${query.join("&")}` : ""}`;
    }

    case "WiFi": {
      const ssid = fields.ssid.trim();

      if (!ssid) return "";

      const security = fields.security || "WPA";

      return `WIFI:T:${security};S:${escapeWifi(ssid)};P:${escapeWifi(
        fields.password,
      )};;`;
    }

    default:
      return "";
  }
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,":])/g, "\\$1");
}

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidURL(value: string): boolean {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
}: {
  name:
    | "link"
    | "text"
    | "mail"
    | "phone"
    | "wifi"
    | "check"
    | "download"
    | "copy"
    | "sparkles"
    | "bolt"
    | "shield"
    | "printer"
    | "arrow"
    | "external"
    | "refresh"
    | "qr"
    | "chevron"
    | "upload"
    | "trash"
    | "history"
    | "image"
    | "save"
    | "close";
  size?: number;
  strokeWidth?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<string, ReactNode> = {
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" />
        <path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 7 20l1.15-1.15" />
      </>
    ),
    text: (
      <>
        <path d="M5 5h14" />
        <path d="M12 5v14" />
        <path d="M8 19h8" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    phone: (
      <path d="M7 3h3l2 5-2 1.5a15 15 0 0 0 4.5 4.5L16 12l5 2v3a3 3 0 0 1-3 3C10.27 20 4 13.73 4 6a3 3 0 0 1 3-3Z" />
    ),
    wifi: (
      <>
        <path d="M5 12.5a11 11 0 0 1 14 0" />
        <path d="M8 15.5a6.5 6.5 0 0 1 8 0" />
        <path d="M11 18.5a2 2 0 0 1 2 0" />
        <circle cx="12" cy="20" r=".5" fill="currentColor" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3Z" />
        <path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8 9-13h-7l1-7Z" />,
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6l8-3Z" />
        <path d="m8.5 12 2.3 2.3 4.7-5" />
      </>
    ),
    printer: (
      <>
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    external: (
      <>
        <path d="M14 5h5v5" />
        <path d="M10 14 19 5" />
        <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 1 0 1 5" />
        <path d="M20 5v6h-6" />
      </>
    ),
    qr: (
      <>
        <path d="M4 4h6v6H4z" />
        <path d="M14 4h6v6h-6z" />
        <path d="M4 14h6v6H4z" />
        <path d="M14 14h2v2h-2z" />
        <path d="M18 14h2v6h-2z" />
        <path d="M14 18h2v2h-2z" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="m6 7 1 13h10l1-13" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="m4 18 5-5 4 4 3-3 4 4" />
      </>
    ),
    save: (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M8 4v5h7V4" />
        <path d="M8 20v-6h8v6" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function QRLogo({
  size = 30,
  accent = ACCENT,
}: {
  size?: number;
  accent?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="11" height="11" rx="2.5" fill={accent} />
      <rect x="5" y="5" width="5" height="5" rx="1" fill="#07100D" />

      <rect x="19" y="2" width="11" height="11" rx="2.5" fill={accent} />
      <rect x="22" y="5" width="5" height="5" rx="1" fill="#07100D" />

      <rect x="2" y="19" width="11" height="11" rx="2.5" fill={accent} />
      <rect x="5" y="22" width="5" height="5" rx="1" fill="#07100D" />

      <rect x="19" y="19" width="4" height="4" rx="1" fill={accent} />
      <rect x="26" y="19" width="4" height="4" rx="1" fill={accent} />
      <rect x="19" y="26" width="4" height="4" rx="1" fill={accent} />
      <rect x="25" y="25" width="5" height="5" rx="1" fill={accent} />
    </svg>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`premium-panel ${className}`}>{children}</section>;
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field-label">
      {children}
      {required && <span className="required">*</span>}
    </label>
  );
}

function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`premium-input ${className}`} {...props} />;
}

function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`premium-input ${className}`} {...props} />;
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

function SectionHeader({
  number,
  eyebrow,
  title,
  description,
  badge,
}: {
  number?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div className="section-heading">
        {(number || eyebrow) && (
          <div className="section-eyebrow">
            {number && <span className="section-number">{number}</span>}
            {eyebrow}
          </div>
        )}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {badge}
    </div>
  );
}

function TypeSelector({
  value,
  onChange,
}: {
  value: QRType;
  onChange: (value: QRType) => void;
}) {
  return (
    <Panel className="type-panel">
      <div className="type-topline">
        <div>
          <span className="micro-label">CREATE</span>
          <h2>Choose a format</h2>
        </div>

        <span className="format-count">05 FORMATS</span>
      </div>

      <div className="type-grid">
        {QR_TYPES.map((item) => {
          const active = value === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`type-button ${active ? "active" : ""}`}
              onClick={() => onChange(item.id)}
              aria-pressed={active}
            >
              {active && <span className="active-dot" />}

              <span className="type-icon">
                <Icon name={item.icon} size={18} />
              </span>

              <span className="type-label">{item.label}</span>
              <span className="type-short">{item.id}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function URLForm({
  fields,
  onChange,
  invalid,
}: {
  fields: QRFields;
  onChange: (fields: QRFields) => void;
  invalid: boolean;
}) {
  return (
    <FormField label="Website URL" required>
      <Input
        type="url"
        autoFocus
        inputMode="url"
        autoComplete="url"
        placeholder="https://yourwebsite.com"
        value={fields.url}
        aria-invalid={invalid}
        onChange={(e) =>
          onChange({
            ...fields,
            url: e.target.value,
          })
        }
      />

      <div className="field-hint">
        <span className={invalid ? "error-text" : ""}>
          {invalid
            ? "Enter a valid http:// or https:// URL."
            : "Short URLs create cleaner, easier-to-scan QR codes."}
        </span>

        {!invalid && <span>HTTP / HTTPS</span>}
      </div>
    </FormField>
  );
}

function TextForm({
  fields,
  onChange,
}: {
  fields: QRFields;
  onChange: (fields: QRFields) => void;
}) {
  const progress = Math.min((fields.text.length / MAX_TEXT) * 100, 100);

  return (
    <FormField label="Text content" required>
      <Textarea
        autoFocus
        rows={6}
        maxLength={MAX_TEXT}
        placeholder="Write anything you want to encode..."
        value={fields.text}
        onChange={(e) =>
          onChange({
            ...fields,
            text: e.target.value,
          })
        }
      />

      <div className="counter-row">
        <span>Plain text QR</span>
        <span>
          {fields.text.length.toLocaleString()} / {MAX_TEXT}
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </FormField>
  );
}

function PhoneForm({
  fields,
  onChange,
}: {
  fields: QRFields;
  onChange: (fields: QRFields) => void;
}) {
  return (
    <FormField label="Phone number" required>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus
        placeholder="+91 98765 43210"
        value={fields.phone}
        onChange={(e) =>
          onChange({
            ...fields,
            phone: e.target.value,
          })
        }
      />

      <div className="field-hint">
        <span>Scanning opens the device dialer.</span>
        <span>TEL</span>
      </div>
    </FormField>
  );
}

function EmailForm({
  fields,
  onChange,
  invalid,
}: {
  fields: QRFields;
  onChange: (fields: QRFields) => void;
  invalid: boolean;
}) {
  const update =
    (key: keyof QRFields) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({
        ...fields,
        [key]: e.target.value,
      });

  return (
    <>
      <FormField label="Email address" required>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="hello@example.com"
          value={fields.email}
          aria-invalid={invalid}
          onChange={update("email")}
        />

        {invalid && (
          <p className="error-text error-message">
            Please enter a valid email address.
          </p>
        )}
      </FormField>

      <FormField label="Subject">
        <Input
          type="text"
          placeholder="Optional subject"
          value={fields.subject}
          onChange={update("subject")}
        />
      </FormField>

      <FormField label="Message">
        <Textarea
          rows={4}
          placeholder="Optional email message"
          value={fields.body}
          onChange={update("body")}
          className="resize-none"
        />
      </FormField>
    </>
  );
}

function WiFiForm({
  fields,
  onChange,
}: {
  fields: QRFields;
  onChange: (fields: QRFields) => void;
}) {
  const update = (key: keyof QRFields) => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({
      ...fields,
      [key]: e.target.value,
    });

  return (
    <>
      <FormField label="Network name" required>
        <Input
          type="text"
          autoFocus
          autoComplete="off"
          placeholder="My WiFi Network"
          value={fields.ssid}
          onChange={update("ssid")}
        />
      </FormField>

      <FormField label="Password">
        <Input
          type="text"
          autoComplete="off"
          placeholder="WiFi password"
          value={fields.password}
          onChange={update("password")}
        />
      </FormField>

      <FormField label="Security">
        <div className="segmented-control">
          {(["WPA", "WEP", "None"] as const).map((item) => {
            const active = fields.security === item;

            return (
              <button
                key={item}
                type="button"
                className={active ? "active" : ""}
                onClick={() =>
                  onChange({
                    ...fields,
                    security: item,
                  })
                }
                aria-pressed={active}
              >
                {item}
              </button>
            );
          })}
        </div>
      </FormField>
    </>
  );
}

function Customizer({
  fg,
  bg,
  ecc,
  size,
  preset,
  onFgChange,
  onBgChange,
  onEccChange,
  onSizeChange,
  onPresetChange,
}: {
  fg: string;
  bg: string;
  ecc: ECCLevel;
  size: number;
  preset: number;
  onFgChange: (value: string) => void;
  onBgChange: (value: string) => void;
  onEccChange: (value: ECCLevel) => void;
  onSizeChange: (value: number) => void;
  onPresetChange: (value: number) => void;
}) {
  const sliderProgress = ((size - 150) / 850) * 100;

  return (
    <Panel className="customizer-panel">
      <SectionHeader
        number="02"
        eyebrow="APPEARANCE"
        title="Make it yours"
        description="Tune the visual style without compromising scan reliability."
      />

      <div className="custom-section">
        <div className="control-heading">
          <div>
            <span className="control-title">Color theme</span>
            <span className="control-subtitle">Quick presets</span>
          </div>
          <span className="control-meta">8 STYLES</span>
        </div>

        <div className="preset-grid">
          {PRESETS.map((item, index) => {
            const active = preset === index;

            return (
              <button
                key={item.name}
                type="button"
                title={item.name}
                aria-label={`Use ${item.name} theme`}
                aria-pressed={active}
                className={`preset ${active ? "active" : ""}`}
                style={
                  {
                    "--preset-fg": item.fg,
                    "--preset-bg": item.bg,
                  } as CSSProperties
                }
                onClick={() => onPresetChange(index)}
              >
                {active && (
                  <span className="preset-check">
                    <Icon name="check" size={11} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="color-grid">
        <ColorPicker label="QR color" value={fg} onChange={onFgChange} />

        <ColorPicker label="Background" value={bg} onChange={onBgChange} />
      </div>

      <div className="divider" />

      <div className="custom-section">
        <div className="control-heading">
          <div>
            <span className="control-title">Output resolution</span>
            <span className="control-subtitle">Higher is better for print</span>
          </div>

          <span className="value-pill">{size}px</span>
        </div>

        <input
          className="premium-range"
          type="range"
          min="150"
          max="1000"
          step="50"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          style={
            {
              "--range-progress": `${sliderProgress}%`,
            } as CSSProperties
          }
          aria-label="Output resolution"
        />

        <div className="range-labels">
          <span>150 px</span>
          <span>1000 px</span>
        </div>
      </div>

      <div className="custom-section ecc-section">
        <div className="control-heading">
          <div>
            <span className="control-title">Error correction</span>
            <span className="control-subtitle">Protects against damage</span>
          </div>

          <span className="control-meta">
            {ECC_LEVELS[ecc].recovery} RECOVERY
          </span>
        </div>

        <div className="ecc-grid">
          {(Object.keys(ECC_LEVELS) as ECCLevel[]).map((key) => {
            const item = ECC_LEVELS[key];
            const active = ecc === key;

            return (
              <button
                key={key}
                type="button"
                className={`ecc-option ${active ? "active" : ""}`}
                onClick={() => onEccChange(key)}
                aria-pressed={active}
              >
                <span className="ecc-letter">{key}</span>
                <span className="ecc-name">{item.name}</span>
                {active && <span className="ecc-dot" />}
              </button>
            );
          })}
        </div>

        <div className="ecc-tip">
          <Icon name="shield" size={15} />
          <span>{ECC_LEVELS[ecc].description}</span>
        </div>
      </div>
    </Panel>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="color-picker">
      <div className="color-picker-top">
        <span>{label}</span>
        <span className="color-value">{value.toUpperCase()}</span>
      </div>

      <div className="color-picker-bottom">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />

        <div className="color-preview" style={{ background: value }} />

        <span className="color-code">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function QRPreview({
  qrUrl,
  bg,
  size,
  scanning,
  aspect,
}: {
  qrUrl: string | null;
  bg: string;
  size: number;
  scanning: boolean;
  aspect: number;
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [qrUrl]);

  const hasQR = Boolean(qrUrl) && !imageError;
  const displaySize = Math.min(size, 340);

  return (
    <div className={`preview-canvas ${hasQR ? "has-qr" : ""}`}>
      <div className="canvas-grid" />

      <div className="canvas-top-glow" />

      {hasQR && qrUrl ? (
        <div className="preview-content">
          <div
            className="qr-frame"
            style={
              {
                "--qr-bg": bg,
              } as CSSProperties
            }
          >
            <div className="corner corner-tl" />
            <div className="corner corner-tr" />
            <div className="corner corner-bl" />
            <div className="corner corner-br" />

            <div className="qr-image-wrap">
              {scanning && <div className="scan-line" />}

              <img
                key={qrUrl}
                src={qrUrl}
                alt="Generated QR code preview"
                width={displaySize}
                height={Math.round(displaySize * aspect)}
                className="qr-image"
                onError={() => setImageError(true)}
              />
            </div>
          </div>

          <div className="live-badge">
            <span className="live-dot" />
            LIVE PREVIEW
          </div>
        </div>
      ) : (
        <div className="empty-preview">
          <div className="empty-qr">
            <div className="empty-ring" />
            <QRLogo size={58} accent="#394642" />
            <div className="empty-spark">
              <Icon name="sparkles" size={14} />
            </div>
          </div>

          <h3>Your QR appears here</h3>
          <p>
            Choose a format and enter your content to generate a live preview.
          </p>

          <div className="empty-hint">
            <Icon name="bolt" size={13} />
            Updates automatically as you type
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBar({
  content,
  size,
  ecc,
}: {
  content: string;
  size: number;
  ecc: ECCLevel;
}) {
  const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;

  return (
    <div className="status-bar">
      <div className="status-ready">
        <span className="status-pulse" />
        READY
      </div>

      <span className="status-separator">/</span>

      <span className="status-meta">
        {size}px · ECC {ecc}
      </span>

      <span className="status-separator">/</span>

      <span className="status-content" title={content}>
        {preview}
      </span>
    </div>
  );
}

function ActionBar({
  disabled,
  downloading,
  copied,
  saved,
  autoSave,
  onDownloadPng,
  onDownloadSvg,
  onCopyImage,
  onSave,
  onAutoSaveChange,
}: {
  disabled: boolean;
  downloading: boolean;
  copied: boolean;
  saved: boolean;
  autoSave: boolean;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
  onCopyImage: () => void;
  onSave: () => void;
  onAutoSaveChange: (value: boolean) => void;
}) {
  return (
    <>
      <div className="action-area">
        <button
          type="button"
          className="primary-action"
          disabled={disabled || downloading}
          onClick={onDownloadPng}
        >
          <span>
            <Icon name="download" size={16} />
          </span>
          {downloading ? "Preparing file..." : "Download PNG"}
          {!downloading && <Icon name="arrow" size={15} strokeWidth={2} />}
        </button>

        <button
          type="button"
          className="secondary-action"
          disabled={disabled || downloading}
          onClick={onDownloadSvg}
        >
          <Icon name="qr" size={16} />
          SVG
        </button>

        <button
          type="button"
          className={`copy-action ${copied ? "copied" : ""}`}
          disabled={disabled}
          onClick={onCopyImage}
          title="Copy QR image"
          aria-label="Copy QR image"
        >
          <Icon name={copied ? "check" : "copy"} size={17} />
        </button>
      </div>

      <div className="save-row">
        <button
          type="button"
          className={`save-action ${saved ? "saved" : ""}`}
          disabled={disabled}
          onClick={onSave}
        >
          <Icon name={saved ? "check" : "save"} size={15} />
          {saved ? "Saved to history" : "Save to history"}
        </button>

        <label className="autosave-toggle">
          <input
            type="checkbox"
            checked={autoSave}
            onChange={(e) => onAutoSaveChange(e.target.checked)}
          />
          <span className="autosave-box">
            {autoSave && <Icon name="check" size={11} strokeWidth={3} />}
          </span>
          Auto-save on download
        </label>
      </div>
    </>
  );
}

function QualityCard({ ecc }: { ecc: ECCLevel }) {
  return (
    <div className="quality-card">
      <div className="quality-icon">
        <Icon name="sparkles" size={17} />
      </div>

      <div className="quality-copy">
        <div className="quality-title">
          <span>PRO QUALITY</span>
          <span className="quality-line" />
        </div>

        <p>
          ECC <strong>{ecc}</strong> is active. Use High or Maximum for printed
          QR codes and logo overlays.
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: "bolt" | "shield" | "printer";
  title: string;
  text: string;
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">
        <Icon name={icon} size={15} />
      </div>
      <div className="feature-title">{title}</div>
      <div className="feature-text">{text}</div>
    </div>
  );
}

function BrandingPanel({
  dotStyle,
  onDotStyleChange,
  logo,
  logoScale,
  logoPlate,
  logoError,
  onLogoFile,
  onLogoRemove,
  onLogoScaleChange,
  onLogoPlateChange,
  title,
  titleScale,
  onTitleChange,
  onTitleScaleChange,
  ecc,
}: {
  dotStyle: DotStyle;
  onDotStyleChange: (value: DotStyle) => void;
  logo: string | null;
  logoScale: number;
  logoPlate: boolean;
  logoError: string;
  onLogoFile: (file: File) => void;
  onLogoRemove: () => void;
  onLogoScaleChange: (value: number) => void;
  onLogoPlateChange: (value: boolean) => void;
  title: string;
  titleScale: number;
  onTitleChange: (value: string) => void;
  onTitleScaleChange: (value: number) => void;
  ecc: ECCLevel;
}) {
  const logoProgress = ((logoScale - 10) / 20) * 100;
  const titleProgress = ((titleScale - 3) / 7) * 100;

  return (
    <Panel className="branding-panel">
      <SectionHeader
        number="03"
        eyebrow="BRANDING"
        title="Logo, title & style"
        description="Add your logo in the center and a title under the QR."
      />

      <div className="custom-section">
        <div className="control-heading">
          <div>
            <span className="control-title">Logo</span>
            <span className="control-subtitle">Shown in the QR center</span>
          </div>
          {logo && <span className="control-meta">{logoScale}% SIZE</span>}
        </div>

        <div className="logo-row">
          <div className="logo-thumb">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Selected logo" />
            ) : (
              <Icon name="image" size={20} />
            )}
          </div>

          <div className="logo-actions">
            <label className="logo-upload">
              <Icon name="upload" size={15} />
              {logo ? "Change logo" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) onLogoFile(file);
                  e.target.value = "";
                }}
              />
            </label>

            {logo && (
              <button
                type="button"
                className="logo-remove"
                onClick={onLogoRemove}
              >
                <Icon name="trash" size={14} />
                Remove
              </button>
            )}
          </div>
        </div>

        {logoError && <div className="inline-error">{logoError}</div>}

        {logo && (
          <>
            <input
              className="premium-range"
              type="range"
              min="10"
              max="30"
              step="1"
              value={logoScale}
              onChange={(e) => onLogoScaleChange(Number(e.target.value))}
              style={
                { "--range-progress": `${logoProgress}%` } as CSSProperties
              }
              aria-label="Logo size"
            />

            <label className="autosave-toggle plate-toggle">
              <input
                type="checkbox"
                checked={logoPlate}
                onChange={(e) => onLogoPlateChange(e.target.checked)}
              />
              <span className="autosave-box">
                {logoPlate && <Icon name="check" size={11} strokeWidth={3} />}
              </span>
              Background plate behind logo
            </label>

            {ecc !== "H" && ecc !== "Q" && (
              <div className="inline-warning">
                <Icon name="shield" size={14} />
                Use High or Maximum error correction so the QR still scans
                with a logo.
              </div>
            )}
          </>
        )}
      </div>

      <div className="divider" />

      <div className="custom-section">
        <div className="control-heading">
          <div>
            <span className="control-title">Title</span>
            <span className="control-subtitle">Printed below the QR</span>
          </div>
          {title.trim() && (
            <span className="control-meta">
              {title.length}/{MAX_TITLE}
            </span>
          )}
        </div>

        <Input
          type="text"
          maxLength={MAX_TITLE}
          placeholder="e.g. Scan to visit our website"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="QR title"
        />

        {title.trim() && (
          <input
            className="premium-range"
            type="range"
            min="3"
            max="10"
            step="0.5"
            value={titleScale}
            onChange={(e) => onTitleScaleChange(Number(e.target.value))}
            style={
              { "--range-progress": `${titleProgress}%` } as CSSProperties
            }
            aria-label="Title size"
          />
        )}
      </div>

      <div className="divider" />

      <div className="custom-section">
        <div className="control-heading">
          <div>
            <span className="control-title">Dot style</span>
            <span className="control-subtitle">Shape of the QR modules</span>
          </div>
        </div>

        <div className="style-grid">
          {DOT_STYLES.map((item) => {
            const active = dotStyle === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`style-option ${active ? "active" : ""}`}
                aria-pressed={active}
                onClick={() => onDotStyleChange(item.id)}
              >
                <span className={`style-sample sample-${item.id}`}>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function HistoryPanel({
  items,
  notice,
  onLoad,
  onDelete,
  onClear,
}: {
  items: HistoryItem[];
  notice: string;
  onLoad: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  const cards = useMemo(
    () =>
      items.map((item) => {
        const data = buildQRData(item.type, item.fields);
        let thumb: RenderResult | null = null;

        try {
          if (data) {
            thumb = renderQr(data, {
              fg: item.fg,
              bg: item.bg,
              ecc: item.ecc,
              size: 240,
              dotStyle: item.dotStyle,
              title: item.title,
              titleScale: item.titleScale,
              logo: item.logo,
              logoScale: item.logoScale,
              logoPlate: item.logoPlate,
            });
          }
        } catch {
          thumb = null;
        }

        return { item, data, thumb };
      }),
    [items],
  );

  return (
    <section className="premium-panel history-panel p-6">
      <div className="history-head">
        <SectionHeader
          number="04"
          eyebrow="HISTORY"
          title="Saved QR codes"
          description="Stored only in this browser. Click a card to open it again."
        />

        {items.length > 0 && (
          <button
            type="button"
            className={`history-clear ${confirmClear ? "confirm" : ""}`}
            onClick={() => {
              if (confirmClear) {
                onClear();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 3000);
              }
            }}
          >
            <Icon name="trash" size={14} />
            {confirmClear ? "Click again to clear all" : "Clear all"}
          </button>
        )}
      </div>

      {notice && <div className="inline-error history-notice">{notice}</div>}

      {items.length === 0 ? (
        <div className="history-empty">
          <Icon name="history" size={22} />
          <p>No saved QR codes yet.</p>
          <span>Use “Save to history” under the preview.</span>
        </div>
      ) : (
        <div className="history-grid">
          {cards.map(({ item, data, thumb }) => (
            <div key={item.id} className="history-card">
              <button
                type="button"
                className="history-open"
                onClick={() => onLoad(item)}
                title="Open this QR"
              >
                <span className="history-thumb" style={{ background: item.bg }}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.dataUrl} alt="Saved QR preview" />
                  ) : (
                    <Icon name="qr" size={24} />
                  )}
                </span>

                <span className="history-title">
                  {item.title.trim() || data || "Untitled"}
                </span>

                <span className="history-meta">
                  {item.type} · {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </button>

              <button
                type="button"
                className="history-delete"
                onClick={() => onDelete(item.id)}
                aria-label="Delete from history"
                title="Delete"
              >
                <Icon name="close" size={13} strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function QRGenerator() {
  const [type, setType] = useState<QRType>("URL");
  const [fields, setFields] = useState<QRFields>(emptyFields);

  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#FFFFFF");
  const [ecc, setEcc] = useState<ECCLevel>("M");
  const [size, setSize] = useState(500);
  const [preset, setPreset] = useState(0);

  const [content, setContent] = useState("");
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [dotStyle, setDotStyle] = useState<DotStyle>("square");
  const [title, setTitle] = useState("");
  const [titleScale, setTitleScale] = useState(6);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(22);
  const [logoPlate, setLogoPlate] = useState(true);
  const [logoError, setLogoError] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyRef = useRef<HistoryItem[]>([]);
  const [historyNotice, setHistoryNotice] = useState("");
  const [autoSave, setAutoSave] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalid = useMemo(() => {
    if (type === "URL") {
      return Boolean(fields.url) && !isValidURL(fields.url);
    }

    if (type === "Email") {
      return Boolean(fields.email) && !isValidEmail(fields.email);
    }

    return false;
  }, [type, fields]);

  const triggerScan = useCallback(() => {
    setScanning(false);

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    scanTimer.current = setTimeout(() => {
      setScanning(true);

      scanTimer.current = setTimeout(() => {
        setScanning(false);
      }, 750);
    }, 30);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const data = buildQRData(type, fields);
      setContent(data);

      if (data && !invalid) {
        triggerScan();
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [type, fields, invalid, triggerScan]);

  useEffect(() => {
    if (!content || invalid) return;
    triggerScan();
  }, [fg, bg, ecc, size, content, invalid, triggerScan]);

  useEffect(() => {
    return () => {
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }

      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }

      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
    };
  }, []);

  const { qr, qrError } = useMemo<{
    qr: RenderResult | null;
    qrError: string;
  }>(() => {
    if (invalid || !content) return { qr: null, qrError: "" };

    try {
      return {
        qr: renderQr(content, {
          fg,
          bg,
          ecc,
          size,
          dotStyle,
          title,
          titleScale,
          logo,
          logoScale,
          logoPlate,
        }),
        qrError: "",
      };
    } catch {
      return {
        qr: null,
        qrError:
          "This content is too long for the selected error correction level. Shorten it or choose a lower level.",
      };
    }
  }, [
    content,
    invalid,
    fg,
    bg,
    ecc,
    size,
    dotStyle,
    title,
    titleScale,
    logo,
    logoScale,
    logoPlate,
  ]);

  const hasContent = Boolean(content) && !invalid && Boolean(qr);

  const handleTypeChange = useCallback((newType: QRType) => {
    setType(newType);
    setFields(emptyFields());
    setContent("");
    setCopied(false);
    setPreset(0);
  }, []);

  const handlePreset = useCallback((index: number) => {
    const selected = PRESETS[index];

    if (!selected) return;

    setPreset(index);
    setFg(selected.fg);
    setBg(selected.bg);
  }, []);

  // ---------- History ----------
  const commitHistory = useCallback((next: HistoryItem[]) => {
    historyRef.current = next;
    setHistory(next);

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistoryNotice("");
    } catch {
      setHistoryNotice(
        "Browser storage is full. Delete a few saved items (large logos take space).",
      );
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);

        if (raw) {
          const parsed = JSON.parse(raw);

          if (Array.isArray(parsed)) {
            historyRef.current = parsed as HistoryItem[];
            setHistory(parsed as HistoryItem[]);
          }
        }

        setAutoSave(localStorage.getItem(AUTOSAVE_KEY) === "1");
      } catch {
        // Ignore corrupted storage.
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const flashSaved = useCallback(() => {
    setSaved(true);

    if (savedTimer.current) clearTimeout(savedTimer.current);

    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }, []);

  const saveToHistory = useCallback(() => {
    if (!content || invalid) return;

    const snapshot = {
      type,
      fields,
      fg,
      bg,
      ecc,
      size,
      dotStyle,
      title,
      titleScale,
      logo,
      logoScale,
      logoPlate,
    };

    const signature = JSON.stringify(snapshot);

    const rest = historyRef.current.filter((entry) => {
      const { id: _id, createdAt: _createdAt, ...other } = entry;
      void _id;
      void _createdAt;
      return JSON.stringify(other) !== signature;
    });

    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      ...snapshot,
    };

    commitHistory([item, ...rest].slice(0, MAX_HISTORY));

    flashSaved();
  }, [
    content,
    invalid,
    type,
    fields,
    fg,
    bg,
    ecc,
    size,
    dotStyle,
    title,
    titleScale,
    logo,
    logoScale,
    logoPlate,
    flashSaved,
    commitHistory,
  ]);

  const handleLoadHistory = useCallback((item: HistoryItem) => {
    setType(item.type);
    setFields({ ...emptyFields(), ...item.fields });
    setFg(item.fg);
    setBg(item.bg);
    setEcc(item.ecc);
    setSize(item.size);
    setPreset(-1);
    setDotStyle(item.dotStyle);
    setTitle(item.title);
    setTitleScale(item.titleScale);
    setLogo(item.logo);
    setLogoScale(item.logoScale);
    setLogoPlate(item.logoPlate);
    setLogoError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleDeleteHistory = useCallback(
    (id: string) => {
      commitHistory(historyRef.current.filter((entry) => entry.id !== id));
    },
    [commitHistory],
  );

  const handleClearHistory = useCallback(() => {
    commitHistory([]);
  }, [commitHistory]);

  const handleAutoSaveChange = useCallback((value: boolean) => {
    setAutoSave(value);

    try {
      localStorage.setItem(AUTOSAVE_KEY, value ? "1" : "0");
    } catch {
      // Ignore.
    }
  }, []);

  // ---------- Logo ----------
  const handleLogoFile = useCallback(async (file: File) => {
    try {
      const dataUrl = await readLogo(file);

      setLogo(dataUrl);
      setLogoError("");
      setEcc("H");
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Unable to read this image.",
      );
    }
  }, []);

  // ---------- Download / copy ----------
  const handleDownload = useCallback(
    async (format: DownloadFormat) => {
      if (!qr) return;

      setDownloading(true);

      try {
        const blob =
          format === "svg"
            ? new Blob([qr.svg], { type: "image/svg+xml;charset=utf-8" })
            : await svgToPngBlob(qr.svg, qr.width, qr.height);

        const slug = title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40);

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = objectUrl;
        anchor.download = `${slug || `qr-${type.toLowerCase()}`}-${size}px.${format}`;

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        if (autoSave) saveToHistory();
      } catch {
        setLogoError("Download failed. Please try again.");
      } finally {
        setDownloading(false);
      }
    },
    [qr, title, type, size, autoSave, saveToHistory],
  );

  const handleCopyImage = useCallback(async () => {
    if (!qr) return;

    try {
      const blob = await svgToPngBlob(qr.svg, qr.width, qr.height);

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      setCopied(true);

      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }

      copyTimer.current = setTimeout(() => {
        setCopied(false);
      }, 2200);
    } catch {
      setCopied(false);
    }
  }, [qr]);

  return (
    <main className="qr-app">
      <style>{`
        :root {
          --qr-accent: ${ACCENT};
          --qr-accent-bright: ${ACCENT_BRIGHT};
        }

        .qr-app {
          min-height: 100vh;
          color: ${COLORS.text};
          background:
            radial-gradient(
              circle at 50% -10%,
              rgba(0, 200, 150, .115),
              transparent 31rem
            ),
            radial-gradient(
              circle at 95% 40%,
              rgba(0, 200, 150, .045),
              transparent 26rem
            ),
            ${COLORS.bg};
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .qr-app *,
        .qr-app *::before,
        .qr-app *::after {
          box-sizing: border-box;
        }

        .qr-app button,
        .qr-app input,
        .qr-app textarea {
          font: inherit;
        }

        .qr-app button {
          -webkit-tap-highlight-color: transparent;
        }

        .qr-shell {
          width: min(1220px, calc(100% - 32px));
          margin: 0 auto;
        }

        .qr-header {
          padding: 28px 0 24px;
        }

        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .brand-mark {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
          border: 1px solid #293530;
          background:
            linear-gradient(145deg, #151D1A, #0A0F0D);
          box-shadow:
            0 15px 35px rgba(0,0,0,.28),
            inset 0 1px 0 rgba(255,255,255,.04);
        }

        .brand-title-row {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .brand-title {
          margin: 0;
          color: #F4F8F6;
          font-family:
            "DM Mono",
            "SFMono-Regular",
            Consolas,
            monospace;
          font-size: 16px;
          font-weight: 650;
          letter-spacing: -.03em;
        }

        .pro-pill {
          padding: 4px 7px;
          border-radius: 6px;
          color: #03130E;
          background: ${ACCENT};
          font-family:
            "DM Mono",
            monospace;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .12em;
          box-shadow: 0 0 20px rgba(0,200,150,.16);
        }

        .brand-subtitle {
          margin: 4px 0 0;
          color: #5F6C67;
          font-size: 11px;
        }

        .system-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid #1D2724;
          border-radius: 11px;
          background: rgba(12,17,16,.78);
          color: #68756F;
          font-family: "DM Mono", monospace;
          font-size: 9px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .system-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 10px ${ACCENT};
        }

        .workspace {
          display: grid;
          grid-template-columns: 410px minmax(0, 1fr);
          gap: 16px;
          align-items: start;
        }

        .left-column,
        .right-column {
          min-width: 0;
        }

        .right-column {
          position: sticky;
          top: 18px;
        }

        .premium-panel {
          overflow: hidden;
          border: 1px solid ${COLORS.border};
          border-radius: 20px;
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,.035),
              rgba(255,255,255,.008)
            ),
            ${COLORS.surface};
          box-shadow:
            0 1px 1px rgba(0,0,0,.35),
            0 20px 65px rgba(0,0,0,.18);
        }

        .type-panel {
          padding: 14px;
          margin-bottom: 12px;
        }

        .type-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 3px 4px 12px;
        }

        .micro-label,
        .format-count,
        .section-eyebrow,
        .control-meta,
        .field-label,
        .quality-title,
        .status-bar,
        .color-value,
        .range-labels,
        .color-code {
          font-family:
            "DM Mono",
            "SFMono-Regular",
            Consolas,
            monospace;
        }

        .micro-label {
          display: block;
          margin-bottom: 3px;
          color: #56625E;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: .17em;
        }

        .type-topline h2 {
          margin: 0;
          color: #D8E0DD;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: -.015em;
        }

        .format-count {
          color: #3F4A46;
          font-size: 8px;
          letter-spacing: .1em;
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }

        .type-button {
          position: relative;
          min-height: 78px;
          padding: 10px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid #1D2724;
          border-radius: 13px;
          background: #0A0F0E;
          color: #66736E;
          cursor: pointer;
          transition:
            transform .18s ease,
            border-color .18s ease,
            background .18s ease,
            color .18s ease,
            box-shadow .18s ease;
        }

        .type-button:hover {
          transform: translateY(-1px);
          border-color: #34403B;
          color: #C5CECA;
          background: #0E1412;
        }

        .type-button.active {
          border-color: #33443E;
          background:
            linear-gradient(
              145deg,
              rgba(0,200,150,.075),
              rgba(255,255,255,.018)
            ),
            #111816;
          color: #F1F6F4;
          box-shadow:
            inset 0 0 0 1px rgba(0,200,150,.055),
            0 8px 24px rgba(0,0,0,.16);
        }

        .active-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 10px ${ACCENT};
        }

        .type-icon {
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: rgba(255,255,255,.025);
        }

        .type-button.active .type-icon {
          color: ${ACCENT};
          background: rgba(0,200,150,.085);
        }

        .type-label {
          font-size: 9px;
          font-weight: 650;
        }

        .type-short {
          color: #414C48;
          font-family: "DM Mono", monospace;
          font-size: 7px;
          letter-spacing: .08em;
        }

        .type-button.active .type-short {
          color: #668278;
        }

        .content-panel {
          padding: 18px;
          margin-bottom: 12px;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .section-heading {
          min-width: 0;
        }

        .section-eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 5px;
          color: #56635E;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: .14em;
        }

        .section-number {
          color: ${ACCENT};
        }

        .section-heading h2 {
          margin: 0;
          color: #EAF0ED;
          font-size: 16px;
          font-weight: 680;
          letter-spacing: -.025em;
        }

        .section-heading p {
          max-width: 310px;
          margin: 5px 0 0;
          color: #68756F;
          font-size: 11px;
          line-height: 1.55;
        }

        .char-badge {
          padding: 6px 8px;
          border: 1px solid #1D2724;
          border-radius: 8px;
          color: #53605C;
          background: #0A0F0E;
          font-family: "DM Mono", monospace;
          font-size: 8px;
          white-space: nowrap;
        }

        .form-field {
          margin-bottom: 15px;
        }

        .form-field:last-child {
          margin-bottom: 0;
        }

        .field-label {
          display: block;
          margin-bottom: 7px;
          color: #71807A;
          font-size: 8px;
          font-weight: 650;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .required {
          margin-left: 3px;
          color: ${ACCENT};
        }

        .premium-input {
          width: 100%;
          min-height: 43px;
          padding: 11px 13px;
          outline: none;
          border: 1px solid #202B27;
          border-radius: 12px;
          background: #090E0D;
          color: #EDF3F0;
          font-size: 12px;
          line-height: 1.5;
          transition:
            border-color .2s ease,
            background .2s ease,
            box-shadow .2s ease;
        }

        textarea.premium-input {
          min-height: 130px;
          resize: vertical;
        }

        .premium-input::placeholder {
          color: #3E4945;
        }

        .premium-input:hover {
          border-color: #2E3A35;
        }

        .premium-input:focus {
          border-color: rgba(0,200,150,.75);
          background: #0B1110;
          box-shadow:
            0 0 0 3px rgba(0,200,150,.075),
            0 8px 25px rgba(0,0,0,.12);
        }

        .premium-input[aria-invalid="true"] {
          border-color: rgba(248,113,113,.7);
        }

        .field-hint,
        .counter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 7px;
          color: #4F5B56;
          font-size: 9px;
          line-height: 1.4;
        }

        .field-hint > span:last-child,
        .counter-row > span:last-child {
          font-family: "DM Mono", monospace;
          color: #46524D;
        }

        .error-text {
          color: #F87171 !important;
        }

        .error-message {
          margin: 7px 0 0;
          font-size: 10px;
        }

        .progress-track {
          height: 2px;
          margin-top: 7px;
          overflow: hidden;
          border-radius: 99px;
          background: #1B2421;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: ${ACCENT};
          box-shadow: 0 0 8px rgba(0,200,150,.5);
          transition: width .2s ease;
        }

        .content-ready {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 15px;
          padding: 10px;
          border: 1px solid rgba(0,200,150,.13);
          border-radius: 12px;
          background: rgba(0,200,150,.035);
        }

        .content-ready-icon {
          width: 28px;
          height: 28px;
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          color: ${ACCENT};
          background: rgba(0,200,150,.08);
        }

        .content-ready-title {
          margin: 0;
          color: #B8C5C0;
          font-size: 10px;
          font-weight: 650;
        }

        .content-ready-value {
          max-width: 280px;
          margin: 3px 0 0;
          overflow: hidden;
          color: #50605A;
          font-family: "DM Mono", monospace;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customizer-panel {
          padding: 18px;
        }

        .custom-section {
          margin-bottom: 20px;
        }

        .control-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 10px;
        }

        .control-title {
          display: block;
          color: #B6C0BC;
          font-size: 11px;
          font-weight: 600;
        }

        .control-subtitle {
          display: block;
          margin-top: 3px;
          color: #4F5C57;
          font-size: 9px;
        }

        .control-meta {
          color: #48544F;
          font-size: 7px;
          letter-spacing: .1em;
          white-space: nowrap;
        }

        .preset-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 7px;
        }

        .preset {
          position: relative;
          aspect-ratio: 1;
          padding: 0;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 11px;
          background:
            linear-gradient(
              135deg,
              var(--preset-fg) 50%,
              var(--preset-bg) 50%
            );
          cursor: pointer;
          transition:
            transform .18s ease,
            box-shadow .18s ease;
        }

        .preset:hover {
          transform: scale(1.055);
        }

        .preset.active {
          box-shadow:
            0 0 0 2px ${ACCENT},
            0 0 0 4px #101615;
        }

        .preset-check {
          position: absolute;
          inset: 0;
          width: 19px;
          height: 19px;
          margin: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #04130E;
          background: ${ACCENT};
          box-shadow: 0 3px 10px rgba(0,0,0,.35);
        }

        .color-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-bottom: 19px;
        }

        .color-picker {
          padding: 11px;
          border: 1px solid #1D2724;
          border-radius: 12px;
          background: #090E0D;
        }

        .color-picker-top,
        .color-picker-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .color-picker-top {
          margin-bottom: 9px;
        }

        .color-picker-top > span:first-child {
          color: #68756F;
          font-size: 9px;
        }

        .color-value {
          color: #414D48;
          font-size: 7px;
        }

        .color-picker-bottom {
          justify-content: flex-start;
        }

        .color-picker input[type="color"] {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          padding: 3px;
          border: 1px solid #2A3530;
          border-radius: 8px;
          background: #0B100F;
          cursor: pointer;
        }

        .color-picker input[type="color"]::-webkit-color-swatch-wrapper {
          padding: 0;
        }

        .color-picker input[type="color"]::-webkit-color-swatch {
          border: 0;
          border-radius: 5px;
        }

        .color-preview {
          width: 17px;
          height: 17px;
          border-radius: 5px;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.12);
        }

        .color-code {
          color: #7A8781;
          font-size: 8px;
        }

        .divider {
          height: 1px;
          margin: 0 0 19px;
          background: #1B2421;
        }

        .value-pill {
          padding: 6px 8px;
          border: 1px solid rgba(0,200,150,.13);
          border-radius: 8px;
          color: ${ACCENT};
          background: rgba(0,200,150,.045);
          font-family: "DM Mono", monospace;
          font-size: 9px;
        }

        .premium-range {
          width: 100%;
          height: 5px;
          margin: 7px 0 0;
          appearance: none;
          outline: none;
          border-radius: 99px;
          background:
            linear-gradient(
              to right,
              ${ACCENT} 0,
              ${ACCENT} var(--range-progress),
              #242E2A var(--range-progress),
              #242E2A 100%
            );
          cursor: pointer;
        }

        .premium-range::-webkit-slider-thumb {
          width: 17px;
          height: 17px;
          appearance: none;
          border: 3px solid #101615;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow:
            0 0 0 1px rgba(0,200,150,.3),
            0 3px 9px rgba(0,0,0,.45);
        }

        .premium-range::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border: 3px solid #101615;
          border-radius: 50%;
          background: ${ACCENT};
        }

        .range-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          color: #3F4A46;
          font-size: 7px;
        }

        .ecc-section {
          margin-bottom: 0;
        }

        .ecc-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 7px;
        }

        .ecc-option {
          position: relative;
          min-height: 61px;
          padding: 9px 7px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          border: 1px solid #1D2724;
          border-radius: 11px;
          background: #090E0D;
          color: #65726D;
          cursor: pointer;
          transition:
            border-color .18s ease,
            background .18s ease,
            color .18s ease;
        }

        .ecc-option:hover {
          border-color: #34403B;
          color: #C8D0CD;
        }

        .ecc-option.active {
          border-color: #344A42;
          color: #F0F5F2;
          background: rgba(0,200,150,.055);
          box-shadow: inset 0 0 0 1px rgba(0,200,150,.035);
        }

        .ecc-letter {
          color: inherit;
          font-family: "DM Mono", monospace;
          font-size: 12px;
          font-weight: 700;
        }

        .ecc-name {
          margin-top: 3px;
          color: #4F5B56;
          font-size: 8px;
        }

        .ecc-option.active .ecc-name {
          color: #6E8179;
        }

        .ecc-dot {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 8px ${ACCENT};
        }

        .ecc-tip {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          color: #5E6E67;
          font-size: 9px;
        }

        .ecc-tip svg {
          color: ${ACCENT};
        }

        .segmented-control {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 4px;
          border: 1px solid #1D2724;
          border-radius: 11px;
          background: #080D0C;
        }

        .segmented-control button {
          min-height: 35px;
          border: 0;
          border-radius: 8px;
          color: #5E6A65;
          background: transparent;
          font-family: "DM Mono", monospace;
          font-size: 9px;
          cursor: pointer;
          transition: all .18s ease;
        }

        .segmented-control button:hover {
          color: #D4DBD8;
        }

        .segmented-control button.active {
          color: #EAF2EE;
          background: #17201D;
          box-shadow:
            0 1px 3px rgba(0,0,0,.25),
            inset 0 0 0 1px #293832;
        }

        .preview-panel {
          overflow: hidden;
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 15px 17px;
          border-bottom: 1px solid #1B2421;
          background: rgba(14,20,18,.82);
        }

        .preview-heading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .preview-index {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #24302B;
          border-radius: 9px;
          color: ${ACCENT};
          background: rgba(0,200,150,.045);
          font-family: "DM Mono", monospace;
          font-size: 8px;
        }

        .preview-label {
          color: #596660;
          font-family: "DM Mono", monospace;
          font-size: 7px;
          letter-spacing: .15em;
        }

        .preview-title {
          margin: 2px 0 0;
          color: #C9D2CE;
          font-size: 11px;
          font-weight: 600;
        }

        .preview-badges {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .preview-badge {
          padding: 6px 8px;
          border: 1px solid #242E2A;
          border-radius: 8px;
          color: #68746F;
          background: #111715;
          font-family: "DM Mono", monospace;
          font-size: 7px;
          letter-spacing: .05em;
        }

        .preview-badge.accent {
          border-color: rgba(0,200,150,.12);
          color: #67AF9D;
          background: rgba(0,200,150,.045);
        }

        .preview-canvas {
          position: relative;
          min-height: 530px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #080D0C;
        }

        .preview-canvas.has-qr {
          background:
            radial-gradient(
              circle at center,
              rgba(0,200,150,.045),
              transparent 23rem
            ),
            #080D0C;
        }

        .canvas-grid {
          position: absolute;
          inset: 0;
          opacity: .65;
          background-image:
            linear-gradient(
              rgba(255,255,255,.018) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,.018) 1px,
              transparent 1px
            );
          background-size: 24px 24px;
          mask-image: linear-gradient(
            to bottom,
            black,
            transparent 85%
          );
        }

        .canvas-top-glow {
          position: absolute;
          width: 420px;
          height: 420px;
          top: -220px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: rgba(0,200,150,.055);
          filter: blur(80px);
          pointer-events: none;
        }

        .preview-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .qr-frame {
          position: relative;
          padding: 17px;
          border-radius: 21px;
          background: var(--qr-bg, white);
          box-shadow:
            0 0 0 1px rgba(255,255,255,.09),
            0 35px 100px rgba(0,0,0,.58),
            0 10px 30px rgba(0,0,0,.32);
          animation: qrAppear .4s cubic-bezier(.16,1,.3,1);
        }

        .qr-image-wrap {
          position: relative;
          overflow: hidden;
          border-radius: 4px;
          line-height: 0;
        }

        .qr-image {
          display: block;
          max-width: min(340px, 62vw);
          height: auto;
          border-radius: 2px;
        }

        .corner {
          position: absolute;
          z-index: 3;
          width: 24px;
          height: 24px;
          border-color: ${ACCENT};
          pointer-events: none;
        }

        .corner-tl {
          top: -7px;
          left: -7px;
          border-top: 2px solid;
          border-left: 2px solid;
          border-radius: 5px 0 0 0;
        }

        .corner-tr {
          top: -7px;
          right: -7px;
          border-top: 2px solid;
          border-right: 2px solid;
          border-radius: 0 5px 0 0;
        }

        .corner-bl {
          bottom: -7px;
          left: -7px;
          border-bottom: 2px solid;
          border-left: 2px solid;
          border-radius: 0 0 0 5px;
        }

        .corner-br {
          right: -7px;
          bottom: -7px;
          border-right: 2px solid;
          border-bottom: 2px solid;
          border-radius: 0 0 5px 0;
        }

        .scan-line {
          position: absolute;
          z-index: 5;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent,
            ${ACCENT},
            transparent
          );
          box-shadow:
            0 0 10px ${ACCENT},
            0 0 28px rgba(0,200,150,.5);
          animation: scan .75s ease-out forwards;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 18px;
          padding: 7px 10px;
          border: 1px solid rgba(0,200,150,.13);
          border-radius: 99px;
          color: #69A997;
          background: rgba(0,200,150,.045);
          font-family: "DM Mono", monospace;
          font-size: 7px;
          letter-spacing: .1em;
        }

        .live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 9px ${ACCENT};
        }

        .empty-preview {
          position: relative;
          z-index: 2;
          max-width: 310px;
          padding: 30px;
          text-align: center;
        }

        .empty-qr {
          position: relative;
          width: 112px;
          height: 112px;
          margin: 0 auto 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #202B27;
          border-radius: 27px;
          background: #0D1311;
          box-shadow:
            0 25px 55px rgba(0,0,0,.25),
            inset 0 1px 0 rgba(255,255,255,.025);
        }

        .empty-ring {
          position: absolute;
          inset: 13px;
          border: 1px dashed #2B3833;
          border-radius: 18px;
        }

        .empty-spark {
          position: absolute;
          top: -7px;
          right: -7px;
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #293630;
          border-radius: 9px;
          color: ${ACCENT};
          background: #111815;
        }

        .empty-preview h3 {
          margin: 0;
          color: #C8D1CD;
          font-size: 13px;
          font-weight: 650;
        }

        .empty-preview p {
          margin: 7px auto 0;
          color: #56635E;
          font-size: 10px;
          line-height: 1.65;
        }

        .empty-hint {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 17px;
          padding: 7px 9px;
          border: 1px solid #1C2723;
          border-radius: 8px;
          color: #4F5C56;
          background: rgba(255,255,255,.012);
          font-size: 8px;
        }

        .empty-hint svg {
          color: ${ACCENT};
        }

        .status-bar {
          min-height: 39px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 14px;
          border-top: 1px solid #1B2421;
          background: #0A0F0E;
          color: #52605A;
          font-size: 8px;
        }

        .status-ready {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #789089;
          font-weight: 600;
        }

        .status-pulse {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 0 3px rgba(0,200,150,.07);
        }

        .status-separator {
          color: #29342F;
        }

        .status-meta {
          flex-shrink: 0;
        }

        .status-content {
          overflow: hidden;
          color: #46534D;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .action-area {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto 44px;
          gap: 7px;
          padding: 13px;
        }

        .primary-action,
        .secondary-action,
        .copy-action {
          min-height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          cursor: pointer;
          transition:
            transform .18s ease,
            background .18s ease,
            border-color .18s ease,
            box-shadow .18s ease,
            color .18s ease;
        }

        .primary-action {
          padding: 0 15px;
          border: 0;
          color: #03130E;
          background:
            linear-gradient(
              135deg,
              ${ACCENT_BRIGHT},
              ${ACCENT}
            );
          font-size: 11px;
          font-weight: 750;
          box-shadow:
            0 10px 30px rgba(0,200,150,.12),
            inset 0 1px 0 rgba(255,255,255,.2);
        }

        .primary-action:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 14px 35px rgba(0,200,150,.18),
            inset 0 1px 0 rgba(255,255,255,.2);
        }

        .primary-action span {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: rgba(0,0,0,.08);
        }

        .secondary-action,
        .copy-action {
          border: 1px solid #26312D;
          color: #7A8781;
          background: #0B100F;
          font-size: 10px;
          font-weight: 600;
        }

        .secondary-action {
          padding: 0 13px;
        }

        .secondary-action:hover:not(:disabled),
        .copy-action:hover:not(:disabled) {
          border-color: #394640;
          color: #EDF3F0;
          background: #101714;
        }

        .copy-action.copied {
          border-color: rgba(0,200,150,.25);
          color: ${ACCENT};
          background: rgba(0,200,150,.06);
        }

        .primary-action:disabled,
        .secondary-action:disabled,
        .copy-action:disabled {
          opacity: .3;
          cursor: not-allowed;
          transform: none;
        }

        .quality-card {
          display: flex;
          gap: 11px;
          margin-top: 12px;
          padding: 14px;
          border: 1px solid rgba(0,200,150,.12);
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              rgba(0,200,150,.055),
              rgba(0,200,150,.018)
            );
        }

        .quality-icon {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          color: ${ACCENT};
          background: rgba(0,200,150,.075);
        }

        .quality-copy {
          min-width: 0;
        }

        .quality-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${ACCENT};
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .12em;
        }

        .quality-line {
          width: 25px;
          height: 1px;
          background: rgba(0,200,150,.22);
        }

        .quality-copy p {
          margin: 5px 0 0;
          color: #678078;
          font-size: 9px;
          line-height: 1.55;
        }

        .quality-copy strong {
          color: #A4C4BA;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        .feature-card {
          min-width: 0;
          padding: 12px;
          border: 1px solid #1C2622;
          border-radius: 13px;
          background: #0C1110;
        }

        .feature-icon {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #66756E;
          background: rgba(255,255,255,.025);
        }

        .feature-title {
          margin-top: 9px;
          color: #AAB5B0;
          font-size: 9px;
          font-weight: 650;
        }

        .feature-text {
          margin-top: 3px;
          color: #4D5954;
          font-size: 8px;
        }

        .qr-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 24px 0 18px;
          color: #38433F;
          font-size: 8px;
        }

        .footer-brand {
          font-family: "DM Mono", monospace;
          letter-spacing: .08em;
        }

        @keyframes qrAppear {
          from {
            opacity: 0;
            transform: scale(.9) translateY(8px);
          }
          70% {
            opacity: 1;
            transform: scale(1.015) translateY(0);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes scan {
          from {
            top: 0;
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          to {
            top: 100%;
            opacity: 0;
          }
        }

        @media (max-width: 1050px) {
          .workspace {
            grid-template-columns: 360px minmax(0, 1fr);
          }

          .preview-canvas {
            min-height: 490px;
          }

          .qr-image {
            max-width: min(300px, 50vw);
          }
        }

        @media (max-width: 900px) {
          .right-column {
            position: static;
          }

          .workspace {
            grid-template-columns: 1fr;
          }

          .left-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            align-items: start;
          }

          .type-panel,
          .content-panel,
          .customizer-panel {
            margin-bottom: 0;
          }

          .type-panel {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 680px) {
          .qr-shell {
            width: min(100% - 20px, 1220px);
          }

          .qr-header {
            padding: 18px 0 16px;
          }

          .system-status {
            display: none;
          }

          .brand-mark {
            width: 42px;
            height: 42px;
          }

          .left-column {
            display: block;
          }

          .type-panel,
          .content-panel,
          .customizer-panel {
            margin-bottom: 10px;
          }

          .type-grid {
            gap: 5px;
          }

          .type-button {
            min-height: 70px;
          }

          .type-label {
            font-size: 8px;
          }

          .preview-header {
            padding: 12px;
          }

          .preview-badges .preview-badge:first-child {
            display: none;
          }

          .preview-canvas {
            min-height: 400px;
          }

          .qr-frame {
            padding: 12px;
            border-radius: 17px;
          }

          .qr-image {
            max-width: 260px;
          }

          .feature-grid {
            gap: 5px;
          }

          .feature-card {
            padding: 9px;
          }

          .feature-title {
            font-size: 8px;
          }

          .feature-text {
            font-size: 7px;
          }

          .qr-footer {
            flex-direction: column;
            text-align: center;
            padding-bottom: 15px;
          }
        }

        @media (max-width: 450px) {
          .brand-title {
            font-size: 14px;
          }

          .brand-subtitle {
            font-size: 9px;
          }

          .pro-pill {
            font-size: 7px;
          }

          .type-panel,
          .content-panel,
          .customizer-panel {
            padding: 13px;
          }

          .type-button {
            min-height: 64px;
            border-radius: 10px;
          }

          .type-icon {
            width: 25px;
            height: 25px;
          }

          .type-label {
            font-size: 7px;
          }

          .type-short {
            display: none;
          }

          .section-heading h2 {
            font-size: 14px;
          }

          .color-grid {
            grid-template-columns: 1fr;
          }

          .ecc-grid {
            gap: 5px;
          }

          .ecc-option {
            min-height: 56px;
          }

          .action-area {
            grid-template-columns: minmax(0,1fr) 42px;
          }

          .secondary-action {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .copy-action {
            grid-column: 2;
            grid-row: 1;
          }

          .primary-action {
            grid-column: 1;
            grid-row: 1;
          }

          .status-meta,
          .status-separator {
            display: none;
          }

          .preview-canvas {
            min-height: 350px;
          }

          .qr-image {
            max-width: 225px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .qr-app *,
          .qr-app *::before,
          .qr-app *::after {
            scroll-behavior: auto !important;
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }

        /* ---------- Branding / History / Save additions ---------- */
        .branding-panel {
          padding: 0 0 6px;
          margin-top: 12px;
        }

        .logo-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 4px 0 12px;
        }

        .logo-thumb {
          width: 58px;
          height: 58px;
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px dashed #2F3B36;
          border-radius: 14px;
          color: #53605C;
          background: #0B100F;
        }

        .logo-thumb img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .logo-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .logo-upload,
        .logo-remove,
        .save-action,
        .history-clear {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 13px;
          border: 1px solid #26312D;
          border-radius: 11px;
          color: #9AA7A1;
          background: #0B100F;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          transition: border-color .18s ease, color .18s ease, background .18s ease;
        }

        .logo-upload input {
          display: none;
        }

        .logo-upload {
          color: ${ACCENT};
          border-color: rgba(0,200,150,.28);
          background: rgba(0,200,150,.06);
        }

        .logo-upload:hover,
        .logo-remove:hover,
        .save-action:hover:not(:disabled),
        .history-clear:hover {
          border-color: #394640;
          color: #EDF3F0;
          background: #101714;
        }

        .logo-remove:hover,
        .history-clear.confirm {
          border-color: rgba(255,90,90,.4);
          color: #FF8A8A;
        }

        .inline-error,
        .inline-warning {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 8px 0;
          padding: 9px 11px;
          border-radius: 10px;
          font-size: 11px;
          line-height: 1.45;
        }

        .inline-error {
          border: 1px solid rgba(255,90,90,.25);
          color: #FF9C9C;
          background: rgba(255,90,90,.06);
        }

        .inline-warning {
          border: 1px solid rgba(255,190,70,.25);
          color: #F2C46B;
          background: rgba(255,190,70,.06);
        }

        .inline-warning svg {
          flex: none;
          margin-top: 1px;
        }

        .qr-error {
          margin: 0 13px 4px;
        }

        .plate-toggle {
          margin-top: 12px;
        }

        .style-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 4px;
        }

        .style-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 11px 6px 10px;
          border: 1px solid #1D2724;
          border-radius: 13px;
          color: #82908B;
          background: #0B100F;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          transition: border-color .18s ease, color .18s ease, background .18s ease;
        }

        .style-option:hover {
          border-color: #33423C;
          color: #EDF3F0;
        }

        .style-option.active {
          border-color: rgba(0,200,150,.5);
          color: ${ACCENT};
          background: rgba(0,200,150,.07);
        }

        .style-sample {
          display: grid;
          grid-template-columns: repeat(2, 9px);
          gap: 3px;
        }

        .style-sample i {
          width: 9px;
          height: 9px;
          background: currentColor;
        }

        .sample-rounded i {
          border-radius: 3px;
        }

        .sample-dots i {
          border-radius: 50%;
        }

        .save-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          padding: 0 13px 14px;
        }

        .save-action.saved {
          border-color: rgba(0,200,150,.3);
          color: ${ACCENT};
          background: rgba(0,200,150,.07);
        }

        .save-action:disabled {
          opacity: .3;
          cursor: not-allowed;
        }

        .autosave-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #82908B;
          font-size: 11px;
          cursor: pointer;
          user-select: none;
        }

        .autosave-toggle input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .autosave-box {
          width: 17px;
          height: 17px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #33423C;
          border-radius: 5px;
          color: #03130E;
          background: #0B100F;
        }

        .autosave-toggle input:checked + .autosave-box {
          border-color: ${ACCENT};
          background: ${ACCENT};
        }

        .autosave-toggle input:focus-visible + .autosave-box {
          outline: 2px solid ${ACCENT};
          outline-offset: 2px;
        }

        .history-panel {
          margin-top: 16px;
          padding-bottom: 20px;
        }

        .history-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding-right: 18px;
        }

        .history-head .section-header {
          flex: 1;
        }

        .history-head .history-clear {
          margin-top: 18px;
          flex: none;
        }

        .history-notice {
          margin: 0 18px 8px;
        }

        .history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 26px 18px 10px;
          color: #53605C;
          text-align: center;
        }

        .history-empty p {
          margin: 6px 0 0;
          color: #82908B;
          font-size: 13px;
          font-weight: 650;
        }

        .history-empty span {
          font-size: 11px;
        }

        .history-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
          padding: 4px 18px 0;
        }

        .history-card {
          position: relative;
          border: 1px solid #1D2724;
          border-radius: 15px;
          background: #0B100F;
          transition: border-color .18s ease, transform .18s ease;
        }

        .history-card:hover {
          border-color: rgba(0,200,150,.4);
          transform: translateY(-2px);
        }

        .history-open {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
          padding: 9px;
          border: 0;
          color: inherit;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .history-thumb {
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          margin-bottom: 4px;
          border-radius: 9px;
          color: #53605C;
        }

        .history-thumb img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .history-title {
          overflow: hidden;
          color: #E4ECE8;
          font-size: 11.5px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-meta {
          color: #5F6C67;
          font-family: "DM Mono", monospace;
          font-size: 9px;
          letter-spacing: .04em;
        }

        .history-delete {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(0,0,0,.18);
          border-radius: 8px;
          color: #fff;
          background: rgba(10,14,13,.72);
          opacity: 0;
          cursor: pointer;
          transition: opacity .15s ease, background .15s ease;
        }

        .history-card:hover .history-delete,
        .history-delete:focus-visible {
          opacity: 1;
        }

        .history-delete:hover {
          background: rgba(220,60,60,.9);
        }

        @media (hover: none) {
          .history-delete {
            opacity: 1;
          }
        }
      `}</style>

      <div className="qr-shell">
        <header className="qr-header">
          <div className="brand-row">
            <div className="brand">
              <div className="brand-mark">
                <QRLogo size={27} />
              </div>

              <div>
                <div className="brand-title-row">
                  <h1 className="brand-title">QR Studio</h1>
                  <span className="pro-pill">PRO</span>
                </div>

                <p className="brand-subtitle">
                  Production-ready QR codes, beautifully made.
                </p>
              </div>
            </div>

            <div className="system-status">
              <span className="system-dot" />
              System online
            </div>
          </div>
        </header>

        <div className="workspace">
          <div className="left-column">
            <TypeSelector value={type} onChange={handleTypeChange} />

            <Panel className="content-panel">
              <SectionHeader
                number="01"
                eyebrow="CONTENT"
                title={`Create ${type} QR`}
                description={
                  QR_TYPES.find((item) => item.id === type)?.description
                }
                badge={
                  hasContent ? (
                    <span className="char-badge">{content.length} chars</span>
                  ) : undefined
                }
              />

              {type === "URL" && (
                <URLForm
                  fields={fields}
                  onChange={setFields}
                  invalid={invalid}
                />
              )}

              {type === "Text" && (
                <TextForm fields={fields} onChange={setFields} />
              )}

              {type === "Email" && (
                <EmailForm
                  fields={fields}
                  onChange={setFields}
                  invalid={invalid}
                />
              )}

              {type === "Phone" && (
                <PhoneForm fields={fields} onChange={setFields} />
              )}

              {type === "WiFi" && (
                <WiFiForm fields={fields} onChange={setFields} />
              )}

              {hasContent && (
                <div className="content-ready">
                  <div className="content-ready-icon">
                    <Icon name="check" size={13} strokeWidth={2.3} />
                  </div>

                  <div>
                    <p className="content-ready-title">Content ready</p>

                    <p className="content-ready-value">{content}</p>
                  </div>
                </div>
              )}
            </Panel>

            <Customizer
              fg={fg}
              bg={bg}
              ecc={ecc}
              size={size}
              preset={preset}
              onFgChange={(value) => {
                setFg(value);
                setPreset(-1);
              }}
              onBgChange={(value) => {
                setBg(value);
                setPreset(-1);
              }}
              onEccChange={setEcc}
              onSizeChange={setSize}
              onPresetChange={handlePreset}
            />

            <BrandingPanel
              dotStyle={dotStyle}
              onDotStyleChange={setDotStyle}
              logo={logo}
              logoScale={logoScale}
              logoPlate={logoPlate}
              logoError={logoError}
              onLogoFile={handleLogoFile}
              onLogoRemove={() => {
                setLogo(null);
                setLogoError("");
              }}
              onLogoScaleChange={setLogoScale}
              onLogoPlateChange={setLogoPlate}
              title={title}
              titleScale={titleScale}
              onTitleChange={setTitle}
              onTitleScaleChange={setTitleScale}
              ecc={ecc}
            />
          </div>

          <div className="right-column">
            <Panel className="preview-panel">
              <div className="preview-header">
                <div className="preview-heading">
                  <div className="preview-index">02</div>

                  <div>
                    <div className="preview-label">PREVIEW</div>
                    <p className="preview-title">Live QR canvas</p>
                  </div>
                </div>

                <div className="preview-badges">
                  <span className="preview-badge">{type}</span>

                  <span className="preview-badge accent">{size}px</span>
                </div>
              </div>

              <QRPreview
                qrUrl={qr?.dataUrl ?? null}
                bg={bg}
                size={size}
                scanning={scanning}
                aspect={qr ? qr.height / qr.width : 1}
              />

              {qrError && <div className="inline-error qr-error">{qrError}</div>}

              {hasContent && (
                <StatusBar content={content} size={size} ecc={ecc} />
              )}

              <ActionBar
                disabled={!hasContent}
                downloading={downloading}
                copied={copied}
                saved={saved}
                autoSave={autoSave}
                onDownloadPng={() => handleDownload("png")}
                onDownloadSvg={() => handleDownload("svg")}
                onCopyImage={handleCopyImage}
                onSave={saveToHistory}
                onAutoSaveChange={handleAutoSaveChange}
              />
            </Panel>

            <QualityCard ecc={ecc} />

            <div className="feature-grid">
              <FeatureCard icon="bolt" title="Instant" text="Live generation" />

              <FeatureCard
                icon="shield"
                title="Reliable"
                text={`${ecc} correction`}
              />

              <FeatureCard
                icon="printer"
                title="Print ready"
                text={`${size}px output`}
              />
            </div>
          </div>
        </div>

        <HistoryPanel
          items={history}
          notice={historyNotice}
          onLoad={handleLoadHistory}
          onDelete={handleDeleteHistory}
          onClear={handleClearHistory}
        />

        <footer className="qr-footer">
          <span className="footer-brand">QR STUDIO · DARK EDITION</span>

          <span>Always test your QR before publishing or printing.</span>
        </footer>
      </div>
    </main>
  );
}
