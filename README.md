# ⚡ 能源轉型闖關遊戲

一個以「能源轉型」為主題的網頁互動小遊戲。玩家調整火力、風力、水力、太陽能、核能五種電廠的數量，
在**發電量、建造成本、排碳量、環境風險**之間找到平衡，在 2 分鐘內挑戰通關。

網站內建一個 AI 家教聊天機器人，會依照遊戲主題回答問題；同時會把使用者的基本資料與操作行為
記錄到 Google 試算表，方便後續分析。

---

## 目錄

- [專案結構](#專案結構)
- [功能總覽](#功能總覽)
- [遊戲流程](#遊戲流程)
- [AI 家教聊天機器人](#ai-家教聊天機器人)
- [使用者資料與行為紀錄（GAS）](#使用者資料與行為紀錄gas)
- [本機執行方式](#本機執行方式)
- [部署到 Vercel](#部署到-vercel)
- [環境變數](#環境變數)
- [技術棧](#技術棧)

---

## 專案結構

```
GAME_TEST/
├── index.html                     # 整個遊戲的前端（HTML + CSS + JS 都在這一個檔案裡）
├── api/
│   ├── chat.js                    # Vercel Serverless Function：轉發訊息給 OpenRouter，回傳 AI 家教的回覆
│   └── save.js                    # Vercel Serverless Function：轉發使用者資料/紀錄給 GAS
├── _gs/
│   └── Code.gs                    # Google Apps Script 原始碼（部署在 Google 試算表的「Apps Script」編輯器中）
├── src/
│   └── 111.png                    # AI 家教頭像圖片
├── 能源轉型闖關遊戲_規劃書.md      # 最初的遊戲設計規劃書
└── README.md                      # 就是你正在看的這份文件
```

> `_gs/Code.gs` 只是**原始碼備份**，真正運作的程式碼要另外貼到 Google 試算表的
> 「Extensions → Apps Script」編輯器裡並部署成網頁應用程式，詳見下方說明。

---

## 功能總覽

- ⚡ 五種電廠（火力／風力／水力／太陽能／核能）可自由增減數量
- 📊 即時計算總發電量、總成本、累計排碳量、總環境風險
- 🏙️ 依電廠配置與碳排放動態呈現城市場景（天空變暗、居民表情變化等）
- ⏱️ 遊戲限時 2 分鐘，時間到自動顯示結果頁
- 🔐 進入遊戲前需先登入：填寫姓名、帳號 ID、密碼、性別、年齡、Email（Email 會驗證格式），
  帳號密碼由管理員在 Google 試算表裡建立，玩家不需自行註冊
- 💬 右上角 AI 家教聊天泡泡，可詢問能源相關問題，離題會委婉拒絕
- ☁️ 使用者資料與操作行為會透過後端代理送到 Google 試算表保存

---

## 遊戲流程

1. **登入（開始頁）**
   打開頁面會先看到一個登入畫面，需要輸入姓名、帳號 ID、密碼、性別、年齡、Email。
   按下「登入並開始遊戲」後，系統會：
   - 檢查表單是否都填寫完整、Email 格式是否正確
   - 把帳號 ID、密碼送到後端，跟 Google 試算表 `login` 工作表裡的資料核對：
     - 帳號、密碼必須完全對得上其中一列
     - 而且那一列的 `userName`、`userEmail` 欄位都不可以是空白（代表管理員已經開通這個帳號）
   - 只有兩個條件都通過，才會進入遊戲；否則會顯示錯誤訊息，停留在登入頁

2. **遊戲進行（2 分鐘）**
   - 玩家可以用每張電廠卡片下方的「＋ / −」按鈕調整該電廠數量。
   - 畫面上方會有一個倒數計時器（剩餘時間：MM:SS），最後 20 秒會變紅色提醒。
   - **排碳量是持續累積的**：每 10 秒，系統會依照「當下」電廠配置排放一次碳，
     並把這次排放量加進「累計碳排量」，就算之後調整電廠數量，之前排放出去的碳也不會消失。
   - 環境風險則是即時值，只反映「目前」的電廠配置，不會累積。

3. **時間到、自動跳轉結果頁**
   2 分鐘一到，系統會自動：
   - 停止計時器與碳排放的累加
   - 顯示結果頁，內容包含：每種電廠各自的數量與發電量、總發電量、累計碳排量、總環境風險
   - 提供「重新挑戰」按鈕，可重新整理頁面、重新開始一輪遊戲

---

## AI 家教聊天機器人

- 位置：畫面右上角的圓形頭像按鈕，點擊後彈出類似 Facebook Messenger 的對話視窗。
- 主題限定：系統提示（system prompt）把 AI 定位為「能源小教練」，只回答跟這個遊戲、
  能源知識、永續發展相關的問題；如果使用者問了無關的問題（例如閒聊、其他遊戲、程式除錯等），
  AI 會委婉拒絕並把話題帶回能源主題，而不是生硬地說「我不能回答」。
- 技術細節：
  - 前端呼叫自家的 `/api/chat`（**不會**直接呼叫 OpenRouter，金鑰不會暴露在瀏覽器）。
  - `api/chat.js` 收到 `{ message, history }` 後，組成含 system prompt 的訊息陣列，
    呼叫 OpenRouter 的 `/chat/completions`，把 AI 回覆包成 `{ reply }` 回傳。
  - 使用的模型可用環境變數 `AI_MODEL` 指定，預設是 `openai/gpt-oss-120b:free`。

---

## 登入系統與帳號管理

這個遊戲**不提供自行註冊**，帳號密碼都由管理員預先在 Google 試算表的 `login` 工作表建立。

`login` 工作表格式如下（第一列是欄位標題）：

| id    | password | userName | userEmail |
| ----- | -------- | -------- | --------- |
| 60101 | 0001     |          |           |
| 60102 | 0002     |          |           |
| ...   | ...      |          |           |

- `id`／`password`：管理員發放給玩家的帳號、密碼。
- `userName`／`userEmail`：一開始可以先留空，等管理員確認要開通這個帳號後，
  再手動把玩家的姓名、Email 填進對應那一列。
- 玩家在登入頁輸入帳號、密碼後，系統會去核對 `login` 工作表：
  - 找不到對得上的 `id` + `password` → 顯示「帳號或密碼錯誤」
  - 找得到，但那一列的 `userName` 或 `userEmail` 是空白 → 顯示「此帳號尚未開通，請聯絡管理員」
  - 找得到，而且 `userName`、`userEmail` 都有值 → 登入成功，進入遊戲頁面

---

## 使用者資料與行為紀錄（GAS）

遊戲會把「使用者基本資料」與「操作行為紀錄（log）」送到 Google 試算表保存。
完整的初學者導覽請看另一份文件：**[docs/LOG_GUIDE.md](docs/LOG_GUIDE.md)**。

這裡先講重點：

- 資料**不會**從瀏覽器直接送到 Google，而是先送到 `/api/save`（Vercel Serverless Function），
  再由伺服器轉送給 Google Apps Script（GAS）。這樣可以把 GAS 的網址藏在伺服器端環境變數裡，
  不會被使用者在瀏覽器開發者工具看到。
- 每一筆送到 GAS 的資料都長這樣：
  ```json
  {
    "timeStamp": "2026-07-12T09:00:00.000Z",
    "userName": "王小明",
    "useGender": "男",
    "useAge": "20",
    "userEmail": "example@mail.com",
    "log": "..."
  }
  ```
- GAS 收到後，會把這 6 個欄位寫成試算表 `logSheet` 工作表裡的**一列**。

---

## 本機執行方式

這個專案的前端就是一個單純的 `index.html`，可以直接用瀏覽器打開來看畫面，
但 **AI 家教聊天** 與 **資料紀錄** 這兩個功能需要 `api/chat.js`、`api/save.js` 這兩支
Serverless Function 才能運作，本機測試建議用 Vercel CLI：

```bash
npm install -g vercel
vercel dev
```

啟動後照終端機顯示的網址（通常是 `http://localhost:3000`）打開瀏覽器即可，
`vercel dev` 會自動把 `api/` 資料夾底下的函式跑起來，並讀取 `.env.local` 裡的環境變數。

---

## 部署到 Vercel

1. 把整個專案推到 GitHub / GitLab，並在 Vercel 建立新專案、連結該儲存庫。
2. 到 Vercel 專案的 **Settings → Environment Variables** 設定下方「環境變數」章節列出的變數。
3. 部署後，Vercel 會自動把 `api/chat.js`、`api/save.js` 建成 Serverless Function。
4. 別忘了先把 `_gs/Code.gs` 部署成 Google Apps Script 的網頁應用程式，拿到網址後填進 `GAS_URL`。

---

## 環境變數

在 Vercel（或本機 `.env.local`）需要設定以下變數：

| 變數名稱             | 說明                                                             | 範例 / 預設值                       |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `OPENROUTER_API_KEY` | OpenRouter 的 API 金鑰，供 `api/chat.js` 呼叫 AI 模型用             | `sk-or-xxxxxxxx`                     |
| `AI_MODEL`           | （選用）指定要用的模型，沒設定就用預設值                            | `openai/gpt-oss-120b:free`（預設）   |
| `GAS_URL`            | Google Apps Script 部署後的「網頁應用程式」網址，供 `api/save.js` 轉送資料用 | `https://script.google.com/macros/s/.../exec` |

⚠️ **這三個變數都不要寫死在程式碼裡**，一律透過環境變數讀取，避免金鑰或網址外洩。

---

## 技術棧

- 前端：純 HTML + CSS + JavaScript（無框架、無外部套件）
- 後端：Vercel Serverless Functions（Node.js，`api/chat.js`、`api/save.js`）
- AI：透過 OpenRouter 呼叫 LLM 模型
- 資料儲存：Google Apps Script + Google 試算表
