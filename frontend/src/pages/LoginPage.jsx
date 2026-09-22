import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { mockUsers } from "../data/mockUsers";
import "./AuthPage.css";

const initialForm = {
  email: "",
  password: "",
};

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
      form: "",
    }));
  }

  function validateForm() {
    const nextErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailPattern.test(form.email)) {
      nextErrors.email = "Enter a valid email address.";
    } else if (form.email.length > 254) {
      nextErrors.email = "Email must be 254 characters or fewer.";
    }

    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 8) {
      nextErrors.password =
        "Password must contain at least 8 characters.";
    } else if (form.password.length > 128) {
      nextErrors.password =
        "Password must be 128 characters or fewer.";
    }

    return nextErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const account = mockUsers.find(
      (user) =>
        user.role === "user" &&
        user.email.toLowerCase() ===
          form.email.trim().toLowerCase() &&
        user.password === form.password
    );

    if (!account) {
      setErrors({
        form:
          "Incorrect email or password. Try one of the demo accounts below.",
      });

      return;
    }

    // TODO (backend phase): replace mockUsers with the Node.js login API.
    onLogin(account);
    navigate("/dashboard");
  }

  return (
    <main className="login-page">
      <section
        className="login-card"
        aria-labelledby="login-title"
      >
        <div className="login-brand" aria-hidden="true">
          Q
        </div>

        <p className="login-eyebrow">
          QueueSmart TicketManager
        </p>

        <h1 id="login-title">Welcome back</h1>

        <p className="login-intro">
          Sign in to manage your place in line.
        </p>

        {location.state?.registrationComplete && (
          <p className="success-banner" role="status">
            Account created successfully. You can now sign in.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email</label>

            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? "email-error" : undefined
              }
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
              required
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password
                  ? "password-error"
                  : undefined
              }
              placeholder="At least 8 characters"
            />

            {errors.password && (
              <p
                className="field-error"
                id="password-error"
              >
                {errors.password}
              </p>
            )}
          </div>

          {errors.form && (
            <p className="form-error-banner" role="alert">
              {errors.form}
            </p>
          )}

          <button className="login-button" type="submit">
            Sign in
          </button>
        </form>

        <aside
          className="demo-accounts"
          aria-labelledby="demo-accounts-title"
        >
          <h2 id="demo-accounts-title">
            Demo user account
          </h2>

          <div className="demo-account">
            <strong>User</strong>
            <span>user@queuesmart.com</span>
            <span>Password: User1234</span>
          </div>
        </aside>

        <p className="register-link">
          Need an account?{" "}
          <Link to="/register">Register</Link>
        </p>

        <p className="alternate-login-link">
          QueueSmart staff?{" "}
          <Link to="/admin/login">
            Administrator login
          </Link>
        </p>
      </section>
    </main>
  );
}