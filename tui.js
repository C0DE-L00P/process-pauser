const { execSync } = require("child_process");
const ntsuspend = require("ntsuspend");
const blessed = require("neo-blessed");

// --- State Management ---
// Since the OS doesn't easily report "Suspended" status,
// we track it locally in this session.
const statusMap = new Map();

function getListeningPorts() {
  try {
    const output = execSync(`netstat -ano | findstr LISTENING`).toString();
    const lines = output.trim().split("\n");

    return lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const address = parts[1];
        const port = address.split(":").pop();
        const pid = parts[parts.length - 1];
        return { port, pid };
      })
      .filter((v, i, a) => a.findIndex((t) => t.port === v.port) === i);
  } catch (e) {
    return [];
  }
}

// --- UI Setup ---

const screen = blessed.screen({
  smartCSR: true,
  title: "Process Pauser TUI",
});

const list = blessed.list({
  parent: screen,
  width: "60%", // Slightly wider to fit status text
  height: "70%",
  top: "center",
  left: "center",
  border: { type: "line" },
  label: " {bold}Listening Ports{/bold} ",
  tags: true, // IMPORTANT: Allows the {yellow-fg} tags to work
  style: {
    selected: { bg: "blue", fg: "white" },
    item: { hover: { bg: "grey" } },
  },
  keys: true,
  mouse: true,
  scrollbar: { ch: " ", track: { bg: "cyan" }, style: { inverse: true } },
});

const log = blessed.log({
  parent: screen,
  bottom: 0,
  left: 0,
  width: "100%",
  height: "25%",
  border: { type: "line" },
  label: " Status Log ",
});

const help = blessed.text({
  parent: screen,
  top: 0,
  left: "center",
  content:
    " {bold}P{/bold}: Pause | {bold}R{/bold}: Resume | {bold}Q{/bold}: Quit ",
  tags: true,
});

// --- UI Actions ---

function refreshList() {
  const processes = getListeningPorts();
  list.processes = processes;

  const items = processes.map((p) => {
    const isPaused = statusMap.get(p.pid) === "paused";
    const statusText = isPaused ? "[PAUSED]" : "[RUNNING]";
    const content = `Port: ${p.port.padEnd(8)} | PID: ${p.pid.padEnd(6)} | ${statusText}`;

    // Wrap in yellow tags if paused
    return isPaused ? `{yellow-fg}${content}{/yellow-fg}` : content;
  });

  list.setItems(items);
  screen.render();
}

function handleAction(action) {
  const selectedIndex = list.selected;
  const proc = list.processes[selectedIndex];

  if (!proc) return;

  const pid = parseInt(proc.pid, 10);
  let success = false;

  if (action === "pause") {
    success = ntsuspend.suspend(pid);
    if (success) {
      statusMap.set(proc.pid, "paused");
      log.log(
        `{yellow-fg}[PAUSE]{/yellow-fg} Port ${proc.port} (PID ${pid}) suspended.`,
      );
    } else {
      log.log(`{red-fg}[ERROR]{/red-fg} Could not pause PID ${pid}`);
    }
  } else if (action === "resume") {
    success = ntsuspend.resume(pid);
    if (success) {
      statusMap.set(proc.pid, "running");
      log.log(
        `{green-fg}[RESUME]{/green-fg} Port ${proc.port} (PID ${pid}) resumed.`,
      );
    } else {
      log.log(`{red-fg}[ERROR]{/red-fg} Could not resume PID ${pid}`);
    }
  }

  // Refresh the UI to reflect color and status changes
  refreshList();
}

// Keybindings
screen.key(["q", "C-c"], () => process.exit(0));
screen.key(["p"], () => handleAction("pause"));
screen.key(["r"], () => handleAction("resume"));

// Initial Load
refreshList();
log.log("TUI Started. Use Arrow Keys to select, P to pause, R to resume.");
