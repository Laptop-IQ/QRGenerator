"use client";

/**
 * QR Studio — premium light redesign.
 *
 * Setup (once):
 *   npm i remixicon
 * The stylesheet is imported below. All icons are Remix Icon (line style).
 *
 * Behaviour, state shape, storage keys and the ./qr-render API are unchanged.
 */

import "remixicon/fonts/remixicon.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
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
  icon: IconName;
}> = [
  {
    id: "URL",
    label: "Website",
    description: "Link to a website or landing page.",
    icon: "link",
  },
  {
    id: "Text",
    label: "Text",
    description: "Show plain text when scanned.",
    icon: "text",
  },
  {
    id: "Email",
    label: "Email",
    description: "Start an email with the subject filled in.",
    icon: "mail",
  },
  {
    id: "Phone",
    label: "Phone",
    description: "Dial a phone number.",
    icon: "phone",
  },
  {
    id: "WiFi",
    label: "Wi-Fi",
    description: "Let people join a network without typing the password.",
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
  L: {
    name: "Low",
    recovery: "7%",
    description: "Smallest code, least forgiving.",
  },
  M: {
    name: "Medium",
    recovery: "15%",
    description: "Recommended for most uses.",
  },
  Q: {
    name: "High",
    recovery: "25%",
    description: "Better for printed codes.",
  },
  H: {
    name: "Maximum",
    recovery: "30%",
    description: "Best choice when adding a logo.",
  },
};

/* ------------------------------------------------------------------ */
/* Design tokens as Tailwind class strings (full literals for the JIT)  */
/*   page   #F6F4EE   surface #FFFFFF   tint   #FAF8F3                  */
/*   line   #E3DED1   line-2  #CFC8B8                                   */
/*   ink    #1B1A17   ink-2   #4A4740   ink-3  #77736A                  */
/*   brand  #1F2A56   brand-hover #16203F                               */
/* ------------------------------------------------------------------ */

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F2A56]";

const CARD =
  "rounded-xl border border-[#E3DED1] bg-white shadow-[0_1px_2px_rgba(27,26,23,0.04)]";

const INPUT_BASE = `w-full rounded-lg border border-[#CFC8B8] bg-white px-3 text-sm text-[#1B1A17] placeholder:text-[#8A8579] transition-colors hover:border-[#A9A292] focus:border-[#1F2A56] focus:outline-none focus:ring-[3px] focus:ring-[#1F2A56]/15 aria-[invalid=true]:border-[#B42318] aria-[invalid=true]:focus:ring-[#B42318]/15`;

const BTN = `inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_PRIMARY =
  "border-[#1F2A56] bg-[#1F2A56] text-white hover:enabled:bg-[#16203F]";
const BTN_SECONDARY =
  "border-[#CFC8B8] bg-white text-[#1B1A17] hover:enabled:border-[#A9A292] hover:enabled:bg-[#F6F4EE]";
const BTN_DANGER =
  "border-[#CFC8B8] bg-white text-[#B42318] hover:enabled:border-[#F1A9A0] hover:enabled:bg-[#FEF3F2]";

const RANGE =
  "h-1 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#1F2A56_var(--range-progress),#DDD7C8_var(--range-progress))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F2A56] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#1F2A56] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-[#1F2A56] [&::-moz-range-thumb]:bg-white";

const NOTICE_ERROR =
  "flex items-start gap-2 rounded-lg border border-[#F1A9A0] bg-[#FEF3F2] px-3 py-2.5 text-[13px] leading-snug text-[#B42318]";
const NOTICE_WARN =
  "flex items-start gap-2 rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-3 py-2.5 text-[13px] leading-snug text-[#93370D]";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Icons — Remix Icon, line style                                       */
/* ------------------------------------------------------------------ */

type IconName =
  | "link"
  | "text"
  | "mail"
  | "phone"
  | "wifi"
  | "check"
  | "download"
  | "copy"
  | "upload"
  | "trash"
  | "history"
  | "image"
  | "bookmark"
  | "close"
  | "qr"
  | "chevron"
  | "warning"
  | "printer"
  | "loader"
  | "success";

const ICONS: Record<IconName, string> = {
  link: "ri-link",
  text: "ri-text",
  mail: "ri-mail-line",
  phone: "ri-phone-line",
  wifi: "ri-wifi-line",
  check: "ri-check-line",
  download: "ri-download-2-line",
  copy: "ri-file-copy-line",
  upload: "ri-upload-2-line",
  trash: "ri-delete-bin-line",
  history: "ri-history-line",
  image: "ri-image-line",
  bookmark: "ri-bookmark-line",
  close: "ri-close-line",
  qr: "ri-qr-code-line",
  chevron: "ri-arrow-down-s-line",
  warning: "ri-error-warning-line",
  printer: "ri-printer-line",
  loader: "ri-loader-4-line",
  success: "ri-checkbox-circle-line",
};

function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <i
      aria-hidden="true"
      className={`${ICONS[name]} inline-block shrink-0 leading-none ${className}`}
      style={{ fontSize: size }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                           */
/* ------------------------------------------------------------------ */

function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-10 ${INPUT_BASE} ${className}`} {...props} />;
}

function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-[112px] resize-y py-2.5 leading-relaxed ${INPUT_BASE} ${className}`}
      {...props}
    />
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  error,
  right,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-[#1B1A17]"
        >
          {label}
        </label>
        {right && <span className="text-xs text-[#77736A]">{right}</span>}
      </div>
      {children}
      {error ? (
        <p
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#B42318]"
        >
          <Icon name="warning" size={15} />
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-[#77736A]">{hint}</p>
      )}
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
      className={`inline-flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-[#4A4740] ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-[#A9A292] bg-white text-white transition-colors peer-checked:border-[#1F2A56] peer-checked:bg-[#1F2A56] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1F2A56]">
        {checked && <Icon name="check" size={14} />}
      </span>
      {children}
    </label>
  );
}

function SettingRow({
  title,
  note,
  value,
  children,
}: {
  title: string;
  note?: string;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-[#EEEAE0] py-5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-medium text-[#1B1A17]">{title}</h3>
          {note && <p className="mt-0.5 text-xs text-[#77736A]">{note}</p>}
        </div>
        {value && (
          <span className="text-[13px] tabular-nums text-[#4A4740]">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-px overflow-hidden rounded-lg border border-[#CFC8B8] bg-[#CFC8B8]"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`h-9 cursor-pointer text-[13px] font-medium transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1F2A56] ${
              active
                ? "bg-[#1F2A56] text-white"
                : "bg-white text-[#4A4740] hover:bg-[#F6F4EE]"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-[#E3DED1] first:border-t-0"
    >
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#FAF8F3] [&::-webkit-details-marker]:hidden ${FOCUS} focus-visible:-outline-offset-2`}
      >
        <span>
          <span className="block text-sm font-semibold text-[#1B1A17]">
            {title}
          </span>
          <span className="mt-0.5 block text-xs text-[#77736A]">{summary}</span>
        </span>
        <Icon
          name="chevron"
          size={20}
          className="text-[#77736A] transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-5 pb-5 pt-1">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Content tabs and forms                                               */
/* ------------------------------------------------------------------ */

function TypeTabs({
  value,
  onChange,
}: {
  value: QRType;
  onChange: (value: QRType) => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = QR_TYPES.findIndex((t) => t.id === value);
    let next = index;

    if (e.key === "ArrowRight") next = (index + 1) % QR_TYPES.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + QR_TYPES.length) % QR_TYPES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = QR_TYPES.length - 1;
    else return;

    e.preventDefault();
    const target = QR_TYPES[next];
    onChange(target.id);
    requestAnimationFrame(() =>
      document.getElementById(`tab-${target.id}`)?.focus(),
    );
  };

  return (
    <div
      role="tablist"
      aria-label="QR code type"
      onKeyDown={onKeyDown}
      className="grid grid-cols-5 border-b border-[#E3DED1]"
    >
      {QR_TYPES.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="content-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={`relative flex cursor-pointer flex-col items-center justify-center gap-1 px-1 py-3 text-[13px] font-medium transition-colors first:rounded-tl-xl last:rounded-tr-xl sm:flex-row sm:gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1F2A56] ${
              active
                ? "text-[#1F2A56] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#1F2A56]"
                : "text-[#77736A] hover:bg-[#FAF8F3] hover:text-[#1B1A17]"
            }`}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </button>
        );
      })}
    </div>
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
    <FormField
      label="Web address"
      htmlFor="f-url"
      hint="Shorter addresses make simpler codes that scan faster."
      error={invalid ? "Start the address with http:// or https://" : undefined}
    >
      <Input
        id="f-url"
        type="url"
        autoFocus
        inputMode="url"
        autoComplete="url"
        placeholder="https://example.com"
        value={fields.url}
        aria-invalid={invalid}
        onChange={(e) => onChange({ ...fields, url: e.target.value })}
      />
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
  return (
    <FormField
      label="Text"
      htmlFor="f-text"
      right={`${fields.text.length.toLocaleString()} / ${MAX_TEXT.toLocaleString()}`}
    >
      <Textarea
        id="f-text"
        autoFocus
        rows={6}
        maxLength={MAX_TEXT}
        placeholder="Anything you want people to read after scanning"
        value={fields.text}
        onChange={(e) => onChange({ ...fields, text: e.target.value })}
      />
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
    <FormField
      label="Phone number"
      htmlFor="f-phone"
      hint="Scanning opens the phone’s dialer with this number."
    >
      <Input
        id="f-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus
        placeholder="+91 98765 43210"
        value={fields.phone}
        onChange={(e) => onChange({ ...fields, phone: e.target.value })}
      />
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
      <FormField
        label="Email address"
        htmlFor="f-email"
        error={invalid ? "That doesn’t look like an email address." : undefined}
      >
        <Input
          id="f-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="name@example.com"
          value={fields.email}
          aria-invalid={invalid}
          onChange={update("email")}
        />
      </FormField>

      <FormField label="Subject" htmlFor="f-subject" right="Optional">
        <Input
          id="f-subject"
          type="text"
          value={fields.subject}
          onChange={update("subject")}
        />
      </FormField>

      <FormField label="Message" htmlFor="f-body" right="Optional">
        <Textarea
          id="f-body"
          rows={4}
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
      <FormField label="Network name" htmlFor="f-ssid">
        <Input
          id="f-ssid"
          type="text"
          autoFocus
          autoComplete="off"
          value={fields.ssid}
          onChange={update("ssid")}
        />
      </FormField>

      <FormField label="Password" htmlFor="f-wifi-pass">
        <Input
          id="f-wifi-pass"
          type="text"
          autoComplete="off"
          value={fields.password}
          onChange={update("password")}
        />
      </FormField>

      <div className="mb-4 last:mb-0">
        <span className="mb-1.5 block text-[13px] font-medium text-[#1B1A17]">
          Security
        </span>
        <Segmented
          label="Wi-Fi security"
          value={fields.security}
          onChange={(security) => onChange({ ...fields, security })}
          options={[
            { id: "WPA", label: "WPA" },
            { id: "WEP", label: "WEP" },
            { id: "None", label: "None" },
          ]}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Style controls                                                       */
/* ------------------------------------------------------------------ */

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#CFC8B8] bg-white p-2 transition-colors hover:border-[#A9A292] focus-within:border-[#1F2A56] focus-within:ring-[3px] focus-within:ring-[#1F2A56]/15">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-[#E3DED1] bg-transparent p-0 focus:outline-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-[5px] [&::-moz-color-swatch]:border-0"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-xs text-[#77736A]">{label}</span>
        <span className="text-[13px] font-medium tabular-nums text-[#1B1A17]">
          {value.toUpperCase()}
        </span>
      </span>
    </label>
  );
}

function StyleControls({
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
  const progress = ((size - 150) / 850) * 100;

  return (
    <>
      <SettingRow title="Colors">
        <div className="mb-3 grid grid-cols-8 gap-2">
          {PRESETS.map((item, index) => {
            const active = preset === index;
            return (
              <button
                key={item.name}
                type="button"
                title={item.name}
                aria-label={`${item.name} colors`}
                aria-pressed={active}
                onClick={() => onPresetChange(index)}
                style={
                  {
                    "--preset-fg": item.fg,
                    "--preset-bg": item.bg,
                  } as CSSProperties
                }
                className={`aspect-square cursor-pointer rounded-md border border-black/10 bg-[linear-gradient(135deg,var(--preset-fg)_50%,var(--preset-bg)_50%)] transition-shadow ${FOCUS} ${
                  active
                    ? "ring-2 ring-[#1F2A56] ring-offset-2 ring-offset-white"
                    : "hover:ring-2 hover:ring-[#CFC8B8] hover:ring-offset-2 hover:ring-offset-white"
                }`}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ColorField label="Code" value={fg} onChange={onFgChange} />
          <ColorField label="Background" value={bg} onChange={onBgChange} />
        </div>
      </SettingRow>

      <SettingRow
        title="Size"
        note="Larger files stay sharp when printed."
        value={`${size} px`}
      >
        <input
          className={RANGE}
          type="range"
          min="150"
          max="1000"
          step="50"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          style={{ "--range-progress": `${progress}%` } as CSSProperties}
          aria-label="Output size in pixels"
        />
      </SettingRow>

      <SettingRow
        title="Error correction"
        note={`${ECC_LEVELS[ecc].description} Scans with up to ${ECC_LEVELS[ecc].recovery} of the code damaged.`}
      >
        <Segmented<ECCLevel>
          label="Error correction level"
          value={ecc}
          onChange={onEccChange}
          options={(Object.keys(ECC_LEVELS) as ECCLevel[]).map((key) => ({
            id: key,
            label: ECC_LEVELS[key].name,
          }))}
        />
      </SettingRow>
    </>
  );
}

function BrandingControls({
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
    <>
      <SettingRow
        title="Logo"
        note="Placed in the center of the code."
        value={logo ? `${logoScale}%` : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#CFC8B8] bg-[#FAF8F3] text-[#77736A]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Selected logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <Icon name="image" size={22} />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <label
              className={`${BTN} ${BTN_SECONDARY} focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1F2A56]`}
            >
              <Icon name="upload" size={16} />
              {logo ? "Replace" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
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
                className={`${BTN} ${BTN_DANGER}`}
                onClick={onLogoRemove}
              >
                <Icon name="trash" size={16} />
                Remove
              </button>
            )}
          </div>
        </div>

        {logoError && (
          <div role="alert" className={`${NOTICE_ERROR} mt-3`}>
            <Icon name="warning" size={16} className="mt-px" />
            {logoError}
          </div>
        )}

        {logo && (
          <div className="mt-4 space-y-4">
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

            <Checkbox checked={logoPlate} onChange={onLogoPlateChange}>
              Add a background behind the logo
            </Checkbox>

            {ecc !== "H" && ecc !== "Q" && (
              <div className={NOTICE_WARN}>
                <Icon name="warning" size={16} className="mt-px" />
                Switch error correction to High or Maximum so the code still
                scans with a logo.
              </div>
            )}
          </div>
        )}
      </SettingRow>

      <SettingRow
        title="Title"
        note="Printed under the code."
        value={title.trim() ? `${title.length}/${MAX_TITLE}` : undefined}
      >
        <Input
          type="text"
          maxLength={MAX_TITLE}
          placeholder="Scan to see the menu"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Title under the QR code"
        />

        {title.trim() && (
          <div className="mt-4">
            <input
              className={RANGE}
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
          </div>
        )}
      </SettingRow>

      <SettingRow title="Dot shape">
        <Segmented<DotStyle>
          label="Dot shape"
          value={dotStyle}
          onChange={onDotStyleChange}
          options={DOT_STYLES}
        />
      </SettingRow>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Preview                                                              */
/* ------------------------------------------------------------------ */

function QRPreview({
  qrUrl,
  bg,
  size,
  aspect,
  error,
}: {
  qrUrl: string | null;
  bg: string;
  size: number;
  aspect: number;
  error: string;
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [qrUrl]);

  const hasQR = Boolean(qrUrl) && !imageError;
  const displaySize = Math.min(size, 340);

  return (
    <div className="flex min-h-[320px] items-center justify-center bg-[#EFEBE0] p-6 sm:min-h-[400px] sm:p-10 print:min-h-0 print:bg-white">
      {hasQR && qrUrl ? (
        <div
          className="rounded-lg border border-black/10 p-4 shadow-[0_1px_3px_rgba(27,26,23,0.08)] print:border-0 print:shadow-none"
          style={{ background: bg }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={qrUrl}
            src={qrUrl}
            alt="Generated QR code"
            width={displaySize}
            height={Math.round(displaySize * aspect)}
            className="block h-auto max-w-full"
            style={{ maxWidth: "min(340px, 100%)" }}
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="max-w-[280px] text-center">
          <Icon
            name={error ? "warning" : "qr"}
            size={36}
            className={error ? "text-[#B42318]" : "text-[#A9A292]"}
          />
          <p className="mt-3 text-sm font-medium text-[#1B1A17]">
            {error ? "This code can’t be made yet" : "No preview yet"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#77736A]">
            {error ||
              "Enter your content on the left and the QR code appears here."}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                              */
/* ------------------------------------------------------------------ */

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
    <section
      id="saved-codes"
      className={`${CARD} mt-6 scroll-mt-6 p-5 sm:p-6 print:hidden`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1B1A17]">
            Saved codes
          </h2>
          <p className="mt-0.5 text-[13px] text-[#77736A]">
            Kept in this browser only. Select a code to edit it again.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            className={`${BTN} ${confirmClear ? BTN_DANGER : BTN_SECONDARY}`}
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
            <Icon name="trash" size={16} />
            {confirmClear ? "Select again to delete all" : "Delete all"}
          </button>
        )}
      </div>

      {notice && (
        <div role="alert" className={`${NOTICE_ERROR} mb-4`}>
          <Icon name="warning" size={16} className="mt-px" />
          {notice}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-[#CFC8B8] bg-[#FAF8F3] px-6 py-10 text-center">
          <Icon name="history" size={28} className="text-[#A9A292]" />
          <p className="mt-3 text-sm font-medium text-[#1B1A17]">
            Nothing saved yet
          </p>
          <p className="mt-1 text-[13px] text-[#77736A]">
            Use Save under the preview to keep a code here.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map(({ item, data, thumb }) => (
            <li
              key={item.id}
              className="group relative rounded-lg border border-[#E3DED1] bg-white transition-colors hover:border-[#A9A292]"
            >
              <button
                type="button"
                className={`flex w-full cursor-pointer flex-col gap-1 rounded-lg p-2.5 text-left ${FOCUS}`}
                onClick={() => onLoad(item)}
              >
                <span
                  className="mb-1.5 flex aspect-square items-center justify-center overflow-hidden rounded-md border border-[#EEEAE0] text-[#77736A]"
                  style={{ background: item.bg }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.dataUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Icon name="image" size={22} />
                  )}
                </span>

                <span className="truncate text-[13px] font-medium text-[#1B1A17]">
                  {item.title.trim() || data || "Untitled"}
                </span>
                <span className="text-xs text-[#77736A]">
                  {item.type} · {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(item.id)}
                aria-label="Delete this saved code"
                className={`absolute right-4 top-4 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#CFC8B8] bg-white text-[#4A4740] opacity-0 transition hover:border-[#F1A9A0] hover:bg-[#FEF3F2] hover:text-[#B42318] focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${FOCUS}`}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function QRGenerator() {
  const [type, setType] = useState<QRType>("URL");
  const [fields, setFields] = useState<QRFields>(emptyFields);

  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#FFFFFF");
  const [ecc, setEcc] = useState<ECCLevel>("M");
  const [size, setSize] = useState(500);
  const [preset, setPreset] = useState(0);

  const [content, setContent] = useState("");
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
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToast({ message, tone });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2800);
    },
    [],
  );

  const invalid = useMemo(() => {
    if (type === "URL") return Boolean(fields.url) && !isValidURL(fields.url);
    if (type === "Email")
      return Boolean(fields.email) && !isValidEmail(fields.email);
    return false;
  }, [type, fields]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setContent(buildQRData(type, fields));
    }, 250);

    return () => clearTimeout(timer);
  }, [type, fields]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
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
  const activeType = QR_TYPES.find((item) => item.id === type) ?? QR_TYPES[0];

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
        "Browser storage is full. Delete a few saved codes to make room (logos take the most space).",
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
    showToast("Saved to history");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }, [showToast]);

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
        showToast(
          autoSave
            ? `${format.toUpperCase()} downloaded and saved`
            : `${format.toUpperCase()} downloaded`,
        );
      } catch {
        showToast("Download failed. Please try again.", "error");
      } finally {
        setDownloading(false);
      }
    },
    [qr, title, type, size, autoSave, saveToHistory, showToast],
  );

  const handleCopyImage = useCallback(async () => {
    if (!qr) return;

    try {
      const blob = await svgToPngBlob(qr.svg, qr.width, qr.height);

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      setCopied(true);
      showToast("Image copied to clipboard");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
      showToast(
        "Couldn’t copy. Your browser may block clipboard access.",
        "error",
      );
    }
  }, [qr, showToast]);

  const encodedPreview =
    content.length > 90 ? `${content.slice(0, 90)}…` : content;

  return (
    <main className="min-h-screen bg-[#F6F4EE] font-[Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif] text-sm text-[#1B1A17] antialiased [&_*]:box-border">
      <header className="border-b border-[#E3DED1] bg-[#F6F4EE] print:hidden">
        <div className="mx-auto flex h-16 w-[min(1120px,calc(100%-32px))] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F2A56] text-white">
              <Icon name="qr" size={20} />
            </span>
            <h1 className="text-base font-semibold tracking-tight">
              QR Studio
            </h1>
          </div>

          <button
            type="button"
            className={`${BTN} ${BTN_SECONDARY}`}
            onClick={() =>
              document
                .getElementById("saved-codes")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <Icon name="history" size={16} />
            Saved codes
            {history.length > 0 && (
              <span className="text-[13px] tabular-nums text-[#77736A]">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto w-[min(1120px,calc(100%-32px))] py-6 sm:py-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          {/* ---------- Left: inputs ---------- */}
          <div className="flex min-w-0 flex-col gap-4 print:hidden">
            <section className={CARD}>
              <TypeTabs value={type} onChange={handleTypeChange} />

              <div
                id="content-panel"
                role="tabpanel"
                aria-labelledby={`tab-${type}`}
                className="p-5"
              >
                <h2 className="text-base font-semibold">{activeType.label}</h2>
                <p className="mb-5 mt-0.5 text-[13px] text-[#77736A]">
                  {activeType.description}
                </p>

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
              </div>
            </section>

            <section className={`${CARD} overflow-hidden`}>
              <Disclosure
                title="Style"
                summary="Colors, size and error correction"
                defaultOpen
              >
                <StyleControls
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
              </Disclosure>

              <Disclosure
                title="Logo, title and dots"
                summary="Branding for the center and below the code"
              >
                <BrandingControls
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
              </Disclosure>
            </section>
          </div>

          {/* ---------- Right: preview ---------- */}
          <div className="min-w-0 lg:sticky lg:top-6">
            <section
              className={`${CARD} overflow-hidden print:border-0 print:shadow-none`}
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#E3DED1] px-5 py-3.5 print:hidden">
                <h2 className="text-sm font-semibold">Preview</h2>
                <p className="text-xs tabular-nums text-[#77736A]">
                  {activeType.label} · {size} px · ECC {ecc}
                </p>
              </div>

              <QRPreview
                qrUrl={qr?.dataUrl ?? null}
                bg={bg}
                size={size}
                aspect={qr ? qr.height / qr.width : 1}
                error={qrError}
              />

              {hasContent && (
                <div className="flex items-center justify-between gap-4 border-t border-[#E3DED1] px-5 py-2.5 text-xs text-[#77736A] print:hidden">
                  <p className="min-w-0 truncate" title={content}>
                    <span className="mr-1.5">Contains</span>
                    <span className="text-[#4A4740]">{encodedPreview}</span>
                  </p>
                  <span className="shrink-0 tabular-nums">
                    {content.length} chars
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-[#E3DED1] p-4 print:hidden">
                <button
                  type="button"
                  className={`${BTN} ${BTN_PRIMARY}`}
                  disabled={!hasContent || downloading}
                  onClick={() => handleDownload("png")}
                >
                  <Icon
                    name={downloading ? "loader" : "download"}
                    size={16}
                    className={downloading ? "animate-spin" : ""}
                  />
                  {downloading ? "Preparing…" : "Download PNG"}
                </button>

                <button
                  type="button"
                  className={`${BTN} ${BTN_SECONDARY}`}
                  disabled={!hasContent || downloading}
                  onClick={() => handleDownload("svg")}
                >
                  Download SVG
                </button>

                <button
                  type="button"
                  className={`${BTN} ${BTN_SECONDARY} px-3`}
                  disabled={!hasContent}
                  onClick={handleCopyImage}
                  aria-label="Copy image"
                  title="Copy image"
                >
                  <Icon name={copied ? "check" : "copy"} size={18} />
                </button>

                <button
                  type="button"
                  className={`${BTN} ${BTN_SECONDARY} px-3`}
                  disabled={!hasContent}
                  onClick={() => window.print()}
                  aria-label="Print"
                  title="Print"
                >
                  <Icon name="printer" size={18} />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[#E3DED1] bg-[#FAF8F3] px-4 py-3 print:hidden">
                <button
                  type="button"
                  className={`${BTN} ${BTN_SECONDARY} h-9`}
                  disabled={!hasContent}
                  onClick={saveToHistory}
                >
                  <Icon name={saved ? "check" : "bookmark"} size={16} />
                  {saved ? "Saved" : "Save"}
                </button>

                <Checkbox checked={autoSave} onChange={handleAutoSaveChange}>
                  Save automatically when I download
                </Checkbox>
              </div>
            </section>

            <p className="mt-3 px-1 text-xs text-[#77736A] print:hidden">
              Test the code with your phone before you print or publish it.
            </p>
          </div>
        </div>

        <HistoryPanel
          items={history}
          notice={historyNotice}
          onLoad={handleLoadHistory}
          onDelete={handleDeleteHistory}
          onClear={handleClearHistory}
        />
      </div>

      {/* Toast */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 print:hidden"
      >
        {toast && (
          <div
            className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(27,26,23,0.18)] ${
              toast.tone === "error" ? "bg-[#B42318]" : "bg-[#1B1A17]"
            }`}
          >
            <Icon
              name={toast.tone === "error" ? "warning" : "success"}
              size={18}
            />
            {toast.message}
          </div>
        )}
      </div>
    </main>
  );
}
