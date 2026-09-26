import os
import subprocess
import threading
import time
import hashlib
import logging
from typing import Optional, List, Dict, Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger("MoomooConnection")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

OPEND_BINARY_PATH = os.environ.get("OPEND_BINARY_PATH", "/app/opend/opend_linux_dir/OpenD")
OPEND_DIR = os.path.dirname(OPEND_BINARY_PATH)
OPEND_CONFIG_XML = os.path.join(OPEND_DIR, "OpenD.xml")
OPEND_LOG_DIR = "/tmp/opend_logs"

OPEND_HOST = os.environ.get("MOOMOO_OPEND_HOST", "127.0.0.1")
OPEND_PORT = int(os.environ.get("MOOMOO_OPEND_PORT", 11111))
OPEND_STARTUP_WAIT_SECONDS = int(os.environ.get("OPEND_STARTUP_WAIT_SECONDS", 10))
RECONNECT_DELAY_SECONDS = 5
WATCHDOG_INTERVAL_SECONDS = 15

class MoomooConnectionManager:
    def __init__(self):
        self._opend_process: Optional[subprocess.Popen] = None
        self._quote_ctx = None
        self._connected: bool = False
        self._running: bool = False
        self._lock = threading.Lock()
        self._watchdog_thread: Optional[threading.Thread] = None
        self._connection_status: str = "NOT_STARTED"
        self._last_reconnect_time: float = 0.0
        self._reconnect_count: int = 0
        self._startup_error: Optional[str] = None
        self.stdout_lines: List[str] = []
        self.stderr_lines: List[str] = []

    def start(self) -> None:
        logger.info("[MOOMOO] Starting Moomoo connection manager...")
        self._running = True
        self._startup_error = None

        account = os.environ.get("MOOMOO_LOGIN_ACCOUNT", "").strip()
        pwd = os.environ.get("MOOMOO_LOGIN_PASSWORD", "").strip()
        if not account or not pwd:
            self._connection_status = "CONFIG_ERROR"
            self._startup_error = "Missing MOOMOO_LOGIN_ACCOUNT or MOOMOO_LOGIN_PASSWORD env var"
            logger.error(f"[MOOMOO] {self._startup_error}")
            return

        self._launch_opend(account, pwd)
        if self._opend_process is None:
            return

        logger.info(f"[MOOMOO] Waiting {OPEND_STARTUP_WAIT_SECONDS}s for OpenD to initialize...")
        time.sleep(OPEND_STARTUP_WAIT_SECONDS)

        self._connect_sdk()
        self._start_watchdog()

    def _configure_xml(self, account: str, pwd_md5: str):
        os.makedirs(OPEND_LOG_DIR, exist_ok=True)
        xml_content = f'''<moomoo_opend>
\t<ip>127.0.0.1</ip>
\t<api_port>{OPEND_PORT}</api_port>
\t<lang>en</lang>
\t<log_level>info</log_level>
\t<log_path>{OPEND_LOG_DIR}</log_path>
\t<push_proto_type>0</push_proto_type>
\t<price_reminder_push>1</price_reminder_push>
\t<auto_hold_quote_right>1</auto_hold_quote_right>
\t<future_trade_api_time_zone>UTC+8</future_trade_api_time_zone>
\t<login_account>{account}</login_account>
\t<login_pwd_md5>{pwd_md5}</login_pwd_md5>
\t<area_code>60</area_code>
\t<login_region>us</login_region>
</moomoo_opend>
'''
        try:
            with open(OPEND_CONFIG_XML, "w", encoding="utf-8") as f:
                f.write(xml_content)
            logger.info(f"[MOOMOO] Wrote OpenD.xml to {OPEND_CONFIG_XML} with account {account}, area_code 60, and login_region us")
        except Exception as e:
            logger.error(f"[MOOMOO] Failed to write OpenD.xml: {e}")

    def _launch_opend(self, account: str, pwd: str) -> None:
        try:
            if not os.path.exists(OPEND_BINARY_PATH):
                self._connection_status = "OPEND_BINARY_MISSING"
                self._startup_error = f"OpenD binary not found at {OPEND_BINARY_PATH}"
                logger.error(f"[MOOMOO] {self._startup_error}")
                return

            env_opend = os.environ.copy()
            opend_dir = os.path.dirname(OPEND_BINARY_PATH)
            env_opend['LD_LIBRARY_PATH'] = opend_dir + (':' + env_opend.get('LD_LIBRARY_PATH', ''))

            pwd_md5 = hashlib.md5(pwd.encode('utf-8')).hexdigest()
            self._configure_xml(account, pwd_md5)

            cmd = [
                OPEND_BINARY_PATH,
                f"-login_account={account}",
                f"-login_pwd_md5={pwd_md5}",
                "-area_code=60",
                "-login_region=us",
                f"-cfg_file={OPEND_CONFIG_XML}",
            ]
            logger.info(f"[MOOMOO] Launching OpenD binary: {' '.join([OPEND_BINARY_PATH, f'-login_account={account}', '-login_pwd_md5=***', '-area_code=60', '-login_region=us', f'-cfg_file={OPEND_CONFIG_XML}'])}")

            self._opend_process = subprocess.Popen(
                cmd,
                cwd=opend_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                env=env_opend,
            )
            logger.info(f"[MOOMOO] OpenD launched — PID: {self._opend_process.pid}")
            self._connection_status = "OPEND_STARTING"

            threading.Thread(target=self._reader_thread, args=(self._opend_process.stdout, self.stdout_lines), daemon=True).start()
            threading.Thread(target=self._reader_thread, args=(self._opend_process.stderr, self.stderr_lines), daemon=True).start()

        except PermissionError:
            self._connection_status = "OPEND_NOT_EXECUTABLE"
            self._startup_error = f"Permission denied for OpenD binary at {OPEND_BINARY_PATH}"
            logger.error(f"[MOOMOO] {self._startup_error}")
        except Exception as e:
            self._connection_status = "OPEND_LAUNCH_FAILED"
            self._startup_error = str(e)
            logger.error(f"[MOOMOO] Failed to launch OpenD: {e}")
            self._opend_process = None

    def _reader_thread(self, pipe, lines_list):
        try:
            for line in iter(pipe.readline, ''):
                if line:
                    clean = line.strip()
                    lines_list.append(clean)
                    if len(lines_list) > 100:
                        lines_list.pop(0)
                    logger.info(f"[OpenD stdout/err] {clean}")
        except Exception:
            pass

    def send_stdin(self, text: str) -> bool:
        if self._opend_process and self._opend_process.stdin:
            try:
                self._opend_process.stdin.write(text + "\n")
                self._opend_process.stdin.flush()
                logger.info(f"[OpenD stdin] Sent: {text}")
                return True
            except Exception as e:
                logger.error(f"[OpenD stdin] Error sending input: {e}")
        return False

    def stop(self) -> None:
        logger.info("[MOOMOO] Stopping connection manager...")
        self._running = False
        self._close_sdk()
        self._terminate_opend()

    def is_connected(self) -> bool:
        return self._connected

    def get_quote_ctx(self):
        with self._lock:
            return self._quote_ctx if self._connected else None

    def get_status(self) -> dict:
        return {
            "status": self._connection_status,
            "connected": self._connected,
            "opend_pid": self._opend_process.pid if self._opend_process else None,
            "opend_alive": self._is_opend_alive(),
            "reconnect_count": self._reconnect_count,
            "last_reconnect_time": self._last_reconnect_time,
            "startup_error": self._startup_error,
            "opend_recent_stdout": self.stdout_lines[-10:],
            "opend_recent_stderr": self.stderr_lines[-10:],
        }

    def test_connection(self) -> dict:
        results = {
            "step_1_opend_process_alive": False,
            "step_2_sdk_connected": False,
            "step_3_market_state_accessible": False,
            "step_4_mcl_contracts_found": [],
            "step_5_snapshot_data_received": False,
            "target_contracts_detected": {
                "september_2026": None,
                "october_2026": None,
                "november_2026": None,
            },
            "overall_success": False,
            "error": None,
            "diagnostics": [],
            "opend_process_logs": self.stdout_lines[-15:] + self.stderr_lines[-15:]
        }

        account = os.environ.get("MOOMOO_LOGIN_ACCOUNT", "").strip()
        pwd = os.environ.get("MOOMOO_LOGIN_PASSWORD", "").strip()

        if not account or not pwd:
            results["diagnostics"].append("Lacking Credentials: MOOMOO_LOGIN_ACCOUNT or MOOMOO_LOGIN_PASSWORD is not configured in environment variables.")

        if self._is_opend_alive():
            results["step_1_opend_process_alive"] = True
            logger.info("[TEST] Step 1 PASS: OpenD process is alive")
        else:
            msg = "OpenD process is not running. Check if OpenD binary exists and is executable."
            results["diagnostics"].append(msg)
            results["error"] = msg
            logger.error(f"[TEST] Step 1 FAIL: {msg}")
            return results

        with self._lock:
            ctx = self._quote_ctx

        if ctx and self._connected:
            results["step_2_sdk_connected"] = True
            logger.info("[TEST] Step 2 PASS: SDK is connected to OpenD")
        else:
            msg = f"SDK is not connected to OpenD. Cause: {self._startup_error or 'Connection rejected or timeout'}"
            results["diagnostics"].append(msg)
            results["error"] = msg
            logger.error(f"[TEST] Step 2 FAIL: {msg}")
            return results

        try:
            from moomoo import RET_OK
            ret, data = ctx.get_market_state(["NYMEX.MCL"])
            if ret == RET_OK:
                results["step_3_market_state_accessible"] = True
                logger.info("[TEST] Step 3 PASS: Market state query succeeded")
            else:
                diag = f"Market state query returned error: {data}. Futures trading or quote authority might be restricted."
                results["diagnostics"].append(diag)
                logger.warning(f"[TEST] Step 3 WARN: {diag}")
        except Exception as e:
            results["diagnostics"].append(f"Market state query exception: {str(e)}")

        try:
            contracts = self._get_active_mcl_contracts(ctx)
            results["step_4_mcl_contracts_found"] = contracts

            for c in contracts:
                code = c["code"]
                if "2609" in code or "26U" in code:
                    results["target_contracts_detected"]["september_2026"] = c
                elif "2610" in code or "26V" in code:
                    results["target_contracts_detected"]["october_2026"] = c
                elif "2611" in code or "26X" in code:
                    results["target_contracts_detected"]["november_2026"] = c

            if contracts:
                logger.info(f"[TEST] Step 4 PASS: Found {len(contracts)} MCL contracts")
            else:
                results["diagnostics"].append("No MCL contracts returned by get_fut_info. Account might lack CME Group / NYMEX LV2 market data permissions.")
        except Exception as e:
            results["diagnostics"].append(f"MCL contract lookup exception: {str(e)}")

        try:
            from moomoo import RET_OK
            if contracts:
                first_code = contracts[0]["code"]
                ret2, snap = ctx.get_market_snapshot([first_code])
                if ret2 == RET_OK and snap is not None and not snap.empty:
                    results["step_5_snapshot_data_received"] = True
                    row = snap.iloc[0]
                    results["step_4_mcl_contracts_found"][0]["last_price"] = float(row.get("last_price", 0))
                    results["step_4_mcl_contracts_found"][0]["volume"] = float(row.get("volume", 0))
                else:
                    results["diagnostics"].append(f"Snapshot returned empty or error: {snap}")
        except Exception as e:
            results["diagnostics"].append(f"Market snapshot exception: {str(e)}")

        results["overall_success"] = (
            results["step_1_opend_process_alive"] and
            results["step_2_sdk_connected"]
        )

        return results

    def _terminate_opend(self) -> None:
        if self._opend_process:
            try:
                self._opend_process.terminate()
                self._opend_process.wait(timeout=5)
            except Exception:
                try:
                    self._opend_process.kill()
                except Exception:
                    pass
            self._opend_process = None

    def _is_opend_alive(self) -> bool:
        return (
            self._opend_process is not None and
            self._opend_process.poll() is None
        )

    def _connect_sdk(self) -> None:
        try:
            from moomoo import OpenQuoteContext, RET_OK
            logger.info(f"[MOOMOO] Connecting SDK to OpenD at {OPEND_HOST}:{OPEND_PORT}...")
            ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT)

            ret, data = ctx.get_global_state()
            if ret != RET_OK:
                raise ConnectionError(f"SDK handshake failed: {data}")

            with self._lock:
                self._quote_ctx = ctx
                self._connected = True
                self._connection_status = "CONNECTED"

            logger.info("[MOOMOO] SDK connected successfully")
        except ImportError:
            self._connected = False
            self._connection_status = "SDK_NOT_INSTALLED"
            self._startup_error = "moomoo package not installed in current Python environment"
            logger.error(f"[MOOMOO] {self._startup_error}")
        except Exception as e:
            self._connected = False
            self._connection_status = "SDK_FAILED"
            self._startup_error = str(e)
            logger.error(f"[MOOMOO] SDK connection failed: {e}")

    def _close_sdk(self) -> None:
        with self._lock:
            if self._quote_ctx:
                try:
                    self._quote_ctx.close()
                except Exception:
                    pass
                self._quote_ctx = None
            self._connected = False

    def _start_watchdog(self) -> None:
        self._watchdog_thread = threading.Thread(
            target=self._watchdog_loop,
            daemon=True,
            name="MoomooWatchdog"
        )
        self._watchdog_thread.start()

    def _watchdog_loop(self) -> None:
        while self._running:
            time.sleep(WATCHDOG_INTERVAL_SECONDS)
            try:
                opend_alive = self._is_opend_alive()
                sdk_ok = self._connected and self._quote_ctx is not None

                account = os.environ.get("MOOMOO_LOGIN_ACCOUNT", "").strip()
                pwd = os.environ.get("MOOMOO_LOGIN_PASSWORD", "").strip()

                if not opend_alive and self._opend_process is not None:
                    logger.warning("[WATCHDOG] OpenD died — restarting...")
                    self._connection_status = "WATCHDOG_RESTARTING_OPEND"
                    self._close_sdk()
                    time.sleep(RECONNECT_DELAY_SECONDS)
                    self._configure_xml()
                    self._launch_opend(account, pwd)
                    time.sleep(OPEND_STARTUP_WAIT_SECONDS)
                    self._connect_sdk()
                    self._reconnect_count += 1
                    self._last_reconnect_time = time.time()
                elif not sdk_ok and opend_alive:
                    logger.warning("[WATCHDOG] SDK dropped — reconnecting SDK...")
                    self._connection_status = "WATCHDOG_RECONNECTING_SDK"
                    self._close_sdk()
                    time.sleep(RECONNECT_DELAY_SECONDS)
                    self._connect_sdk()
                    self._reconnect_count += 1
                    self._last_reconnect_time = time.time()
            except Exception as e:
                logger.error(f"[WATCHDOG] Loop error: {e}")

    def _get_active_mcl_contracts(self, ctx) -> list:
        import datetime
        from moomoo import RET_OK

        ret, data = ctx.get_fut_info(code_list=["NYMEX.MCL"])
        if ret != RET_OK or data is None or data.empty:
            return []

        today = datetime.date.today()
        current_month_start = today.replace(day=1)

        valid_contracts = []
        for _, row in data.iterrows():
            code = str(row.get("code", "")).strip()
            last_trade_time_str = str(row.get("last_trade_time", "")).strip()

            if not code or not last_trade_time_str or last_trade_time_str == "nan":
                continue

            try:
                expiry_date = datetime.datetime.strptime(last_trade_time_str[:10], "%Y-%m-%d").date()
                expiry_month_start = expiry_date.replace(day=1)

                if expiry_month_start >= current_month_start:
                    months_ahead = (
                        (expiry_month_start.year - current_month_start.year) * 12 +
                        (expiry_month_start.month - current_month_start.month)
                    )
                    valid_contracts.append({
                        "code": code,
                        "expiry": str(expiry_date),
                        "months_ahead": months_ahead,
                        "label": f"N+{months_ahead}" if months_ahead > 0 else "CURRENT",
                    })
            except Exception:
                continue

        valid_contracts.sort(key=lambda x: x["months_ahead"])
        return valid_contracts

moomoo_manager = MoomooConnectionManager()
