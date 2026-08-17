/**
 * Research Output page: list / add / soft-delete entries stored in a Google Sheet
 * via a Google Apps Script Web App bound to that sheet.
 *
 * NOTE: this endpoint is public (Anyone can call it, no login) by design, so the
 * /exec URL below is not a secret. "Delete" only hides a row (soft delete) --
 * it never destroys data, so it stays safe to expose publicly.
 */
(function () {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbxLC48dlOqJqh051V3tdjl7Ho2faDl3KrDcmi6CdiBeXOeuQy-VDpOYokr4N788FGBcQg/exec";

  const select = (el, all = false) => {
    el = el.trim();
    if (all) return [...document.querySelectorAll(el)];
    return document.querySelector(el);
  };

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderRow(entry) {
    const tr = document.createElement("tr");
    tr.dataset.id = entry.ID;
    tr.innerHTML = `
      <td>${escapeHtml(entry.Title)}</td>
      <td>${escapeHtml(entry.Category)}</td>
      <td>${escapeHtml(entry.Type)}</td>
      <td>${escapeHtml(entry.FirstAuthor)}</td>
      <td class="d-none d-lg-table-cell">${escapeHtml(entry.CoAuthors)}</td>
      <td>${escapeHtml(entry.Venue)}</td>
      <td>${escapeHtml(entry.Status)}</td>
      <td>${escapeHtml(entry.Date)}</td>
      <td>${entry.Link ? `<a href="${escapeHtml(entry.Link)}" target="_blank" rel="noopener">Link</a>` : ""}</td>
      <td class="d-none d-lg-table-cell">${escapeHtml(entry.SourceWP)}</td>
      <td class="d-none d-lg-table-cell">${escapeHtml(entry.Notes)}</td>
      <td><button type="button" class="btn btn-sm btn-outline-danger btn-delete-entry">Delete</button></td>
    `;
    return tr;
  }

  async function loadEntries() {
    const tbody = select("#entriesTableBody");
    const status = select("#entriesStatus");
    tbody.innerHTML = '<tr><td colspan="12">Loading...</td></tr>';
    status.textContent = "";
    try {
      const res = await fetch(API_URL, { method: "GET" });
      const data = await res.json();
      tbody.innerHTML = "";
      if (!data.ok || !data.entries.length) {
        tbody.innerHTML = '<tr><td colspan="12">No entries yet.</td></tr>';
        return;
      }
      data.entries
        .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
        .forEach((entry) => tbody.appendChild(renderRow(entry)));
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="12">Failed to load entries.</td></tr>';
      status.textContent = "Could not reach the database. Please try again later.";
      console.error(err);
    }
  }

  // Content-Type must stay text/plain: Apps Script Web Apps can't answer the
  // CORS preflight that application/json would trigger from a cross-origin fetch.
  async function postAction(payload) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  window.addEventListener("load", () => {
    if (API_URL.indexOf("PASTE_EXEC_URL_HERE") !== -1) {
      select("#entriesStatus").textContent =
        "This page is not yet connected to a database (missing Apps Script URL).";
      select("#entriesTableBody").innerHTML =
        '<tr><td colspan="12">Not configured.</td></tr>';
      return;
    }

    loadEntries();

    const form = select("#addEntryForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload.action = "add";

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const result = await postAction(payload);
        if (result.ok) {
          form.reset();
          bootstrap.Modal.getInstance(select("#addEntryModal")).hide();
          loadEntries();
        } else {
          alert("Failed to add entry: " + (result.error || "unknown error"));
        }
      } catch (err) {
        alert("Failed to add entry: could not reach the database.");
        console.error(err);
      } finally {
        submitBtn.disabled = false;
      }
    });

    select("#entriesTableBody").addEventListener("click", async (e) => {
      if (!e.target.classList.contains("btn-delete-entry")) return;
      const tr = e.target.closest("tr");
      const id = tr.dataset.id;
      if (!confirm("Remove this entry from the public list? (This only hides it, it can be restored by an admin.)")) {
        return;
      }
      e.target.disabled = true;
      try {
        const result = await postAction({ action: "delete", id });
        if (result.ok) {
          tr.remove();
        } else {
          alert("Failed to delete: " + (result.error || "unknown error"));
          e.target.disabled = false;
        }
      } catch (err) {
        alert("Failed to delete: could not reach the database.");
        e.target.disabled = false;
        console.error(err);
      }
    });
  });
})();
