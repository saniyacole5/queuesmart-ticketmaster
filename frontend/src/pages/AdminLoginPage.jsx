import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mockUsers } from "../data/mockUsers";
import "./AuthPage.css";

const initialForm = { email: "", password: "" };

export default function AdminLoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "", form: "" }));
  }

  function validateForm() {
    const nextErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.email.trim()) nextErrors.email = "Administrator email is required.";
    else if (!emailPattern.test(form.email))
      nextErrors.email = "Enter a valid email address.";

    if (!form.password) nextErrors.password = "Password is required.";
    else if (form.password.length < 8)
      nextErrors.password = "Password must contain at least 8 characters.";

    return nextErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const administrator = mockUsers.find(
      (user) =>
        user.role === "admin" &&
        user.email.toLowerCase() === form.email.trim().toLowerCase() &&
        user.password === form.password,
    );

    if (!administrator) {
      setErrors({
        form: "Incorrect administrator email or password. Use the demo account below.",
      });
      return;
    }

    // TODO (backend phase): replace mockUsers with the Node.js admin login API.
    onLogin(administrator);
    navigate("/admin");
  }

  return (
    <main className="login-page admin-login-page">
      <section className="login-card" aria-labelledby="admin-login-title">
        <div className="login-brand admin-login-brand" aria-hidden="true">
          A
        </div>
        <p className="login-eyebrow">QueueSmart TicketManager</p>
        <h1 id="admin-login-title">Administrator login</h1>
        <p className="login-intro">
          Sign in to manage services and customer queues.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="admin-email">Administrator email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              maxLength={254}
              value={form.email}
              onChange={handleChange}
              autoComplete="username"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "admin-email-error" : undefined}
              placeholder="admin@example.com"
            />
            {errors.email && (
              <p className="field-error" id="admin-email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "admin-password-error" : undefined
              }
              placeholder="At least 8 characters"
            />
            {errors.password && (
              <p className="field-error" id="admin-password-error">
                {errors.password}
              </p>
            )}
          </div>

          {errors.form && (
            <p className="form-error-banner" role="alert">
              {errors.form}
            </p>
          )}

          <button className="login-button admin-login-button" type="submit">
            Sign in as administrator
          </button>
        </form>

        <aside className="demo-accounts" aria-labelledby="admin-demo-title">
          <h2 id="admin-demo-title">Demo administrator account</h2>
          <div className="demo-account">
            <strong>Administrator</strong>
            <span>admin@queuesmart.com</span>
            <span>Password: Admin1234</span>
          </div>
        </aside>

        <p className="alternate-login-link">
          Not an administrator? <Link to="/login">Return to user login</Link>
        </p>
      </section>
    </main>
  );
}
