import * as pdfjsLib from "./vendor/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";

const PDF_URL = "./assets/brand-guidelines-v2.pdf";
const pageLabels = [
  "Cover",
  "Brand Foundation",
  "Brand",
  "Vision and Mission",
  "Logo",
  "Primary Logo",
  "Logo Lockups",
  "Scaling",
  "Clear Space",
  "Logo Placement",
  "Partnerships",
  "Logo and Colour",
  "Misuse",
  "Colour",
  "Primary Colour",
  "Secondary Colour",
  "Tertiary Colours",
  "Colour Proportions",
  "Accessibility",
  "Combinations",
  "Typography",
  "Type System",
  "Hierarchy",
  "Usage",
  "Examples",
  "Photography",
  "Photography Style",
  "Image Treatment",
  "Elements",
  "Graphic Elements",
  "Patterns",
  "Applications",
  "Stationery",
  "Digital",
  "Thank You",
];

const stack = document.querySelector("#pageStack");
const nav = document.querySelector("#pageNav");
const readout = document.querySelector("#pageReadout");
const progressBar = document.querySelector("#progressBar");
const loader = document.querySelector("#loader");
const prevButton = document.querySelector("#prevPage");
const nextButton = document.querySelector("#nextPage");

let pdfDoc;
let currentPage = 1;
const renderedPages = new Map();
const pageCards = [];

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const pad = (number) => String(number).padStart(2, "0");

function createPageShell(pageNumber) {
  const card = document.createElement("article");
  card.className = "page-card";
  card.id = `page-${pageNumber}`;
  card.dataset.page = pageNumber;

  const label = document.createElement("p");
  label.className = "page-number";
  label.textContent = `${pad(pageNumber)} / ${pad(pageLabels.length)} ${pageLabels[pageNumber - 1]}`;

  const shell = document.createElement("div");
  shell.className = "canvas-shell";

  const placeholder = document.createElement("div");
  placeholder.className = "page-placeholder";
  placeholder.textContent = "Preparing page";
  shell.append(placeholder);

  card.append(label, shell);
  stack.append(card);
  pageCards.push(card);
}

function createNavigation() {
  pageLabels.forEach((label, index) => {
    const pageNumber = index + 1;
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = `#page-${pageNumber}`;
    link.dataset.page = pageNumber;
    link.innerHTML = `<span>${pad(pageNumber)}</span><span>${label}</span>`;
    nav.append(link);
  });
}

async function renderPage(pageNumber) {
  const card = pageCards[pageNumber - 1];
  const shell = card?.querySelector(".canvas-shell");
  if (!pdfDoc || !shell || renderedPages.get(pageNumber) === shell.clientWidth) return;

  renderedPages.set(pageNumber, shell.clientWidth);
  shell.replaceChildren();

  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(280, shell.clientWidth);
  const scale = availableWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.25);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  shell.append(canvas);

  await page.render({
    canvasContext: context,
    viewport,
    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  }).promise;
}

function updateCurrentPage(pageNumber) {
  currentPage = Math.min(Math.max(pageNumber, 1), pageLabels.length);
  readout.textContent = `${pad(currentPage)} / ${pad(pageLabels.length)}`;

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("is-active", Number(link.dataset.page) === currentPage);
  });

  pageCards.forEach((card) => {
    card.classList.toggle("is-current", Number(card.dataset.page) === currentPage);
  });
}

function updateProgress() {
  const scrollTop = window.scrollY;
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const percentage = height <= 0 ? 0 : (scrollTop / height) * 100;
  progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
}

function syncCurrentPageFromViewport() {
  const targetY = window.innerHeight * 0.28;
  const nearest = pageCards.reduce(
    (best, card) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.top - targetY);
      return distance < best.distance ? { page: Number(card.dataset.page), distance } : best;
    },
    { page: currentPage, distance: Number.POSITIVE_INFINITY },
  );

  updateCurrentPage(nearest.page);
}

function scrollToPage(pageNumber) {
  const target = document.querySelector(`#page-${pageNumber}`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addTilt(card) {
  const shell = card.querySelector(".canvas-shell");
  if (!shell) return;

  card.addEventListener("pointermove", (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = shell.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    shell.style.setProperty("--tilt-x", (x * 2.3).toFixed(2));
    shell.style.setProperty("--tilt-y", (y * 2.3).toFixed(2));
  });

  card.addEventListener("pointerleave", () => {
    shell.style.setProperty("--tilt-x", "0");
    shell.style.setProperty("--tilt-y", "0");
  });
}

function setupObservers() {
  const renderObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const pageNumber = Number(entry.target.dataset.page);
        entry.target.classList.add("is-visible");
        renderPage(pageNumber);
      });
    },
    { rootMargin: "900px 0px" },
  );

  pageCards.forEach((card) => {
    renderObserver.observe(card);
    addTilt(card);
  });
}

function setupControls() {
  prevButton.addEventListener("click", () => scrollToPage(currentPage - 1));
  nextButton.addEventListener("click", () => scrollToPage(currentPage + 1));
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      updateProgress();
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        syncCurrentPageFromViewport();
        ticking = false;
      });
    },
    { passive: true },
  );

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const visibleCards = pageCards.filter((card) => card.classList.contains("is-visible"));
      visibleCards.forEach((card) => renderPage(Number(card.dataset.page)));
    }, 180);
  });
}

async function init() {
  try {
    if (!location.hash) window.scrollTo({ top: 0, left: 0 });
    pageLabels.forEach((_, index) => createPageShell(index + 1));
    createNavigation();
    setupControls();

    pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
    setupObservers();
    updateCurrentPage(1);
    updateProgress();
    await renderPage(1);
    syncCurrentPageFromViewport();
    loader.classList.add("is-done");
  } catch (error) {
    console.error(error);
    loader.textContent = "Could not load the PDF. Open this folder through the local server.";
  }
}

init();
