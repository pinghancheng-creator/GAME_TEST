export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "僅支援 POST 請求" });
  }

  const gasUrl = process.env.GAS_URL;

  if (!gasUrl) {
    console.error("缺少 GAS_URL 環境變數");
    return res.status(500).json({ error: "伺服器尚未設定 GAS_URL 環境變數" });
  }

  try {
    const gasRes = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });

    const text = await gasRes.text();

    res.status(gasRes.status);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(text);
  } catch (err) {
    console.error("轉送至 GAS 失敗：", err);
    return res.status(502).json({ error: "無法連線至 GAS，請稍後再試。" });
  }
}
