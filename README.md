<div align="center">

# Mind Mirror

### 一個專注於心智、情緒、人格與行為的心理自我探索測驗平台。

<p>
  <img alt="GitHub 可發布" src="https://img.shields.io/badge/GitHub-%E5%8F%AF%E7%99%BC%E4%BD%88-181717?style=for-the-badge&logo=github&logoColor=white">
  <img alt="JavaScript 測驗引擎" src="https://img.shields.io/badge/JavaScript-%E6%B8%AC%E9%A9%97%E5%BC%95%E6%93%8E-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111111">
  <img alt="Supabase 後端" src="https://img.shields.io/badge/Supabase-%E5%BE%8C%E7%AB%AF-3FCF8E?style=for-the-badge&logo=supabase&logoColor=0B2F22">
  <img alt="Deno 邊緣函式" src="https://img.shields.io/badge/Deno-%E9%82%8A%E7%B7%A3%E5%87%BD%E5%BC%8F-000000?style=for-the-badge&logo=deno&logoColor=white">
  <img alt="OpenAI 可選洞察" src="https://img.shields.io/badge/OpenAI-%E5%8F%AF%E9%81%B8%E6%B4%9E%E5%AF%9F-412991?style=for-the-badge&logo=openai&logoColor=white">
</p>

Mind Mirror 透過短而細膩的測驗，陪使用者更溫柔地理解自己。它像一面鏡子，陪你看見日常選擇裡的情緒節奏、思考慣性、關係模式與內在拉扯。

</div>

---

## 這個專案做什麼

- 提供 12 個心理自我探索主題，涵蓋人格、情緒、壓力、關係、動機、價值觀與思考模式。
- 每個主題都有 32 題題庫，每次作答隨機抽出 8 題，讓重測也保有新鮮感。
- 每個選項都對應心理特質分數，結果會呈現你的模式、傾向與近期常啟動的內在系統。
- 結果頁會產生人格化標題、敘事解讀、優勢、容易忽略的地方與溫柔成長建議。
- 本機預覽可直接使用示範模式，不需要先設定 Supabase。
- 啟用 Supabase 後，可以儲存匿名作答工作階段、答題紀錄、結果與行為分析事件。

## 測驗主題

| 主題 | 探索重點 |
| --- | --- |
| 人格節奏 | 你如何理解世界、安排自己，並在壓力與變動中維持自己的節奏。 |
| 情緒慣性 | 情緒如何升起、停留、被藏起來，或轉化成行動。 |
| 壓力反應 | 當生活變得太吵、太急、太不確定時，你會如何保住自己。 |
| 決策風格 | 當邏輯、直覺、壓力與害怕互相拉扯時，你如何做選擇。 |
| 關係風格 | 你如何靠近、等待、退開、修復，以及表達需要。 |
| 隱性恐懼 | 控制、討好、逃避、努力背後，那些安靜但真實的害怕。 |
| 動機風格 | 真正讓你開始、維持、衝刺或重新點燃自己的燃料。 |
| 社交行為 | 你如何管理注意力、歸屬感、能量與被看見的風險。 |
| 思考模式 | 你更信任邏輯、直覺、細節、全局，或某種內在訊號。 |
| 內在拉扯 | 慾望、安全感、真實自我與外界期待之間的推拉。 |
| 自律與衝動 | 你如何和慾望、疲累、長期目標與當下回饋談判。 |
| 人生價值 | 忙碌、壓力與選擇變重時，你最想守住什麼。 |

## 本機預覽

這個專案是靜態網站，可以直接在本機開起來看。預設會使用示範模式，不需要後端設定。

```bash
python3 -m http.server 4175
```

打開瀏覽器：

```text
http://127.0.0.1:4175
```

首頁會從 `index.html` 開始，單一測驗會透過這種網址進入：

```text
quiz.html?slug=personality-type
```

## 專案結構

```text
.
├── index.html                         # 12 個主題的測驗首頁
├── quiz.html                          # 共用測驗作答頁
├── script.js                          # 首頁互動
├── quiz.js                            # 測驗流程互動
├── styles.css                         # 視覺設計系統
├── config.js                          # 示範模式與 Supabase 執行設定
├── lib/
│   ├── quiz-content.js                # 測驗主題、題庫與結果設定
│   ├── scoring.js                     # 決定性計分邏輯
│   ├── local-service.js               # 本機示範模式服務
│   ├── api-service.js                 # Supabase 函式呼叫
│   ├── session.js                     # 匿名識別碼處理
│   └── telemetry.js                   # 行為事件佇列
├── supabase/
│   ├── migrations/                    # 資料表結構與權限規則
│   ├── seed.sql                       # 產生出的測驗內容種子資料
│   └── functions/                     # Supabase 邊緣函式
├── scripts/
│   └── build-seed-assets.mjs          # 從測驗內容重新產生種子資料與文件
├── tests/
│   └── content.test.mjs               # 內容與計分檢查
└── docs/
    └── quiz-content-examples.md       # 可審閱的測驗內容範例
```

## Supabase 設定

先套用資料庫遷移檔，再匯入測驗內容種子資料。

```bash
supabase db push
```

如果你想手動執行 SQL，請依序執行：

```text
supabase/migrations/202604160001_quiz_platform.sql
supabase/seed.sql
```

接著部署邊緣函式：

```bash
supabase functions deploy quiz-start
supabase functions deploy quiz-answer
supabase functions deploy quiz-complete
supabase functions deploy quiz-topic
supabase functions deploy track-event
```

## 執行設定

`config.js` 預設使用本機示範模式。

```js
window.__QUIZ_APP_CONFIG__ = {
  demoMode: true,
  supabaseUrl: "",
  supabaseAnonKey: "",
  functionsUrl: "",
  appName: "Mind Mirror",
};
```

如果要啟用 Supabase 儲存與追蹤，請關閉 `demoMode`，並填入你的 Supabase 專案資訊：

```js
window.__QUIZ_APP_CONFIG__ = {
  demoMode: false,
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  functionsUrl: "",
  appName: "Mind Mirror",
};
```

如果 `functionsUrl` 留空，前端會使用：

```text
${supabaseUrl}/functions/v1
```

## 邊緣函式環境變數

在 Supabase 設定這些密鑰：

```bash
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
supabase secrets set OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
supabase secrets set OPENAI_MODEL="gpt-4.1-mini"
```

`OPENAI_API_KEY` 與 `OPENAI_MODEL` 是可選設定。沒有設定時，結果仍會使用固定計分與手寫文案正常產生，只會略過額外的 AI 鏡像洞察。

## 可用指令

```bash
npm run build:seed
```

從 `lib/quiz-content.js` 重新產生 `supabase/seed.sql` 與 `docs/quiz-content-examples.md`。

```bash
npm test
```

執行內容與計分檢查。

## API 介面

| 函式 | 用途 |
| --- | --- |
| `quiz-start` | 建立測驗工作階段，並回傳 8 題隨機題目。 |
| `quiz-answer` | 儲存單題答案與對應的特質分數變化。 |
| `quiz-complete` | 計算分數、儲存結果，並在設定可用時加入 AI 洞察。 |
| `quiz-topic` | 回傳公開主題資訊，用於預覽與路由。 |
| `track-event` | 記錄匿名行為分析事件。 |

## 資料模型

Supabase 資料表結構包含：

- `quiz_topics`
- `questions`
- `question_options`
- `result_profiles`
- `quiz_sessions`
- `session_questions`
- `responses`
- `results`
- `analytics_events`

所有結果與行為寫入都會經過邊緣函式，避免公開前端直接寫入核心資料表。

## 隱私說明

Mind Mirror 使用儲存在 `localStorage` 的匿名識別碼。它會追蹤產品互動與測驗結果，不需要登入、姓名、電子郵件，也不做侵入式指紋追蹤。

## 驗證清單

- 首頁會正確顯示 12 張測驗卡片。
- 每次測驗會從題庫抽出 8 題不重複題目。
- 結果頁會包含標題、敘事解讀、優勢、容易忽略的地方與成長建議。
- 示範模式不需要 Supabase 也能運作。
- Supabase 模式會寫入作答工作階段、答題紀錄、結果與分析事件。
- 修改內容後，請先確認 `npm test` 通過再提交。

## 授權

目前是私人專案。公開發布前，建議先補上正式授權條款。
