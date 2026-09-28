const TOTAL_COUNTERS = 7;
const MAX_VISIBLE_PER_COUNTER = 4;

const grid = document.getElementById("boardGrid");
const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("boardDate");
const connectionBanner = document.getElementById("connectionBanner");
const overrideBanner = document.getElementById("overrideBanner");
const adsStrip = document.getElementById("adsStrip");

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
        // the rest are summarized in a "+N more waiting" line instead of
        // growing the column indefinitely.
        const visible = tokens.slice(0, MAX_VISIBLE_PER_COUNTER);
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

/* ================= SPONSORED ADS STRIP ================= */
// Pulls the same Advertisements shown on the public ZSB portal (CORS is
// already open there) and rotates through them along the bottom of the board.
const ADS_API = "https://zsb-barasat.in/api/content";
let adsList = [];
let adsIndex = 0;

function renderAd() {
    if (!adsList.length) return;

    const ad = adsList[adsIndex % adsList.length];
    adsIndex++;

    const name = ad.name || "Advertisement";
    const caption = ad.kind === "listing"
        ? [ad.category, ad.location].filter(Boolean).join(" · ")
        : (ad.description ? ad.description.replace(/<[^>]*>/g, " ").trim() : (ad.caption || ""));

    adsStrip.innerHTML = `
        ${ad.imageUrl ? `<img class="ads-strip-img" src="${ad.imageUrl}" alt="" />` : ""}
        <span class="ads-strip-text"><strong>${name}</strong>${caption ? " — " + caption : ""}</span>
    `;
}

async function loadAds() {
    try {
        const res = await fetch(ADS_API);
        const json = await res.json();

        adsList = (json.data && json.data.ads) || [];

        if (!adsList.length) {
            adsStrip.hidden = true;
            return;
        }

        adsStrip.hidden = false;
        adsIndex = 0;
        renderAd();

    } catch (err) {
        console.error("Failed to load ads:", err);
    }
}

async function loadQueue() {

    try {

        const res = await fetch(`${window.BASE_PATH}/display/queue`);
        const data = await res.json();

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
