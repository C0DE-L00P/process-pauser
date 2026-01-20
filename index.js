const { execSync } = require("child_process");
const ntsuspend = require("ntsuspend");

/**
 * Finds the PID of a process listening on a specific port (Windows)
 * @param {number} port
 * @returns {number|null} PID
 */
function getPidByPort(port) {
  try {
    // Run netstat and find the line containing the port
    const output = execSync(`netstat -ano | findstr :${port}`).toString();

    // Typical output: TCP 0.0.0.0:8080 0.0.0.0:0 LISTENING 1234
    const lines = output.trim().split("\n");
    if (lines.length > 0) {
      // Get the last column (PID) of the first matching line
      const parts = lines[0].trim().split(/\s+/);
      return parseInt(parts[parts.length - 1], 10);
    }
  } catch (e) {
    console.error(`No process found on port ${port}`);
  }
  return null;
}

/**
 * Pause or Resume a process by its port
 */
async function controlProcessByPort(port, action) {
  const pid = getPidByPort(port);

  if (!pid) {
    console.log(`Error: Could not find PID for port ${port}`);
    return;
  }

  console.log(`Found PID ${pid} on port ${port}. Action: ${action}`);

  if (action === "pause") {
    const success = ntsuspend.suspend(pid);
    console.log(success ? "Process Paused." : "Failed to pause.");
  } else if (action === "resume") {
    const success = ntsuspend.resume(pid);
    console.log(success ? "Process Resumed." : "Failed to resume.");
  }
}

// --- Usage Examples ---
// controlProcessByPort(3000, "pause");
controlProcessByPort(3000, "resume");
