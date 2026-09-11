import ScreenTemplate from "../components/ScreenTemplate";

export default function UserDashboardPage() {
  return (
    <ScreenTemplate
      title="User Dashboard"
      description="The user's overview after signing in."
      requirements={[
        "Show current queue status",
        "Show active services",
        "Show a notifications summary",
      ]}
    />
  );
}
