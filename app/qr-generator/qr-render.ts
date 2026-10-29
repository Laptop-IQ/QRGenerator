import QRCode from "qrcode";

export type RenderECC = "L" | "M" | "Q" | "H";
export type DotStyle = "square" | "rounded" | "dots";

export interface RenderOptions {
  fg: string;
  bg: string;
  ecc: RenderECC;
  /** Output width in px (height grows when a title is added). */
  size: number;
  dotStyle: DotStyle;
  /** Text shown below the QR. Empty string = no title. */
  title: string;
  /** Title font size as a percentage of the QR width. */
  titleScale: number;
  /** Logo as a data URL, or null. */
  logo: string | null;
  /** Logo side as a percentage of the QR code width. */
  logoScale: number;
  /** Draw a background plate behind the logo. */
  logoPlate: boolean;
}

export interface RenderResult {
  svg: string;
  dataUrl: string;
  width: number;
  height: number;
}

const QUIET_ZONE = 4; // modules

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function num(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function renderQr(data: string, options: RenderOptions): RenderResult {
  const {
    fg,
    bg,
    ecc,
    size,
    dotStyle,
    logo,
    logoScale,
    logoPlate,
  } = options;

  const qr = QRCode.create(data, { errorCorrectionLevel: ecc });
  const n = qr.modules.size;
  const total = n + QUIET_ZONE * 2;

  const width = size;
  const m = width / total; // module size in px
  const offset = QUIET_ZONE * m;

  // ---------- Title ----------
  const title = options.title.trim();
  let fontSize = 0;
  let titleBlock = 0;

  if (title) {
    fontSize = (width * options.titleScale) / 100;
    const estimatedWidth = Array.from(title).length * fontSize * 0.6;
    const maxWidth = width * 0.88;

    if (estimatedWidth > maxWidth) {
      fontSize = (fontSize * maxWidth) / estimatedWidth;
    }

    titleBlock = fontSize * 1.9;
  }

  const height = Math.round(width + titleBlock);

  // ---------- Logo geometry ----------
  let logoSide = 0;
  let clearHalf = 0;

  if (logo) {
    const qrSide = n * m;
    // Never let the logo reach the finder patterns.
    const maxByFinders = ((n - 16) * m) / 1.18;

    logoSide = Math.min((qrSide * logoScale) / 100, maxByFinders);
    clearHalf = (logoSide * (logoPlate ? 1.18 : 1.08)) / 2;
  }

  const cx = width / 2;
  const cy = width / 2;

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // ---------- Modules ----------
  let squarePath = "";
  let shapes = "";

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!qr.modules.get(r, c)) continue;

      const x = offset + c * m;
      const y = offset + r * m;

      if (logo) {
        const overlaps =
          x + m > cx - clearHalf &&
          x < cx + clearHalf &&
          y + m > cy - clearHalf &&
          y < cy + clearHalf;

        if (overlaps) continue;
      }

      if (dotStyle === "square") {
        squarePath += `M${num(x)} ${num(y)}h${num(m)}v${num(m)}h-${num(m)}z`;
      } else if (dotStyle === "rounded") {
        shapes += `<rect x="${num(x)}" y="${num(y)}" width="${num(m)}" height="${num(m)}" rx="${num(m * 0.32)}"/>`;
      } else if (isFinder(r, c)) {
        shapes += `<rect x="${num(x)}" y="${num(y)}" width="${num(m)}" height="${num(m)}" rx="${num(m * 0.25)}"/>`;
      } else {
        shapes += `<circle cx="${num(x + m / 2)}" cy="${num(y + m / 2)}" r="${num(m * 0.46)}"/>`;
      }
    }
  }

  const modules =
    dotStyle === "square"
      ? `<path d="${squarePath}" fill="${fg}"/>`
      : `<g fill="${fg}">${shapes}</g>`;

  // ---------- Logo ----------
  let logoMarkup = "";

  if (logo) {
    const lx = cx - logoSide / 2;
    const ly = cy - logoSide / 2;
    const radius = logoSide * 0.18;

    if (logoPlate) {
      const plate = logoSide * 1.18;
      logoMarkup += `<rect x="${num(cx - plate / 2)}" y="${num(cy - plate / 2)}" width="${num(plate)}" height="${num(plate)}" rx="${num(plate * 0.2)}" fill="${bg}"/>`;
    }

    logoMarkup +=
      `<clipPath id="logo-clip"><rect x="${num(lx)}" y="${num(ly)}" width="${num(logoSide)}" height="${num(logoSide)}" rx="${num(radius)}"/></clipPath>` +
      `<image href="${logo}" xlink:href="${logo}" x="${num(lx)}" y="${num(ly)}" width="${num(logoSide)}" height="${num(logoSide)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#logo-clip)"/>`;
  }

  // ---------- Title markup ----------
  const titleMarkup = title
    ? `<text x="${num(width / 2)}" y="${num(width + fontSize * 1.05)}" text-anchor="middle" font-family="Inter, 'Segoe UI', Arial, Helvetica, sans-serif" font-size="${num(fontSize)}" font-weight="600" fill="${fg}">${escapeXml(title)}</text>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${dotStyle === "square" ? ' shape-rendering="crispEdges"' : ""}>` +
    `<rect width="${width}" height="${height}" fill="${bg}"/>` +
    modules +
    logoMarkup +
    titleMarkup +
    `</svg>`;

  return {
    svg,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width,
    height,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image"));
    img.src = src;
  });
}

export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const img = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to create PNG"));
    }, "image/png");
  });
}

/**
 * Reads a user-selected image and downsizes it (max 256px) so it stays light
 * enough to store in the history.
 */
export async function readLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, JPG, SVG, WebP).");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Logo must be smaller than 5 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);
    const naturalW = img.naturalWidth || 256;
    const naturalH = img.naturalHeight || 256;
    const scale = Math.min(1, 256 / Math.max(naturalW, naturalH));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalW * scale));
    canvas.height = Math.max(1, Math.round(naturalH * scale));

    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
