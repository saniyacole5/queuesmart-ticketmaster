import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./LoginPage.css";

const initialForm = { email: "", password: "" };

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function validateForm() {
    const nextErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.email.trim()) nextErrors.email = "Email is required.";
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

    // TODO (backend phase): replace this with a request to the Node.js login API.
    navigate("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">
          Q
        </div>
        <p className="login-eyebrow">QueueSmart TicketManager</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="login-intro">Sign in to manage your place in line.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              placeholder="name@example.com"
            />
            {errors.email && (
              <p className="field-error" id="email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              placeholder="At least 8 characters"
            />
            {errors.password && (
              <p className="field-error" id="password-error">
                {errors.password}
              </p>
            )}
          </div>

          <button className="login-button" type="submit">
            Sign in
          </button>
        </form>

        <p className="register-link">
          Need an account? <Link to="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}
