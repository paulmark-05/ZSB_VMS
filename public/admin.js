async function checkAuth() {

    try {

        const res =
            await fetch(
                `${window.BASE_PATH}/check-auth`
            );

        const data =
            await res.json();

        if (
            !data.authenticated
        ) {

            window.location.href =
                `${window.BASE_PATH}/admin-login.html`;

            return false;
        }

        return data;
    }

    catch (err) {

        window.location.href =
            `${window.BASE_PATH}/admin-login.html`;

        return false;
    }
}

let socket;

if (typeof io !== "undefined") {
    socket = io();

    socket.on("new-booking", () => {
        console.log("📥 New booking received");
        loadVisitors();
    });

    socket.on("counter-update", () => {
        console.log("🔁 Counter updated");
        loadCounters();
    });

    socket.on("queue-update", () => {
        console.log("🔁 Queue updated");
        loadVisitors();
    });

    // Another admin added, removed or edited a counter or work
    socket.on("config-update", () => {
        loadCounters();

        if (window.currentUser?.role === "superadmin") {
            populateCounterSelects();

            if (
                document.getElementById("setupDashboard").style.display !== "none"
            ) {
                loadSetup();
            }
        }
    });

} else {
    console.error("❌ Socket.IO not loaded");
}

let users = [];

function formatDate(dateStr) {

    if (!dateStr) return "";

    const [year, month, day] =
        dateStr.split("-");

    return `${day}/${month}/${year}`;
}

function formatRegistration(dateStr) {

    if (!dateStr)
        return "—";

    const d =
        new Date(dateStr);

    const day =
        String(
            d.getDate()
        ).padStart(2, "0");

    const month =
        String(
            d.getMonth() + 1
        ).padStart(2, "0");

    const hour =
        String(
            d.getHours()
        ).padStart(2, "0");

    const minute =
        String(
            d.getMinutes()
        ).padStart(2, "0");

    return `${day}/${month} ${hour}:${minute}`;
}


let allData = [];



// ================= LOAD =================
async function loadVisitors() {

    const selectedDate = document.getElementById("dateFilter").value;

    const res = await fetch(`${window.BASE_PATH}/admin/visitors?date=${selectedDate}`);
    allData = await res.json();

    populateFilterOptions();
    renderTable(allData);
    updateCounters();

}

async function loadUsers() {

    try {

        const response = await fetch(`${window.BASE_PATH}/admin/users`, {
            credentials: "same-origin"
        });

        const result = await response.json();

        if (!result.success) {

            alert(result.message || "Unable to load users.");
            return;
        }

        users = result.data;

        renderUsers();

    } catch (err) {

        console.error(err);

        alert("Unable to load users.");

    }

}

function renderUsers() {

    const tbody =
        document.getElementById("usersTableBody");

    tbody.innerHTML = "";

    users.forEach(user => {

        const row =
            document.createElement("tr");

        row.innerHTML = `

            <td>${user.username}</td>

            <td>
                ${user.role === "superadmin"
                ? "Super Admin"
                : "Counter Admin"
            }
            </td>

            <td>
                ${user.assignedCounter
                ? `Counter ${user.assignedCounter}`
                : "-"
            }
            </td>

            <td>

                ${user.active

                ? "<span class='status-active'>Active</span>"

                : "<span class='status-disabled'>Disabled</span>"
            }

            </td>

            <td>

                ${user.lastLogin

                ? new Date(
                    user.lastLogin
                ).toLocaleString()

                : "-"

            }

            </td>

            <td>

                <button
                    onclick="resetPassword('${user._id}')">

                    Reset Password

                </button>

                ${user.role !== "superadmin"

                ?

                `<button
                        onclick="toggleUserStatus('${user._id}', ${user.active})">

                        ${user.active ? "Disable" : "Enable"}

                    </button>`

                :

                ""

            }

            </td>

        `;

        tbody.appendChild(row);

    });

}

async function createUser() {
console.log("Create User clicked");
    const username =
        document
            .getElementById(
                "newUsername")
            .value.trim();

    const password =
        document
            .getElementById(
                "newPassword")
            .value;

    const assignedCounter =
        document
            .getElementById(
                "newCounter")
            .value;

    if (
        !username ||
        !password ||
        !assignedCounter
    ) {

        alert(
            "Please complete all fields."
        );

        return;

    }

    const saveBtn =
        document.getElementById("saveUserBtn");

    saveBtn.disabled = true;


    const response =
        await fetch(
            `${window.BASE_PATH}/admin/users`,
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    username,

                    password,

                    role: "counter",

                    assignedCounter

                })

            }

        );

    const result =
        await response.json();

    saveBtn.disabled = false;

    if (!result.success) {

        showToast(result.message);

        return;

    }

    closeCreateUserModal();

    await loadUsers();
    showToast("User created successfully.");

}

// ================= TABLE =================
function renderTable(data) {

    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    data.forEach(v => {

        const tr = document.createElement("tr");
        tr.dataset.id = v._id;

        tr.innerHTML = `
        <td>${formatDate(v.date)}</td>
        <td>${v.rank || ""}</td>
        <td>${v.name || ""}</td>
        <td>${v.workType}</td>
        <td>C${v.counter} / T${v.sequence}</td>
        <td>
        <input type="checkbox"
        ${v.status === "completed" ? "checked" : ""}
        onchange="toggleStatus('${v._id}', this.checked)">
        </td>
        <td>${v.subDivision}</td>
        <td>${v.zsbId || "—"}</td>
        <td>${v.serviceNo || "-"}</td>
        <td>${v.phone}</td>
        <td>${v.email || "—"}</td>
        <td>${formatRegistration(v.createdAt)}</td>
        <td class="actions-cell" style="display:${window.currentUser?.role === "superadmin" ? "table-cell" : "none"};">
            <button class="delete-btn" onclick="deleteVisitor('${v._id}')">Delete</button>
        </td>

        `;

        tbody.appendChild(tr);


        if (
            v.status ===
            "completed"
        ) {

            tr.classList.add(
                "completed-row"
            );
        }

        tr.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        "#tableBody tr"
                    )
                    .forEach(row =>
                        row.classList.remove(
                            "selected-row"
                        )
                    );

                tr.classList.add(
                    "selected-row"
                );

                tr.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });

            });
    });
}
function updateCounters(data = allData) {

    const total =
        data.length;

    const completed =
        data.filter(
            v =>
                v.status ===
                "completed"
        ).length;

    const pending =
        data.filter(
            v =>
                v.status !==
                "completed"
        ).length;

    document.getElementById(
        "totalCount"
    ).textContent =
        total;

    document.getElementById(
        "completedCount"
    ).textContent =
        completed;

    document.getElementById(
        "pendingCount"
    ).textContent =
        pending;
}

async function toggleStatus(
    id,
    isChecked
) {

    const newStatus =
        isChecked
            ? "completed"
            : "pending";

    await fetch(
        `${window.BASE_PATH}/admin/complete/${id}`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                status: newStatus
            })
        }
    );

    // UPDATE allData
    const visitor =
        allData.find(
            v => v._id === id
        );

    if (visitor) {

        visitor.status =
            newStatus;
    }

    // UPDATE ROW STYLE
    const row =
        document.querySelector(
            `tr[data-id="${id}"]`
        );

    if (!row) return;

    if (isChecked) {

        row.classList.add(
            "completed-row"
        );

    } else {

        row.classList.remove(
            "completed-row"
        );
    }

    updateCounters(allData);
}

async function deleteVisitor(id) {

    const confirmDelete =
        confirm(
            "Permanently delete this visitor record? This cannot be undone."
        );

    if (!confirmDelete) return;

    const response = await fetch(
        `${window.BASE_PATH}/admin/visitors/${id}`,
        { method: "DELETE" }
    );

    const result = await response.json();

    if (!result.success) {

        showToast(result.message || "Unable to delete record.");
        return;

    }

    allData = allData.filter(v => v._id !== id);

    renderTable(allData);
    updateCounters(allData);
    showToast("Record deleted.");

}

// ================= COUNTERS =================
async function loadCounters() {

    const dateInput =
        document
            .getElementById(
                "dateFilter"
            );

    const selectedDate =

        dateInput?.value?.trim()

            ? dateInput.value

            : new Date()
                .toISOString()
                .split("T")[0];
    const res =

        await fetch(

            `${window.BASE_PATH}/admin/counters?date=${selectedDate}`
        );

    const data =
        await res.json();

    const panel =
        document.getElementById(
            "counterPanel"
        );

    panel.innerHTML =
        "";

    for (const i of await getCounterNumbers()) {

        const isClosed =

            data
                .closedCounters
                .includes(i);

        const div =
            document.createElement(
                "div"
            );

        div.innerHTML =
            `
        <div style="
        display:flex;
        align-items:center;
        gap:8px;
        ">

            <span>
            Counter ${i}
            </span>

            <label class="switch">

            <input
            type="checkbox"

            ${!isClosed
                ? "checked"
                : ""}

            onchange=
            "toggleCounter(
            ${i},
            this.checked
            )">

            <span class=
            "sliderToggle">
            </span>

            </label>

        </div>
        `;

        div.style.color =

            isClosed
                ? "red"
                : "green";

        panel.appendChild(
            div
        );
    }
}

async function toggleCounter(
    counter,
    isOpen
) {

    const dateInput =
        document
            .getElementById(
                "dateFilter"
            );

    const selectedDate =

        dateInput?.value?.trim()

            ? dateInput.value

            : new Date()
                .toISOString()
                .split("T")[0];

    const url =

        isOpen

            ? `${window.BASE_PATH}/admin/open-counter`

            : `${window.BASE_PATH}/admin/close-counter`;

    await fetch(

        url,

        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({

                    counter,

                    date: selectedDate
                })
        }
    );

    loadCounters();
}

// ================= TV DISPLAY DATE =================

async function loadDisplayDate() {

    const res = await fetch(`${window.BASE_PATH}/admin/display-date`);
    const data = await res.json();

    document.getElementById("displayDateInput").value = data.date;

}

async function setDisplayDate(useToday = false) {

    const date = useToday

        ? new Date().toISOString().split("T")[0]

        : document.getElementById("displayDateInput").value;

    if (!date) {

        showToast("Select a date first.");
        return;

    }

    const response = await fetch(

        `${window.BASE_PATH}/admin/display-date`,

        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ date })
        }
    );

    const result = await response.json();

    if (!result.success) {

        showToast(result.message || "Unable to update display date.");
        return;

    }

    document.getElementById("displayDateInput").value = result.date;

    showToast(`TV board now showing ${result.date}.`);

}

// ================= COUNTERS & WORKS (Super Admin) =================

async function getCounterNumbers() {

    const res = await fetch(`${window.BASE_PATH}/config/form`);

    return (await res.json()).counters;

}

// Fills every counter dropdown (Create User, Add work) from the live list.
async function populateCounterSelects() {

    const counters = await getCounterNumbers();

    [
        ["newCounter", "Select Counter"],
        ["newWorkCounter", "Counter"]
    ].forEach(([id, placeholder]) => {

        const select = document.getElementById(id);

        if (!select) return;

        const previous = select.value;

        select.innerHTML = "";
        select.add(new Option(placeholder, ""));

        counters.forEach(n => select.add(new Option(`Counter ${n}`, n)));

        if ([...select.options].some(o => o.value === previous)) {
            select.value = previous;
        }

    });

}

async function setupRequest(method, path, body) {

    const response = await fetch(`${window.BASE_PATH}/admin/setup${path}`, {

        method,

        headers: { "Content-Type": "application/json" },

        body: body ? JSON.stringify(body) : undefined

    });

    try {

        return await response.json();

    } catch {

        return { success: false, message: "Unexpected response from the server." };

    }

}

let setupData = null;

async function loadSetup() {

    const response = await fetch(`${window.BASE_PATH}/admin/setup`);

    const result = await response.json();

    if (!result.success) {

        showToast(result.message || "Unable to load counters and works.");
        return;

    }

    setupData = result;

    renderSetup();

}

function textCell(text) {

    const td = document.createElement("td");

    td.textContent = text;

    return td;

}

function actionButton(label, className, onClick) {

    const button = document.createElement("button");

    button.className = className;
    button.textContent = label;
    button.onclick = onClick;

    return button;

}

// Built with DOM calls and textContent throughout, because work names are
// typed by an admin.
function renderSetup() {

    const counterBody = document.getElementById("countersTableBody");

    counterBody.innerHTML = "";

    setupData.counters.forEach(c => {

        const tr = document.createElement("tr");

        const loginCell = document.createElement("td");

        if (c.logins.length === 0) {

            loginCell.textContent = "No login yet. Create one under User Management.";
            loginCell.style.color = "#b3253a";

        } else {

            loginCell.textContent =
                c.logins
                    .map(l => l.active ? l.username : `${l.username} (disabled)`)
                    .join(", ");

        }

        const actionCell = document.createElement("td");

        actionCell.append(
            actionButton("Remove", "delete-btn", () => removeCounter(c.number))
        );

        tr.append(
            textCell(`Counter ${c.number}`),
            textCell(String(c.workCount)),
            loginCell,
            actionCell
        );

        counterBody.appendChild(tr);

    });

    const addButton = document.getElementById("addCounterBtn");
    const full = setupData.counters.length >= setupData.maxCounters;

    addButton.disabled = full;
    addButton.title = full
        ? `The TV board can show at most ${setupData.maxCounters} counters.`
        : "";

    const workBody = document.getElementById("worksTableBody");

    workBody.innerHTML = "";

    setupData.works.forEach(w => {

        const tr = document.createElement("tr");

        const counterCell = document.createElement("td");
        const counterSelect = document.createElement("select");

        setupData.counters.forEach(c =>
            counterSelect.add(new Option(`Counter ${c.number}`, c.number))
        );

        counterSelect.value = w.counter;
        counterSelect.onchange = () =>
            updateWork(w._id, { counter: Number(counterSelect.value) });

        counterCell.append(counterSelect);

        const zsbCell = document.createElement("td");
        const zsbCheck = document.createElement("input");

        zsbCheck.type = "checkbox";
        zsbCheck.checked = w.requiresZsbId;
        zsbCheck.onchange = () =>
            updateWork(w._id, { requiresZsbId: zsbCheck.checked });

        zsbCell.append(zsbCheck);

        const actionCell = document.createElement("td");

        actionCell.append(
            actionButton("Rename", "small-btn", () => renameWork(w._id, w.name)),
            " ",
            actionButton("Delete", "delete-btn", () => deleteWork(w._id, w.name))
        );

        tr.append(textCell(w.name), counterCell, zsbCell, actionCell);

        workBody.appendChild(tr);

    });

}

async function refreshAfterSetupChange() {

    await Promise.all([
        loadSetup(),
        loadCounters(),
        populateCounterSelects()
    ]);

}

async function addCounter() {

    const result = await setupRequest("POST", "/counters");

    if (!result.success) {

        showToast(result.message || "Unable to add the counter.");
        return;

    }

    showToast(`Counter ${result.number} added. Create its login under User Management.`);

    await refreshAfterSetupChange();

}

async function removeCounter(number) {

    if (!confirm(`Remove Counter ${number}? This can't be undone.`)) return;

    const result = await setupRequest("DELETE", `/counters/${number}`);

    if (!result.success) {

        showToast(result.message || "Unable to remove the counter.");
        return;

    }

    showToast(`Counter ${number} removed.`);

    await refreshAfterSetupChange();

}

async function addWork() {

    const nameInput = document.getElementById("newWorkName");
    const counter = document.getElementById("newWorkCounter").value;

    if (!nameInput.value.trim() || !counter) {

        showToast("Enter a work name and choose a counter.");
        return;

    }

    const result = await setupRequest("POST", "/works", {

        name: nameInput.value,

        counter: Number(counter),

        requiresZsbId: document.getElementById("newWorkZsb").checked

    });

    if (!result.success) {

        showToast(result.message || "Unable to add the work.");
        return;

    }

    nameInput.value = "";

    showToast("Work added. It's on the booking form now.");

    await refreshAfterSetupChange();

}

async function updateWork(id, changes) {

    const result = await setupRequest("PATCH", `/works/${id}`, changes);

    if (!result.success) {

        showToast(result.message || "Unable to update the work.");

    } else {

        showToast("Work updated.");

    }

    // reload either way so the table never shows a value the server rejected
    await refreshAfterSetupChange();

}

async function renameWork(id, currentName) {

    const name = prompt("New name for this work:", currentName);

    if (name === null || name.trim() === currentName) return;

    await updateWork(id, { name });

}

async function deleteWork(id, name) {

    if (!confirm(
        `Delete "${name}"? It disappears from the booking form. ` +
        "Existing bookings keep their record."
    )) return;

    const result = await setupRequest("DELETE", `/works/${id}`);

    if (!result.success) {

        showToast(result.message || "Unable to delete the work.");
        return;

    }

    showToast("Work deleted.");

    await refreshAfterSetupChange();

}

// ================= SEARCH =================
function populateFilterOptions() {

    const column = document.getElementById("columnSelect").value;
    const valueSelect = document.getElementById("valueSelect");

    valueSelect.innerHTML = "<option value=''>Select Value</option>";

    if (!column) return;

    const values = [...new Set(allData.map(v => v[column]))];

    values.forEach(val => {
        if (val) valueSelect.add(new Option(val, val));
    });
}

document.getElementById("columnSelect").addEventListener("change", populateFilterOptions);

function applyFilter() {

    const column =
        document.getElementById(
            "columnSelect"
        ).value;

    const value =
        document.getElementById(
            "valueSelect"
        ).value;


    let filtered =
        [...allData];

    // ===== COLUMN FILTER =====
    if (column && value) {

        filtered =
            filtered.filter(v =>
                String(v[column])
                === value
            );
    }

    renderTable(filtered);
    updateCounters(filtered);
}

function resetFilter() {

    document.getElementById(
        "columnSelect"
    ).value = "";

    document.getElementById(
        "valueSelect"
    ).innerHTML =
        `
    <option value="">
    Select Value
    </option>
    `;


    renderTable(allData);
    updateCounters(allData);
}

function closeCreateUserModal() {

    document.getElementById(
        "createUserModal"
    ).style.display = "none";

    document.getElementById(
        "newUsername"
    ).value = "";

    document.getElementById(
        "newPassword"
    ).value = "";

    document.getElementById(
        "newCounter"
    ).value = "";

}

window.addEventListener("click", function (event) {

    const modal =
        document.getElementById("createUserModal");

    if (event.target === modal) {

        closeCreateUserModal();

    }

});

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const session =
            await checkAuth();

        if (!session)
            return;

        window.currentUser =
            session.user;

        if (window.currentUser.role === "superadmin") {

            document
                .getElementById("actionsHeader")
                .style.display = "table-cell";

            loadDisplayDate();

        }

        if (window.currentUser.role === "counter") {

            const createBtn =
                document.getElementById("createUserBtn");

            if (createBtn) {

                createBtn.style.display = "none";

            }
            document
                .getElementById(
                    "adminNavigation")
                .style.display = "none";

            document
                .getElementById(
                    "assignedCounterBar")
                .style.display = "flex";

            document
                .getElementById(
                    "assignedCounterText")
                .innerHTML =

                `Counter ${window.currentUser.assignedCounter}`;

            document
                .getElementById(
                    "counterControlSection")
                .style.display = "none";

            document
                .getElementById(
                    "displayDateSection")
                .style.display = "none";

        }

        const tabs = [
            ["visitorTab", "visitorSection", null],
            ["setupTab", "setupDashboard", loadSetup],
            ["userManagementTab", "userManagementDashboard", loadUsers]
        ];

        tabs.forEach(([tabId, sectionId, onOpen]) => {

            const tab = document.getElementById(tabId);

            if (!tab) return;

            tab.onclick = async () => {

                tabs.forEach(([otherTabId, otherSectionId]) => {

                    const active = otherTabId === tabId;

                    document
                        .getElementById(otherTabId)
                        .classList.toggle("active", active);

                    document
                        .getElementById(otherSectionId)
                        .style.display = active ? "block" : "none";

                });

                if (onOpen) await onOpen();

            };

        });

        if (window.currentUser.role === "superadmin") {

            populateCounterSelects();

        }

        document
            .getElementById("createUserBtn")
            .onclick = () => {

                document
                    .getElementById(
                        "createUserModal")
                    .style.display = "flex";

            };

        document
            .getElementById(
                "saveUserBtn")
            .onclick = createUser;
        
          console.log("✅ saveUserBtn event attached");  

        document
            .getElementById("newPassword")
            .addEventListener("keypress", function (e) {

                if (e.key === "Enter") {

                    createUser();

                }

            });


        document.body.style.display =
            "block";

        const exportBtn = document.getElementById("exportBtn");
        const exportModal = document.getElementById("exportModal");

        exportBtn.addEventListener("click", () => {
            exportModal.style.display = "flex";
        });

        document
            .getElementById(
                "dateFilter"
            )
            .value =

            new Date()
                .toISOString()
                .split("T")[0];

        await loadVisitors();

        await loadCounters();

        document
            .getElementById(
                "dateFilter"
            )
            .addEventListener(

                "change",

                async () => {

                    await loadVisitors();

                    await loadCounters();
                }
            );
    });





//export
async function startExport() {

    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;

    const fields = [...document.querySelectorAll(".field-grid input:checked")]
        .map(cb => cb.value);

    if (fields.length === 0) {
        alert("Select at least one field");
        return;
    }

    const query = new URLSearchParams({
        from: fromDate,
        to: toDate,
        fields: fields.join(",")
    });

    try {

        const response = await fetch(`${window.BASE_PATH}/admin/export?${query.toString()}`);

        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = "visitor-report.xlsx";

        document.body.appendChild(a);

        a.click();

        a.remove();

        window.URL.revokeObjectURL(url);

        showToast("Excel downloaded successfully");

        closeExportModal();

    } catch (err) {

        console.error(err);
        alert("Excel download failed");

    }
}


// ================= EXPORT MODAL =================


function closeExportModal() {
    exportModal.style.display = "none";
}
function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}

// ================= LOGOUT =================

async function logout() {

    const confirmLogout =
        confirm(
            "Logout from admin panel?"
        );

    if (
        !confirmLogout
    ) return;

    await fetch(
        `${window.BASE_PATH}/logout`,
        {
            method: "POST"
        }
    );

    window.location.href =
        `${window.BASE_PATH}/admin-login.html`;
}
