const socket = io();
console.log("script.js loaded");

// ================== GLOBAL ELEMENTS ==================
const branch = document.getElementById("branch");
const subDivision = document.getElementById("subDivision");
const workOptions = document.getElementById("workOptions");
const consentCheckbox = document.getElementById("consentCheckbox");
const submitBtn = document.getElementById("submitBtn");

// ================== HOLIDAYS ==================
const holidays = ["2026-01-26", "2026-08-15"];

const branchPrefixes = {
    "ZSB North 24 Parganas": "WB 10/"
};

// ================== MASTER CONFIG ==================
const branchData = {
    "ZSB North 24 Parganas": {
        sub: ["Barasat", "Barrackpore", "Bongaon", "Basirhat", "Bidhannagar"]
    }
};

// ================== WORK LIST ==================
// Managed by the Super Admin (Setup tab), so it's loaded from the server
// instead of being hardcoded here.
let workList = [];
let workLoadFailed = false;

async function loadFormConfig() {

    try {

        const res = await fetch(`${window.BASE_PATH}/config/form`);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        workList = (await res.json()).works;
        workLoadFailed = false;

    } catch (err) {

        console.error("Could not load the work list:", err);
        workLoadFailed = true;

    }

}


// ================== CLOSED COUNTERS ==================
let closedCounters = [];
async function fetchClosedCounters() {
    const selectedDate =

        document
            .getElementById(
                "datePicker"
            )?.value ||

        new Date()
            .toISOString()
            .split("T")[0];

    const res =
        await fetch(

            `${window.BASE_PATH}/admin/counters?date=${selectedDate}`

        );
        
    const data = await res.json();
    closedCounters = data.closedCounters;
}

function formatDate(dateStr) {

    if (!dateStr) return "";

    const [year, month, day] =
        dateStr.split("-");

    return `${day}-${month}-${year}`;
}


// ================== POPULATE ==================
function populateDynamic() {
    // remember the visitor's pick so a live update doesn't silently clear it
    const previousWork =
        document.querySelector("input[name='work']:checked")?.value;

    subDivision.innerHTML = `
<option value="" disabled selected>
Select Sub Division
</option>
`;
    workOptions.innerHTML = "";

    const data = branchData[branch.value];
    if (!data) return;
    document.getElementById("zsbPrefix").textContent = branchPrefixes[branch.value] || "WB/";

    subDivision.disabled = false;
    const zsbValue = document.getElementById("zsbId").value.trim();
    const isValidZSB = /^\d{6}$/.test(zsbValue);

    // subdivisions
    data.sub.forEach(s => {
        subDivision.add(new Option(s, s));
    });

    // work options
    if (workLoadFailed) {

        const notice = document.createElement("p");
        notice.style.color = "red";
        notice.textContent =
            "Couldn't load the list of services. Please refresh the page.";
        workOptions.appendChild(notice);
        return;

    }

    workList.forEach(w => {

        const isClosed = closedCounters.includes(w.counter);

        const disableByZsb = w.requiresZsbId !== false && (!zsbValue || !isValidZSB);
        const disabled = isClosed || disableByZsb;

        const label = document.createElement("label");
        label.style.display = "block";
        label.style.marginBottom = "6px";

        // Built with DOM calls rather than an HTML string: work names are
        // typed by an admin and may contain quotes or ampersands.
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "work";
        radio.value = w.name;
        radio.dataset.counter = w.counter;
        radio.disabled = disabled;

        const counterTag = document.createElement("span");
        counterTag.style.cssText = "color:#777;font-size:12px;";
        counterTag.textContent = `(Counter ${w.counter})`;

        label.append(radio, ` ${w.name} `, counterTag);

        if (isClosed) {

            const closedTag = document.createElement("span");
            closedTag.style.cssText = "color:red;font-size:11px;";
            closedTag.textContent = " - CLOSED";
            label.append(closedTag);

        }

        if (disableByZsb) {

            const zsbTag = document.createElement("span");
            zsbTag.title = "ZSB ID card not available";
            zsbTag.style.cssText = "color:red;font-size:11px;";
            zsbTag.textContent = " - ZSB ID REQUIRED";
            label.append(zsbTag);

        }

        if (radio.value === previousWork && !disabled) radio.checked = true;

        workOptions.appendChild(label);
    });
}


// ================== CALENDAR ==================
// ================== CALENDAR ==================
function initCalendar() {

    const now =
        new Date();

    const today =
        new Date();

    today.setHours(
        0, 0, 0, 0
    );

    if (
        now.getHours() >= 14
    ) {
        today.setDate(
            today.getDate() + 1
        );
    }

    let allowedDates = [];

    function toISO(date) {

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function isWorkingDay(date) {

        const iso =
            toISO(date);

        return (

            date.getDay() !== 0 &&

            date.getDay() !== 6 &&

            !holidays.includes(iso)

        );
    }

    // ---------- CASE 1 ----------
    // Today is working day

    if (isWorkingDay(today)) {

        allowedDates.push(
            toISO(today)
        );

        let nextWorking =
            new Date(today);

        do {

            nextWorking.setDate(
                nextWorking.getDate() + 1
            );

        }

        while (
            !isWorkingDay(
                nextWorking
            )
        );

        allowedDates.push(
            toISO(
                nextWorking
            )
        );

    }

    // ---------- CASE 2 ----------
    // Today NOT working day

    else {

        let tempDate =
            new Date(today);

        while (
            allowedDates.length < 2
        ) {

            tempDate.setDate(
                tempDate.getDate() + 1
            );

            if (
                isWorkingDay(
                    tempDate
                )
            ) {

                allowedDates.push(
                    toISO(
                        tempDate
                    )
                );
            }
        }
    }

    flatpickr(
        "#datePicker",
        {

            dateFormat:
                "Y-m-d",

            altInput:
                true,

            altFormat:
                "d-m-Y",

            enable:
                allowedDates,

            defaultDate:
                allowedDates[0]

        }
    );

    console.log(
        "Allowed dates:",
        allowedDates
    );
}

document.addEventListener("DOMContentLoaded", async () => {

    await Promise.all([loadFormConfig(), fetchClosedCounters()]);
    populateDynamic();

    // calendar
    initCalendar();

    // branch change
    branch.onchange = populateDynamic;

    // consent checkbox
    consentCheckbox.addEventListener("change", () => {
        if (consentCheckbox.checked) {
            submitBtn.disabled = false;
            submitBtn.classList.add("active");
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.remove("active");
        }
    });

});


socket.on(
    "config-update",
    async () => {

        await Promise.all([loadFormConfig(), fetchClosedCounters()]);

        populateDynamic();
    }
);

socket.on(
    "counter-update",
    async () => {

        await fetchClosedCounters();

        populateDynamic();

        console.log(
            "Counter live updated"
        );
    }
);

document
.getElementById(
    "datePicker"
)
.addEventListener(
    "change",
    async ()=>{

        await fetchClosedCounters();

        populateDynamic();
    }
);
