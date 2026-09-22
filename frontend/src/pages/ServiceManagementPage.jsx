import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { services as initialServices } from "../data/mockData";
import { useNotifications } from "../context/NotificationContext";

const blank = {
  name: "",
  description: "",
  duration: "",
  priority: "medium",
};

export default function ServiceManagementPage() {
  const [items, setItems] = useState(
    initialServices.map((service) => ({
      ...service,
      duration: String(service.estimatedWait),
      priority: "medium",
    }))
  );
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const { notify } = useNotifications();

  function edit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      duration: item.duration,
      priority: item.priority,
    });
    setErrors({});
  }

  function save(event) {
    event.preventDefault();
    const next = {};

    if (!form.name.trim()) {
      next.name = "Service name is required.";
    } else if (form.name.trim().length > 100) {
      next.name = "Service name must be 100 characters or fewer.";
    }

    if (!form.description.trim()) {
      next.description = "Description is required.";
    }

    if (!form.duration) {
      next.duration = "Expected duration is required.";
    } else if (
      !/^\d+$/.test(form.duration) ||
      Number(form.duration) < 1
    ) {
      next.duration =
        "Enter a whole number of minutes greater than zero.";
    }

    if (!["low", "medium", "high"].includes(form.priority)) {
      next.priority = "Choose a valid priority.";
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    const saved = {
      id: editingId ?? Date.now(),
      name: form.name.trim(),
      description: form.description.trim(),
      duration: form.duration,
      estimatedWait: Number(form.duration),
      priority: form.priority,
    };

    setItems((current) =>
      editingId === null
        ? [...current, saved]
        : current.map((item) =>
            item.id === editingId ? saved : item
          )
    );

    notify(
      `Service "${saved.name}" ${
        editingId === null ? "created" : "updated"
      } in this demo.`,
      "success"
    );

    setEditingId(null);
    setForm(blank);
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
              value={form.name}
              maxLength={101}
              required
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name ? "name-error" : undefined
              }
            />
          </label>
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
              required
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description
                  ? "description-error"
                  : undefined
              }
            />
          </label>
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
              min="1"
              step="1"
              required
              value={form.duration}
              onChange={(event) =>
                setForm({ ...form, duration: event.target.value })
              }
              aria-invalid={Boolean(errors.duration)}
              aria-describedby={
                errors.duration ? "duration-error" : undefined
              }
            />
          </label>
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
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

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
          <div className="notification-item" key={item.id}>
            <strong>{item.name}</strong>
            <p>{item.description}</p>
            <p>
              {item.duration} minutes · {item.priority} priority
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