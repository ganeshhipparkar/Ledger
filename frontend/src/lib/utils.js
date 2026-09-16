import { authHeaders } from "@/app/lib/auth";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function statusBadge(status) {
  if (!status || typeof status !== "string") {
    return "inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700";
  }
  const s = status.toLowerCase();
  if (s === "active") {
    return "inline-block rounded-full bg-green-100 px-3 py-1 text-xs text-green-700";
  }
  if (s === "inactive") {
    return "inline-block rounded-full bg-red-100 px-3 py-1 text-xs text-red-700";
  }
  return "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700";
}

export function formatStatus(status) {
  if (!status || typeof status !== "string") return "-";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strTime = String(hours).padStart(2, "0") + ":" + minutes + " " + ampm;
  return `${day}/${month}/${year} ${strTime}`;
}

export function getImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `http://localhost:4000${cleanPath}`;
}

export function limitDecimals(val, maxDec) {
  if (val === null || val === undefined || val === "") return val;
  const envMaxDec = parseInt(process.env.NEXT_PUBLIC_DECIMAL_ALLOWED, 10);
  const resolvedMaxDec = maxDec ?? (Number.isFinite(envMaxDec) && envMaxDec >= 0 ? envMaxDec : 4);
  const str = String(val);
  const parts = str.split(".");
  if (parts.length > 1 && parts[1].length > resolvedMaxDec) {
    return `${parts[0]}.${parts[1].slice(0, resolvedMaxDec)}`;
  }
  return str;
}

export function formatDisplayDate(dateString) {
  if (!dateString) return "—";
  const parsed = dayjs(dateString);
  if (!parsed.isValid()) return "—";

  const envFormat = process.env.NEXT_PUBLIC_DATE_FORMAT;
  let dayjsFormat = "DD MMM YYYY";

  if (envFormat) {
    const fmt = envFormat.toLowerCase();
    if (fmt === "yyyy-mm-dd") {
      dayjsFormat = "YYYY-MM-DD";
    } else if (fmt === "dd-mm-yyyy") {
      dayjsFormat = "DD-MM-YYYY";
    } else if (fmt === "mm-dd-yyyy") {
      dayjsFormat = "MM-DD-YYYY";
    } else {
      dayjsFormat = envFormat.toUpperCase();
    }
  }

  return parsed.format(dayjsFormat);
}


export async function downloadFile(path, filename) {
    try {
        const response = await fetch(`http://localhost:4000${path}`, {
            headers: { ...authHeaders() },
        });
        if (!response.ok) throw new Error("Failed to fetch file");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        throw err;
    }
}
