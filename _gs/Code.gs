// Google Apps Script — 部署為「網頁應用程式」，接收前端送來的使用者資料與行為紀錄
// 試算表：https://docs.google.com/spreadsheets/d/1hr-zOWeB9On4NcEAH-_2NlkXetcE9Qu0bJveByZRW1c/edit?gid=0#gid=0

var SPREADSHEET_ID = "1hr-zOWeB9On4NcEAH-_2NlkXetcE9Qu0bJveByZRW1c";
var SHEET_NAME = "logSheet";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var timeStamp = data.timeStamp || new Date().toISOString();
    var userName = data.userName || "";
    var useGender = data.useGender || "";
    var useAge = data.useAge || "";
    var userEmail = data.userEmail || "";
    var log = data.log || "";

    var sheet = getLogSheet_();
    sheet.appendRow([timeStamp, userName, useGender, useAge, userEmail, log]);

    return ContentService.createTextOutput("OK");
  } catch (err) {
    return ContentService.createTextOutput(err.message);
  }
}

function getLogSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["timeStamp", "userName", "useGender", "useAge", "userEmail", "log"]);
  }

  return sheet;
}
