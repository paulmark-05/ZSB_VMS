const TOTAL_COUNTERS = 7;
// The kiosk screen has room for 3 full rows per counter. A narrower mobile
// view (or the ZSB portal embed) doesn't, so it shows 2 real entries plus a
// single "+N more waiting" summary card instead of shrinking rows to fit a
// 3rd one — no scrolling needed inside a counter either way.
const MAX_VISIBLE_PER_COUNTER_DESKTOP = 3;
const MAX_VISIBLE_PER_COUNTER_MOBILE = 2;
const MOBILE_BREAKPOINT = 900;

function maxVisiblePerCounter() {
    return window.innerWidth <= MOBILE_BREAKPOINT
        ? MAX_VISIBLE_PER_COUNTER_MOBILE
        : MAX_VISIBLE_PER_COUNTER_DESKTOP;
}

const grid = document.getElementById("boardGrid");
const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("boardDate");
const connectionBanner = document.getElementById("connectionBanner");
const overrideBanner = document.getElementById("overrideBanner");
const adsPanel = document.getElementById("adsPanel");
const adsPanelBody = document.getElementById("adsPanelBody");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDDMMMYY(dateObj) {

    const dd = String(dateObj.getDate()).padStart(2, "0");
    const mon = MONTHS[dateObj.getMonth()];
    const yy = String(dateObj.getFullYear()).slice(-2);

    return `${dd} ${mon} ${yy}`;

}

function densityClass(count) {

    if (count <= 4) return "density-1";
    if (count <= 8) return "density-2";
    if (count <= 14) return "density-3";
    return "density-4";
}

function buildColumns() {

    grid.innerHTML = "";

    for (let i = 1; i <= TOTAL_COUNTERS; i++) {

        const col = document.createElement("div");
        col.className = "counter-column";
        col.id = `counter-${i}`;

        col.innerHTML = `
            <div class="counter-header">Counter ${i}</div>
            <div class="counter-body" id="counter-${i}-body"></div>
        `;

        grid.appendChild(col);
    }
}

function updateOverrideBanner(activeDate) {

    const today = new Date().toISOString().split("T")[0];

    if (activeDate === today) {

        overrideBanner.classList.remove("show");
        return;

    }

    const [y, m, d] = activeDate.split("-").map(Number);

    overrideBanner.textContent =
        `Showing queue for ${formatDDMMMYY(new Date(y, m - 1, d))}, not today`;

    overrideBanner.classList.add("show");

}

function renderQueue(data) {

    updateOverrideBanner(data.date);

    const byCounter = {};

    for (let i = 1; i <= TOTAL_COUNTERS; i++) byCounter[i] = [];

    (data.visitors || []).forEach(v => {
        if (byCounter[v.counter]) byCounter[v.counter].push(v);
    });

    for (let i = 1; i <= TOTAL_COUNTERS; i++) {

        const columnEl = document.getElementById(`counter-${i}`);
        const bodyEl = document.getElementById(`counter-${i}-body`);
        const isClosed = (data.closedCounters || []).includes(i);
        const tokens = byCounter[i];

        columnEl.classList.toggle("closed", isClosed);

        bodyEl.classList.remove("density-1", "density-2", "density-3", "density-4");

        if (isClosed) {

            bodyEl.innerHTML = `<div class="counter-closed-label">COUNTER<br>CLOSED</div>`;
            continue;

        }

        if (tokens.length === 0) {

            bodyEl.innerHTML = `<div class="counter-empty">No one waiting</div>`;
            continue;

        }

        // Show only the next few waiting tokens so the board stays readable —
        // the rest are summarized in a "+N more waiting" card instead of
        // growing the column indefinitely.
        const visible = tokens.slice(0, maxVisiblePerCounter());
        const overflow = tokens.length - visible.length;

        bodyEl.classList.add(densityClass(visible.length));

        bodyEl.innerHTML = visible.map(v => `
            <div class="token-row">
                <div class="token-number">T-${v.sequence}</div>
                <div class="token-rank">${v.rank || ""}</div>
                <div class="token-name">${v.name || ""}</div>
            </div>
        `).join("") + (overflow > 0 ? `<div class="counter-more">+${overflow} more waiting</div>` : "");

    }

}

/* ================= NOTIFICATION SOUND ================= */
// Web Audio API tone generator — no audio file asset needed. Browsers block
// audio until a user gesture happens on the page at least once, so we lazily
// create the AudioContext on the first click/touch/keypress anywhere.
let audioCtx = null;

function ensureAudioUnlocked() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
        // Web Audio not supported — sound simply won't play, nothing else breaks.
    }
}

["click", "touchstart", "keydown"].forEach(evt =>
    document.addEventListener(evt, ensureAudioUnlocked, { once: true })
);

function playChime() {
    if (!audioCtx) return; // not yet unlocked by a user gesture on this page

    try {
        const now = audioCtx.currentTime;

        [660, 880].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = "sine";
            osc.frequency.value = freq;

            const start = now + i * 0.15;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);

            osc.connect(gain).connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.34);
        });
    } catch {
        // Ignore playback errors (e.g. autoplay still blocked) — the visual
        // update from loadQueue() already happened regardless.
    }
}

/* ================= SPONSORED ADS PANEL ================= */
// Pulls the same Advertisements shown on the public ZSB portal (CORS is
// already open there) and rotates through them in a side panel next to the grid.
const ADS_API = "https://zsb-barasat.in/api/content";
let adsList = [];
let adsIndex = 0;

function renderAd() {
    if (!adsList.length) return;

    const ad = adsList[adsIndex % adsList.length];
    adsIndex++;

    const name = ad.name || "Advertisement";
    const desc = ad.kind === "listing"
        ? [ad.category, ad.location].filter(Boolean).join(" · ")
        : (ad.description ? ad.description.replace(/<[^>]*>/g, " ").trim() : (ad.caption || ""));

    // A poster ad with a link gets a scannable QR code so viewers standing at
    // the kiosk can jump straight to that page on their own phone.
    const qrBlock = ad.link
        ? `<div class="ads-panel-qr">
               <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(ad.link)}" alt="Scan to visit" />
               <span>Scan to visit</span>
           </div>`
        : "";

    adsPanelBody.innerHTML = `
        ${ad.imageUrl ? `<img class="ads-panel-poster" src="${ad.imageUrl}" alt="" />` : ""}
        <div class="ads-panel-name">${name}</div>
        ${desc ? `<div class="ads-panel-desc">${desc}</div>` : ""}
        ${qrBlock}
    `;
}

async function loadAds() {
    try {
        const res = await fetch(ADS_API);
        const json = await res.json();

        adsList = (json.data && json.data.ads) || [];

        if (!adsList.length) {
            adsPanel.hidden = true;
            return;
        }

        adsPanel.hidden = false;
        adsIndex = 0;
        renderAd();

    } catch (err) {
        console.error("Failed to load ads:", err);
    }
}

let lastQueueData = null;

async function loadQueue() {

    try {

        const res = await fetch(`${window.BASE_PATH}/display/queue`);
        const data = await res.json();

        lastQueueData = data;
        renderQueue(data);

    } catch (err) {

        console.error("Failed to load queue:", err);

    }

}

function updateClock() {

    const now = new Date();

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");

    clockEl.textContent = `${hh}${mm} HRS`;

    dateEl.textContent =
        `${WEEKDAYS[now.getDay()]} ${formatDDMMMYY(now)}`;

}

buildColumns();
loadQueue();

// Re-render (no re-fetch) when the viewport crosses the mobile breakpoint —
// e.g. a phone rotating, or the host page resizing the embedding iframe —
// so the 2-vs-3 visible row count stays correct without waiting on the
// next poll.
let resizeTimer = null;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (lastQueueData) renderQueue(lastQueueData);
    }, 200);
});

updateClock();
setInterval(updateClock, 1000);

// fallback poll, in case the socket connection ever silently drops
setInterval(loadQueue, 30000);

// unattended kiosk safety net — full reload every 4 hours
setTimeout(() => location.reload(), 4 * 60 * 60 * 1000);

loadAds();
setInterval(loadAds, 60000);  // refresh which ads are active every minute
setInterval(renderAd, 7000);  // rotate the displayed ad every 7s

if (typeof io !== "undefined") {

    const socket = io();

    socket.on("connect", () => {
        connectionBanner.classList.remove("show");
        loadQueue();
    });

    socket.on("disconnect", () => {
        connectionBanner.classList.add("show");
    });

    const onUpdate = () => { playChime(); loadQueue(); };

    socket.on("queue-update", onUpdate);
    socket.on("new-booking", onUpdate);
    socket.on("counter-update", onUpdate);

}
