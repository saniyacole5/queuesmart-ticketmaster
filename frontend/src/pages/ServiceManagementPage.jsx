import ScreenTemplate from "../components/ScreenTemplate";

export default function ServiceManagementPage() {
  return (
    <ScreenTemplate
      title="Service Management"
      description="Allow administrators to create and edit services."
      requirements={[
        "Service name: required, maximum 100 characters",
        "Description: required",
        "Expected duration: required numeric input",
        "Priority: low, medium, or high",
      ]}
    />
  );
}
