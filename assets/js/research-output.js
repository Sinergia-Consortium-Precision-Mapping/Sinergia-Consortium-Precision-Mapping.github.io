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

  const API_URL = "https://script.google.com/macros/s/AKfycbwdhOeYtxSrMbEDYCNf1ZDByjzV7phV5Sm_sJ1GMG9YuUn6SVj3QGK6X1dk3A6MkP0y/exec";

  const CATEGORY = {
    SCI_PR: "scientific Publication (peer-reviewed)",
    SCI_NPR: "scientific Publication (not peer-reviewed)",
    DATASET: "dataset",
    ACADEMIC: "academic",
    KNOWLEDGE: "knowledge",
    PUBLIC: "public",
    COLLAB: "collaboration",
    THIRD_PARTY: "third-party",
    FOLLOW_UP: "follow-up",
    AWARDS: "awards",
  };

  // Real descriptions per category value; categories without an entry fall back
  // to placeholder copy.
  const CATEGORY_DESCRIPTIONS = {
    [CATEGORY.SCI_PR]:
      "Here you can indicate publications produced within the scope of the project. Only scientific publications that have been published or accepted for publication and which mention the support received from the SNSF should be entered here. You can add planned publications later - even after the end of the project. Furthermore, you have the option to indicate significant planned output in the scientific report. Publications that address a wider public can be entered under \"Public communication\".",
    [CATEGORY.SCI_NPR]:
      "Here you can indicate publications produced within the scope of the project that have not undergone peer review (e.g. preprints, working papers, technical reports, theses). Only scientific publications that have been published or made publicly available and which mention the support received from the SNSF should be entered here. You can add planned publications later - even after the end of the project. Furthermore, you have the option to indicate significant planned output in the scientific report. Publications that address a wider public can be entered under \"Public communication\".",
    [CATEGORY.DATASET]:
      "Here you can indicate datasets created in the project. Datasets that will be made available in a repository later can be added at any time, even after the project has ended. Furthermore, you have the option to indicate significant planned output in the scientific report.",
    [CATEGORY.ACADEMIC]:
      "Here you can mention the scientific events you organised yourself or in which you or a collaborator in your project actively participated within the scope of the project (contribution in the form of a lecture or a poster). Only events aimed at scientific experts should be entered in this data container.\nKnowledge transfer events or events for a wider public can be mentioned under \"Knowledge transfer events\" (e.g. events for potential users) and \"Public communication\" (e.g. Ausstellungen, TV appearances).",
    [CATEGORY.KNOWLEDGE]:
      "Here you can mention the knowledge transfer events you have (or someone employed in your project has) organised or attended within the scope of the project. Only events aimed at transferring knowledge to non-scientific experts should be entered in this data container.\n\nIf your event serves the dual purpose of communicating with the public and transferring knowledge to potential direct or indirect users, you can mention it in both categories. Events aimed at scientific experts should be entered under \"Academic events\".",
    [CATEGORY.PUBLIC]:
      "Here you can enter communication activities within the scope of the project that were not aimed primarily at scientific experts, but at a wider public. Websites with further information on this communication activity can also be indicated here. In addition, please indicate the type of activity under \"Other activities\" in the title.\n\nIf your event serves the dual purpose of communicating with the public and transferring knowledge to potential direct or indirect users, you can mention it in both categories.\n\nFor articles with (almost) identical content that are published simultaneously in more than one print media, you may generate more than one entry. Web articles that are published in different languages on the same multilingual website should only be entered once.",
    [CATEGORY.COLLAB]:
      "Here you can indicate the national and international collaborations that were of particular importance for the project.\nProject partners who have already been entered should not be indicated here.\nPlease make a separate entry for the different research groups with whom you work.",
    [CATEGORY.THIRD_PARTY]:
      "Please indicate here whether the SNSF grant helped you to acquire additional third-party funds for the research project. If your project was financed by other third-party funds, please enter the key data of this additional financing.",
    [CATEGORY.FOLLOW_UP]:
      "Here you can indicate whether any follow-up projects (excluding projects funded by the SNSF) have been implemented based on the results of the SNSF project.",
    [CATEGORY.AWARDS]:
      "Please indicate here whether any of the persons employed in the project has received an award in the context of the research work carried out (prizes, honourary titles, fellowships or other marks of distinction)",
  };

  function categoryDescription(category, categoryName) {
    return (
      CATEGORY_DESCRIPTIONS[category] ||
      `here comes the beautifull description for ${categoryName}`
    );
  }

  // The field that must be filled in for each category before submitting.
  const PRIMARY_FIELD_ID = {
    [CATEGORY.SCI_PR]: "fieldPubTitle",
    [CATEGORY.SCI_NPR]: "fieldPubTitle",
    [CATEGORY.DATASET]: "fieldDatasetTitle",
    [CATEGORY.ACADEMIC]: "fieldAcademicArticleTitle",
    [CATEGORY.KNOWLEDGE]: "fieldKnowledgeArticleTitle",
    [CATEGORY.PUBLIC]: "fieldPublicTitle",
    [CATEGORY.COLLAB]: "fieldCollabGroup",
    [CATEGORY.THIRD_PARTY]: "fieldThirdPartyOrg",
    [CATEGORY.FOLLOW_UP]: "fieldFollowUpTitle",
    [CATEGORY.AWARDS]: "fieldAwardTitle",
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

  const firstNonEmpty = (...values) =>
    values.map((v) => (v == null ? "" : String(v).trim())).find(Boolean) || "";

  // Website columns are standardised to Title / First Author / Source WP / Notes.
  // When a field is empty for an entry, fall back to the closest related field.
  function displayTitle(e) {
    return firstNonEmpty(
      e.Title, e.PubTitle, e.DatasetTitle, e.AcademicArticleTitle,
      e.AcademicEventTitle, e.KnowledgeArticleTitle, e.KnowledgeEventTitle,
      e.PublicTitle, e.CollabResearchGroup, e.ThirdPartyOrganisation,
      e.FollowUpTitle, e.AwardTitle, e.Venue, e.Category
    );
  }

  function displayFirstAuthor(e) {
    return firstNonEmpty(
      e.FirstAuthor, e.CoAuthors, e.AcademicPersonInvolved,
      e.KnowledgePersonInvolved, e.AwardPersonInvolved, e.CollabResearchGroup,
      e.ThirdPartyOrganisation, e.ThirdPartySource
    );
  }

  function displayNotes(e) {
    return firstNonEmpty(
      e.Notes,
      [e.Type, e.Venue, e.Date].map((v) => firstNonEmpty(v)).filter(Boolean).join(" · ")
    );
  }

  function renderRow(entry) {
    const tr = document.createElement("tr");
    tr.dataset.id = entry.ID;
    tr.innerHTML = `
      <td>${escapeHtml(displayTitle(entry))}</td>
      <td>${escapeHtml(displayFirstAuthor(entry))}</td>
      <td>${escapeHtml(entry.SourceWP)}</td>
      <td>${escapeHtml(displayNotes(entry))}</td>
      <td><button type="button" class="btn btn-sm btn-outline-danger btn-delete-entry">Delete</button></td>
    `;
    return tr;
  }

  async function loadEntries() {
    const tbody = select("#entriesTableBody");
    const status = select("#entriesStatus");
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    status.textContent = "";
    try {
      const res = await fetch(API_URL, { method: "GET" });
      const data = await res.json();
      tbody.innerHTML = "";
      if (!data.ok || !data.entries.length) {
        tbody.innerHTML = '<tr><td colspan="5">No entries yet.</td></tr>';
        return;
      }
      data.entries
        .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
        .forEach((entry) => tbody.appendChild(renderRow(entry)));
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="5">Failed to load entries.</td></tr>';
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
    const categorySelect = select("#fieldCategory");
    const selectedOption = categorySelect.selectedOptions[0];
    const categoryName = selectedOption ? selectedOption.textContent.trim() : "";

    if (category && categoryName) {
      panel.textContent = categoryDescription(category, categoryName);
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
        AcademicPersonInvolved: checkedValues(".person-academic"),
        Title: select("#fieldAcademicArticleTitle").value,
        Venue: select("#fieldAcademicEventTitle").value,
        Type: select("#fieldAcademicContribution").value,
        Date: select("#fieldAcademicDate").value,
        FirstAuthor: checkedValues(".person-academic"),
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
        KnowledgePersonInvolved: checkedValues(".person-knowledge"),
        KnowledgeTargetGroup: select("#fieldKnowledgeTargetGroup").value,
        Title: select("#fieldKnowledgeArticleTitle").value,
        Venue: select("#fieldKnowledgeEventTitle").value,
        Type: select("#fieldKnowledgeContribution").value,
        Date: select("#fieldKnowledgeDate").value,
        FirstAuthor: checkedValues(".person-knowledge"),
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
    } else if (category === CATEGORY.THIRD_PARTY) {
      Object.assign(payload, {
        ThirdPartySource: select("#fieldThirdPartySource").value,
        ThirdPartyOrganisation: select("#fieldThirdPartyOrg").value,
        ThirdPartyAmount: select("#fieldThirdPartyAmount").value,
        ThirdPartyYear: select("#fieldThirdPartyYear").value,
        Title: select("#fieldThirdPartyOrg").value,
        Venue: select("#fieldThirdPartySource").value,
        Type: "Third-party funds",
        Date: select("#fieldThirdPartyYear").value,
      });
    } else if (category === CATEGORY.FOLLOW_UP) {
      Object.assign(payload, {
        FollowUpTitle: select("#fieldFollowUpTitle").value,
        FollowUpStartYear: select("#fieldFollowUpStart").value,
        FollowUpDurationMonths: select("#fieldFollowUpDuration").value,
        FollowUpFinancing: select("#fieldFollowUpFinancing").value,
        Title: select("#fieldFollowUpTitle").value,
        Venue: select("#fieldFollowUpFinancing").value,
        Type: "Follow-up project",
        Date: select("#fieldFollowUpStart").value,
      });
    } else if (category === CATEGORY.AWARDS) {
      Object.assign(payload, {
        AwardTitle: select("#fieldAwardTitle").value,
        AwardYear: select("#fieldAwardYear").value,
        AwardEndowmentCHF: select("#fieldAwardEndowment").value,
        AwardPersonInvolved: checkedValues(".person-award"),
        Title: select("#fieldAwardTitle").value,
        Type: "Award",
        Date: select("#fieldAwardYear").value,
        FirstAuthor: checkedValues(".person-award"),
      });
    }

    payload.SourceWP = checkedValues(".source-wp");
    payload.Notes = select("#fieldNotes").value;
    return payload;
  }

  window.addEventListener("load", () => {
    if (API_URL.indexOf("PASTE_EXEC_URL_HERE") !== -1) {
      select("#entriesStatus").textContent =
        "This page is not yet connected to a database (missing Apps Script URL).";
      select("#entriesTableBody").innerHTML =
        '<tr><td colspan="5">Not configured.</td></tr>';
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
      const primaryFieldId = PRIMARY_FIELD_ID[category];
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
