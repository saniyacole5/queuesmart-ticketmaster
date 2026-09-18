import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./AuthPage.css";

const initialForm = {
  email: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterPage() {
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

    if (!form.confirmPassword)
      nextErrors.confirmPassword = "Confirm your password.";
    else if (form.confirmPassword !== form.password)
      nextErrors.confirmPassword = "Passwords must match.";

    return nextErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // TODO (backend phase): send the registration data to the Node.js API.
    navigate("/login", { state: { registrationComplete: true } });
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="register-title">
        <div className="login-brand" aria-hidden="true">
          Q
        </div>
        <p className="login-eyebrow">QueueSmart TicketManager</p>
        <h1 id="register-title">Create your account</h1>
        <p className="login-intro">
          Register to join queues and receive status updates.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              name="email"
              type="email"
              required
              maxLength={254}
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? "register-email-error" : undefined
              }
              placeholder="name@example.com"
            />
            {errors.email && (
              <p className="field-error" id="register-email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "register-password-error" : undefined
              }
              placeholder="At least 8 characters"
            />
            {errors.password && (
              <p className="field-error" id="register-password-error">
                {errors.password}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword ? "confirm-password-error" : undefined
              }
              placeholder="Re-enter your password"
            />
            {errors.confirmPassword && (
              <p className="field-error" id="confirm-password-error">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button className="login-button" type="submit">
            Create account
          </button>
        </form>

        <p className="register-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
