import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { useQueues } from "../context/QueueContext";
import { useNotifications } from "../context/NotificationContext";

const blank = {
  name: "",
  description: "",
  duration: "",
  priority: "medium",
};

// Field limits are declared once so the inputs and the validation agree.
const limits = {
  nameMax: 100,
  descriptionMax: 500,
  durationMin: 1,
  durationMax: 480,
};

function validateService(form) {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = "Service name is required.";
  } else if (form.name.trim().length > limits.nameMax) {
    errors.name = `Service name must be ${limits.nameMax} characters or fewer.`;
  }

  if (!form.description.trim()) {
    errors.description = "Description is required.";
  } else if (form.description.trim().length > limits.descriptionMax) {
    errors.description = `Description must be ${limits.descriptionMax} characters or fewer.`;
  }

  if (!form.duration.trim()) {
    errors.duration = "Expected duration is required.";
  } else if (!/^\d+$/.test(form.duration.trim())) {
    errors.duration = "Enter whole minutes using digits only.";
  } else {
    const minutes = Number(form.duration);

    if (minutes < limits.durationMin || minutes > limits.durationMax) {
      errors.duration = `Enter between ${limits.durationMin} and ${limits.durationMax} minutes.`;
    }
  }

  if (!["low", "medium", "high"].includes(form.priority)) {
    errors.priority = "Choose a valid priority.";
  }

  return errors;
}

export default function ServiceManagementPage() {
  const { services: items, saveService } = useQueues();
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const { notify } = useNotifications();

  function edit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      duration: String(item.estimatedWait),
      priority: item.priority,
    });
    setErrors({});
    setSubmitted(false);
  }

  // After a failed submit, re-check as the admin types so errors clear
  // as soon as each field is fixed.
  function update(field, value) {
    const nextForm = { ...form, [field]: value };

    setForm(nextForm);

    if (submitted) {
      setErrors(validateService(nextForm));
    }
  }

  function save(event) {
    event.preventDefault();

    const next = validateService(form);

    setSubmitted(true);
    setErrors(next);
    if (Object.keys(next).length) return;

    const existing = items.find((item) => item.id === editingId);

    const saved = {
      id: editingId ?? Date.now(),
      name: form.name.trim(),
      description: form.description.trim(),
      estimatedWait: Number(form.duration),
      priority: form.priority,
      isOpen: existing?.isOpen ?? true,
    };

    saveService(saved);

    notify(
      `Service "${saved.name}" ${
        editingId === null ? "created" : "updated"
      } in this demo.`,
      "success"
    );

    setEditingId(null);
    setForm(blank);
    setSubmitted(false);
  }

  return (
    <>
      <PageHeader
        title="Service Management"
        description="Create or edit services for this front-end demo."
      />

      <section className="panel form-panel">
        <h2>{editingId === null ? "Create service" : "Edit service"}</h2>

        <form onSubmit={save} noValidate>
          <label htmlFor="service-name">
            Service name
            <input
              id="service-name"
              type="text"
              value={form.name}
              maxLength={limits.nameMax}
              required
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name ? "name-error" : "name-count"
              }
            />
          </label>
          <p id="name-count" className="field-hint">
            {form.name.length} / {limits.nameMax} characters
          </p>
          {errors.name && (
            <p id="name-error" className="field-error">
              {errors.name}
            </p>
          )}

          <label htmlFor="service-description">
            Description
            <textarea
              id="service-description"
              value={form.description}
              maxLength={limits.descriptionMax}
              required
              onChange={(event) =>
                update("description", event.target.value)
              }
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description
                  ? "description-error"
                  : "description-count"
              }
            />
          </label>
          <p id="description-count" className="field-hint">
            {form.description.length} / {limits.descriptionMax} characters
          </p>
          {errors.description && (
            <p id="description-error" className="field-error">
              {errors.description}
            </p>
          )}

          <label htmlFor="service-duration">
            Expected duration (minutes)
            <input
              id="service-duration"
              type="number"
              inputMode="numeric"
              min={limits.durationMin}
              max={limits.durationMax}
              step="1"
              required
              value={form.duration}
              onChange={(event) => update("duration", event.target.value)}
              aria-invalid={Boolean(errors.duration)}
              aria-describedby={
                errors.duration ? "duration-error" : "duration-hint"
              }
            />
          </label>
          <p id="duration-hint" className="field-hint">
            Whole minutes, {limits.durationMin}–{limits.durationMax}.
          </p>
          {errors.duration && (
            <p id="duration-error" className="field-error">
              {errors.duration}
            </p>
          )}

          <label htmlFor="service-priority">
            Priority
            <select
              id="service-priority"
              value={form.priority}
              required
              onChange={(event) => update("priority", event.target.value)}
              aria-invalid={Boolean(errors.priority)}
              aria-describedby={
                errors.priority ? "priority-error" : undefined
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          {errors.priority && (
            <p id="priority-error" className="field-error">
              {errors.priority}
            </p>
          )}

          <button type="submit" className="primary">
            {editingId === null
              ? "Create service"
              : "Save changes"}
          </button>

          {editingId !== null && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setEditingId(null);
                setForm(blank);
                setErrors({});
              }}
            >
              Cancel edit
            </button>
          )}
        </form>
      </section>

      <section className="panel">
        <h2>Services</h2>
        {items.map((item) => (
          <div className="service-row" key={item.id}>
            <strong>{item.name}</strong>
            <p>{item.description}</p>
            <p>
              {item.estimatedWait} minutes · {item.priority} priority
            </p>
            <button type="button" onClick={() => edit(item)}>
              Edit {item.name}
            </button>
          </div>
        ))}
      </section>
    </>
  );
}