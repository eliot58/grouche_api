#!/usr/bin/env node
/**
 * TONAPI Webhooks CLI
 *
 * Команды:
 *   # создать вебхук
 *   node tonapi-webhooks.js create --endpoint https://your-server.com/webhook
 *
 *   # получить список вебхуков
 *   node tonapi-webhooks.js list
 *
 *   # удалить вебхук
 *   node tonapi-webhooks.js delete --id 5
 *
 *   # подписаться на транзакции аккаунтов
 *   node tonapi-webhooks.js subscribe --id 5 --accounts 0:abc...,0:def...
 *
 *   # отписаться от транзакций аккаунтов
 *   node tonapi-webhooks.js unsubscribe --id 5 --accounts 0:abc...,0:def...
 *
 * Опции:
 *   --useQuery        Передавать токен как ?token= вместо Authorization заголовка
 *   --endpoint, -e    URL вашего вебхука для create
 *   --id, -i          ID вебхука (для delete/subscribe/unsubscribe)
 *   --accounts, -a    Список аккаунтов через запятую (для subscribe/unsubscribe)
 *
 * Аутентификация:
 *   Экспортируйте токен: export TONAPI_TOKEN="eyJhbGciOi..."
 *   По умолчанию используется Authorization: Bearer <token>.
 *   Можно переключиться на ?token= через флаг --useQuery.
 */

const BASE = "https://rt.tonapi.io";
const TOKEN = process.env.TONAPIKEY;

if (!TOKEN) {
  console.error("❌ Env TONAPI_TOKEN не задан. Получите ключ на https://tonconsole.com/ и сделайте: export TONAPI_TOKEN=...");
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const useQuery = !!args.useQuery;

(async () => {
  try {
    switch ((args._[0] || "").toLowerCase()) {
      case "create": {
        const endpoint = args.endpoint || args.e;
        if (!endpoint) throw new Error("Не указан --endpoint");
        const res = await api("/webhooks", { method: "POST", body: { endpoint } });
        console.log("✅ Webhook создан:", res);
        break;
      }
      case "list": {
        const res = await api("/webhooks", { method: "GET" });
        console.log("📋 Webhooks:", JSON.stringify(res, null, 2));
        break;
      }
      case "delete": {
        const id = getIdArg(args);
        await api(`/webhooks/${id}`, { method: "DELETE" });
        console.log(`🗑️  Webhook ${id} удален`);
        break;
      }
      case "subscribe": {
        const id = getIdArg(args);
        const accounts = parseAccountsArg(args);
        // Тело: {"accounts":[{"account_id":"..."}]}
        const payload = { accounts: accounts.map((a) => ({ account_id: a })) };
        const res = await api(`/webhooks/${id}/account-tx/subscribe`, {
          method: "POST",
          body: payload,
        });
        console.log(`🔔 Подписка оформлена для webhook ${id}:`, JSON.stringify(res, null, 2));
        break;
      }
      case "unsubscribe": {
        const id = getIdArg(args);
        const accounts = parseAccountsArg(args);
        // Тело: {"accounts":["...","..."]}
        const payload = { accounts };
        const res = await api(`/webhooks/${id}/account-tx/unsubscribe`, {
          method: "POST",
          body: payload,
        });
        console.log(`🔕 Отписка выполнена для webhook ${id}:`, JSON.stringify(res, null, 2));
        break;
      }
      case "help":
      case "":
      default:
        printHelp();
        process.exit(0);
    }
  } catch (err) {
    if (err?.responseJson) {
      console.error("❌ Ошибка:", JSON.stringify(err.responseJson, null, 2));
    } else {
      console.error("❌ Ошибка:", err.message || err);
    }
    process.exit(1);
  }
})();

/** --- helpers --- */

async function api(path, { method = "GET", body } = {}) {
  const url = new URL(BASE + path);
  if (useQuery) {
    url.searchParams.set("token", TOKEN);
  }

  const headers = { "Content-Type": "application/json" };
  if (!useQuery) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.responseJson = json;
    throw err;
  }
  return json;
}

function parseArgs(argv) {
  const out = { _: [] };
  let key = null;
  for (const a of argv) {
    if (a.startsWith("--")) {
      key = a.slice(2);
      if (key === "useQuery") {
        out.useQuery = true;
        key = null;
      } else {
        out[key] = true; // временно ставим true, значение придет следующим токеном
      }
    } else if (a.startsWith("-")) {
      key = a.slice(1);
      out[key] = true;
    } else if (key) {
      out[key] = a;
      key = null;
    } else {
      out._.push(a);
    }
  }
  return out;
}

function getIdArg(a) {
  const id = a.id || a.i;
  if (!id) throw new Error("Не указан --id");
  return id;
}

function parseAccountsArg(a) {
  const raw = a.accounts || a.a;
  if (!raw) throw new Error("Не указан --accounts (список через запятую)");
  // Разрешаем пробелы и переводы строк
  const list = String(raw)
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) throw new Error("Пустой список аккаунтов");
  return list;
}

function printHelp() {
  console.log(`
TONAPI Webhooks CLI

Использование:
  node tonapi-webhooks.js create --endpoint https://your-server.com/webhook
  node tonapi-webhooks.js list
  node tonapi-webhooks.js delete --id 5
  node tonapi-webhooks.js subscribe --id 5 --accounts 0:abc...,0:def...
  node tonapi-webhooks.js unsubscribe --id 5 --accounts 0:abc...,0:def...

Опции:
  --useQuery        Передавать токен как ?token= вместо Authorization заголовка
  --endpoint, -e    URL вашего вебхука (для create)
  --id, -i          ID вебхука (для delete/subscribe/unsubscribe)
  --accounts, -a    Список аккаунтов через запятую или пробелы

Переменные окружения:
  TONAPI_TOKEN      Ваш приватный API ключ (Bearer/Query)
`);
}
