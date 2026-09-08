import threading
import time
from typing import Any


class AnalyticsTracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.api_calls_count = 0
        self.errors_count = 0
        self.rate_limits = 0
        self.latencies: list[float] = []
        self.message_counts: dict[str, int] = {}  # Hour string -> message count

    def record_call(self, latency_ms: float) -> None:
        with self._lock:
            self.api_calls_count += 1
            self.latencies.append(latency_ms)
            if len(self.latencies) > 100:
                self.latencies.pop(0)

    def record_error(self) -> None:
        with self._lock:
            self.errors_count += 1

    def record_rate_limit(self) -> None:
        with self._lock:
            self.rate_limits += 1

    def record_message(self) -> None:
        with self._lock:
            # Group by hour e.g. "14:00"
            hour_str = time.strftime("%H:00")
            self.message_counts[hour_str] = self.message_counts.get(hour_str, 0) + 1

    def get_stats(self) -> dict[str, Any]:
        with self._lock:
            avg_latency = sum(self.latencies) / len(self.latencies) if self.latencies else 0.0

            # Format message volume for charts
            volume_list = []
            # Fill last 6 hours if empty
            current_hour = int(time.strftime("%H"))
            for i in range(-5, 1):
                h = (current_hour + i) % 24
                h_str = f"{h:02d}:00"
                volume_list.append({"time": h_str, "messages": self.message_counts.get(h_str, 0)})

            return {
                "api_calls_count": self.api_calls_count,
                "errors_count": self.errors_count,
                "rate_limits": self.rate_limits,
                "avg_latency_ms": round(avg_latency, 2),
                "message_volume": volume_list,
            }


tracker = AnalyticsTracker()
