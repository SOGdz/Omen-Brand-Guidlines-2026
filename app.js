import * as pdfjsLib from "./vendor/pdf.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";

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

const titleWords = ["visual system", "logo rules", "color logic", "type standards", "brand clarity"];
const stack = document.querySelector("#pageStack");
const nav = document.querySelector("#pageNav");
const readout = document.querySelector("#pageReadout");
const progressBar = document.querySelector("#progressBar");
const loader = document.querySelector("#loader");
const prevButton = document.querySelector("#prevPage");
const nextButton = document.querySelector("#nextPage");
const rotatingWord = document.querySelector("#rotatingWord");
const contactOpen = document.querySelector("#contactOpen");
const contactClose = document.querySelector("#contactClose");
const contactModal = document.querySelector("#contactModal");
const contactForm = document.querySelector("#contactForm");
const formStatus = document.querySelector("#formStatus");

let pdfDoc;
let currentPage = 1;
let titleIndex = 0;
const renderedPages = new Map();
const renderingPages = new Map();
const pageCards = [];

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const pad = (number) => String(number).padStart(2, "0");
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function createPageShell(pageNumber) {
  const card = document.createElement("article");
  card.className = "page-card";
  card.id = `page-${pageNumber}`;
  card.dataset.page = pageNumber;

  const label = document.createElement("p");
  label.className = "page-number";
  label.innerHTML = `<strong>${pad(pageNumber)}</strong> / ${pad(pageLabels.length)} ${pageLabels[pageNumber - 1]}`;

  const shell = document.createElement("div");
  shell.className = "canvas-shell";

  const placeholder = document.createElement("div");
  placeholder.className = "page-placeholder";
  placeholder.textContent = "Loading page";
  shell.append(placeholder);

  card.append(label, shell);
  stack.append(card);
  pageCards.push(card);
}

function createNavigation() {
  pageLabels.forEach((label, index) => {
    const pageNumber = index + 1;
    const link = document.createElement("a");
    link.href = `#page-${pageNumber}`;
    link.dataset.page = pageNumber;
    link.innerHTML = `<span>${pad(pageNumber)}</span><span>${label}</span>`;
    nav.append(link);
  });
}

function rotateTitle() {
  setInterval(() => {
    titleIndex = (titleIndex + 1) % titleWords.length;
    rotatingWord.textContent = titleWords[titleIndex];
    rotatingWord.style.animation = "none";
    requestAnimationFrame(() => {
      rotatingWord.style.animation = "";
    });
  }, 2200);
}

async function renderPage(pageNumber) {
  const card = pageCards[pageNumber - 1];
  const shell = card?.querySelector(".canvas-shell");
  if (!pdfDoc || !shell || renderedPages.get(pageNumber) === shell.clientWidth) return;
  if (renderingPages.has(pageNumber)) return renderingPages.get(pageNumber);

  const job = (async () => {
    shell.replaceChildren();

    const page = await pdfDoc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(280, shell.clientWidth);
    const scale = availableWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.8);

    const canvas = document.createElement("canvas");
    canvas.className = "page-canvas";
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

    renderedPages.set(pageNumber, shell.clientWidth);
    renderingPages.delete(pageNumber);
  })();

  renderingPages.set(pageNumber, job);
  return job;
}

function updateCurrentPage(pageNumber) {
  currentPage = Math.min(Math.max(pageNumber, 1), pageLabels.length);
  readout.textContent = `${pad(currentPage)} / ${pad(pageLabels.length)}`;

  document.querySelectorAll(".page-index a").forEach((link) => {
    link.classList.toggle("is-active", Number(link.dataset.page) === currentPage);
  });

  pageCards.forEach((card) => {
    card.classList.toggle("is-current", Number(card.dataset.page) === currentPage);
  });
}

function updateProgress() {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const percentage = height <= 0 ? 0 : (window.scrollY / height) * 100;
  progressBar.style.width = `${clamp(percentage, 0, 100)}%`;
}

function syncCurrentPageFromViewport() {
  const targetY = Math.min(170, window.innerHeight * 0.22);
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

function updatePageScale() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const center = window.innerHeight / 2;
  pageCards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const distance = Math.abs((rect.top + rect.height / 2 - center) / window.innerHeight);
    card.style.setProperty("--page-scale", clamp(1 - distance * 0.025, 0.965, 1).toFixed(3));
  });
}

function scrollToPage(pageNumber) {
  const target = document.querySelector(`#page-${pageNumber}`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupObservers() {
  const observer = new IntersectionObserver(
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

  pageCards.forEach((card) => observer.observe(card));
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
        updatePageScale();
        ticking = false;
      });
    },
    { passive: true },
  );

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderedPages.clear();
      renderingPages.clear();
      const visibleCards = pageCards.filter((card) => card.classList.contains("is-visible"));
      visibleCards.forEach((card) => renderPage(Number(card.dataset.page)));
      updatePageScale();
    }, 180);
  });
}

function openContactModal() {
  contactModal.classList.add("is-open");
  contactModal.setAttribute("aria-hidden", "false");
  contactModal.style.opacity = "1";
  contactModal.style.visibility = "visible";
  contactModal.style.pointerEvents = "auto";
  document.querySelector("#visitorName")?.focus();
}

function closeContactModal() {
  contactModal.classList.remove("is-open");
  contactModal.setAttribute("aria-hidden", "true");
  contactModal.style.opacity = "";
  contactModal.style.visibility = "";
  contactModal.style.pointerEvents = "";
  contactOpen?.focus();
}

function setupContactModal() {
  contactOpen?.addEventListener("click", openContactModal);
  contactClose?.addEventListener("click", closeContactModal);

  contactModal?.addEventListener("click", (event) => {
    if (event.target === contactModal) closeContactModal();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && contactModal?.classList.contains("is-open")) {
      closeContactModal();
    }
  });

  contactForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = {
      name: document.querySelector("#visitorName")?.value.trim() || "",
      contact: document.querySelector("#visitorContact")?.value.trim() || "",
      message: document.querySelector("#visitorMessage")?.value.trim() || "",
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem("omenVisitorContact", JSON.stringify(data));
    formStatus.textContent = "Saved on this device.";
  });
}

async function init() {
  try {
    if (!location.hash) window.scrollTo({ top: 0, left: 0 });
    pageLabels.forEach((_, index) => createPageShell(index + 1));
    createNavigation();
    setupControls();
    setupContactModal();
    rotateTitle();

    pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
    await renderPage(1);
    setupObservers();
    updateCurrentPage(1);
    updateProgress();
    syncCurrentPageFromViewport();
    updatePageScale();
    loader.classList.add("is-done");
  } catch (error) {
    console.error(error);
    loader.textContent = "Could not load the PDF.";
  }
}

init();
