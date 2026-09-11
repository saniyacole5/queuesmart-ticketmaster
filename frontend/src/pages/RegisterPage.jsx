import ScreenTemplate from "../components/ScreenTemplate";

export default function RegisterPage() {
  return (
    <ScreenTemplate
      title="Registration"
      description="Account-creation screen for new users."
      requirements={[
        "Add an email input used as the username",
        "Add required password and confirmation inputs",
        "Add client-side validation and error messages",
        "Add a link back to login",
      ]}
    />
  );
}
