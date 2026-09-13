"use strict";

/* =========================================
   METALENS PHOTO METADATA ENGINE
   ========================================= */

const $ = (selector) => document.querySelector(selector);

const fileInput = $("#fileInput");
const dropZone = $("#dropZone");
const dashboard = $("#dashboard");
const previewImage = $("#previewImage");

let currentFile = null;
let currentMetadata = {};
let currentObjectURL = null;


/* =========================================
   FILE INPUT
   ========================================= */

fileInput.addEventListener("change", async (event) => {

  const file = event.target.files?.[0];

  if (!file) return;

  await analyzeImage(file);

});


/* =========================================
   DRAG & DROP
   ========================================= */

["dragenter", "dragover"].forEach((eventName) => {

  dropZone.addEventListener(eventName, (event) => {

    event.preventDefault();

    dropZone.style.transform =
      "rotateX(0deg) rotateY(0deg) translateY(-8px) scale(1.02)";

  });

});


["dragleave", "drop"].forEach((eventName) => {

  dropZone.addEventListener(eventName, (event) => {

    event.preventDefault();

    dropZone.style.transform = "";

  });

});


dropZone.addEventListener("drop", async (event) => {

  const file = event.dataTransfer.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {

    showToast("Please select an image file.");

    return;

  }

  await analyzeImage(file);

});


/* =========================================
   MAIN ANALYSIS
   ========================================= */

async function analyzeImage(file) {

  if (!file.type.startsWith("image/")) {

    showToast("This file is not an image.");

    return;

  }

  currentFile = file;

  dropZone.classList.add("scanning");

  showToast("Scanning metadata...");

  try {

    createPreview(file);

    await wait(650);

    let metadata = {};

    if (window.exifr) {

      metadata = await exifr.parse(file, {

        tiff: true,
        exif: true,
        gps: true,
        iptc: true,
        xmp: true,
        icc: true,
        jfif: true,
        ihdr: true,

        translateValues: true,
        reviveValues: true,
        mergeOutput: true

      }) || {};

    }

    currentMetadata = metadata;

    await wait(500);

    renderMetadata(metadata);

    dropZone.classList.remove("scanning");

    dashboard.classList.remove("hidden");

    dashboard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    showToast("Analysis complete.");

  } catch (error) {

    console.error(error);

    dropZone.classList.remove("scanning");

    showToast("Could not read metadata.");

  }

}


/* =========================================
   PREVIEW
   ========================================= */

function createPreview(file) {

  if (currentObjectURL) {

    URL.revokeObjectURL(currentObjectURL);

  }

  currentObjectURL = URL.createObjectURL(file);

  previewImage.src = currentObjectURL;

  $("#fileName").textContent = file.name;

  $("#fileSize").textContent = formatBytes(file.size);

  $("#format").textContent =
    file.type.replace("image/", "").toUpperCase();

  $("#imageType").textContent =
    file.type.split("/")[1]?.toUpperCase() || "IMAGE";

  previewImage.onload = () => {

    $("#dimensions").textContent =
      `${previewImage.naturalWidth} × ${previewImage.naturalHeight}`;

  };

}


/* =========================================
   RENDER METADATA
   ========================================= */

function renderMetadata(data) {

  const get = (...keys) => {

    for (const key of keys) {

      if (
        data[key] !== undefined &&
        data[key] !== null &&
        data[key] !== ""
      ) {

        return data[key];

      }

    }

    return null;

  };


  /* DEVICE */

  const make = get(
    "Make",
    "make",
    "Manufacturer"
  );

  const model = get(
    "Model",
    "model",
    "CameraModelName"
  );

  const lens = get(
    "LensModel",
    "Lens",
    "LensInfo"
  );

  const serial = get(
    "BodySerialNumber",
    "SerialNumber",
    "CameraSerialNumber"
  );

  $("#make").textContent = display(make);

  $("#model").textContent = display(model);

  $("#lens").textContent = display(lens);

  $("#serial").textContent = display(serial);

  $("#deviceName").textContent =
    make || model
      ? `${make || ""} ${model || ""}`.trim()
      : "Not available";

  $("#deviceStatus").textContent =
    make || model ? "FOUND" : "—";


  /* DATE */

  const originalDate = get(
    "DateTimeOriginal",
    "CreateDate",
    "DateTimeDigitized"
  );

  const digitizedDate = get(
    "DateTimeDigitized",
    "CreateDate"
  );

  const modifiedDate = get(
    "ModifyDate",
    "FileModifyDate"
  );

  const timezone = get(
    "OffsetTimeOriginal",
    "OffsetTime",
    "OffsetTimeDigitized"
  );

  $("#captureDate").textContent =
    formatDate(originalDate);

  $("#originalDate").textContent =
    formatDate(originalDate);

  $("#digitizedDate").textContent =
    formatDate(digitizedDate);

  $("#timezone").textContent =
    display(timezone);

  $("#timelineCapture").textContent =
    formatDate(originalDate);

  $("#timelineDigitized").textContent =
    formatDate(digitizedDate);

  $("#timelineModified").textContent =
    formatDate(modifiedDate);


  /* GPS */

  const lat = get(
    "latitude",
    "Latitude",
    "GPSLatitude"
  );

  const lon = get(
    "longitude",
    "Longitude",
    "GPSLongitude"
  );

  const altitude = get(
    "GPSAltitude",
    "Altitude"
  );

  if (isValidCoordinate(lat, lon)) {

    const latText = Number(lat).toFixed(6);
    const lonText = Number(lon).toFixed(6);

    $("#coordinates").textContent =
      `${latText}, ${lonText}`;

    $("#gpsStatus").textContent = "FOUND";

    $("#altitude").textContent =
      altitude !== null
        ? `Altitude: ${formatNumber(altitude)} m`
        : "Altitude: —";

    const mapURL =
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;

    $("#mapLink").href = mapURL;
    $("#mapLink").classList.remove("disabled");

  } else {

    $("#coordinates").textContent =
      "No GPS data";

    $("#gpsStatus").textContent = "—";

    $("#altitude").textContent =
      "Altitude: —";

    $("#mapLink").removeAttribute("href");
    $("#mapLink").classList.add("disabled");

  }


  /* CAMERA */

  $("#iso").textContent =
    display(get("ISO", "ISOSpeedRatings"));

  $("#shutter").textContent =
    formatShutter(
      get(
        "ExposureTime",
        "ShutterSpeedValue"
      )
    );

  $("#aperture").textContent =
    formatAperture(
      get(
        "FNumber",
        "ApertureValue"
      )
    );

  $("#focal").textContent =
    formatFocal(
      get(
        "FocalLength",
        "FocalLengthIn35mmFormat"
      )
    );

  $("#flash").textContent =
    display(get("Flash"));

  $("#whiteBalance").textContent =
    display(
      get(
        "WhiteBalance"
      )
    );


  /* SOFTWARE */

  $("#software").textContent =
    display(
      get(
        "Software",
        "CreatorTool"
      )
    );

  $("#author").textContent =
    display(
      get(
        "Artist",
        "Author",
        "By-line"
      )
    );

  $("#copyright").textContent =
    display(
      get(
        "CopyrightNotice",
        "Copyright"
      )
    );

  $("#description").textContent =
    display(
      get(
        "ImageDescription",
        "Description",
        "Caption-Abstract"
      )
    );

  $("#title").textContent =
    display(
      get(
        "Title",
        "ObjectName"
      )
    );

  $("#colorSpace").textContent =
    display(
      get(
        "ColorSpace",
        "ColorSpaceData"
      )
    );


  /* FIELD COUNT */

  const fieldCount =
    Object.keys(data).filter(
      key => data[key] !== undefined &&
             data[key] !== null &&
             data[key] !== ""
    ).length;

  $("#fieldCount").textContent =
    fieldCount;


  /* RAW */

  $("#rawMetadata").textContent =
    JSON.stringify(
      sanitizeMetadata(data),
      null,
      2
    );

}


/* =========================================
   UTILITIES
   ========================================= */

function display(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return "—";

  }

  if (Array.isArray(value)) {

    return value.join(", ");

  }

  if (typeof value === "object") {

    try {

      return JSON.stringify(value);

    } catch {

      return "—";

    }

  }

  return String(value);

}


function formatDate(value) {

  if (!value) return "Not available";

  if (value instanceof Date) {

    return value.toLocaleString();

  }

  const stringValue = String(value);

  if (
    stringValue.includes(":") &&
    !stringValue.includes("T")
  ) {

    return stringValue;

  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {

    return date.toLocaleString();

  }

  return stringValue;

}


function formatBytes(bytes) {

  if (!bytes) return "0 B";

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  const index =
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(index ? 2 : 0)} ${units[index]}`;

}


function formatNumber(value) {

  const number = Number(value);

  if (Number.isNaN(number)) {

    return display(value);

  }

  return number.toFixed(2);

}


function formatShutter(value) {

  if (value === null || value === undefined) {

    return "—";

  }

  const n = Number(value);

  if (Number.isNaN(n)) {

    return display(value);

  }

  if (n > 0 && n < 1) {

    return `1/${Math.round(1 / n)}s`;

  }

  return `${n}s`;

}


function formatAperture(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "—";

  }

  const n = Number(value);

  if (Number.isNaN(n)) {

    return display(value);

  }

  return `f/${n.toFixed(1)}`;

}


function formatFocal(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "—";

  }

  const n = Number(value);

  if (Number.isNaN(n)) {

    return display(value);

  }

  return `${n.toFixed(1)}mm`;

}


function isValidCoordinate(lat, lon) {

  const latitude = Number(lat);
  const longitude = Number(lon);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );

}


function wait(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );

}


/* =========================================
   SANITIZE
   ========================================= */

function sanitizeMetadata(value, depth = 0) {

  if (depth > 8) {

    return "[Max depth]";

  }

  if (value instanceof Date) {

    return value.toISOString();

  }

  if (typeof value === "bigint") {

    return value.toString();

  }

  if (Array.isArray(value)) {

    return value.map(
      item => sanitizeMetadata(item, depth + 1)
    );

  }

  if (
    value &&
    typeof value === "object"
  ) {

    const result = {};

    for (const key of Object.keys(value)) {

      try {

        result[key] =
          sanitizeMetadata(
            value[key],
            depth + 1
          );

      } catch {

        result[key] = "[Unreadable]";

      }

    }

    return result;

  }

  return value;

}


/* =========================================
   COPY JSON
   ========================================= */

$("#copyBtn").addEventListener(
  "click",
  async () => {

    const json =
      JSON.stringify(
        sanitizeMetadata(currentMetadata),
        null,
        2
      );

    try {

      await navigator.clipboard.writeText(json);

      showToast("Metadata JSON copied.");

    } catch {

      showToast("Copy failed.");

    }

  }
);


/* =========================================
   DOWNLOAD JSON
   ========================================= */

$("#downloadBtn").addEventListener(
  "click",
  () => {

    const json =
      JSON.stringify(
        sanitizeMetadata(currentMetadata),
        null,
        2
      );

    const blob =
      new Blob(
        [json],
        { type: "application/json" }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    const baseName =
      currentFile?.name
        ?.replace(/\.[^/.]+$/, "")
        || "metadata";

    link.download =
      `${baseName}-metadata.json`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    showToast("Metadata exported.");

  }
);


/* =========================================
   NEW IMAGE
   ========================================= */

$("#newBtn").addEventListener(
  "click",
  () => {

    dashboard.classList.add("hidden");

    fileInput.value = "";

    currentMetadata = {};

    currentFile = null;

    if (currentObjectURL) {

      URL.revokeObjectURL(currentObjectURL);

      currentObjectURL = null;

    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    showToast("Ready for a new image.");

  }
);


/* =========================================
   RAW TOGGLE
   ========================================= */

$("#toggleRaw").addEventListener(
  "click",
  () => {

    const pre = $("#rawMetadata");
    const button = $("#toggleRaw");

    if (pre.dataset.expanded === "true") {

      pre.style.height = "335px";

      pre.dataset.expanded = "false";

      button.textContent = "EXPAND ↗";

    } else {

      pre.style.height = "650px";

      pre.dataset.expanded = "true";

      button.textContent = "COLLAPSE ↙";

    }

  }
);


/* =========================================
   TOAST
   ========================================= */

let toastTimer;

function showToast(message) {

  const toast = $("#toast");

  $("#toastText").textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(
      () => {
        toast.classList.remove("show");
      },
      2500
    );

}


/* =========================================
   PARALLAX 3D
   ========================================= */

if (window.matchMedia("(pointer:fine)").matches) {

  const card = document.querySelector(".upload-card");

  window.addEventListener(
    "mousemove",
    (event) => {

      if (
        dashboard &&
        !dashboard.classList.contains("hidden")
      ) {
        return;
      }

      const x =
        (event.clientX /
          window.innerWidth -
          .5) * 10;

      const y =
        (event.clientY /
          window.innerHeight -
          .5) * -8;

      card.style.transform =
        `rotateX(${y}deg) rotateY(${x}deg)`;

    }
  );

}


/* =========================================
   KEYBOARD SHORTCUT
   ========================================= */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape" &&
      !dashboard.classList.contains("hidden")
    ) {

      $("#newBtn").click();

    }

  }
);
