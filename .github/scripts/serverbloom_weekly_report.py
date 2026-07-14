#!/usr/bin/env python3
"""Send ServerBloom's private, evidence-limited weekly card health report."""

from __future__ import annotations

import json
import os
import re
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


API_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbwsU40XuJqCBFzCZjH_Mp57y05OIIFp3RAtxFD1HisM_she08o2951ajf4ovzA1Q1gW/exec"
)
TAIPEI = ZoneInfo("Asia/Taipei")
PLACEHOLDER_NAME = "下一個盛開的社群"
BUILTIN_SERVER = {
    "id": "only-for-game",
    "name": "Only for Game",
    "category": "遊戲",
    "inviteUrl": "https://discord.gg/bWTKbMzct3",
    "tags": ["LOL", "Minecraft", "Steam", "台港澳"],
    "description": "台港澳玩家為主的遊戲交流社群，聊天、語音、找隊友與日常互動都能慢慢找到固定圈子。",
    "createdAt": None,
}


def request_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "ServerBloom-weekly-report/1.0"})
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8")


def load_servers() -> list[dict[str, Any]]:
    callback = "serverBloomWeeklyReport"
    raw = request_text(f"{API_URL}?callback={callback}")
    match = re.fullmatch(rf"\s*{callback}\((.*)\);?\s*", raw, re.DOTALL)
    if not match:
        raise RuntimeError("Server data did not use the expected JSONP response format")

    payload = json.loads(match.group(1))
    remote = payload.get("servers", []) if isinstance(payload, dict) else []
    servers = [BUILTIN_SERVER, *[item for item in remote if isinstance(item, dict)]]

    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for server in servers:
        name = str(server.get("name") or "").strip()
        invite = str(server.get("inviteUrl") or "").strip()
        if not name or name == PLACEHOLDER_NAME or not invite or invite in seen:
            continue
        seen.add(invite)
        unique.append(server)
    return unique


def invite_code(invite_url: str) -> str | None:
    parsed = urlparse(invite_url)
    host = (parsed.hostname or "").lower()
    parts = [part for part in parsed.path.split("/") if part]
    if host in {"discord.gg", "www.discord.gg"} and parts:
        return parts[0]
    if host in {"discord.com", "www.discord.com"} and len(parts) >= 2 and parts[0] == "invite":
        return parts[1]
    return None


def invite_issue(invite_url: str) -> str | None:
    code = invite_code(invite_url)
    if not code:
        return "可能問題：邀請網址格式不是可辨識的 Discord 邀請連結。"
    try:
        request_text(f"https://discord.com/api/v10/invites/{code}?with_counts=true")
    except HTTPError as error:
        if error.code == 404:
            return "可能問題：Discord 公開介面回報找不到此邀請，邀請可能已失效。"
        return f"可能問題：Discord 驗證服務回傳 HTTP {error.code}，本次無法可靠確認邀請狀態。"
    except (URLError, TimeoutError, OSError):
        return "可能問題：Discord 驗證服務暫時無法回應，本次無法可靠確認邀請狀態。"
    return None


def optional_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def normalized_tags(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item for item in re.split(r"[、,，\s]+", str(value or "")) if item]


def analyze_server(server: dict[str, Any], now: datetime) -> list[str]:
    issues: list[str] = []
    invite = str(server.get("inviteUrl") or "").strip()
    checked_invite = invite_issue(invite)
    if checked_invite:
        issues.append(checked_invite)

    description = str(server.get("description") or "").strip()
    if len(description) < 30:
        issues.append("可能問題：公開介紹較短，玩家可能難以快速理解社群特色與適合對象。")

    tags = normalized_tags(server.get("tags"))
    if len(tags) < 2:
        issues.append("可能問題：公開標籤少於 2 個，搜尋與分類線索可能不足。")

    updated = parse_time(server.get("updatedAt") or server.get("createdAt"))
    if updated is None:
        issues.append("可能問題：缺少可驗證的更新日期，無法確認卡片資料是否仍為最新。")
    elif (now.astimezone(timezone.utc) - updated.astimezone(timezone.utc)).days > 90:
        issues.append("可能問題：公開卡片資料已超過 90 天未更新，內容可能需要重新確認。")

    growth = optional_number(server.get("growth30d"))
    if growth is None:
        issues.append("可能問題：缺少可靠的最近 30 天成長資料，無法判斷是否成長停滯。")
    elif growth <= 0:
        issues.append("可能問題：公開的最近 30 天淨成長未高於 0，可能出現成長停滯。")

    current_clicks = optional_number(server.get("clicks7d"))
    previous_clicks = optional_number(server.get("clicksPrevious7d"))
    if current_clicks is None or previous_clicks is None:
        issues.append("可能問題：缺少連續兩週的點擊資料，無法判斷點擊是否異常。")
    elif previous_clicks >= 5 and current_clicks <= previous_clicks * 0.2:
        issues.append("可能問題：近 7 天公開點擊量較前一週下降 80% 以上，建議確認連結與曝光狀態。")
    elif previous_clicks >= 5 and current_clicks >= previous_clicks * 3:
        issues.append("可能問題：近 7 天公開點擊量升至前一週 3 倍以上，建議排除重複或自動化流量。")

    return issues


def build_report(servers: list[dict[str, Any]], now: datetime) -> str:
    lines = [
        "ServerBloom 每週私密可能問題報告",
        f"產生時間：{now.strftime('%Y-%m-%d %H:%M')}（台灣時間）",
        f"正式社群卡片：{len(servers)} 張",
        "",
        "注意：這是根據網站公開欄位與公開端點進行的自動檢查，只列出可能問題，",
        "不代表已知 Discord 群內的真實情況；請由管理者人工複核後再處理。",
    ]

    for index, server in enumerate(servers, start=1):
        name = str(server.get("name") or "未命名社群").strip()
        issues = analyze_server(server, now)
        lines.extend(["", f"{index}. {name}"])
        if issues:
            lines.extend(f"- {issue}" for issue in issues)
        else:
            lines.append("- 本週未偵測到可由公開資料判斷的可能問題。")
    return "\n".join(lines)


def required_secret(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Required GitHub Secret is missing: {name}")
    return value


def send_report(report: str, now: datetime) -> None:
    username = required_secret("SERVERBLOOM_REPORT_SMTP_USERNAME")
    password = required_secret("SERVERBLOOM_REPORT_SMTP_APP_PASSWORD")
    recipient = required_secret("SERVERBLOOM_REPORT_RECIPIENT")

    message = EmailMessage()
    message["Subject"] = f"[ServerBloom] 每週私密可能問題報告 {now:%Y-%m-%d}"
    message["From"] = username
    message["To"] = recipient
    message.set_content(report)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=30) as smtp:
        smtp.login(username, password)
        smtp.send_message(message, from_addr=username, to_addrs=[recipient])


def main() -> None:
    now = datetime.now(TAIPEI)
    servers = load_servers()
    report = build_report(servers, now)
    send_report(report, now)
    print(f"Weekly private report sent for {len(servers)} formal cards.")


if __name__ == "__main__":
    main()
