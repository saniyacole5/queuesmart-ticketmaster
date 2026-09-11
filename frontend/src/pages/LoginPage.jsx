import ScreenTemplate from "../components/ScreenTemplate";

export default function LoginPage() {
  return (
    <ScreenTemplate
      title="Login"
      description="Authentication screen for returning users and administrators."
      requirements={[
        "Add an email input with email validation",
        "Add a required password input",
        "Add a submit button and validation messages",
        "Add a link to the registration screen",
      ]}
    />
  );
}
