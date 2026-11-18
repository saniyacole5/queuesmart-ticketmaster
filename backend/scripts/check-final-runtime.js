// Member work area - Integration and persistence.
const base = (process.env.DEMO_API_URL || "http://127.0.0.1:3001/api").replace(/\/$/, "");

try {
  const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Health endpoint returned HTTP ${response.status}.`);
  const { data } = await response.json();
  const modes = ["authStorage", "servicesStorage", "queueStorage", "activityStorage"];
  if (data.storage !== "mysql" || modes.some(mode => data[mode] !== "mysql")) {
    throw new Error("Start the backend with all four storage settings set to mysql.");
  }
  console.log("The running backend reports MySQL for authentication, services, queues, and activity.");
  // TODO(INTEGRATION-1) Pair this configuration check with db:check and the
  // capture/restart/verify workflow. /health alone cannot prove durable data.
} catch (error) {
  console.error("Final runtime check failed.", error.message);
  process.exitCode = 1;
}
