/**
 * Backend for the "Research Output" public submission page.
 * Stores entries in the Google Sheet "Sinergia Research Output Entries"
 * (SPREADSHEET_ID below), whose header row (row 1) is exactly the HEADERS
 * array below, in that order. Works as a standalone or bound script.
 *
 * Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
 * Copy the resulting /exec URL into assets/js/research-output.js (API_URL).
 */

const SPREADSHEET_ID = '16LFfwIjK_BXPFc1ZfVsrEVRXGxY7bRBmtLUE73sHnf0';
const SHEET_NAME = 'Entries'; // falls back to the first tab if not found
const HEADERS = [
  'ID', 'Timestamp', 'Category',
  // Generic / display columns, also used by the not-yet-specified categories
  // (kept for older rows; new categories fill Title/Venue/Type/Date too).
  'Title', 'FirstAuthor', 'CoAuthors', 'Venue', 'Type', 'Status', 'Date', 'Link',
  // Scientific publication (peer-reviewed / not peer-reviewed).
  'PubFormOfPublication', 'PubTitle', 'PubJournalName', 'PubPageOrArticleNumber',
  'PubStatus', 'PubDOI', 'PubImportSource', 'PubOpenAccess', 'PubLink',
  // Dataset.
  'DatasetTitle', 'DatasetPID', 'DatasetRepository', 'DatasetRepositoryLink',
  // Academic events.
  'AcademicParticipationType', 'AcademicContributionType', 'AcademicEventTitle',
  'AcademicArticleTitle', 'AcademicDate', 'AcademicCountry', 'AcademicPlace',
  'AcademicPersonInvolved',
  // Knowledge transfer events.
  'KnowledgeParticipationType', 'KnowledgeContributionType', 'KnowledgeEventTitle',
  'KnowledgeArticleTitle', 'KnowledgeDate', 'KnowledgeCountry', 'KnowledgePlace',
  'KnowledgePersonInvolved', 'KnowledgeTargetGroup',
  // Public communication.
  'PublicType', 'PublicTitle', 'PublicRegion', 'PublicYear',
  // Collaboration (Use-inspired outputs).
  'CollabResearchGroup', 'CollabCountry', 'CollabType', 'CollabStarted',
  // Shared across all categories.
  'SourceWP', 'Notes', 'Deleted',
  // Added later, appended after 'Deleted' so existing sheet rows keep their
  // column positions. Add these headers to row 1 of the sheet, in this order.
  // Third-party funds.
  'ThirdPartySource', 'ThirdPartyOrganisation', 'ThirdPartyAmount', 'ThirdPartyYear',
  // Follow-up projects.
  'FollowUpTitle', 'FollowUpStartYear', 'FollowUpDurationMonths', 'FollowUpFinancing',
  // Awards.
  'AwardTitle', 'AwardYear', 'AwardEndowmentCHF', 'AwardPersonInvolved',
];

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowToObject_(row) {
  const obj = {};
  HEADERS.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function doGet(e) {
  const rows = getSheet_().getDataRange().getValues().slice(1); // drop header row
  const entries = rows
    .filter((r) => r[0]) // skip fully blank rows
    .map(rowToObject_)
    .filter((obj) => obj.Deleted !== true);
  return jsonResponse_({ ok: true, entries: entries });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'add') return handleAdd_(body);
    if (body.action === 'delete') return handleDelete_(body);
    return jsonResponse_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function handleAdd_(body) {
  const sheet = getSheet_();
  const id = 'RO-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  // ID, Timestamp and Deleted are set here; every other column is taken
  // verbatim from the submitted payload (missing keys become '').
  const row = HEADERS.map((h) => {
    if (h === 'ID') return id;
    if (h === 'Timestamp') return new Date().toISOString();
    if (h === 'Deleted') return false;
    return body[h] == null ? '' : body[h];
  });

  sheet.appendRow(row);
  return jsonResponse_({ ok: true, id: id });
}

function handleDelete_(body) {
  const sheet = getSheet_();
  const id = body.id;
  if (!id) return jsonResponse_({ ok: false, error: 'Missing id' });

  const data = sheet.getDataRange().getValues();
  const idCol = HEADERS.indexOf('ID');
  const deletedCol = HEADERS.indexOf('Deleted');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      sheet.getRange(i + 1, deletedCol + 1).setValue(true); // soft delete only
      return jsonResponse_({ ok: true });
    }
  }
  return jsonResponse_({ ok: false, error: 'ID not found' });
}
