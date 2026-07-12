const SYSTEM_PROMPT = `你是「能源小教練」，一個嵌入在「能源轉型闖關遊戲」網頁中的 AI 家教。
這款遊戲讓玩家調整火力、風力、水力、太陽能、核能等發電廠的數量，
在發電量、建造成本、排碳量、環境風險之間找到平衡以通關。

你的任務：
- 用親切、簡短、易懂的中文，協助玩家理解各種發電方式的優缺點、能源轉型的概念、
  排碳與環境風險的取捨，並在玩家卡關時給予策略建議（但不要直接洩漏單一標準答案，
  多引導玩家自己思考）。
- 回答盡量精簡（3-6 句以內），必要時可條列重點。

如果玩家的問題明顯與這個能源轉型遊戲、能源知識、永續發展無關（例如閒聊八卦、
其他遊戲、程式除錯、個人隱私等），請委婉拒絕，並自然地把話題帶回能源相關主題，
不要生硬地說「我不能回答」，而是像家教一樣溫和地引導，例如：
「這個我比較沒辦法幫上忙耶，不過如果你想聊聊怎麼兼顧發電量跟排碳量，我很樂意喔！」`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "僅支援 POST 請求" });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "缺少訊息內容" });
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .slice(-10)
    : [];

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...safeHistory,
    { role: "user", content: message },
  ];

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "openai/gpt-oss-120b:free",
          messages,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", response.status, errText);
      return res
        .status(502)
        .json({ error: "AI 服務暫時無法回應，請稍後再試。" });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res
        .status(502)
        .json({ error: "AI 沒有回傳有效內容，請再試一次。" });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ error: "伺服器發生錯誤，請稍後再試。" });
  }
}
