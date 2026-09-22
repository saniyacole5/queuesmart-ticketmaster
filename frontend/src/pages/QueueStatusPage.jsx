import { useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { currentQueue } from "../data/mockData";
import { useNotifications } from "../context/NotificationContext";

export default function QueueStatusPage() {
  const [stage, setStage] = useState(0);
  const { notify } = useNotifications();

  const states = ["Waiting", "Almost Ready", "Served"];
  const position =
    stage === 0 ? currentQueue.position : stage === 1 ? 1 : 0;

  function advance() {
    if (stage >= 2) return;

    const next = stage + 1;
    setStage(next);

    notify(
      `Queue status changed to ${states[next]} for ${currentQueue.serviceName}.`,
      "info"
    );
  }

  return (
    <>
      <PageHeader
        title="Queue Status"
        description="Track your current position and estimated wait time."
      />

      <section className="status-card">
        <p className="eyebrow">{currentQueue.serviceName}</p>

        <h2>Your Position</h2>
        <strong className="position">
          {position === 0 ? "Ready" : `#${position}`}
        </strong>

        <p>
          Estimated Wait Time:{" "}
          <strong>
            {stage === 0
              ? currentQueue.estimatedWait
              : stage === 1
                ? 2
                : 0}{" "}
            minutes
          </strong>
        </p>

        <StatusBadge>{states[stage]}</StatusBadge>

        <div className="progress">
          <span></span>
        </div>

        <div className="step-row">
          <span>Joined</span>
          <span>Waiting</span>
          <span>Almost Ready</span>
          <span>Served</span>
        </div>

        <p>
          There are {Math.max(0, position - 1)} customers ahead of you.
        </p>

        <button
          className="primary"
          type="button"
          onClick={advance}
          disabled={stage === 2}
        >
          Simulate next status update
        </button>
      </section>
    </>
  );
}