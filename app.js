// ===========================================================
// app.js — Money Entry & Balance Management
// Built for Firebase Firestore integration, client-side PDF export,
// real-time balance validation, people aggregation, & charts.
// ===========================================================

import { db, ENTRIES_COLLECTION } from "./firebase-config.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* ---------------------------------------------------------
   Global App State
--------------------------------------------------------- */
let entries = [];
let activeView = "dashboard";
let currentCurrency = "₹";
let activeTheme = localStorage.getItem("moneyEntryTheme") || "system";
let activeSearchQuery = "";
let activeStatusFilter = "all";
let entryToDeleteId = null;

// Chart.js instances
let chartAmountVsBalanceInstance = null;
let chartTopDebtorsInstance = null;

/* ---------------------------------------------------------
   DOM Element Cache
--------------------------------------------------------- */
// Layout & Header
const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");
const topSyncTextEl = document.getElementById("topSyncText");
const topSyncBadgeEl = document.getElementById("topSyncBadge");
const sidebarSyncTextEl = document.getElementById("sidebarSyncText");
const sidebarSyncDotEl = document.getElementById("sidebarSyncDot");

const globalSearchInput = document.getElementById("globalSearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");

// Views
const viewPanes = document.querySelectorAll(".view-pane");
const navButtons = document.querySelectorAll("[data-view]");

// Dashboard elements
const dashTotalBalanceEl = document.getElementById("dashTotalBalance");
const dashTotalAmountEl = document.getElementById("dashTotalAmount");
const dashTotalEntriesEl = document.getElementById("dashTotalEntries");
const dashTotalPeopleEl = document.getElementById("dashTotalPeople");
const dashRecentContainer = document.getElementById("dashRecentContainer");

// Add Form elements
const addEntryForm = document.getElementById("addEntryForm");
const addWhoInput = document.getElementById("addWhoInput");
const addReasonInput = document.getElementById("addReasonInput");
const addAmountInput = document.getElementById("addAmountInput");
const addBalanceInput = document.getElementById("addBalanceInput");
const addSubmitBtn = document.getElementById("addSubmitBtn");
const addClearBtn = document.getElementById("addClearBtn");
const addGroupWho = document.getElementById("addGroupWho");
const addGroupReason = document.getElementById("addGroupReason");
const addGroupAmount = document.getElementById("addGroupAmount");
const addGroupBalance = document.getElementById("addGroupBalance");

// All Entries elements
const entriesSearchInput = document.getElementById("entriesSearchInput");
const filterStatusSelect = document.getElementById("filterStatus");
const entriesTableBody = document.getElementById("entriesTableBody");
const entriesCardsGrid = document.getElementById("entriesCardsGrid");
const entriesLoadingState = document.getElementById("entriesLoadingState");
const entriesErrorState = document.getElementById("entriesErrorState");
const entriesEmptyState = document.getElementById("entriesEmptyState");
const retryFetchBtn = document.getElementById("retryFetchBtn");

// PDF dropdown elements
const pdfMenuBtn = document.getElementById("pdfMenuBtn");
const pdfDropdown = document.getElementById("pdfDropdown");
const downloadCurrentPdfBtn = document.getElementById("downloadCurrentPdfBtn");
const downloadAllPdfBtn = document.getElementById("downloadAllPdfBtn");

// People view elements
const peopleSearchInput = document.getElementById("peopleSearchInput");
const peopleGrid = document.getElementById("peopleGrid");
const peopleEmptyState = document.getElementById("peopleEmptyState");

// Reports view elements
const repTotalAmountEl = document.getElementById("repTotalAmount");
const repTotalBalanceEl = document.getElementById("repTotalBalance");
const repTotalSettledEl = document.getElementById("repTotalSettled");
const repSettlementRateEl = document.getElementById("repSettlementRate");
const reportPdfBtn = document.getElementById("reportPdfBtn");

// Settings elements
const themePicker = document.getElementById("themePicker");
const currencySelect = document.getElementById("currencySelect");
const refreshDataBtn = document.getElementById("refreshDataBtn");
const settingsPdfBtn = document.getElementById("settingsPdfBtn");

// Modals
const editModalBackdrop = document.getElementById("editModalBackdrop");
const editEntryForm = document.getElementById("editEntryForm");
const editEntryIdInput = document.getElementById("editEntryId");
const editWhoInput = document.getElementById("editWhoInput");
const editReasonInput = document.getElementById("editReasonInput");
const editAmountInput = document.getElementById("editAmountInput");
const editBalanceInput = document.getElementById("editBalanceInput");
const closeEditModalBtn = document.getElementById("closeEditModalBtn");
const cancelEditModalBtn = document.getElementById("cancelEditModalBtn");

const deleteModalBackdrop = document.getElementById("deleteModalBackdrop");
const deleteModalMsg = document.getElementById("deleteModalMsg");
const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const personModalBackdrop = document.getElementById("personModalBackdrop");
const personModalTitle = document.getElementById("personModalTitle");
const personModalSub = document.getElementById("personModalSub");
const personModalTotalAmount = document.getElementById("personModalTotalAmount");
const personModalTotalBalance = document.getElementById("personModalTotalBalance");
const personModalCount = document.getElementById("personModalCount");
const personModalEntriesList = document.getElementById("personModalEntriesList");
const closePersonModalBtn = document.getElementById("closePersonModalBtn");

const helpModalBackdrop = document.getElementById("helpModalBackdrop");
const helpModalBtn = document.getElementById("helpModalBtn");
const closeHelpModalBtn = document.getElementById("closeHelpModalBtn");

// Toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");

/* ---------------------------------------------------------
   Helpers & Formatting
--------------------------------------------------------- */
function formatMoney(num) {
  const val = Number(num) || 0;
  return `${currentCurrency}${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, isError = false) {
  toastMessage.textContent = message;
  toastIcon.textContent = isError ? "✕" : "✓";
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/* ---------------------------------------------------------
   Theme & Settings Management
--------------------------------------------------------- */
function applyTheme(theme) {
  activeTheme = theme;
  localStorage.setItem("moneyEntryTheme", theme);
  
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    document.body.setAttribute("data-theme", theme);
  }

  // Update theme pills UI
  themePicker.querySelectorAll(".theme-pill").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
}

// System theme listener
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (activeTheme === "system") {
    document.body.setAttribute("data-theme", e.matches ? "dark" : "light");
  }
});

themePicker.addEventListener("click", (e) => {
  const target = e.target.closest(".theme-pill");
  if (target) {
    applyTheme(target.dataset.theme);
  }
});

currencySelect.addEventListener("change", (e) => {
  currentCurrency = e.target.value;
  renderAllViews();
});

/* ---------------------------------------------------------
   View Navigation Router
--------------------------------------------------------- */
const viewTitles = {
  dashboard: { title: "Dashboard", subtitle: "Overview of money given and active balances" },
  "add-entry": { title: "Add Entry", subtitle: "Record new money transaction & remaining balance" },
  "all-entries": { title: "All Entries", subtitle: "Manage, filter, search, and export records" },
  people: { title: "People Ledger", subtitle: "Aggregated totals per unique person" },
  reports: { title: "Financial Reports", subtitle: "Visual breakdown and balance analytics" },
  settings: { title: "Settings", subtitle: "Application configuration and data management" }
};

function switchView(viewName) {
  if (!viewTitles[viewName]) return;
  activeView = viewName;

  // Update nav buttons active states
  navButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  // Show active pane
  viewPanes.forEach(pane => {
    pane.classList.toggle("active", pane.id === `view-${viewName}`);
  });

  // Update Top Bar titles
  const meta = viewTitles[viewName];
  pageTitleEl.textContent = meta.title;
  pageSubtitleEl.textContent = meta.subtitle;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Re-render target view
  renderAllViews();
}

// Attach click listeners to all nav triggers
document.addEventListener("click", (e) => {
  const navTrigger = e.target.closest("[data-view]");
  if (navTrigger) {
    e.preventDefault();
    switchView(navTrigger.dataset.view);
  }
});

/* ---------------------------------------------------------
   Firebase Firestore Realtime Listener
--------------------------------------------------------- */
function initFirestoreListener() {
  entriesLoadingState.hidden = false;
  entriesErrorState.hidden = true;

  const entriesQuery = query(collection(db, ENTRIES_COLLECTION), orderBy("createdAt", "desc"));

  onSnapshot(
    entriesQuery,
    (snapshot) => {
      entries = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // Update sync indicators
      topSyncTextEl.textContent = "Synced";
      topSyncBadgeEl.style.backgroundColor = "var(--primary-light)";
      sidebarSyncTextEl.textContent = "Firebase Connected";
      sidebarSyncDotEl.className = "status-dot online";

      entriesLoadingState.hidden = true;
      entriesErrorState.hidden = true;

      renderAllViews();
    },
    (error) => {
      console.error("Firestore snapshot error:", error);
      topSyncTextEl.textContent = "Offline";
      topSyncBadgeEl.style.backgroundColor = "var(--danger-bg)";
      sidebarSyncTextEl.textContent = "Connection Failed";
      sidebarSyncDotEl.className = "status-dot";

      entriesLoadingState.hidden = true;
      entriesErrorState.hidden = false;

      showToast("Unable to connect to Firebase. Check network.", true);
    }
  );
}

retryFetchBtn.addEventListener("click", () => {
  initFirestoreListener();
});

refreshDataBtn.addEventListener("click", () => {
  showToast("Refreshed Firebase connection ✓");
  initFirestoreListener();
});

/* ---------------------------------------------------------
   Render All Views
--------------------------------------------------------- */
function renderAllViews() {
  renderDashboard();
  renderAllEntries();
  renderPeople();
  renderReports();
}

/* ---------------------------------------------------------
   1. Dashboard View Logic
--------------------------------------------------------- */
function renderDashboard() {
  const totalAmount = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalBalance = entries.reduce((sum, e) => sum + (Number(e.balance) || 0), 0);
  
  // Unique people count
  const uniquePeople = new Set(entries.map(e => (e.who || "").trim().toLowerCase()).filter(Boolean));

  dashTotalAmountEl.textContent = formatMoney(totalAmount);
  dashTotalBalanceEl.textContent = formatMoney(totalBalance);
  dashTotalEntriesEl.textContent = entries.length;
  dashTotalPeopleEl.textContent = uniquePeople.size;

  // Recent 5 entries
  const recentEntries = entries.slice(0, 5);

  if (recentEntries.length === 0) {
    dashRecentContainer.innerHTML = `
      <div class="empty-state-card" style="border:none; padding:24px;">
        <p>No recent entries recorded.</p>
      </div>`;
    return;
  }

  dashRecentContainer.innerHTML = `
    <div class="desktop-table-wrapper">
      <table class="entries-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Reason</th>
            <th class="text-right">Amount</th>
            <th class="text-right">Balance</th>
            <th class="text-center">Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${recentEntries.map(entryTableRowHtml).join("")}
        </tbody>
      </table>
    </div>`;

  attachRowActionListeners(dashRecentContainer);
}

/* ---------------------------------------------------------
   2. Add Entry Logic & Strict Validation
--------------------------------------------------------- */
function validateAddForm() {
  let valid = true;
  
  // Clear previous invalid styles
  [addGroupWho, addGroupReason, addGroupAmount, addGroupBalance].forEach(g => g.classList.remove("invalid"));

  const whoVal = addWhoInput.value.trim();
  if (!whoVal) {
    addGroupWho.classList.add("invalid");
    valid = false;
  }

  const reasonVal = addReasonInput.value.trim();
  if (!reasonVal) {
    addGroupReason.classList.add("invalid");
    valid = false;
  }

  const amountVal = parseFloat(addAmountInput.value);
  if (addAmountInput.value.trim() === "" || isNaN(amountVal) || amountVal < 0) {
    addGroupAmount.classList.add("invalid");
    valid = false;
  }

  const balanceVal = parseFloat(addBalanceInput.value);
  const balanceErrorEl = document.getElementById("addBalanceError");

  if (addBalanceInput.value.trim() === "" || isNaN(balanceVal) || balanceVal < 0) {
    balanceErrorEl.textContent = "Please enter a valid balance amount (≥ 0).";
    addGroupBalance.classList.add("invalid");
    valid = false;
  } else if (!isNaN(amountVal) && balanceVal > amountVal) {
    // Balance validation: Balance MUST NOT be greater than Amount
    balanceErrorEl.textContent = "Balance cannot be greater than the amount.";
    addGroupBalance.classList.add("invalid");
    valid = false;
  }

  return valid;
}

// Live real-time validation on input
addBalanceInput.addEventListener("input", () => {
  const amountVal = parseFloat(addAmountInput.value);
  const balanceVal = parseFloat(addBalanceInput.value);
  if (!isNaN(amountVal) && !isNaN(balanceVal) && balanceVal > amountVal) {
    document.getElementById("addBalanceError").textContent = "Balance cannot be greater than the amount.";
    addGroupBalance.classList.add("invalid");
  } else {
    addGroupBalance.classList.remove("invalid");
  }
});

addEntryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validateAddForm()) return;

  addSubmitBtn.disabled = true;
  addSubmitBtn.textContent = "Saving to Firebase…";

  const entryData = {
    who: addWhoInput.value.trim(),
    reason: addReasonInput.value.trim(),
    amount: parseFloat(addAmountInput.value),
    balance: parseFloat(addBalanceInput.value),
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, ENTRIES_COLLECTION), entryData);
    
    showToast("Entry added successfully ✓");
    addEntryForm.reset();
    [addGroupWho, addGroupReason, addGroupAmount, addGroupBalance].forEach(g => g.classList.remove("invalid"));

  } catch (error) {
    console.error("Firebase save failed:", error);
    showToast("Could not save to Firebase. Try again.", true);
  } finally {
    addSubmitBtn.disabled = false;
    addSubmitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Save Entry`;
  }
});

addClearBtn.addEventListener("click", () => {
  addEntryForm.reset();
  [addGroupWho, addGroupReason, addGroupAmount, addGroupBalance].forEach(g => g.classList.remove("invalid"));
});

/* ---------------------------------------------------------
   3. All Entries View Logic & Filtering
--------------------------------------------------------- */
function getFilteredEntries() {
  return entries.filter(entry => {
    // Search query match
    const q = activeSearchQuery.toLowerCase().trim();
    const whoMatch = (entry.who || "").toLowerCase().includes(q);
    const reasonMatch = (entry.reason || "").toLowerCase().includes(q);
    const searchPass = !q || whoMatch || reasonMatch;

    // Status filter match
    let statusPass = true;
    if (activeStatusFilter === "remaining") {
      statusPass = (Number(entry.balance) || 0) > 0;
    } else if (activeStatusFilter === "settled") {
      statusPass = (Number(entry.balance) || 0) === 0;
    }

    return searchPass && statusPass;
  });
}

function renderAllEntries() {
  const filtered = getFilteredEntries();

  if (entries.length === 0) {
    entriesEmptyState.hidden = false;
    entriesTableBody.innerHTML = "";
    entriesCardsGrid.innerHTML = "";
    return;
  } else {
    entriesEmptyState.hidden = true;
  }

  if (filtered.length === 0) {
    entriesTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 24px; color: var(--text-muted);">
          No matching entries found for "${escapeHtml(activeSearchQuery)}"
        </td>
      </tr>`;
    entriesCardsGrid.innerHTML = `
      <div class="empty-state-card" style="padding: 24px;">
        <p>No matching entries found.</p>
      </div>`;
    return;
  }

  // Render Desktop Table Rows
  entriesTableBody.innerHTML = filtered.map(entryTableRowHtml).join("");

  // Render Mobile Cards
  entriesCardsGrid.innerHTML = filtered.map(entryMobileCardHtml).join("");

  attachRowActionListeners(entriesTableBody);
  attachRowActionListeners(entriesCardsGrid);
}

function entryTableRowHtml(entry) {
  const balance = Number(entry.balance) || 0;
  const isSettled = balance === 0;
  const statusBadge = isSettled 
    ? `<span class="status-pill settled">Settled</span>` 
    : `<span class="status-pill remaining">Balance</span>`;

  return `
    <tr data-id="${entry.id}">
      <td class="table-who">${escapeHtml(entry.who)}</td>
      <td class="table-reason">${escapeHtml(entry.reason)}</td>
      <td class="table-amount text-right">${formatMoney(entry.amount)}</td>
      <td class="table-balance text-right ${isSettled ? 'settled' : 'remaining'}">${formatMoney(entry.balance)}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-right">
        <button class="action-btn edit-btn" data-edit-id="${entry.id}" title="Edit Entry">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="action-btn delete-btn" data-delete-id="${entry.id}" title="Delete Entry">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </td>
    </tr>`;
}

function entryMobileCardHtml(entry) {
  const balance = Number(entry.balance) || 0;
  const isSettled = balance === 0;

  return `
    <div class="entry-card" data-id="${entry.id}">
      <div class="entry-card-header">
        <div>
          <div class="entry-card-who">${escapeHtml(entry.who)}</div>
          <div class="entry-card-reason">${escapeHtml(entry.reason)}</div>
        </div>
        <span class="status-pill ${isSettled ? 'settled' : 'remaining'}">${isSettled ? 'Settled' : 'Balance'}</span>
      </div>

      <div class="entry-card-figures">
        <div class="card-fig">
          <span class="card-fig-label">Amount Given</span>
          <span class="card-fig-val">${formatMoney(entry.amount)}</span>
        </div>
        <div class="card-fig">
          <span class="card-fig-label">Balance Remaining</span>
          <span class="card-fig-val ${isSettled ? 'settled' : 'remaining'}">${formatMoney(entry.balance)}</span>
        </div>
      </div>

      <div class="entry-card-footer">
        <span style="font-size:0.75rem; color:var(--text-muted);">Recorded Entry</span>
        <div>
          <button class="action-btn edit-btn" data-edit-id="${entry.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="action-btn delete-btn" data-delete-id="${entry.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function attachRowActionListeners(container) {
  container.querySelectorAll("[data-edit-id]").forEach(btn => {
    btn.onclick = () => openEditModal(btn.dataset.editId);
  });
  container.querySelectorAll("[data-delete-id]").forEach(btn => {
    btn.onclick = () => openDeleteModal(btn.dataset.deleteId);
  });
}

// Instant Search inputs binding
function handleSearchUpdate(queryVal) {
  activeSearchQuery = queryVal;
  globalSearchInput.value = queryVal;
  entriesSearchInput.value = queryVal;
  clearSearchBtn.hidden = !queryVal;
  renderAllEntries();
}

globalSearchInput.addEventListener("input", (e) => handleSearchUpdate(e.target.value));
entriesSearchInput.addEventListener("input", (e) => handleSearchUpdate(e.target.value));

clearSearchBtn.addEventListener("click", () => {
  handleSearchUpdate("");
});

filterStatusSelect.addEventListener("change", (e) => {
  activeStatusFilter = e.target.value;
  renderAllEntries();
});

/* ---------------------------------------------------------
   4. Edit Entry Modal & Validation
--------------------------------------------------------- */
function openEditModal(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  editEntryIdInput.value = entry.id;
  editWhoInput.value = entry.who || "";
  editReasonInput.value = entry.reason || "";
  editAmountInput.value = entry.amount || 0;
  editBalanceInput.value = entry.balance || 0;

  // Clear errors
  [
    document.getElementById("editGroupWho"),
    document.getElementById("editGroupReason"),
    document.getElementById("editGroupAmount"),
    document.getElementById("editGroupBalance")
  ].forEach(g => g.classList.remove("invalid"));

  editModalBackdrop.classList.add("open");
}

function closeEditModal() {
  editModalBackdrop.classList.remove("open");
}

closeEditModalBtn.addEventListener("click", closeEditModal);
cancelEditModalBtn.addEventListener("click", closeEditModal);
editModalBackdrop.addEventListener("click", (e) => {
  if (e.target === editModalBackdrop) closeEditModal();
});

editEntryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = editEntryIdInput.value;
  const whoVal = editWhoInput.value.trim();
  const reasonVal = editReasonInput.value.trim();
  const amountVal = parseFloat(editAmountInput.value);
  const balanceVal = parseFloat(editBalanceInput.value);

  const editGroupWho = document.getElementById("editGroupWho");
  const editGroupReason = document.getElementById("editGroupReason");
  const editGroupAmount = document.getElementById("editGroupAmount");
  const editGroupBalance = document.getElementById("editGroupBalance");
  const editBalanceError = document.getElementById("editBalanceError");

  let valid = true;
  [editGroupWho, editGroupReason, editGroupAmount, editGroupBalance].forEach(g => g.classList.remove("invalid"));

  if (!whoVal) { editGroupWho.classList.add("invalid"); valid = false; }
  if (!reasonVal) { editGroupReason.classList.add("invalid"); valid = false; }
  if (isNaN(amountVal) || amountVal < 0) { editGroupAmount.classList.add("invalid"); valid = false; }

  if (isNaN(balanceVal) || balanceVal < 0) {
    editBalanceError.textContent = "Please enter a valid balance (≥ 0).";
    editGroupBalance.classList.add("invalid");
    valid = false;
  } else if (balanceVal > amountVal) {
    editBalanceError.textContent = "Balance cannot be greater than the amount.";
    editGroupBalance.classList.add("invalid");
    valid = false;
  }

  if (!valid) return;

  const saveBtn = document.getElementById("saveEditModalBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Updating…";

  try {
    await updateDoc(doc(db, ENTRIES_COLLECTION, id), {
      who: whoVal,
      reason: reasonVal,
      amount: amountVal,
      balance: balanceVal,
      updatedAt: serverTimestamp()
    });

    closeEditModal();
    showToast("Entry updated successfully ✓");
  } catch (err) {
    console.error("Update failed:", err);
    showToast("Could not update entry in Firebase.", true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
});

/* ---------------------------------------------------------
   5. Delete Entry Modal
--------------------------------------------------------- */
function openDeleteModal(id) {
  entryToDeleteId = id;
  const entry = entries.find(e => e.id === id);
  if (entry) {
    deleteModalMsg.textContent = `Delete entry for "${entry.who} (${entry.reason})"?`;
  }
  deleteModalBackdrop.classList.add("open");
}

function closeDeleteModal() {
  deleteModalBackdrop.classList.remove("open");
  entryToDeleteId = null;
}

closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
cancelDeleteBtn.addEventListener("click", closeDeleteModal);
deleteModalBackdrop.addEventListener("click", (e) => {
  if (e.target === deleteModalBackdrop) closeDeleteModal();
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!entryToDeleteId) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting…";

  try {
    await deleteDoc(doc(db, ENTRIES_COLLECTION, entryToDeleteId));
    closeDeleteModal();
    showToast("Entry deleted successfully ✓");
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Could not delete from Firebase.", true);
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete";
  }
});

/* ---------------------------------------------------------
   6. People View Logic
--------------------------------------------------------- */
function renderPeople() {
  const peopleMap = new Map();

  entries.forEach(e => {
    const rawWho = (e.who || "").trim();
    if (!rawWho) return;
    const key = rawWho.toLowerCase();

    if (!peopleMap.has(key)) {
      peopleMap.set(key, {
        name: rawWho,
        totalAmount: 0,
        totalBalance: 0,
        entriesCount: 0,
        personEntries: []
      });
    }

    const item = peopleMap.get(key);
    item.totalAmount += (Number(e.amount) || 0);
    item.totalBalance += (Number(e.balance) || 0);
    item.entriesCount += 1;
    item.personEntries.push(e);
  });

  const peopleList = Array.from(peopleMap.values());
  const searchQuery = peopleSearchInput.value.trim().toLowerCase();

  const filteredPeople = peopleList.filter(p => p.name.toLowerCase().includes(searchQuery));

  if (filteredPeople.length === 0) {
    peopleGrid.innerHTML = "";
    peopleEmptyState.hidden = false;
    return;
  } else {
    peopleEmptyState.hidden = true;
  }

  peopleGrid.innerHTML = filteredPeople.map(p => `
    <div class="person-card" data-person-name="${escapeHtml(p.name)}">
      <div class="person-card-top">
        <div class="person-avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>
        <div class="person-name-box">
          <h4>${escapeHtml(p.name)}</h4>
          <span class="person-entries-count">${p.entriesCount} recorded ${p.entriesCount === 1 ? 'entry' : 'entries'}</span>
        </div>
      </div>
      <div class="person-stats-rows">
        <div class="p-stat">
          <span>Total Given:</span>
          <span class="p-stat-val">${formatMoney(p.totalAmount)}</span>
        </div>
        <div class="p-stat">
          <span>Remaining Balance:</span>
          <span class="p-stat-val highlight">${formatMoney(p.totalBalance)}</span>
        </div>
      </div>
    </div>
  `).join("");

  // Attach click to open person detail modal
  peopleGrid.querySelectorAll(".person-card").forEach(card => {
    card.onclick = () => {
      const name = card.dataset.personName;
      const personData = peopleList.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (personData) openPersonModal(personData);
    };
  });
}

peopleSearchInput.addEventListener("input", () => {
  renderPeople();
});

function openPersonModal(personData) {
  personModalTitle.textContent = personData.name;
  personModalSub.textContent = `All transaction records for ${personData.name}`;
  personModalTotalAmount.textContent = formatMoney(personData.totalAmount);
  personModalTotalBalance.textContent = formatMoney(personData.totalBalance);
  personModalCount.textContent = personData.entriesCount;

  personModalEntriesList.innerHTML = personData.personEntries.map(e => `
    <div class="entry-card" style="box-shadow:none;">
      <div class="entry-card-header">
        <div class="entry-card-reason" style="font-size:0.95rem; font-weight:600; color:var(--text-main);">${escapeHtml(e.reason)}</div>
        <span class="status-pill ${(Number(e.balance) || 0) === 0 ? 'settled' : 'remaining'}">
          ${(Number(e.balance) || 0) === 0 ? 'Settled' : 'Balance'}
        </span>
      </div>
      <div class="entry-card-figures">
        <div class="card-fig">
          <span class="card-fig-label">Amount Given</span>
          <span class="card-fig-val">${formatMoney(e.amount)}</span>
        </div>
        <div class="card-fig">
          <span class="card-fig-label">Balance Remaining</span>
          <span class="card-fig-val ${(Number(e.balance) || 0) === 0 ? 'settled' : 'remaining'}">${formatMoney(e.balance)}</span>
        </div>
      </div>
    </div>
  `).join("");

  personModalBackdrop.classList.add("open");
}

closePersonModalBtn.addEventListener("click", () => {
  personModalBackdrop.classList.remove("open");
});

/* ---------------------------------------------------------
   7. Reports View & Visual Charting
--------------------------------------------------------- */
function renderReports() {
  const totalAmount = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalBalance = entries.reduce((sum, e) => sum + (Number(e.balance) || 0), 0);
  const totalSettled = totalAmount - totalBalance;
  const settlementRatio = totalAmount > 0 ? ((totalSettled / totalAmount) * 100).toFixed(1) : 0;

  repTotalAmountEl.textContent = formatMoney(totalAmount);
  repTotalBalanceEl.textContent = formatMoney(totalBalance);
  repTotalSettledEl.textContent = formatMoney(totalSettled);
  repSettlementRateEl.textContent = `${settlementRatio}%`;

  renderCharts(totalAmount, totalBalance, totalSettled);
}

function renderCharts(totalAmount, totalBalance, totalSettled) {
  if (typeof window.Chart === "undefined") return;

  // Chart 1: Amount vs Balance Comparison
  const ctx1 = document.getElementById("chartAmountVsBalance")?.getContext("2d");
  if (ctx1) {
    if (chartAmountVsBalanceInstance) chartAmountVsBalanceInstance.destroy();

    chartAmountVsBalanceInstance = new window.Chart(ctx1, {
      type: "bar",
      data: {
        labels: ["Total Given", "Remaining Balance", "Settled Amount"],
        datasets: [{
          label: "Amount",
          data: [totalAmount, totalBalance, totalSettled],
          backgroundColor: ["#000000", "#52525B", "#A1A1AA"],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => `${currentCurrency}${val}`
            }
          }
        }
      }
    });
  }

  // Chart 2: Top Active Balances per Person
  const ctx2 = document.getElementById("chartTopDebtors")?.getContext("2d");
  if (ctx2) {
    if (chartTopDebtorsInstance) chartTopDebtorsInstance.destroy();

    // Aggregate balances per person
    const debtorMap = new Map();
    entries.forEach(e => {
      const name = (e.who || "Unknown").trim();
      const bal = Number(e.balance) || 0;
      if (bal > 0) {
        debtorMap.set(name, (debtorMap.get(name) || 0) + bal);
      }
    });

    const sortedDebtors = Array.from(debtorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    chartTopDebtorsInstance = new window.Chart(ctx2, {
      type: "bar",
      data: {
        labels: sortedDebtors.length ? sortedDebtors.map(d => d[0]) : ["No Active Balances"],
        datasets: [{
          label: "Remaining Balance",
          data: sortedDebtors.length ? sortedDebtors.map(d => d[1]) : [0],
          backgroundColor: "#18181B",
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (val) => `${currentCurrency}${val}`
            }
          }
        }
      }
    });
  }
}

/* ---------------------------------------------------------
   8. PDF Generation (jsPDF + AutoTable)
--------------------------------------------------------- */
pdfMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  pdfDropdown.classList.toggle("show");
});

document.addEventListener("click", () => {
  pdfDropdown.classList.remove("show");
});

function loadLogoDataUrl() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = "icons/logo.png";
  });
}

function formatPdfMoney(num) {
  const val = Number(num) || 0;
  const curr = currentCurrency === "₹" ? "Rs. " : `${currentCurrency} `;
  return `${curr}${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

async function generatePDF(exportEntries, titleSuffix = "Statement") {
  if (exportEntries.length === 0) {
    showToast("No entries available to export.", true);
    return;
  }

  showToast("Generating PDF statement…");

  try {
    const { jsPDF } = window.jspdf;
    const pdfDoc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdfDoc.internal.pageSize.getWidth();

    const logoDataUrl = await loadLogoDataUrl();

    let cursorY = 40;
    const marginX = 40;

    // Header Logo & Brand
    if (logoDataUrl) {
      pdfDoc.addImage(logoDataUrl, "PNG", marginX, cursorY - 14, 32, 32);
    }

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(18);
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text("Money Entry", marginX + (logoDataUrl ? 40 : 0), cursorY);

    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(110, 110, 110);
    const dateStr = new Date().toLocaleDateString("en-IN", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    pdfDoc.text(`Generated: ${dateStr}`, pageWidth - marginX, cursorY, { align: "right" });

    cursorY += 12;
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Financial Record ${titleSuffix}`, marginX + (logoDataUrl ? 40 : 0), cursorY);

    cursorY += 16;
    pdfDoc.setDrawColor(220, 220, 220);
    pdfDoc.setLineWidth(1);
    pdfDoc.line(marginX, cursorY, pageWidth - marginX, cursorY);

    // Summary box calculations
    const totAmount = exportEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totBalance = exportEntries.reduce((s, e) => s + (Number(e.balance) || 0), 0);

    cursorY += 24;
    pdfDoc.setFillColor(248, 248, 248);
    pdfDoc.roundedRect(marginX, cursorY, pageWidth - (marginX * 2), 44, 8, 8, "F");

    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(100, 100, 100);
    pdfDoc.text("TOTAL ENTRIES", marginX + 16, cursorY + 18);
    pdfDoc.text("TOTAL AMOUNT GIVEN", marginX + 160, cursorY + 18);
    pdfDoc.text("TOTAL BALANCE REMAINING", marginX + 340, cursorY + 18);

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(11);
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text(`${exportEntries.length}`, marginX + 16, cursorY + 33);
    pdfDoc.text(formatPdfMoney(totAmount), marginX + 160, cursorY + 33);
    
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text(formatPdfMoney(totBalance), marginX + 340, cursorY + 33);

    // PDF Data Table
    const tableRows = exportEntries.map((e) => [
      e.who || "",
      e.reason || "",
      formatPdfMoney(e.amount),
      formatPdfMoney(e.balance),
      (Number(e.balance) || 0) === 0 ? "Settled" : "Balance"
    ]);

    pdfDoc.autoTable({
      startY: cursorY + 60,
      head: [["Who", "Reason", "Amount", "Balance", "Status"]],
      body: tableRows,
      foot: [["Total", "", formatPdfMoney(totAmount), formatPdfMoney(totBalance), ""]],
      margin: { left: marginX, right: marginX },
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        cellPadding: 7,
        textColor: [0, 0, 0],
        lineColor: [230, 230, 230],
        lineWidth: 0.5
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      footStyles: {
        fillColor: [244, 244, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold"
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "center" }
      }
    });

    const finalY = pdfDoc.lastAutoTable.finalY + 24;
    pdfDoc.setFontSize(8.5);
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setTextColor(150, 155, 150);
    pdfDoc.text("Money Entry — Professional Balance Management Record", marginX, finalY);

    pdfDoc.save(`money-entry-records-${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast("PDF exported successfully ✓");

  } catch (err) {
    console.error("PDF generation failed:", err);
    showToast("Could not generate PDF document.", true);
  }
}

downloadCurrentPdfBtn.addEventListener("click", () => {
  generatePDF(getFilteredEntries(), "(Current Results)");
});

downloadAllPdfBtn.addEventListener("click", () => {
  generatePDF(entries, "(All Entries)");
});

settingsPdfBtn.addEventListener("click", () => {
  generatePDF(entries, "(All Entries)");
});

reportPdfBtn.addEventListener("click", () => {
  generatePDF(entries, "(Financial Summary)");
});

/* ---------------------------------------------------------
   9. Help & Info Modal
--------------------------------------------------------- */
helpModalBtn.addEventListener("click", () => {
  helpModalBackdrop.classList.add("open");
});

closeHelpModalBtn.addEventListener("click", () => {
  helpModalBackdrop.classList.remove("open");
});

helpModalBackdrop.addEventListener("click", (e) => {
  if (e.target === helpModalBackdrop) helpModalBackdrop.classList.remove("open");
});

/* ---------------------------------------------------------
   10. PWA Service Worker & Installation Handler
--------------------------------------------------------- */
let deferredPrompt = null;
const pwaInstallBtn = document.getElementById("pwaInstallBtn");
const pwaStatusText = document.getElementById("pwaStatusText");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (pwaInstallBtn) {
    pwaInstallBtn.hidden = false;
  }
  if (pwaStatusText) {
    pwaStatusText.textContent = "Ready to install as a standalone app";
  }
});

if (pwaInstallBtn) {
  pwaInstallBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        showToast("Money Entry installed successfully ✓");
        pwaInstallBtn.hidden = true;
        if (pwaStatusText) pwaStatusText.textContent = "App is installed";
      }
      deferredPrompt = null;
    } else {
      showToast("App install prompt is ready or already installed.");
    }
  });
}

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  if (pwaInstallBtn) pwaInstallBtn.hidden = true;
  if (pwaStatusText) pwaStatusText.textContent = "App is installed";
  showToast("Money Entry installed on home screen ✓");
});

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      console.log("ServiceWorker registration successful:", reg.scope);
    }).catch((err) => {
      console.warn("ServiceWorker registration failed:", err);
    });
  });
}

/* ---------------------------------------------------------
   11. Initialization
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(activeTheme);
  initFirestoreListener();
});
