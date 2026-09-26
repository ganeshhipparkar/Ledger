const fs = require("fs");
const path = require("path");
const CryptoJS = require("crypto-js");

async function syncEnv() {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  try {
    const SECRET = process.env.ENCRYPTION_KEY || "hiddenbrainspune";
    const res = await fetch(`${backendUrl}/mod-setting/frontend`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    let settings = payload;
    if (payload.encrypted) {
      const bytes = CryptoJS.AES.decrypt(payload.encrypted, SECRET);
      const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
      settings = JSON.parse(decryptedStr);
    }

    const envPath = path.join(__dirname, "..", ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    const lines = envContent.split(/\r?\n/);
    const updatedLines = [];
    const keysHandled = new Set();

    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        if (settings.hasOwnProperty(key)) {
          updatedLines.push(`${key}=${settings[key]}`);
          keysHandled.add(key);
        } else {
          updatedLines.push(line);
        }
      } else {
        if (line.trim() !== "") {
          updatedLines.push(line);
        }
      }
    }

    for (const key in settings) {
      if (!keysHandled.has(key)) {
        updatedLines.push(`${key}=${settings[key]}`);
      }
    }

    const newContent = updatedLines.join("\n") + (updatedLines.length > 0 ? "\n" : "");
    fs.writeFileSync(envPath, newContent);
    console.log("[sync-env] Successfully synced environment variables from backend.");

  } catch (error) {
    console.warn(`[sync-env] Warning: Could not fetch frontend settings from backend (${error.message}). Proceeding without syncing.`);
    process.exit(0);
  }
}

syncEnv();
