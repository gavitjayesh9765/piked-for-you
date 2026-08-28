# Running the backend

> The API always runs from `backend/.venv`. If `WinError 10013` greets you, the
> port is taken — it is almost never a firewall.

---

## The normal way

```powershell
cd D:\Goal\Pickedforyou\backend
.\run.ps1
```

- API  -> http://127.0.0.1:8000
- Docs -> http://127.0.0.1:8000/docs

`run.ps1` pins `.venv`, reinstalls dependencies if the last install died partway
through, checks the port **before** binding so you get a readable message
instead of a socket error, and runs with `--reload` so edits apply live.

Logs stream to the terminal you started it in. Leave that window open.

Other flags:

```powershell
.\run.ps1 -Port 8001   # somewhere else
.\run.ps1 -Install     # (re)install dependencies first
```

---

## Running uvicorn directly

Equally valid — this is what `run.ps1` ends up calling:

```powershell
cd D:\Goal\Pickedforyou\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Two things that bite:

- It is **`app.main:app`**, never `main:app`. The latter fails with an import
  error even on a free port, which reads like a different problem entirely.
- Activate the venv first. A stray global-Python `uvicorn` will start, import a
  different set of packages, and diverge from what `run.ps1` gives you.

More detail in the output:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --log-level debug
```

---

## WinError 10013

```
ERROR: [WinError 10013] An attempt was made to access a socket in a way
       forbidden by its access permissions
```

On Linux a second bind to a live socket says *"address already in use"*. Windows
says this instead. **It means the port is busy.** It is not antivirus, not the
firewall, not a missing admin prompt.

Find the holder:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }
```

Stop it, or move out of its way:

```powershell
Stop-Process -Id <pid>
.\run.ps1 -Port 8001
```

To see the full command line of whatever is squatting — useful when the process
is just called `python.exe`:

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Select-Object ProcessId,ParentProcessId,CommandLine | Format-List
```

Kill the **parent** as well as the child. Under `--reload` uvicorn runs a
supervisor plus a worker, and killing only the worker gets you a fresh one.

### Ruling out the other cause

Windows genuinely does reserve port ranges, usually to Hyper-V or WSL, and those
also give 10013. Check before going hunting:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

On this machine the exclusions are 5985, 47001 and 50000-50059. Port 8000 is
clear, so a 10013 on 8000 here is always a live process.

---

## Where the logs went

If the server is running but no window is showing logs, something started it
detached with its output redirected. An agent session is the usual culprit:

```
python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > .../scratchpad/api.log 2>&1
```

Every request and SQL statement lands in that file instead of a terminal, and
the port stays held after you have forgotten it exists. The `CommandLine` query
above reveals the redirect target if you want to read the backlog.

**Start the server yourself when you want to watch logs.** Anything launched on
your behalf by an agent runs in the background with its output captured to a
temp file you will not think to open.
