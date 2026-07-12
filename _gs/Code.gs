// Google Apps Script — 部署為「網頁應用程式」，接收前端送來的登入請求、使用者資料與行為紀錄
// 試算表：https://docs.google.com/spreadsheets/d/1hr-zOWeB9On4NcEAH-_2NlkXetcE9Qu0bJveByZRW1c/edit?gid=0#gid=0

var SPREADSHEET_ID = "1hr-zOWeB9On4NcEAH-_2NlkXetcE9Qu0bJveByZRW1c";
var LOG_SHEET_NAME = "logSheet";
var LOGIN_SHEET_NAME = "login";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === "login") {
      return handleLogin_(data);
    }

    return handleSaveLog_(data);
  } catch (err) {
    return ContentService.createTextOutput(err.message);
  }
}

// 存一筆使用者資料 / 行為紀錄到 logSheet
function handleSaveLog_(data) {
  var timeStamp = data.timeStamp || new Date().toISOString();
  var userName = data.userName || "";
  var useGender = data.useGender || "";
  var useAge = data.useAge || "";
  var userEmail = data.userEmail || "";
  var log = data.log || "";

  var sheet = getSheet_(LOG_SHEET_NAME, ["timeStamp", "userName", "useGender", "useAge", "userEmail", "log"]);
  sheet.appendRow([timeStamp, userName, useGender, useAge, userEmail, log]);

  return ContentService.createTextOutput("OK");
}

// 核對帳號密碼：id、password 必須對得上 login 工作表裡的一列，
// 而且該列的 userName、userEmail 都不可以是空白，才算通過驗證
function handleLogin_(data) {
  var id = String(data.id || "").trim();
  var password = String(data.password || "").trim();

  if (!id || !password) {
    return ContentService.createTextOutput("帳號與密碼不可空白");
  }

  var sheet = getSheet_(LOGIN_SHEET_NAME, ["id", "password", "userName", "userEmail"]);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var rowId = String(row[0]).trim();
    var rowPassword = String(row[1]).trim();

    if (rowId === id && rowPassword === password) {
      var rowUserName = String(row[2] || "").trim();
      var rowUserEmail = String(row[3] || "").trim();

      if (rowUserName && rowUserEmail) {
        return ContentService.createTextOutput("OK");
      }
      return ContentService.createTextOutput("此帳號尚未開通，請聯絡管理員");
    }
  }

  return ContentService.createTextOutput("帳號或密碼錯誤");
}

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }

  return sheet;
}
