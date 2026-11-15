"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import {
  readLogo,
  renderQr,
  svgToPngBlob,
  type DotStyle,
  type RenderResult,
} from "./qr-render";

const ACCENT = "#00C896";

type QRType = "URL" | "Text" | "Email" | "Phone" | "WiFi";
type ECCLevel = "L" | "M" | "Q" | "H";
type DownloadFormat = "png" | "svg";

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

interface Preset {
  name: string;
  fg: string;
  bg: string;
}

const HISTORY_KEY = "qr-studio-history-v1";
const AUTOSAVE_KEY = "qr-studio-autosave-v1";
const MAX_HISTORY = 30;
const MAX_TITLE = 60;
const MAX_TEXT = 1200;

const DOT_STYLES: Array<{ id: DotStyle; label: string }> = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
];

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
  { id: "Phone", label: "Phone", description: "Phone number", icon: "phone" },
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
  { name: string; recovery: string; description: string }
> = {
  L: { name: "Low", recovery: "7%", description: "Smallest QR" },
  M: { name: "Medium", recovery: "15%", description: "Recommended" },
  Q: { name: "High", recovery: "25%", description: "More damage resistant" },
  H: { name: "Maximum", recovery: "30%", description: "Print & logos" },
};

/* ------------------------------------------------------------------ */
/* Shared Tailwind class strings (kept as full literals for the JIT)   */
/* ------------------------------------------------------------------ */

const MONO = "font-['DM_Mono','SFMono-Regular',Consolas,monospace]";

const PANEL =
  "overflow-hidden rounded-[20px] border border-[#1D2724] bg-[#0C1110] bg-[linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.008))] shadow-[0_1px_1px_rgba(0,0,0,.35),0_20px_65px_rgba(0,0,0,.18)]";

const INPUT =
  "w-full min-h-[43px] rounded-xl border border-[#202B27] bg-[#090E0D] px-[13px] py-[11px] text-[13px] leading-normal text-[#EDF3F0] outline-none transition placeholder:text-[#3E4945] hover:border-[#2E3A35] focus:border-[#00C896]/75 focus:bg-[#0B1110] focus:shadow-[0_0_0_3px_rgba(0,200,150,.075)] aria-[invalid=true]:border-red-400/70";

const BTN =
  "inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-[7px] rounded-[11px] border border-[#26312D] bg-[#0B100F] px-[13px] text-[11px] font-semibold text-[#9AA7A1] transition hover:border-[#394640] hover:bg-[#101714] hover:text-[#EDF3F0] disabled:cursor-not-allowed disabled:opacity-30";

const RANGE =
  "mt-[7px] h-[5px] w-full cursor-pointer appearance-none rounded-full outline-none bg-[linear-gradient(to_right,#00C896_var(--range-progress),#242E2A_var(--range-progress))] [&::-webkit-slider-thumb]:h-[17px] [&::-webkit-slider-thumb]:w-[17px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-[#101615] [&::-webkit-slider-thumb]:bg-[#00C896] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,200,150,.3),0_3px_9px_rgba(0,0,0,.45)] [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-[#101615] [&::-moz-range-thumb]:bg-[#00C896]";

const INLINE_ERROR =
  "my-2 flex items-start gap-2 rounded-[10px] border border-[rgba(255,90,90,.25)] bg-[rgba(255,90,90,.06)] px-[11px] py-[9px] text-[11px] leading-[1.45] text-[#FF9C9C]";

const INLINE_WARNING =
  "my-2 flex items-start gap-2 rounded-[10px] border border-[rgba(255,190,70,.25)] bg-[rgba(255,190,70,.06)] px-[11px] py-[9px] text-[11px] leading-[1.45] text-[#F2C46B]";

const CONTROL_TITLE = "block text-[11px] font-semibold text-[#B6C0BC]";
const CONTROL_SUB = "mt-[3px] block text-[9px] text-[#4F5C57]";
const CONTROL_META = `${MONO} whitespace-nowrap text-[7px] tracking-[.1em] text-[#48544F]`;
const DIVIDER = "mb-[19px] h-px bg-[#1B2421]";

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

function escapeWifi(value: string): string {
  return value.replace(/([\\;,":])/g, "\\$1");
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

type IconName =
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
  | "qr"
  | "upload"
  | "trash"
  | "history"
  | "image"
  | "save"
  | "close";

function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
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

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {paths[name]}
    </svg>
  );
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
  return <section className={`${PANEL} ${className}`}>{children}</section>;
}

function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${INPUT} ${className}`} {...props} />;
}

function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${INPUT} min-h-[130px] resize-y ${className}`}
      {...props}
    />
  );
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
    <div className="mb-[15px] last:mb-0">
      <label
        className={`${MONO} mb-[7px] block text-[8px] font-semibold uppercase tracking-[.12em] text-[#71807A]`}
      >
        {label}
        {required && <span className="ml-[3px] text-[#00C896]">*</span>}
      </label>
      {children}
    </div>
  );
}

function FieldHint({
  children,
  right,
  error = false,
}: {
  children: ReactNode;
  right?: ReactNode;
  error?: boolean;
}) {
  return (
    <div className="mt-[7px] flex items-center justify-between gap-2.5 text-[9px] leading-[1.4] text-[#4F5B56]">
      <span className={error ? "text-[#F87171]" : ""}>{children}</span>
      {right && <span className={`${MONO} text-[#46524D]`}>{right}</span>}
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
    <div className="mb-[18px] flex items-start justify-between gap-[15px]">
      <div className="min-w-0">
        {(number || eyebrow) && (
          <div
            className={`${MONO} mb-[5px] flex items-center gap-[7px] text-[8px] font-semibold tracking-[.14em] text-[#56635E]`}
          >
            {number && <span className="text-[#00C896]">{number}</span>}
            {eyebrow}
          </div>
        )}
        <h2 className="m-0 text-base font-bold tracking-[-.025em] text-[#EAF0ED] max-[450px]:text-sm">
          {title}
        </h2>
        {description && (
          <p className="mt-[5px] max-w-[310px] text-[11px] leading-[1.55] text-[#68756F]">
            {description}
          </p>
        )}
      </div>
      {badge}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
  className = "",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer select-none items-center gap-2 text-[11px] text-[#82908B] ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border border-[#33423C] bg-[#0B100F] text-[#03130E] peer-checked:border-[#00C896] peer-checked:bg-[#00C896] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#00C896]">
        {checked && <Icon name="check" size={11} strokeWidth={3} />}
      </span>
      {children}
    </label>
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
    <Panel className="p-3.5 max-[900px]:col-span-full max-[450px]:p-[13px]">
      <div className="flex items-center justify-between gap-[15px] px-1 pb-3 pt-[3px]">
        <div>
          <span
            className={`${MONO} mb-[3px] block text-[8px] font-semibold tracking-[.17em] text-[#56625E]`}
          >
            CREATE
          </span>
          <h2 className="m-0 text-[13px] font-semibold tracking-[-.015em] text-[#D8E0DD]">
            Choose a format
          </h2>
        </div>
        <span className={`${MONO} text-[8px] tracking-[.1em] text-[#3F4A46]`}>
          05 FORMATS
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 max-[680px]:gap-[5px]">
        {QR_TYPES.map((item) => {
          const active = value === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.id)}
              className={`relative flex min-h-[78px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[13px] border px-1 py-2.5 transition hover:-translate-y-px max-[680px]:min-h-[70px] max-[450px]:min-h-16 max-[450px]:rounded-[10px] ${
                active
                  ? "border-[#33443E] bg-[#111816] bg-[linear-gradient(145deg,rgba(0,200,150,.075),rgba(255,255,255,.018))] text-[#F1F6F4] shadow-[inset_0_0_0_1px_rgba(0,200,150,.055),0_8px_24px_rgba(0,0,0,.16)]"
                  : "border-[#1D2724] bg-[#0A0F0E] text-[#66736E] hover:border-[#34403B] hover:bg-[#0E1412] hover:text-[#C5CECA]"
              }`}
            >
              {active && (
                <span className="absolute right-[7px] top-[7px] h-[5px] w-[5px] rounded-full bg-[#00C896] shadow-[0_0_10px_#00C896]" />
              )}

              <span
                className={`flex h-[29px] w-[29px] items-center justify-center rounded-[9px] max-[450px]:h-[25px] max-[450px]:w-[25px] ${
                  active
                    ? "bg-[rgba(0,200,150,.085)] text-[#00C896]"
                    : "bg-white/[0.025]"
                }`}
              >
                <Icon name={item.icon} size={18} />
              </span>

              <span className="text-[9px] font-semibold max-[680px]:text-[8px] max-[450px]:text-[7px]">
                {item.label}
              </span>
              <span
                className={`${MONO} text-[7px] tracking-[.08em] max-[450px]:hidden ${
                  active ? "text-[#668278]" : "text-[#414C48]"
                }`}
              >
                {item.id}
              </span>
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
        onChange={(e) => onChange({ ...fields, url: e.target.value })}
      />
      <FieldHint error={invalid} right={invalid ? undefined : "HTTP / HTTPS"}>
        {invalid
          ? "Enter a valid http:// or https:// URL."
          : "Short URLs create cleaner, easier-to-scan QR codes."}
      </FieldHint>
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
        onChange={(e) => onChange({ ...fields, text: e.target.value })}
      />
      <FieldHint right={`${fields.text.length.toLocaleString()} / ${MAX_TEXT}`}>
        Plain text QR
      </FieldHint>
      <div className="mt-[7px] h-0.5 overflow-hidden rounded-full bg-[#1B2421]">
        <div
          className="h-full rounded-[inherit] bg-[#00C896] shadow-[0_0_8px_rgba(0,200,150,.5)] transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
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
        onChange={(e) => onChange({ ...fields, phone: e.target.value })}
      />
      <FieldHint right="TEL">Scanning opens the device dialer.</FieldHint>
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
      onChange({ ...fields, [key]: e.target.value });

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
          <p className="mt-[7px] text-[10px] text-[#F87171]">
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
    onChange({ ...fields, [key]: e.target.value });

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
        <div className="grid grid-cols-3 gap-1 rounded-[11px] border border-[#1D2724] bg-[#080D0C] p-1">
          {(["WPA", "WEP", "None"] as const).map((item) => {
            const active = fields.security === item;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...fields, security: item })}
                className={`${MONO} min-h-[35px] cursor-pointer rounded-lg border-0 text-[9px] transition ${
                  active
                    ? "bg-[#17201D] text-[#EAF2EE] shadow-[0_1px_3px_rgba(0,0,0,.25),inset_0_0_0_1px_#293832]"
                    : "bg-transparent text-[#5E6A65] hover:text-[#D4DBD8]"
                }`}
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
    <div className="rounded-xl border border-[#1D2724] bg-[#090E0D] p-[11px]">
      <div className="mb-[9px] flex items-center justify-between gap-2">
        <span className="text-[9px] text-[#68756F]">{label}</span>
        <span className={`${MONO} text-[7px] text-[#414D48]`}>
          {value.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-[31px] w-[31px] shrink-0 cursor-pointer rounded-lg border border-[#2A3530] bg-[#0B100F] p-[3px] [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-0"
        />
        <div
          className="h-[17px] w-[17px] rounded-[5px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]"
          style={{ background: value }}
        />
        <span className={`${MONO} text-[8px] text-[#7A8781]`}>
          {value.toUpperCase()}
        </span>
      </div>
    </div>
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
    <Panel className="p-[18px] max-[450px]:p-[13px]">
      <SectionHeader
        number="02"
        eyebrow="APPEARANCE"
        title="Make it yours"
        description="Tune the visual style without compromising scan reliability."
      />

      <div className="mb-5">
        <div className="mb-2.5 flex items-center justify-between gap-[15px]">
          <div>
            <span className={CONTROL_TITLE}>Color theme</span>
            <span className={CONTROL_SUB}>Quick presets</span>
          </div>
          <span className={CONTROL_META}>8 STYLES</span>
        </div>

        <div className="grid grid-cols-8 gap-[7px]">
          {PRESETS.map((item, index) => {
            const active = preset === index;
            return (
              <button
                key={item.name}
                type="button"
                title={item.name}
                aria-label={`Use ${item.name} theme`}
                aria-pressed={active}
                onClick={() => onPresetChange(index)}
                style={
                  {
                    "--preset-fg": item.fg,
                    "--preset-bg": item.bg,
                  } as CSSProperties
                }
                className={`relative aspect-square cursor-pointer overflow-hidden rounded-[11px] border border-white/[0.06] bg-[linear-gradient(135deg,var(--preset-fg)_50%,var(--preset-bg)_50%)] p-0 transition hover:scale-[1.055] ${
                  active ? "shadow-[0_0_0_2px_#00C896,0_0_0_4px_#101615]" : ""
                }`}
              >
                {active && (
                  <span className="absolute inset-0 m-auto flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[#00C896] text-[#04130E] shadow-[0_3px_10px_rgba(0,0,0,.35)]">
                    <Icon name="check" size={11} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-[19px] grid grid-cols-2 gap-[9px] max-[450px]:grid-cols-1">
        <ColorPicker label="QR color" value={fg} onChange={onFgChange} />
        <ColorPicker label="Background" value={bg} onChange={onBgChange} />
      </div>

      <div className={DIVIDER} />

      <div className="mb-5">
        <div className="mb-2.5 flex items-center justify-between gap-[15px]">
          <div>
            <span className={CONTROL_TITLE}>Output resolution</span>
            <span className={CONTROL_SUB}>Higher is better for print</span>
          </div>
          <span
            className={`${MONO} rounded-lg border border-[rgba(0,200,150,.13)] bg-[rgba(0,200,150,.045)] px-2 py-1.5 text-[9px] text-[#00C896]`}
          >
            {size}px
          </span>
        </div>

        <input
          className={RANGE}
          type="range"
          min="150"
          max="1000"
          step="50"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          style={{ "--range-progress": `${sliderProgress}%` } as CSSProperties}
          aria-label="Output resolution"
        />

        <div
          className={`${MONO} mt-1.5 flex justify-between text-[7px] text-[#3F4A46]`}
        >
          <span>150 px</span>
          <span>1000 px</span>
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-[15px]">
          <div>
            <span className={CONTROL_TITLE}>Error correction</span>
            <span className={CONTROL_SUB}>Protects against damage</span>
          </div>
          <span className={CONTROL_META}>
            {ECC_LEVELS[ecc].recovery} RECOVERY
          </span>
        </div>

        <div className="grid grid-cols-4 gap-[7px] max-[450px]:gap-[5px]">
          {(Object.keys(ECC_LEVELS) as ECCLevel[]).map((key) => {
            const item = ECC_LEVELS[key];
            const active = ecc === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onEccChange(key)}
                className={`relative flex min-h-[61px] cursor-pointer flex-col items-start justify-center rounded-[11px] border px-[7px] py-[9px] transition max-[450px]:min-h-14 ${
                  active
                    ? "border-[#344A42] bg-[rgba(0,200,150,.055)] text-[#F0F5F2] shadow-[inset_0_0_0_1px_rgba(0,200,150,.035)]"
                    : "border-[#1D2724] bg-[#090E0D] text-[#65726D] hover:border-[#34403B] hover:text-[#C8D0CD]"
                }`}
              >
                <span className={`${MONO} text-xs font-bold`}>{key}</span>
                <span
                  className={`mt-[3px] text-[8px] ${
                    active ? "text-[#6E8179]" : "text-[#4F5B56]"
                  }`}
                >
                  {item.name}
                </span>
                {active && (
                  <span className="absolute right-2 top-2 h-[5px] w-[5px] rounded-full bg-[#00C896] shadow-[0_0_8px_#00C896]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-[7px] text-[9px] text-[#5E6E67]">
          <span className="text-[#00C896]">
            <Icon name="shield" size={15} />
          </span>
          <span>{ECC_LEVELS[ecc].description}</span>
        </div>
      </div>
    </Panel>
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
    // FIX: this panel previously had no horizontal padding (padding: 0 0 6px),
    // which pushed the content against the edges and clipped the header/input.
    <Panel className="p-[18px] max-[450px]:p-[13px]">
      <SectionHeader
        number="03"
        eyebrow="BRANDING"
        title="Logo, title & style"
        description="Add your logo in the center and a title under the QR."
      />

      <div className="mb-5">
        <div className="mb-2.5 flex items-center justify-between gap-[15px]">
          <div>
            <span className={CONTROL_TITLE}>Logo</span>
            <span className={CONTROL_SUB}>Shown in the QR center</span>
          </div>
          {logo && <span className={CONTROL_META}>{logoScale}% SIZE</span>}
        </div>

        <div className="mb-3 mt-1 flex items-center gap-3">
          <div className="flex h-[58px] w-[58px] flex-none items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-[#2F3B36] bg-[#0B100F] text-[#53605C]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Selected logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <Icon name="image" size={20} />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <label
              className={`${BTN} border-[rgba(0,200,150,.28)] bg-[rgba(0,200,150,.06)] text-[#00C896]`}
            >
              <Icon name="upload" size={15} />
              {logo ? "Change logo" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
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
                className={`${BTN} hover:border-[rgba(255,90,90,.4)] hover:text-[#FF8A8A]`}
                onClick={onLogoRemove}
              >
                <Icon name="trash" size={14} />
                Remove
              </button>
            )}
          </div>
        </div>

        {logoError && <div className={INLINE_ERROR}>{logoError}</div>}

        {logo && (
          <>
            <input
              className={RANGE}
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

            <Checkbox
              checked={logoPlate}
              onChange={onLogoPlateChange}
              className="mt-3"
            >
              Background plate behind logo
            </Checkbox>

            {ecc !== "H" && ecc !== "Q" && (
              <div className={INLINE_WARNING}>
                <span className="mt-px">
                  <Icon name="shield" size={14} />
                </span>
                Use High or Maximum error correction so the QR still scans with
                a logo.
              </div>
            )}
          </>
        )}
      </div>

      <div className={DIVIDER} />

      <div className="mb-5">
        <div className="mb-2.5 flex items-center justify-between gap-[15px]">
          <div>
            <span className={CONTROL_TITLE}>Title</span>
            <span className={CONTROL_SUB}>Printed below the QR</span>
          </div>
          {title.trim() && (
            <span className={CONTROL_META}>
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
            className={RANGE}
            type="range"
            min="3"
            max="10"
            step="0.5"
            value={titleScale}
            onChange={(e) => onTitleScaleChange(Number(e.target.value))}
            style={{ "--range-progress": `${titleProgress}%` } as CSSProperties}
            aria-label="Title size"
          />
        )}
      </div>

      <div className={DIVIDER} />

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-[15px]">
          <div>
            <span className={CONTROL_TITLE}>Dot style</span>
            <span className={CONTROL_SUB}>Shape of the QR modules</span>
          </div>
        </div>

        <div className="mt-1 grid grid-cols-3 gap-2">
          {DOT_STYLES.map((item) => {
            const active = dotStyle === item.id;
            const shape =
              item.id === "rounded"
                ? "[&>i]:rounded-[3px]"
                : item.id === "dots"
                  ? "[&>i]:rounded-full"
                  : "";
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => onDotStyleChange(item.id)}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-[13px] border px-1.5 pb-2.5 pt-[11px] text-[11px] font-semibold transition ${
                  active
                    ? "border-[rgba(0,200,150,.5)] bg-[rgba(0,200,150,.07)] text-[#00C896]"
                    : "border-[#1D2724] bg-[#0B100F] text-[#82908B] hover:border-[#33423C] hover:text-[#EDF3F0]"
                }`}
              >
                <span
                  className={`grid grid-cols-[repeat(2,9px)] gap-[3px] ${shape} [&>i]:h-[9px] [&>i]:w-[9px] [&>i]:bg-current`}
                >
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
    <div
      className={`relative flex min-h-[530px] items-center justify-center overflow-hidden max-[1050px]:min-h-[490px] max-[680px]:min-h-[400px] max-[450px]:min-h-[350px] ${
        hasQR
          ? "bg-[#080D0C] bg-[radial-gradient(circle_at_center,rgba(0,200,150,.045),transparent_23rem)]"
          : "bg-[#080D0C]"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:24px_24px] opacity-65 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[rgba(0,200,150,.055)] blur-[80px]" />

      {hasQR && qrUrl ? (
        <div className="relative z-[2] flex flex-col items-center">
          <div
            className="relative animate-[qrAppear_.4s_cubic-bezier(.16,1,.3,1)] rounded-[21px] p-[17px] shadow-[0_0_0_1px_rgba(255,255,255,.09),0_35px_100px_rgba(0,0,0,.58),0_10px_30px_rgba(0,0,0,.32)] motion-reduce:animate-none max-[680px]:rounded-[17px] max-[680px]:p-3"
            style={{ background: bg }}
          >
            <div className="pointer-events-none absolute -left-[7px] -top-[7px] z-[3] h-6 w-6 rounded-tl-[5px] border-l-2 border-t-2 border-[#00C896]" />
            <div className="pointer-events-none absolute -right-[7px] -top-[7px] z-[3] h-6 w-6 rounded-tr-[5px] border-r-2 border-t-2 border-[#00C896]" />
            <div className="pointer-events-none absolute -bottom-[7px] -left-[7px] z-[3] h-6 w-6 rounded-bl-[5px] border-b-2 border-l-2 border-[#00C896]" />
            <div className="pointer-events-none absolute -bottom-[7px] -right-[7px] z-[3] h-6 w-6 rounded-br-[5px] border-b-2 border-r-2 border-[#00C896]" />

            <div className="relative overflow-hidden rounded leading-[0]">
              {scanning && (
                <div className="absolute inset-x-0 top-0 z-[5] h-0.5 animate-[scan_.75s_ease-out_forwards] bg-[linear-gradient(90deg,transparent,#00C896,transparent)] shadow-[0_0_10px_#00C896,0_0_28px_rgba(0,200,150,.5)] motion-reduce:animate-none" />
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={qrUrl}
                src={qrUrl}
                alt="Generated QR code preview"
                width={displaySize}
                height={Math.round(displaySize * aspect)}
                className="block h-auto max-w-[min(340px,62vw)] rounded-sm max-[1050px]:max-w-[min(300px,50vw)] max-[680px]:max-w-[260px] max-[450px]:max-w-[225px]"
                onError={() => setImageError(true)}
              />
            </div>
          </div>

          <div
            className={`${MONO} mt-[18px] flex items-center gap-[7px] rounded-full border border-[rgba(0,200,150,.13)] bg-[rgba(0,200,150,.045)] px-2.5 py-[7px] text-[7px] tracking-[.1em] text-[#69A997]`}
          >
            <span className="h-[5px] w-[5px] rounded-full bg-[#00C896] shadow-[0_0_9px_#00C896]" />
            LIVE PREVIEW
          </div>
        </div>
      ) : (
        <div className="relative z-[2] max-w-[310px] p-[30px] text-center">
          <div className="relative mx-auto mb-[22px] flex h-28 w-28 items-center justify-center rounded-[27px] border border-[#202B27] bg-[#0D1311] shadow-[0_25px_55px_rgba(0,0,0,.25),inset_0_1px_0_rgba(255,255,255,.025)]">
            <div className="absolute inset-[13px] rounded-[18px] border border-dashed border-[#2B3833]" />
            <QRLogo size={58} accent="#394642" />
            <div className="absolute -right-[7px] -top-[7px] flex h-[29px] w-[29px] items-center justify-center rounded-[9px] border border-[#293630] bg-[#111815] text-[#00C896]">
              <Icon name="sparkles" size={14} />
            </div>
          </div>

          <h3 className="m-0 text-[13px] font-semibold text-[#C8D1CD]">
            Your QR appears here
          </h3>
          <p className="mx-auto mt-[7px] text-[10px] leading-[1.65] text-[#56635E]">
            Choose a format and enter your content to generate a live preview.
          </p>

          <div className="mt-[17px] inline-flex items-center gap-1.5 rounded-lg border border-[#1C2723] bg-white/[0.012] px-[9px] py-[7px] text-[8px] text-[#4F5C56]">
            <span className="text-[#00C896]">
              <Icon name="bolt" size={13} />
            </span>
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
    <div
      className={`${MONO} flex min-h-[39px] items-center gap-[9px] border-t border-[#1B2421] bg-[#0A0F0E] px-3.5 text-[8px] text-[#52605A]`}
    >
      <div className="flex items-center gap-1.5 font-semibold text-[#789089]">
        <span className="h-[5px] w-[5px] rounded-full bg-[#00C896] shadow-[0_0_0_3px_rgba(0,200,150,.07)]" />
        READY
      </div>

      <span className="text-[#29342F] max-[450px]:hidden">/</span>

      <span className="shrink-0 max-[450px]:hidden">
        {size}px · ECC {ecc}
      </span>

      <span className="text-[#29342F]">/</span>

      <span className="truncate text-[#46534D]" title={content}>
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
  const actionBase =
    "flex min-h-[43px] cursor-pointer items-center justify-center gap-2 rounded-xl transition disabled:cursor-not-allowed disabled:opacity-30";
  const outlineAction =
    "border border-[#26312D] bg-[#0B100F] text-[10px] font-semibold text-[#7A8781] hover:enabled:border-[#394640] hover:enabled:bg-[#101714] hover:enabled:text-[#EDF3F0]";

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_44px] gap-[7px] p-[13px] max-[450px]:grid-cols-[minmax(0,1fr)_42px]">
        <button
          type="button"
          disabled={disabled || downloading}
          onClick={onDownloadPng}
          className={`${actionBase} border-0 bg-[linear-gradient(135deg,#00E0A8,#00C896)] px-[15px] text-[11px] font-bold text-[#03130E] shadow-[0_10px_30px_rgba(0,200,150,.12),inset_0_1px_0_rgba(255,255,255,.2)] hover:enabled:-translate-y-px hover:enabled:shadow-[0_14px_35px_rgba(0,200,150,.18),inset_0_1px_0_rgba(255,255,255,.2)] max-[450px]:col-start-1 max-[450px]:row-start-1`}
        >
          <span className="flex h-[25px] w-[25px] items-center justify-center rounded-[7px] bg-black/[0.08]">
            <Icon name="download" size={16} />
          </span>
          {downloading ? "Preparing file..." : "Download PNG"}
          {!downloading && <Icon name="arrow" size={15} strokeWidth={2} />}
        </button>

        <button
          type="button"
          disabled={disabled || downloading}
          onClick={onDownloadSvg}
          className={`${actionBase} ${outlineAction} px-[13px] max-[450px]:col-span-full max-[450px]:row-start-2`}
        >
          <Icon name="qr" size={16} />
          SVG
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onCopyImage}
          title="Copy QR image"
          aria-label="Copy QR image"
          className={`${actionBase} max-[450px]:col-start-2 max-[450px]:row-start-1 ${
            copied
              ? "border border-[rgba(0,200,150,.25)] bg-[rgba(0,200,150,.06)] text-[#00C896]"
              : outlineAction
          }`}
        >
          <Icon name={copied ? "check" : "copy"} size={17} />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 px-[13px] pb-3.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onSave}
          className={`${BTN} ${
            saved
              ? "border-[rgba(0,200,150,.3)] bg-[rgba(0,200,150,.07)] text-[#00C896]"
              : ""
          }`}
        >
          <Icon name={saved ? "check" : "save"} size={15} />
          {saved ? "Saved to history" : "Save to history"}
        </button>

        <Checkbox checked={autoSave} onChange={onAutoSaveChange}>
          Auto-save on download
        </Checkbox>
      </div>
    </>
  );
}

function QualityCard({ ecc }: { ecc: ECCLevel }) {
  return (
    <div className="mt-3 flex gap-[11px] rounded-2xl border border-[rgba(0,200,150,.12)] bg-[linear-gradient(135deg,rgba(0,200,150,.055),rgba(0,200,150,.018))] p-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(0,200,150,.075)] text-[#00C896]">
        <Icon name="sparkles" size={17} />
      </div>

      <div className="min-w-0">
        <div
          className={`${MONO} flex items-center gap-2 text-[8px] font-bold tracking-[.12em] text-[#00C896]`}
        >
          <span>PRO QUALITY</span>
          <span className="h-px w-[25px] bg-[rgba(0,200,150,.22)]" />
        </div>

        <p className="mt-[5px] text-[9px] leading-[1.55] text-[#678078]">
          ECC <strong className="text-[#A4C4BA]">{ecc}</strong> is active. Use
          High or Maximum for printed QR codes and logo overlays.
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
    <div className="min-w-0 rounded-[13px] border border-[#1C2622] bg-[#0C1110] p-3 max-[680px]:p-[9px]">
      <div className="flex h-[25px] w-[25px] items-center justify-center rounded-lg bg-white/[0.025] text-[#66756E]">
        <Icon name={icon} size={15} />
      </div>
      <div className="mt-[9px] text-[9px] font-semibold text-[#AAB5B0] max-[680px]:text-[8px]">
        {title}
      </div>
      <div className="mt-[3px] text-[8px] text-[#4D5954] max-[680px]:text-[7px]">
        {text}
      </div>
    </div>
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
    <Panel className="mt-4 p-[18px]">
      <div className="flex items-start justify-between gap-3.5">
        <div className="flex-1">
          <SectionHeader
            number="04"
            eyebrow="HISTORY"
            title="Saved QR codes"
            description="Stored only in this browser. Click a card to open it again."
          />
        </div>

        {items.length > 0 && (
          <button
            type="button"
            className={`${BTN} flex-none ${
              confirmClear ? "border-[rgba(255,90,90,.4)] text-[#FF8A8A]" : ""
            }`}
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

      {notice && <div className={INLINE_ERROR}>{notice}</div>}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-[18px] pb-2.5 pt-[26px] text-center text-[#53605C]">
          <Icon name="history" size={22} />
          <p className="mt-1.5 text-[13px] font-semibold text-[#82908B]">
            No saved QR codes yet.
          </p>
          <span className="text-[11px]">
            Use “Save to history” under the preview.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {cards.map(({ item, data, thumb }) => (
            <div
              key={item.id}
              className="group relative rounded-[15px] border border-[#1D2724] bg-[#0B100F] transition hover:-translate-y-0.5 hover:border-[rgba(0,200,150,.4)]"
            >
              <button
                type="button"
                className="flex w-full cursor-pointer flex-col gap-1 border-0 bg-transparent p-[9px] text-left text-inherit"
                onClick={() => onLoad(item)}
                title="Open this QR"
              >
                <span
                  className="mb-1 flex aspect-square items-center justify-center overflow-hidden rounded-[9px] text-[#53605C]"
                  style={{ background: item.bg }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.dataUrl}
                      alt="Saved QR preview"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Icon name="qr" size={24} />
                  )}
                </span>

                <span className="truncate text-[11.5px] font-semibold text-[#E4ECE8]">
                  {item.title.trim() || data || "Untitled"}
                </span>

                <span
                  className={`${MONO} text-[9px] tracking-[.04em] text-[#5F6C67]`}
                >
                  {item.type} · {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </button>

              <button
                type="button"
                className="absolute right-3.5 top-3.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-black/[0.18] bg-[rgba(10,14,13,.72)] text-white opacity-0 transition hover:bg-[rgba(220,60,60,.9)] focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
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
    </Panel>
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
    if (type === "URL") return Boolean(fields.url) && !isValidURL(fields.url);
    if (type === "Email")
      return Boolean(fields.email) && !isValidEmail(fields.email);
    return false;
  }, [type, fields]);

  const triggerScan = useCallback(() => {
    setScanning(false);
    if (scanTimer.current) clearTimeout(scanTimer.current);

    scanTimer.current = setTimeout(() => {
      setScanning(true);
      scanTimer.current = setTimeout(() => setScanning(false), 750);
    }, 30);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const data = buildQRData(type, fields);
      setContent(data);
      if (data && !invalid) triggerScan();
    }, 250);

    return () => clearTimeout(timer);
  }, [type, fields, invalid, triggerScan]);

  useEffect(() => {
    if (!content || invalid) return;
    triggerScan();
  }, [fg, bg, ecc, size, content, invalid, triggerScan]);

  useEffect(() => {
    return () => {
      if (scanTimer.current) clearTimeout(scanTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
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
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [qr]);

  return (
    <main className="min-h-screen bg-[#060908] bg-[radial-gradient(circle_at_50%_-10%,rgba(0,200,150,.115),transparent_31rem),radial-gradient(circle_at_95%_40%,rgba(0,200,150,.045),transparent_26rem)] font-[Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif] text-[#F3F7F5] [&_*]:box-border">
      {/* Only keyframes live here; Tailwind has no built-in equivalent. */}
      <style>{`
        @keyframes qrAppear {
          from { opacity: 0; transform: scale(.9) translateY(8px); }
          70% { opacity: 1; transform: scale(1.015) translateY(0); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes scan {
          from { top: 0; opacity: 0; }
          12% { opacity: 1; }
          to { top: 100%; opacity: 0; }
        }
      `}</style>

      <div className="mx-auto w-[min(1220px,calc(100%-32px))] max-[680px]:w-[min(100%-20px,1220px)]">
        <header className="pb-6 pt-7 max-[680px]:pb-4 max-[680px]:pt-[18px]">
          <div className="flex items-center justify-between gap-5">
            <div className="flex items-center gap-[13px]">
              <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[15px] border border-[#293530] bg-[linear-gradient(145deg,#151D1A,#0A0F0D)] shadow-[0_15px_35px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.04)] max-[680px]:h-[42px] max-[680px]:w-[42px]">
                <QRLogo size={27} />
              </div>

              <div>
                <div className="flex items-center gap-[9px]">
                  <h1
                    className={`${MONO} m-0 text-base font-semibold tracking-[-.03em] text-[#F4F8F6] max-[450px]:text-sm`}
                  >
                    QR Studio
                  </h1>
                  <span
                    className={`${MONO} rounded-md bg-[#00C896] px-[7px] py-1 text-[8px] font-extrabold tracking-[.12em] text-[#03130E] shadow-[0_0_20px_rgba(0,200,150,.16)] max-[450px]:text-[7px]`}
                  >
                    PRO
                  </span>
                </div>

                <p className="mt-1 text-[11px] text-[#5F6C67] max-[450px]:text-[9px]">
                  Production-ready QR codes, beautifully made.
                </p>
              </div>
            </div>

            <div
              className={`${MONO} flex items-center gap-2 rounded-[11px] border border-[#1D2724] bg-[rgba(12,17,16,.78)] px-3 py-[9px] text-[9px] uppercase tracking-[.08em] text-[#68756F] max-[680px]:hidden`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#00C896] shadow-[0_0_10px_#00C896]" />
              System online
            </div>
          </div>
        </header>

        <div className="grid grid-cols-[410px_minmax(0,1fr)] items-start gap-4 max-[1050px]:grid-cols-[360px_minmax(0,1fr)] max-[900px]:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-3 max-[900px]:grid max-[900px]:grid-cols-2 max-[900px]:items-start max-[680px]:grid-cols-1 max-[680px]:gap-2.5">
            <TypeSelector value={type} onChange={handleTypeChange} />

            <Panel className="p-[18px] max-[450px]:p-[13px]">
              <SectionHeader
                number="01"
                eyebrow="CONTENT"
                title={`Create ${type} QR`}
                description={
                  QR_TYPES.find((item) => item.id === type)?.description
                }
                badge={
                  hasContent ? (
                    <span
                      className={`${MONO} whitespace-nowrap rounded-lg border border-[#1D2724] bg-[#0A0F0E] px-2 py-1.5 text-[8px] text-[#53605C]`}
                    >
                      {content.length} chars
                    </span>
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
                <div className="mt-[15px] flex items-center gap-2.5 rounded-xl border border-[rgba(0,200,150,.13)] bg-[rgba(0,200,150,.035)] p-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[rgba(0,200,150,.08)] text-[#00C896]">
                    <Icon name="check" size={13} strokeWidth={2.3} />
                  </div>

                  <div className="min-w-0">
                    <p className="m-0 text-[10px] font-semibold text-[#B8C5C0]">
                      Content ready
                    </p>
                    <p
                      className={`${MONO} mt-[3px] max-w-[280px] truncate text-[8px] text-[#50605A]`}
                    >
                      {content}
                    </p>
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

          <div className="sticky top-[18px] min-w-0 max-[900px]:static">
            <Panel>
              <div className="flex items-center justify-between gap-[15px] border-b border-[#1B2421] bg-[rgba(14,20,18,.82)] px-[17px] py-[15px] max-[680px]:p-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`${MONO} flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border border-[#24302B] bg-[rgba(0,200,150,.045)] text-[8px] text-[#00C896]`}
                  >
                    02
                  </div>

                  <div>
                    <div
                      className={`${MONO} text-[7px] tracking-[.15em] text-[#596660]`}
                    >
                      PREVIEW
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#C9D2CE]">
                      Live QR canvas
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`${MONO} rounded-lg border border-[#242E2A] bg-[#111715] px-2 py-1.5 text-[7px] tracking-[.05em] text-[#68746F] max-[680px]:hidden`}
                  >
                    {type}
                  </span>
                  <span
                    className={`${MONO} rounded-lg border border-[rgba(0,200,150,.12)] bg-[rgba(0,200,150,.045)] px-2 py-1.5 text-[7px] tracking-[.05em] text-[#67AF9D]`}
                  >
                    {size}px
                  </span>
                </div>
              </div>

              <QRPreview
                qrUrl={qr?.dataUrl ?? null}
                bg={bg}
                size={size}
                scanning={scanning}
                aspect={qr ? qr.height / qr.width : 1}
              />

              {qrError && (
                <div className={`${INLINE_ERROR} mx-[13px] mb-1 mt-0`}>
                  {qrError}
                </div>
              )}

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

            <div className="mt-3 grid grid-cols-3 gap-2 max-[680px]:gap-[5px]">
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

        <footer className="flex items-center justify-between gap-5 pb-[18px] pt-6 text-[8px] text-[#38433F] max-[680px]:flex-col max-[680px]:pb-[15px] max-[680px]:text-center">
          <span className={`${MONO} tracking-[.08em]`}>
            QR STUDIO · DARK EDITION
          </span>
          <span>Always test your QR before publishing or printing.</span>
        </footer>
      </div>
    </main>
  );
}
