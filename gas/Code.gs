function doPost(e) {
  var sheet = SpreadsheetApp.openById(getSheetId()).getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(),
    data.type || 'contact',
    data.name || '',
    data.email || '',
    data.message || '',
    data.city || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}

function getSheetId() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (!id) {
    var ss = SpreadsheetApp.create('ホジョタウン お問い合わせ');
    var sheet = ss.getActiveSheet();
    sheet.appendRow(['日時','種別','名前','メール','内容','市区町村']);
    sheet.setFrozenRows(1);
    id = ss.getId();
    props.setProperty('SHEET_ID', id);
  }
  return id;
}
