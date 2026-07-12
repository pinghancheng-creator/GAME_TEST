# 📒 Log（使用者行為紀錄）說明書 — 給初學者看的版本

這份文件會用最白話的方式，解釋這個遊戲裡「記錄使用者資料與行為」這套系統是怎麼運作的。
看完之後，你應該能夠回答：

- 「Log」到底是什麼？
- 資料是怎麼從瀏覽器一路跑到 Google 試算表的？
- 為什麼要「每 5 筆事件才送一次」？
- 出錯了要去哪裡找問題？

---

## 1. 什麼是「Log」？

在這個專案裡，「Log」指的是**使用者在網頁上做了什麼事情的紀錄**，例如：

- 按了「＋」把火力發電廠數量加 1
- 按了「−」把風力發電廠數量減 1
- 打開了 AI 家教的聊天視窗
- 在 AI 家教裡輸入了一句話
- 按了「重新挑戰」

你可以把它想成遊戲的「行車紀錄器」：使用者做的每個重要動作，都會被寫下一行文字，
之後我們就能回頭分析「使用者到底是怎麼玩這個遊戲的」。

每一筆 Log 除了「做了什麼事」之外，還會附上：

- **時間戳記（timeStamp）**：這件事發生在什麼時候
- **這個使用者是誰**：姓名、性別、年齡、Email（在遊戲一開始的資料填寫頁蒐集）

---

## 2. 整體資料流程（從按鈕到 Google 試算表）

```
使用者在瀏覽器操作
        │
        ▼
1) 前端 JavaScript 把動作寫成一句話，例如：
   「點擊按鈕：增加 火力發電廠（目前數量 9）」
        │
        ▼
2) 這句話先放進一個「暫存清單（queue）」，
   同時也存進瀏覽器的 localStorage（離線也不會不見）
        │
        ▼
3) 清單累積到 5 筆之後，把這 5 筆合併成一筆資料，
   打包成 JSON，送到 /api/save（我們自己網站的後端）
        │
        ▼
4) /api/save（Vercel Serverless Function）
   收到之後，轉手送到 Google Apps Script 的網址（GAS_URL）
        │
        ▼
5) Google Apps Script（Code.gs）收到資料，
   用 appendRow 把這筆資料寫成 Google 試算表裡的「一列」
        │
        ▼
6) 寫入成功的話，GAS 回傳文字 "OK"
   一路往回傳到前端，前端才會把這 5 筆從暫存清單裡刪掉
```

簡單說就是：**瀏覽器 → 我們自己的伺服器（/api/save）→ Google Apps Script → Google 試算表**。

### 為什麼不讓瀏覽器直接呼叫 Google Apps Script？

技術上可以，但這樣 Google Apps Script 的網址會直接出現在瀏覽器的程式碼裡，任何人打開
「開發者工具」都看得到，比較不安全，也比較難更換。所以我們多加一層自己的後端
（`/api/save`）當作「中間人」，Google Apps Script 的網址就只存在伺服器的環境變數裡，
瀏覽器完全看不到。

---

## 3. 前端怎麼記錄 Log？（`index.html`）

### 3.1 使用者填完資料的那一刻

遊戲一開始會跳出一個表單，要求輸入姓名、性別、年齡、Email。使用者按下「確認」後：

```js
userName = name;
userGender = gender;
userAge = age;
userEmail = email;

sendProfileToGAS("使用者輸入基本資料並開始遊戲");
```

這裡會**立刻**送出一筆資料（不用等到 5 筆），內容包含使用者的基本資料，
`log` 欄位寫著「使用者輸入基本資料並開始遊戲」，代表這是「註冊」這個事件。

### 3.2 之後的操作事件，怎麼被記下來？

之後只要使用者做了任何「值得記錄」的動作，程式就會呼叫 `recordLog(說明文字)`。
舉例：

```js
// 按下電廠的 + / - 按鈕時
recordLog(`點擊按鈕：${delta > 0 ? "增加" : "減少"} ${plant.name}（目前數量 ${plant.count}）`);

// 在 AI 家教輸入一句話時
recordLog(`輸入文字（AI 對話）：${text}`);

// 打開/關閉 AI 家教視窗時
recordLog("點擊按鈕：開關 AI 家教對話框");

// 按下「重新挑戰」時
recordLog("點擊按鈕：重新挑戰");
```

`recordLog` 這個函式做的事情很單純：

```js
function recordLog(action) {
  logQueue.push(`${new Date().toISOString()} ${action}`);  // 1. 加上時間戳記，放進暫存清單
  persistLogQueue();                                        // 2. 存進 localStorage，防止資料遺失
  flushLogQueue();                                           // 3. 檢查看看要不要送出去
}
```

### 3.3 什麼是「暫存清單（queue）」？為什麼要存進 `localStorage`？

- **queue（佇列）** 就是一個陣列，裡面放著「還沒送出去的 Log」。
- 為什麼要存進 `localStorage`？因為如果使用者剛好在這時候關掉分頁、或是網路突然斷線，
  記憶體裡的資料會直接消失。存進 `localStorage` 之後，就算重新整理網頁，
  之前還沒送出去的紀錄依然還在，之後有機會可以補送。
- 這就是需求裡說的「**暫存直到成功送出到 GAS**」：只有真正送成功（收到 GAS 回的 `"OK"`），
  才會把這幾筆從清單中刪除；沒送成功的話，就繼續留著，下次有新事件發生時再試一次。

### 3.4 為什麼是「每 5 筆」才送一次？

```js
const LOG_BATCH_SIZE = 5;

async function flushLogQueue() {
  if (logQueue.length < LOG_BATCH_SIZE || !userName || !userEmail) return;

  const batch = logQueue.slice(0, LOG_BATCH_SIZE);       // 拿出最前面 5 筆
  const ok = await sendProfileToGAS(batch.join(" | "));  // 合併成一句話，送出去

  if (ok) {
    logQueue = logQueue.slice(LOG_BATCH_SIZE);            // 送成功才刪掉這 5 筆
    persistLogQueue();
  }
}
```

如果使用者每按一次按鈕就送一次資料，會產生非常多網路請求，
Google 試算表也會被寫入很多又小又瑣碎的資料列。改成「累積 5 筆才送 1 次」，
可以：

- 減少送出的次數（省流量、降低失敗機率）
- Google 試算表裡的一列資料，就代表「使用者做的一連串 5 個動作」，比較好閱讀

送出去的時候，這 5 筆事件會用 `" | "`（直線）串成一句話放進 `log` 欄位，例如：

```
2026-07-12T09:00:01Z 點擊按鈕：增加 火力發電廠（目前數量 9） | 2026-07-12T09:00:03Z 點擊按鈕：減少 風力發電廠（目前數量 1） | ...
```

---

## 4. 送出去的資料長什麼樣子？

不管是「使用者資料」還是「5 筆合併的 Log」，最後都是透過同一個函式 `sendProfileToGAS()`
包成同樣格式送出去：

```js
function sendProfileToGAS(log) {
  return sendToGAS({
    timeStamp: new Date().toISOString(), // 現在的時間
    userName,                            // 姓名
    useGender: userGender,               // 性別
    useAge: userAge,                     // 年齡
    userEmail,                           // Email
    log,                                 // 這次要記錄的事件內容
  });
}
```

也就是說，Google 試算表裡的**每一列**，都會有這 6 個欄位：

| 欄位名稱   | 意思                       | 範例                             |
| ---------- | -------------------------- | --------------------------------- |
| timeStamp  | 這筆資料送出的時間          | `2026-07-12T09:00:00.000Z`        |
| userName   | 使用者姓名                  | `王小明`                          |
| useGender  | 使用者性別                  | `男`                              |
| useAge     | 使用者年齡                  | `20`                              |
| userEmail  | 使用者 Email                | `example@mail.com`                |
| log        | 這次記錄的事件內容（可能是 1 筆註冊事件，或合併後的 5 筆操作事件） | `使用者輸入基本資料並開始遊戲`     |

---

## 5. 中間的橋樑：`api/save.js`

這支程式跑在 Vercel 的伺服器上（不是在使用者的瀏覽器裡），工作只有一件事：
**把前端送來的資料，原封不動轉送給 Google Apps Script**。

```js
export default async function handler(req, res) {
  // 只接受 POST 請求（就是「送資料」的意思，不是「讀資料」）
  if (req.method !== "POST") {
    return res.status(405).json({ error: "僅支援 POST 請求" });
  }

  // 從環境變數讀出 GAS 的網址（不寫死在程式碼裡）
  const gasUrl = process.env.GAS_URL;
  if (!gasUrl) {
    return res.status(500).json({ error: "伺服器尚未設定 GAS_URL 環境變數" });
  }

  // 把前端傳來的資料，轉手送到 GAS
  const gasRes = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body || {}),
  });

  // 把 GAS 的回覆（通常是 "OK" 或錯誤訊息）原封不動回傳給前端
  const text = await gasRes.text();
  res.status(gasRes.status).send(text);
}
```

為什麼叫它「中間代理（proxy）」？因為它不自己處理資料、也不自己存資料，
只是站在前端和 GAS 中間，幫忙把請求轉來轉去，同時把 GAS 的網址藏起來。

---

## 6. 終點站：Google Apps Script（`_gs/Code.gs`）

Google Apps Script（簡稱 GAS）是 Google 提供的一種「可以寫程式、又能直接操作
Google 試算表 / 文件 / 表單」的免費工具。我們把 `_gs/Code.gs` 這段程式碼貼到
Google 試算表的「Apps Script 編輯器」裡，並且把它**部署成一個網頁應用程式**，
它就會有一個專屬的網址（就是我們放進 `GAS_URL` 環境變數的那個網址）。

```js
function doPost(e) {
  try {
    // 1. 把收到的 JSON 字串轉成 JavaScript 物件
    var data = JSON.parse(e.postData.contents);

    // 2. 把物件裡的欄位一個一個拿出來（沒有的話就給空字串）
    var timeStamp = data.timeStamp || new Date().toISOString();
    var userName = data.userName || "";
    var useGender = data.useGender || "";
    var useAge = data.useAge || "";
    var userEmail = data.userEmail || "";
    var log = data.log || "";

    // 3. 找到（或建立）叫做 logSheet 的工作表
    var sheet = getLogSheet_();

    // 4. 把這 6 個值，寫成試算表的「新的一列」
    sheet.appendRow([timeStamp, userName, useGender, useAge, userEmail, log]);

    // 5. 告訴前端「寫入成功」
    return ContentService.createTextOutput("OK");
  } catch (err) {
    // 6. 如果中間任何一步出錯，把「錯誤訊息本人」回傳回去，方便除錯
    return ContentService.createTextOutput(err.message);
  }
}
```

一些關鍵字解釋：

- **`doPost(e)`**：這是 GAS 的一個特殊函式名稱，只要有人對這個網頁應用程式的網址
  發送 `POST` 請求，GAS 就會自動執行這個函式，`e` 裡面裝著這次請求送來的資料。
- **`appendRow([...])`**：試算表操作裡最常用的指令之一，意思是「在工作表的最後面，
  新增一列，裡面依序填入陣列裡的值」。陣列的順序，就是這一列從左到右的欄位順序。
- **`try...catch`**：先「嘗試（try）」執行程式，如果中間有任何錯誤發生，
  就會跳到 `catch` 那一段，把錯誤內容（`err.message`）回傳出去，
  而不是讓整個程式當掉、什麼訊息都不給。

---

## 7. 常見問題 / 除錯方向

**Q：資料一直沒有出現在 Google 試算表裡？**
- 先打開瀏覽器的「開發者工具 → Console」，看看有沒有紅字錯誤。
- 確認 Vercel 專案的環境變數 `GAS_URL` 有沒有設定，而且是「部署後」的網址
  （網址通常長得像 `https://script.google.com/macros/s/xxxxx/exec`）。
- 確認 Google Apps Script 部署的存取權限是「知道連結的任何人」，不然外部請求會被拒絕。

**Q：為什麼有時候明明操作了，Log 卻沒有馬上出現在試算表？**
- 因為系統是「每 5 筆事件才送一次」，如果目前只累積 3、4 筆，就還不會送出去，
  要再多做幾個動作，湊滿 5 筆才會送。

**Q：換了一台電腦 / 換了瀏覽器，之前沒送出去的紀錄還在嗎？**
- 不在。因為暫存清單是存在**這台瀏覽器**的 `localStorage` 裡，換瀏覽器或清除瀏覽器資料，
  暫存清單就會不見。

**Q：`log` 欄位裡出現一堆用 `|` 隔開的文字，代表什麼？**
- 代表這一列資料是「5 筆事件合併後」送出的結果，`|` 是拿來分隔每一筆事件用的符號，
  你可以把它想成是把 5 句話用逗號串成一句話。
