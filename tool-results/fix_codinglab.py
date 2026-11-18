import pathlib

P = pathlib.Path('/home/z/my-project/src/components/lumio/games/CodingLab.tsx')
s = P.read_text()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f"anchor found {n} times (expected {count}): {old[:80]!r}"
    s = s.replace(old, new)


# R1: restore PY constants, drop the stray duplicated harness header
rep(
    "const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';\n"
    "// ---------------------------------------------------------------------------\n"
    "// Python harness (runs inside Pyodide on the main thread). The learner's code\n"
    "// is executed first so it defines the function, then this harness calls it\n"
    "// once per test, compares with ==, and returns a JSON string we parse here.\n"
    "// ---------------------------------------------------------------------------\n\n"
    "/**",
    "const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';\n"
    "const PY_TIMEOUT_MS = 3000;\n\n"
    "const PY_FAIL_MESSAGE =\n"
    "  'Python needs to download its runtime (Pyodide) once — it looks like this device is offline right now.';\n"
    "const PY_TIMEOUT_MESSAGE =\n"
    "  'Your Python code took longer than 3 seconds — check for a very slow or infinite loop.';\n\n"
    "/**",
)

# R2: remove the Web Worker request/response interfaces
rep(
    "/** Parent -> worker payload. */\n"
    "interface WorkerRequest {\n"
    "  code: string;\n"
    "  /** Exercise id — used as a fallback lookup name for the defined function. */\n"
    "  fnName: string;\n"
    "  tests: Array<[unknown[], unknown]>;\n"
    "}\n\n"
    "/** Worker -> parent payload. */\n"
    "interface WorkerResponse {\n"
    "  results: TestResult[];\n"
    "  durationMs: number;\n"
    "}\n\n"
    "/** Minimal Pyodide surface",
    "/** Minimal Pyodide surface",
)

# R3: remove the whole WORKER_SOURCE block (header comment through backtick close)
start = s.index("// ---------------------------------------------------------------------------\n// Web Worker source")
end = s.index("// ---------------------------------------------------------------------------\n// Python harness", start)
s = s[:start] + s[end:]

# R4: remove isWorkerResponse narrowing helper
rep(
    "function isWorkerResponse(v: unknown): v is WorkerResponse {\n"
    "  if (typeof v !== 'object' || v === null) return false;\n"
    "  const o = v as Record<string, unknown>;\n"
    "  return (\n"
    "    Array.isArray(o.results) &&\n"
    "    o.results.every(isTestResult) &&\n"
    "    typeof o.durationMs === 'number'\n"
    "  );\n"
    "}\n\n",
    "",
)

# R5: drop worker/js timer refs
rep(
    "  // ---- refs for cleanup ----\n"
    "  const workerRef = useRef<Worker | null>(null);\n"
    "  const jsTimerRef = useRef<number | null>(null);\n"
    "  const pyTimerRef = useRef<number | null>(null);",
    "  // ---- refs for cleanup ----\n"
    "  const pyTimerRef = useRef<number | null>(null);",
)

# R6: simplify unmount cleanup
rep(
    "  // Unmount cleanup: terminate any live worker and clear every timer.\n"
    "  useEffect(() => {\n"
    "    return () => {\n"
    "      pyUnmountedRef.current = true;\n"
    "      if (workerRef.current) {\n"
    "        workerRef.current.terminate();\n"
    "        workerRef.current = null;\n"
    "      }\n"
    "      if (jsTimerRef.current !== null) window.clearTimeout(jsTimerRef.current);\n"
    "      if (pyTimerRef.current !== null) window.clearTimeout(pyTimerRef.current);\n"
    "    };\n"
    "  }, []);",
    "  // Unmount cleanup: clear every timer.\n"
    "  useEffect(() => {\n"
    "    return () => {\n"
    "      pyUnmountedRef.current = true;\n"
    "      if (pyTimerRef.current !== null) window.clearTimeout(pyTimerRef.current);\n"
    "    };\n"
    "  }, []);",
)

# R7: remove runJsTests entirely
start = s.index("  function runJsTests() {")
end = s.index("  async function runPythonTests() {")
s = s[:start] + s[end:]

# R8: runTests now always runs Python
rep(
    "  function runTests() {\n"
    "    if (isPython) void runPythonTests();\n"
    "    else runJsTests();\n"
    "  }",
    "  function runTests() {\n"
    "    void runPythonTests();\n"
    "  }",
)

# R9: GameShell blurb + model note
rep(
    '      blurb="Write real JavaScript or Python, run it against automated tests, and fix the bugs. Debug exercises come with a hint ladder."\n'
    '      modelNote="JavaScript runs in an isolated Web Worker (2-second limit). Python runs locally via Pyodide (WebAssembly) and needs internet the first time only. No code ever leaves this device."',
    '      blurb="Write real Python, run it against automated tests, and fix the bugs. Debug exercises come with a hint ladder."\n'
    '      modelNote="Python runs locally via Pyodide (WebAssembly) and needs internet the first time only. No code ever leaves this device."',
)

# R10: exercise chip badge is always Python
rep(
    "                <span\n"
    "                  className={cn(\n"
    "                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase',\n"
    "                    e.lang === 'py'\n"
    "                      ? 'bg-emerald-500/15 text-emerald-700'\n"
    "                      : 'bg-muted text-muted-foreground'\n"
    "                  )}\n"
    "                >\n"
    "                  {e.lang === 'py' ? 'Py' : 'JS'}\n"
    "                </span>",
    "                <span className=\"rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700\">\n"
    "                  Py\n"
    "                </span>",
)

# R11: results footer is always Python
rep(
    "                <p className=\"mt-2 text-xs text-muted-foreground\">\n"
    "                  {isPython\n"
    "                    ? 'Ran in local Python (Pyodide, WebAssembly).'\n"
    "                    : `Ran in the Web Worker in ${Math.max(0, run.durationMs)} ms.`}\n"
    "                </p>",
    "                <p className=\"mt-2 text-xs text-muted-foreground\">\n"
    "                  Ran in local Python (Pyodide, WebAssembly).\n"
    "                </p>",
)

# R12: Pyodide loading note no longer mentions JavaScript fallback
rep(
    "                      Downloading the Python runtime (Pyodide, about 10 MB, one\n"
    "                      time only). JavaScript exercises work meanwhile.\n",
    "                      Downloading the Python runtime (Pyodide, about 10 MB, one\n"
    "                      time only).\n",
)

# R13: comments no longer reference the worker
rep(
    "// Types (no `any` anywhere; worker messages are unknown until narrowed)",
    "// Types (no `any` anywhere; harness output is unknown until narrowed)",
)
rep(
    "/** One per-test outcome, exactly what the worker / Python harness returns. */",
    "/** One per-test outcome, exactly what the Python harness returns. */",
)

P.write_text(s)
print("OK — all replacements applied")
