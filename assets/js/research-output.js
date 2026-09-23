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

  const CATEGORY = {
    SCI_PR: "scientific Publication (peer-reviewed)",
    SCI_NPR: "scientific Publication (not peer-reviewed)",
    DATASET: "dataset",
    ACADEMIC: "academic",
    KNOWLEDGE: "knowledge",
    PUBLIC: "public",
    COLLAB: "collaboration",
  };

  // Filled in once real category descriptions are provided; a category with no
  // entry here simply shows no description panel.
  const CATEGORY_DESCRIPTIONS = {};

  // The field that must be filled in for each category before submitting.
  // Categories not listed here fall back to the generic #fieldTitle field.
  const PRIMARY_FIELD_ID = {
    [CATEGORY.SCI_PR]: "fieldPubTitle",
    [CATEGORY.SCI_NPR]: "fieldPubTitle",
    [CATEGORY.DATASET]: "fieldDatasetTitle",
    [CATEGORY.ACADEMIC]: "fieldAcademicArticleTitle",
    [CATEGORY.KNOWLEDGE]: "fieldKnowledgeArticleTitle",
    [CATEGORY.PUBLIC]: "fieldPublicTitle",
    [CATEGORY.COLLAB]: "fieldCollabGroup",
  };

  const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
    "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
    "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
    "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
    "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica",
    "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea",
    "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
    "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala",
    "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland",
    "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
    "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
    "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
    "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
    "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania",
    "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
    "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
    "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama",
    "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
    "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
    "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
    "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
    "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
    "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand",
    "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
    "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
    "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
    "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
  ];

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

  function fullName(first, last) {
    return [first, last].map((s) => (s || "").trim()).filter(Boolean).join(" ");
  }

  function checkedValues(selector) {
    return select(selector, true)
      .filter((el) => el.checked)
      .map((el) => el.value)
      .join("; ");
  }

  function makeCoAuthorRow() {
    const row = document.createElement("div");
    row.className = "row g-2 mb-2 coauthor-row";
    row.innerHTML = `
      <div class="col-5">
        <input type="text" class="form-control form-control-sm coauthor-first" placeholder="First name">
      </div>
      <div class="col-5">
        <input type="text" class="form-control form-control-sm coauthor-last" placeholder="Last name">
      </div>
      <div class="col-2 d-grid">
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove-coauthor" aria-label="Remove co-author">&times;</button>
      </div>
    `;
    return row;
  }

  function populateCountrySelects() {
    select(".country-select", true).forEach((sel) => {
      COUNTRIES.forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
    });
  }

  function updateFormForCategory(category) {
    select(".category-group", true).forEach((el) => {
      const cats = JSON.parse(el.dataset.cats);
      el.classList.toggle("d-none", !cats.includes(category));
    });

    const panel = select("#categoryDescriptionPanel");
    const desc = CATEGORY_DESCRIPTIONS[category];
    if (desc) {
      panel.textContent = desc;
      panel.classList.remove("d-none");
    } else {
      panel.classList.add("d-none");
      panel.textContent = "";
    }
  }

  function authorFields() {
    return {
      FirstAuthor: fullName(
        select("#fieldFirstAuthorFirst").value,
        select("#fieldFirstAuthorLast").value
      ),
      CoAuthors: select(".coauthor-row", true)
        .map((row) =>
          fullName(
            row.querySelector(".coauthor-first").value,
            row.querySelector(".coauthor-last").value
          )
        )
        .filter(Boolean)
        .join("; "),
    };
  }

  function buildPayload() {
    const category = select("#fieldCategory").value;
    const payload = { action: "add", Category: category };

    if (category === CATEGORY.SCI_PR || category === CATEGORY.SCI_NPR) {
      Object.assign(payload, authorFields(), {
        PubFormOfPublication: select("#fieldPubForm").value,
        PubTitle: select("#fieldPubTitle").value,
        PubJournalName: select("#fieldPubJournal").value,
        PubPageOrArticleNumber: select("#fieldPubPageNum").value,
        PubStatus: select("#fieldPubStatus").value,
        PubDOI: select("#fieldPubDOI").value,
        PubImportSource: select("#fieldPubSource").value,
        PubOpenAccess: select("#fieldPubOA").value,
        PubLink: select("#fieldPubLink").value,
        Title: select("#fieldPubTitle").value,
        Venue: select("#fieldPubJournal").value,
        Type: select("#fieldPubForm").value,
        Status: select("#fieldPubStatus").value,
        Link: select("#fieldPubLink").value,
      });
    } else if (category === CATEGORY.DATASET) {
      Object.assign(payload, authorFields(), {
        DatasetTitle: select("#fieldDatasetTitle").value,
        DatasetPID: select("#fieldDatasetPID").value,
        DatasetRepository: select("#fieldDatasetRepo").value,
        DatasetRepositoryLink: select("#fieldDatasetRepoLink").value,
        Title: select("#fieldDatasetTitle").value,
        Venue: select("#fieldDatasetRepo").value,
        Type: "Dataset",
        Link: select("#fieldDatasetRepoLink").value,
      });
    } else if (category === CATEGORY.ACADEMIC) {
      Object.assign(payload, {
        AcademicParticipationType: select("#fieldAcademicParticipation").value,
        AcademicContributionType: select("#fieldAcademicContribution").value,
        AcademicEventTitle: select("#fieldAcademicEventTitle").value,
        AcademicArticleTitle: select("#fieldAcademicArticleTitle").value,
        AcademicDate: select("#fieldAcademicDate").value,
        AcademicCountry: select("#fieldAcademicCountry").value,
        AcademicPlace: select("#fieldAcademicPlace").value,
        AcademicPersonInvolved: select("#fieldAcademicPerson").value,
        Title: select("#fieldAcademicArticleTitle").value,
        Venue: select("#fieldAcademicEventTitle").value,
        Type: select("#fieldAcademicContribution").value,
        Date: select("#fieldAcademicDate").value,
        FirstAuthor: select("#fieldAcademicPerson").value,
      });
    } else if (category === CATEGORY.KNOWLEDGE) {
      Object.assign(payload, {
        KnowledgeParticipationType: select("#fieldKnowledgeParticipation").value,
        KnowledgeContributionType: select("#fieldKnowledgeContribution").value,
        KnowledgeEventTitle: select("#fieldKnowledgeEventTitle").value,
        KnowledgeArticleTitle: select("#fieldKnowledgeArticleTitle").value,
        KnowledgeDate: select("#fieldKnowledgeDate").value,
        KnowledgeCountry: select("#fieldKnowledgeCountry").value,
        KnowledgePlace: select("#fieldKnowledgePlace").value,
        KnowledgePersonInvolved: select("#fieldKnowledgePerson").value,
        KnowledgeTargetGroup: select("#fieldKnowledgeTargetGroup").value,
        Title: select("#fieldKnowledgeArticleTitle").value,
        Venue: select("#fieldKnowledgeEventTitle").value,
        Type: select("#fieldKnowledgeContribution").value,
        Date: select("#fieldKnowledgeDate").value,
        FirstAuthor: select("#fieldKnowledgePerson").value,
      });
    } else if (category === CATEGORY.PUBLIC) {
      Object.assign(payload, {
        PublicType: select("#fieldPublicType").value,
        PublicTitle: select("#fieldPublicTitle").value,
        PublicRegion: checkedValues(".public-region"),
        PublicYear: select("#fieldPublicYear").value,
        Title: select("#fieldPublicTitle").value,
        Type: select("#fieldPublicType").value,
        Date: select("#fieldPublicYear").value,
      });
    } else if (category === CATEGORY.COLLAB) {
      Object.assign(payload, {
        CollabResearchGroup: select("#fieldCollabGroup").value,
        CollabCountry: select("#fieldCollabCountry").value,
        CollabType: checkedValues(".collab-type"),
        CollabStarted: select("#fieldCollabStarted").value,
        Title: select("#fieldCollabGroup").value,
        Type: "Collaboration",
        Status: select("#fieldCollabStarted").value,
      });
    } else {
      // Not-yet-specified categories: third-party funds, follow-up projects, awards.
      Object.assign(payload, authorFields(), {
        Title: select("#fieldTitle").value,
        Venue: select("#fieldVenue").value,
        Type: select("#fieldType").value,
        Status: select("#fieldStatus").value,
        Date: select("#fieldDate").value,
        Link: select("#fieldLink").value,
      });
    }

    payload.SourceWP = select("#fieldSourceWP").value;
    payload.Notes = select("#fieldNotes").value;
    return payload;
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
    populateCountrySelects();

    select('[data-bs-toggle="tooltip"]', true).forEach(
      (el) => new bootstrap.Tooltip(el)
    );

    const form = select("#addEntryForm");
    const coAuthorsList = select("#coAuthorsList");
    const categorySelect = select("#fieldCategory");

    categorySelect.addEventListener("change", (e) => {
      updateFormForCategory(e.target.value);
    });

    select("#btnAddCoAuthor").addEventListener("click", () => {
      coAuthorsList.appendChild(makeCoAuthorRow());
    });

    coAuthorsList.addEventListener("click", (e) => {
      if (!e.target.classList.contains("btn-remove-coauthor")) return;
      e.target.closest(".coauthor-row").remove();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const category = categorySelect.value;
      const primaryFieldId = PRIMARY_FIELD_ID[category] || "fieldTitle";
      if (!select("#" + primaryFieldId).value.trim()) {
        alert("Please fill in the required title field for this category.");
        return;
      }

      const payload = buildPayload();

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const result = await postAction(payload);
        if (result.ok) {
          form.reset();
          coAuthorsList.innerHTML = "";
          updateFormForCategory("");
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
