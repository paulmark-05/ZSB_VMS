const TOTAL_COUNTERS = 7;

const grid = document.getElementById("boardGrid");
const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("boardDate");
const connectionBanner = document.getElementById("connectionBanner");

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

function renderQueue(data) {

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

        bodyEl.classList.add(densityClass(tokens.length));

        bodyEl.innerHTML = tokens.map(v => `
            <div class="token-row">
                <div class="token-number">T-${v.sequence}</div>
                <div class="token-rank">${v.rank || ""}</div>
                <div class="token-name">${v.name || ""}</div>
            </div>
        `).join("");

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

    clockEl.textContent = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });

    dateEl.textContent = now.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

}

buildColumns();
loadQueue();

updateClock();
setInterval(updateClock, 1000);

// fallback poll, in case the socket connection ever silently drops
setInterval(loadQueue, 30000);

// unattended kiosk safety net — full reload every 4 hours
setTimeout(() => location.reload(), 4 * 60 * 60 * 1000);

if (typeof io !== "undefined") {

    const socket = io();

    socket.on("connect", () => {
        connectionBanner.classList.remove("show");
        loadQueue();
    });

    socket.on("disconnect", () => {
        connectionBanner.classList.add("show");
    });

    socket.on("queue-update", loadQueue);
    socket.on("new-booking", loadQueue);
    socket.on("counter-update", loadQueue);

}
