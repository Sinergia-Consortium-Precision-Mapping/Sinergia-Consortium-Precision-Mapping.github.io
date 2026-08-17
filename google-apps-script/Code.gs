/**
 * Backend for the "Research Output" public submission page.
 * Deploy this bound to a Google Sheet with a tab named `Entries` whose
 * header row (row 1) is exactly:
 * ID | Timestamp | Category | Title | FirstAuthor | CoAuthors | Venue | Type | Status | Date | Link | SourceWP | Notes | Deleted
 *
 * Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
 * Copy the resulting /exec URL into assets/js/research-output.js (API_URL).
 */

const SHEET_NAME = 'Entries';
const HEADERS = ['ID', 'Timestamp', 'Category', 'Title', 'FirstAuthor', 'CoAuthors',
                  'Venue', 'Type', 'Status', 'Date', 'Link', 'SourceWP', 'Notes', 'Deleted'];

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
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
  sheet.appendRow([
    id,
    new Date().toISOString(),
    body.Category || '',
    body.Title || '',
    body.FirstAuthor || '',
    body.CoAuthors || '',
    body.Venue || '',
    body.Type || '',
    body.Status || '',
    body.Date || '',
    body.Link || '',
    body.SourceWP || '',
    body.Notes || '',
    false,
  ]);
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
